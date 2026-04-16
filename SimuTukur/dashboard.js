// dashboard.js - Lógica del Panel de Control y Pagos de Energía

async function inicializarDashboard() {
    const email = localStorage.getItem('session_email');
    if (!email) { window.location.href = 'index.html'; return; }
    
    // 🛑 INTERCEPTOR DE PAGOS DE ENERGÍA
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('pago') === 'exito') {
        const tokensAComprar = parseInt(urlParams.get('items'));
        if(tokensAComprar > 0) {
            let creditosActuales = parseInt(localStorage.getItem('simu_creditos')) || 0;
            const nuevosCreditos = creditosActuales + tokensAComprar;
            
            // Actualizamos Local y BD
            localStorage.setItem('simu_creditos', nuevosCreditos);
            await guardarCreditosEnBD(nuevosCreditos);
            actualizarDisplayCreditos();
            
            // Notificamos al usuario
            alert(`✅ ¡Recarga Exitosa! Se han añadido ${tokensAComprar} tokens a tu cuenta.`);
            // Limpiamos la URL para que no se sumen tokens si refresca la página
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    actualizarDisplayCreditos();

    try {
        const { data: suscripciones, error } = await _supabase
            .from('usuarios_membresias')
            .select('*, config_examenes(*)')
            .eq('email', email);

        if (error || !suscripciones || suscripciones.length === 0) {
            document.getElementById('pestanas-cursos').innerHTML = "<p class='text-sm text-red-500 font-bold uppercase'>Error de vinculación.</p>";
            return;
        }

        const contenedorTabs = document.getElementById('pestanas-cursos');
        contenedorTabs.innerHTML = "";
        
        const cursoPrevio = localStorage.getItem('plan_institucion');
        let indexSeleccionado = 0;

        suscripciones.forEach((s, index) => {
            const nombreTab = s.config_examenes.area ? `${s.config_examenes.institucion} ${s.config_examenes.area}` : s.config_examenes.institucion;
            if (s.config_examenes.institucion === cursoPrevio) indexSeleccionado = index;

            const btn = document.createElement('button');
            btn.className = `btn-tab px-6 py-3 rounded-full text-xs font-black uppercase whitespace-nowrap`;
            btn.innerText = nombreTab;
            btn.onclick = () => seleccionarCurso(s, btn);
            contenedorTabs.appendChild(btn);
            
            if (index === indexSeleccionado) seleccionarCurso(s, btn);
        });
    } catch (err) { console.error(err); }
}

async function seleccionarCurso(data, btn) {
    document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const conf = data.config_examenes; 
    const nombrePlan = conf.area ? `${conf.institucion} ${conf.area}` : conf.institucion;

    document.getElementById('saludo-alumno').innerHTML = `Hola, <span class="color-cian italic">${data.nombre_alumno}</span>`;
    document.getElementById('plan-actual-container').innerHTML = `<p class="text-[10px] uppercase font-bold text-gray-500 italic tracking-widest leading-none">Plan Activo: <span class="text-white">${nombrePlan}</span></p>`;
    
    const esPro = data.config_examenes.plan === 'PRO';
    localStorage.setItem('nombre_alumno', data.nombre_alumno);
    localStorage.setItem('token_hex_hijo', data.token_hex);
    localStorage.setItem('plan_institucion', conf.institucion);
    localStorage.setItem('plan_area', conf.area);               
    localStorage.setItem('plan_nombre_completo', nombrePlan);   
    localStorage.setItem('es_pro', esPro);

    localStorage.setItem('simu_creditos', data.intentos_simulacro_restantes || 0);
    actualizarDisplayCreditos();

    setTimeout(() => { cargarHistorial(data.token_hex); }, 800);

    const emailPadre = localStorage.getItem('session_email');
    const { data: historialBD } = await _supabase.from('resultados_examenes')
    .select('puntaje_obtenido')
    .eq('token_hex', data.token_hex)
    .eq('tipo_prueba', nombrePlan)
    .eq('email', emailPadre)               // CANDADO 1
    .eq('nombre_alumno', data.nombre_alumno) // CANDADO 2
    .order('fecha_aplicacion', { ascending: false })
    .limit(1);
    //const { data: historialBD } = await _supabase.from('resultados_examenes').select('puntaje_obtenido').eq('token_hex', data.token_hex).eq('tipo_prueba', nombrePlan).order('fecha_aplicacion', { ascending: false }).limit(1);
    const ultimoPuntajeBD = (historialBD && historialBD.length > 0) ? historialBD[0].puntaje_obtenido : null;
    const params = new URLSearchParams(window.location.search);
    const puntajeReciente = params.get('res');
    const puntajeFinal = puntajeReciente ? parseInt(puntajeReciente) : (ultimoPuntajeBD !== null ? ultimoPuntajeBD : 100);
    const palabraBusqueda = conf.institucion.includes('ECOEMS') ? 'ECOEMS' : nombrePlan;
    
    cargarNiveles(palabraBusqueda, puntajeFinal);
    cargarHistorialChat(data.token_hex, puntajeFinal, puntajeReciente ? "reciente" : "historico");
}

// ==========================================
// LÓGICA DE COMPRA DE ENERGÍA REAL (STRIPE)
// ==========================================

function abrirModalEnergia() { document.getElementById('modalEnergia').classList.remove('hidden'); }
function cerrarModalEnergia() { document.getElementById('modalEnergia').classList.add('hidden'); }

async function comprarPaquete(tokens, precio) {
    const email = localStorage.getItem('session_email');
    const nombre = localStorage.getItem('nombre_alumno');
    const ref = `RECARGA-${Date.now()}`;

    // Desactivamos el modal mientras procesa
    document.getElementById('modalEnergia').classList.add('opacity-50', 'pointer-events-none');

    try {
        const { data, error } = await _supabase.functions.invoke('stripe-checkout', {
            body: {
                nombre_alumno: nombre,
                correo: email,
                tipo_examen: `Recarga ${tokens} Tokens IA`,
                referencia_pago: ref,
                precio: precio,
                es_recarga: true,  // <--- LE AVISAMOS A LA NUBE QUE ES UNA RECARGA
                tokens: tokens     // <--- LE MANDAMOS LA CANTIDAD
            }
        });

        if (error) throw error;
        
        if (data && data.url) {
            window.location.href = data.url; 
        }
    } catch (err) {
        console.error(err);
        alert("Error al conectar con el banco. Intenta más tarde.");
        document.getElementById('modalEnergia').classList.remove('opacity-50', 'pointer-events-none');
    }
}

// ==========================================
// IA Y TOKENS (Sincronizado)
// ==========================================

function actualizarDisplayCreditos() { 
    const disp = document.getElementById('creditos-display');
    if(disp) disp.innerText = parseInt(localStorage.getItem('simu_creditos')) || 0; 
}

async function guardarCreditosEnBD(creditosNuevos) {
    const email = localStorage.getItem('session_email');
    const token = localStorage.getItem('token_hex_hijo');
    if (_supabase && email && token) {
        await _supabase.from('usuarios_membresias').update({ intentos_simulacro_restantes: creditosNuevos }).eq('email', email).eq('token_hex', token);
    }
}

// ==========================================
// MOTOR DE CHAT CON MATHJAX
// ==========================================

function dibujarBurbujaChat(emisor, texto) {
    const chatBox = document.getElementById('chat-box');
    const div = document.createElement('div');
    const textoFormat = texto.replace(/\*\*(.*?)\*\*/g, '<strong class="color-cian">$1</strong>');
    
    if (emisor === 'alumno') {
        div.className = "flex justify-end mb-3";
        div.innerHTML = `<div class="bg-cyan-900/40 p-3 rounded-xl rounded-tr-none border border-cyan-500/30 text-white max-w-[85%] shadow-sm text-sm"><p class="leading-relaxed">${textoFormat}</p></div>`;
    } else {
        div.className = "mb-3";
        div.innerHTML = `<div class="bg-gray-800/60 p-4 rounded-xl rounded-tl-none border border-white/5 max-w-[85%] shadow-sm text-sm text-gray-200"><strong class="color-cian font-black italic text-[10px] uppercase flex items-center gap-2 mb-1"><i class="fa-solid fa-brain"></i> Tutor Simu</strong><p class="leading-relaxed">${textoFormat}</p></div>`;
    }
    
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;

    // 🚀 ACTIVAMOS MATHJAX PARA ESTA BURBUJA
    if (window.MathJax) { window.MathJax.typesetPromise([div]); }
}

async function cargarHistorial(token) {
    const contenedor = document.getElementById('contenedor-historial');
    const emailPadre = localStorage.getItem('session_email');
    const nombreAlumno = localStorage.getItem('nombre_alumno'); // Lo guardaste en seleccionarCurso

    try {
        const { data, error } = await _supabase.from('resultados_examenes')
            .select('tipo_prueba, fecha_aplicacion, puntaje_obtenido')
            .eq('token_hex', token)
            .eq('email', emailPadre)           // CANDADO 1
            .eq('nombre_alumno', nombreAlumno) // CANDADO 2
            .order('fecha_aplicacion', { ascending: false });

/*async function cargarHistorial(token) {
    const contenedor = document.getElementById('contenedor-historial');
    try {
        const { data, error } = await _supabase.from('resultados_examenes')
            .select('tipo_prueba, fecha_aplicacion, puntaje_obtenido')
            .eq('token_hex', token)
            .order('fecha_aplicacion', { ascending: false });*/

        if (error) throw error;

        if (!data || data.length === 0) {
            contenedor.innerHTML = `<div class="card-glass p-6 text-xs text-gray-500 italic border-dashed text-center">Sin actividad registrada.</div>`;
            return;
        }
        
        contenedor.innerHTML = data.map(reg => `
            <div class="card-glass p-4 border-l-4 border-cyan-500 bg-white/5 transition-all hover:bg-white/10 mb-3">
                <div class="flex justify-between items-center text-[10px] sm:text-xs mb-2">
                    <span class="text-cyan-400 font-black uppercase tracking-tighter">${reg.tipo_prueba}</span>
                    <span class="text-gray-500">${new Date(reg.fecha_aplicacion).toLocaleDateString()}</span>
                </div>
                <p class="text-2xl font-black text-white">${reg.puntaje_obtenido}% <span class="text-xs text-gray-500 font-normal italic">Aciertos</span></p>
            </div>
        `).join('');
    } catch(e) {
        console.error("Falla al cargar historial:", e);
        contenedor.innerHTML = `<div class="card-glass p-6 text-xs text-red-500 italic text-center">Error al sincronizar historial.</div>`;
    }
}

async function cargarNiveles(institucion, puntajeReal) {
    const contenedor = document.getElementById('contenedor-niveles');
    const { data } = await _supabase.from('reglas_simulador').select('*').eq('institucion', institucion).order('id', { ascending: true });
    
    const estaBloqueado = puntajeReal < 70;
    
    // 🛑 EL INSTRUCTIVO DE REGLAS RECUPERADO
    let html = `
        <div class="mb-5 bg-cyan-900/20 border border-cyan-800 p-4 rounded-xl shadow-inner">
            <h4 class="text-cyan-400 font-black text-xs uppercase tracking-widest mb-2"><i class="fa-solid fa-circle-info"></i> Reglas de la IA</h4>
            <p class="text-xs text-gray-400 leading-relaxed mb-2">Para desbloquear un nivel superior, debes superar al menos <strong class="text-white">3 simulacros con más del 70%</strong> de aciertos.</p>
            <p class="text-xs text-gray-400 leading-relaxed">Si tu último simulacro es menor a 70%, tu entrenamiento se bloqueará y deberás superar el <strong class="text-red-400">Reto de Repaso</strong>.</p>
        </div>
    `;

    if (estaBloqueado) {
        html += `
            <div class="bg-red-900/20 border border-red-500/50 p-4 rounded-xl mb-4 text-center">
                <h4 class="text-red-400 font-bold text-sm uppercase mb-1">Entrenamiento Bloqueado</h4>
                <p class="text-[10px] text-gray-400 uppercase font-bold">Supera el Repaso primero.</p>
            </div>
            <div class="card-glass p-5 nivel-card border-red-500/50 cursor-pointer hover:bg-red-900/20 transition-all" onclick="irAlExamen('Repaso', 10, 15)">
                <h4 class="text-red-400 font-bold text-xs uppercase italic tracking-tighter mb-2"><i class="fa-solid fa-fire mr-1"></i> Reto de Repaso</h4>
                <p class="text-sm font-black text-white">10 Reactivos de tus errores</p>
                <p class="text-[9px] text-cyan-400 font-bold mt-2 uppercase tracking-wide">🎯 Meta: 70% para aprobar</p>
            </div>
        `;
    }

    if (data) {
        html += data.map(n => {
            const isLocked = estaBloqueado || n.nivel !== 'Principiante'; 
            let textoRequisito = "";
            if (isLocked) {
                if (estaBloqueado) textoRequisito = `<p class="text-[9px] text-red-400/80 italic mt-2 uppercase tracking-wide">🔒 Supera el Repaso primero</p>`;
                else textoRequisito = `<p class="text-[9px] text-gray-500 italic mt-2 uppercase tracking-wide">🔒 Requiere 3 Exámenes > 70%</p>`;
            }

            return `
                <div class="card-glass p-5 nivel-card mt-3 ${isLocked ? 'locked opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-cyan-500'}" onclick="${isLocked ? '' : `irAlExamen('${n.nivel}', ${n.cantidad_preguntas}, ${n.tiempo_minutos})`}">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="${isLocked ? 'text-gray-500' : 'color-cian'} font-bold text-xs uppercase italic tracking-tighter">${n.nivel}</h4>
                        <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-lock-open'} text-sm ${isLocked ? 'text-gray-600' : 'text-cyan-500'}"></i>
                    </div>
                    <p class="text-base font-black ${isLocked ? 'text-gray-400' : 'text-white'}">${n.cantidad_preguntas} Reactivos | ${n.tiempo_minutos} Min</p>
                    ${textoRequisito}
                </div>`;
        }).join('');
    }
    contenedor.innerHTML = html;
}

async function cargarHistorialChat(token, puntaje, contexto) {
    const chatBox = document.getElementById('chat-box');
    const email = localStorage.getItem('session_email');
    const { data: historial } = await _supabase.from('chat_historial').select('*').eq('token_hex', token).eq('email', email).order('created_at', { ascending: true });
    chatBox.innerHTML = ''; 
    if (historial && historial.length > 0) {
        historial.forEach(msg => dibujarBurbujaChat(msg.emisor, msg.mensaje));
    } else {
        // Si no hay historial, mandamos un mensaje inicial de la IA
        dibujarBurbujaChat('simu', "¡Hola! Estoy listo para ayudarte a entrenar. Selecciona un nivel o hazme una pregunta directa.");
    }
}

async function enviarMensajeChat(token) {
    const input = document.getElementById('user-input');
    const textoUsuario = input.value.trim();
    if (!textoUsuario) return;
    
    let energiaElement = document.getElementById('creditos-display');
    let energia = parseInt(energiaElement.innerText) || 0;
    if (energia <= 0) { dibujarBurbujaChat('simu', "Te has quedado sin Energía IA. Usa el botón 'Recargar'."); return; }

    energia -= 1;
    energiaElement.innerText = energia;
    localStorage.setItem('simu_creditos', energia);
    await guardarCreditosEnBD(energia);
    
    dibujarBurbujaChat('alumno', textoUsuario);
    input.value = '';
    
    const idBurbujaIA = "typing-" + Date.now();
    dibujarBurbujaChat('simu', `<span id="${idBurbujaIA}" class="animate-pulse">Simu está analizando...</span>`);

    try {
        const url = `https://pcuopqvmucmhtcdeswxh.supabase.co/functions/v1/chat-simu`;
        const response = await fetch(url, {
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ contents: [{ parts: [{ text: textoUsuario }] }], generationConfig: { temperature: 0.4 } })
        });
        
        if (!response.ok) throw new Error("Falla de red");
        
        const data = await response.json();
        const respuestaIA = data.candidates[0].content.parts[0].text;
        
        const spanBurbuja = document.getElementById(idBurbujaIA);
        if(spanBurbuja && spanBurbuja.parentElement) {
            spanBurbuja.parentElement.innerHTML = respuestaIA.replace(/\*\*(.*?)\*\*/g, '<strong class="color-cian">$1</strong>');
            if (window.MathJax) { window.MathJax.typesetPromise([spanBurbuja.parentElement.parentElement]); }
        }
        
    } catch (e) {
        const spanBurbuja = document.getElementById(idBurbujaIA);
        if(spanBurbuja && spanBurbuja.parentElement) spanBurbuja.parentElement.innerHTML = "<em>Error de conexión. Intenta de nuevo.</em>";
        
        energia += 1;
        energiaElement.innerText = energia;
        localStorage.setItem('simu_creditos', energia);
        await guardarCreditosEnBD(energia);
    }
}

function irAlExamen(nivel, q, t) { localStorage.setItem('simu_nivel', nivel); localStorage.setItem('simu_preguntas', q); localStorage.setItem('simu_tiempo', t); window.location.href = `examen.html?v=${localStorage.getItem('token_hex_hijo')}`; }
function cerrarSesion() { localStorage.clear(); window.location.href = 'index.html'; }

window.onload = inicializarDashboard;

// Listener para el botón enviar con Enter
document.getElementById('user-input')?.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') enviarMensajeChat(localStorage.getItem('token_hex_hijo'));
});
document.getElementById('btnEnviar')?.addEventListener('click', () => {
    enviarMensajeChat(localStorage.getItem('token_hex_hijo'));
});

// ==========================================
// PARCHE DE SEGURIDAD UI (Limpieza de Caché del Navegador)
// ==========================================
window.addEventListener('pageshow', function(event) {
    // Si el usuario regresa con el botón "Atrás" desde Stripe, descongelamos la pantalla
    const modal = document.getElementById('modalEnergia');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('opacity-50', 'pointer-events-none');
    }
});
