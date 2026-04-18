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
            
            localStorage.setItem('simu_creditos', nuevosCreditos);
            await guardarCreditosEnBD(nuevosCreditos);
            actualizarDisplayCreditos();
            
            alert(`✅ ¡Recarga Exitosa! Se han añadido ${tokensAComprar} tokens a tu cuenta.`);
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
    const emailPadre = localStorage.getItem('session_email');
    // 1. Extraemos la Institución desde la sub-caja 'config_examenes'
    localStorage.setItem('plan_institucion', data.config_examenes.institucion);
    
    // 2. Extraemos el Área (A1, A2, etc.) desde la misma sub-caja
    localStorage.setItem('plan_area', data.config_examenes.area);
    
    // 3. El nombre del alumno se queda igual porque está en la caja principal
    localStorage.setItem('nombre_alumno', data.nombre_alumno);
    
    // El resto de tu función se queda exactamente igual...
    console.log("Curso seleccionado:", data.config_examenes.institucion, data.config_examenes.area);
    
    const conf = data.config_examenes; 
    const nombrePlan = conf.area ? `${conf.institucion} ${conf.area}` : conf.institucion;

    // 🔒 Filtro estricto consolidado (Una sola consulta)
    const { data: historialBD } = await _supabase
        .from('resultados_examenes')
        .select('puntaje_obtenido, detalles_fallas')
        .eq('token_hex', data.token_hex)
        .eq('tipo_prueba', nombrePlan)
        .eq('email', emailPadre)
        .eq('nombre_alumno', data.nombre_alumno)
        .order('fecha_aplicacion', { ascending: false })
        .limit(1);

    document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');

    document.getElementById('saludo-alumno').innerHTML = `Hola, <span class="color-cian italic">${data.nombre_alumno}</span>`;
    document.getElementById('plan-actual-container').innerHTML = `<p class="text-[10px] uppercase font-bold text-gray-500 italic tracking-widest leading-none">Plan Activo: <span class="text-white">${nombrePlan}</span></p>`;
    
    const esPro = data.config_examenes.plan === 'PRO';
    localStorage.setItem('token_hex_hijo', data.token_hex);
     localStorage.setItem('plan_area', conf.area);               
    localStorage.setItem('plan_nombre_completo', nombrePlan);   
    localStorage.setItem('es_pro', esPro);
    localStorage.setItem('simu_creditos', data.intentos_simulacro_restantes || 0);
    
    actualizarDisplayCreditos();
    
    const ultimoPuntajeBD = (historialBD && historialBD.length > 0) ? historialBD[0].puntaje_obtenido : null;
    const params = new URLSearchParams(window.location.search);
    const puntajeReciente = params.get('res');
    const puntajeFinal = puntajeReciente ? parseInt(puntajeReciente) : (ultimoPuntajeBD !== null ? ultimoPuntajeBD : 100);
    const palabraBusqueda = conf.institucion.includes('ECOEMS') ? 'ECOEMS' : nombrePlan;
    
    cargarNiveles(palabraBusqueda, puntajeFinal);
    cargarHistorialChat(data.token_hex, puntajeFinal, puntajeReciente ? "reciente" : "historico");
    setTimeout(() => { cargarHistorial(data.token_hex, data.nombre_alumno); }, 800);
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

    document.getElementById('modalEnergia').classList.add('opacity-50', 'pointer-events-none');

    try {
        const { data, error } = await _supabase.functions.invoke('stripe-checkout', {
            body: {
                nombre_alumno: nombre,
                correo: email,
                tipo_examen: `Recarga ${tokens} Tokens IA`,
                referencia_pago: ref,
                precio: precio,
                es_recarga: true,
                tokens: tokens
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
    const nombreHijo = localStorage.getItem('nombre_alumno'); // 🔒 Candado de hermanos

    if (_supabase && email && token) {
        const { data, error } = await _supabase.from('usuarios_membresias')
            .update({ intentos_simulacro_restantes: creditosNuevos })
            .eq('email', email)
            .eq('token_hex', token)
            .eq('nombre_alumno', nombreHijo); // Solo se descuenta al niño que lo usó
            
        if (error) {
            console.error("❌ ERROR AL DESCONTAR TOKEN:", error);
        } else {
            console.log(`✅ Token de ${nombreHijo} actualizado a: ${creditosNuevos}`);
        }
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

    if (window.MathJax) { window.MathJax.typesetPromise([div]); }
}

async function cargarHistorial(token, nombreHijo) {
    const contenedor = document.getElementById('contenedor-historial');
    const emailPadre = localStorage.getItem('session_email');
    
    try {
        const { data, error } = await _supabase
            .from('resultados_examenes')
            // 1. AÑADIMOS 'detalles_fallas' A LA CONSULTA PARA SACAR EL JSON
            .select('tipo_prueba, fecha_aplicacion, puntaje_obtenido, detalles_fallas')
            .eq('token_hex', token)
            .eq('email', emailPadre)           // CANDADO 1
            .eq('nombre_alumno', nombreHijo)   // 🔒 CANDADO 2
            .order('fecha_aplicacion', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            contenedor.innerHTML = `<div class="card-glass p-6 text-xs text-gray-500 italic border-dashed text-center">Sin actividad registrada.</div>`;
            return;
        }
        
        contenedor.innerHTML = data.map(reg => {
            // 2. EXTRAEMOS DATOS DEL JSON
            let aciertosTotales = 0;
            let preguntasTotales = 0;
            let incidencias = [];

            if (reg.detalles_fallas) {
                // Sacamos los datos exactos que guardó el motor
                aciertosTotales = reg.detalles_fallas.aciertos_totales || Math.round((reg.puntaje_obtenido / 100) * 120);
                preguntasTotales = reg.detalles_fallas.preguntas_totales || 120;
                incidencias = reg.detalles_fallas.log_vigilancia || [];
            }

            // 3. SEMÁFORO DE VIGILANCIA (Separamos Audio de Video)
            let incAudio = incidencias.filter(i => i.toLowerCase().includes('ruido')).length;
            let incVideo = incidencias.filter(i => !i.toLowerCase().includes('ruido')).length;

            let colorAudio = incAudio === 0 ? 'text-green-500' : (incAudio <= 2 ? 'text-yellow-500' : 'text-red-500');
            let colorVideo = incVideo === 0 ? 'text-green-500' : (incVideo <= 2 ? 'text-yellow-500' : 'text-red-500');

            // 4. CÁLCULO DE PROBABILIDAD DE ADMISIÓN
            let probColor = '';
            let probText = '';
            if (reg.puntaje_obtenido >= 85) { 
                probColor = 'text-green-400 bg-green-900/30 border-green-500/50'; 
                probText = 'ALTA'; 
            } else if (reg.puntaje_obtenido >= 70) { 
                probColor = 'text-yellow-400 bg-yellow-900/30 border-yellow-500/50'; 
                probText = 'MEDIA'; 
            } else { 
                probColor = 'text-red-400 bg-red-900/30 border-red-500/50'; 
                probText = 'BAJA'; 
            }

            // 5. RENDERIZADO DE LA NUEVA TARJETA TÁCTICA
            return `
            <div class="card-glass p-4 border-l-4 border-cyan-500 bg-white/5 transition-all hover:bg-white/10 mb-3">
                <div class="flex justify-between items-center text-[10px] sm:text-xs mb-3 border-b border-white/5 pb-2">
                    <span class="text-cyan-400 font-black uppercase tracking-tighter">${reg.tipo_prueba}</span>
                    <span class="text-gray-500">${new Date(reg.fecha_aplicacion).toLocaleDateString()}</span>
                </div>

                <div class="flex justify-between items-end mb-4">
                    <div>
                        <p class="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-1">Aciertos</p>
                        <p class="text-2xl font-black text-white leading-none">${aciertosTotales} <span class="text-sm text-gray-500 font-normal italic">/ ${preguntasTotales}</span></p>
                    </div>
                    <div class="text-right">
                        <span class="text-[8px] uppercase tracking-widest font-bold text-gray-500 block mb-1">Probabilidad</span>
                        <span class="${probColor} text-[10px] font-black px-2 py-1 rounded border shadow-sm inline-block">${probText}</span>
                    </div>
                </div>

                <div class="flex justify-between items-center bg-black/40 rounded-lg p-2 border border-slate-800">
                    <span class="text-[8px] text-gray-500 uppercase font-bold tracking-widest">Biometría IA</span>
                    <div class="flex gap-4 pr-1">
                        <div title="Audio: ${incAudio} alertas" class="flex items-center gap-1 cursor-help">
                            <i class="fa-solid fa-microphone text-[11px] ${colorAudio}"></i>
                        </div>
                        <div title="Video: ${incVideo} alertas" class="flex items-center gap-1 cursor-help">
                            <i class="fa-solid fa-camera text-[11px] ${colorVideo}"></i>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    } catch (err) { 
        console.error(err); 
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
            <div class="card-glass p-5 nivel-card border-red-500/50 cursor-pointer hover:bg-red-900/20 transition-all" onclick="irARepaso(10, 15)">
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
    const nombreHijo = localStorage.getItem('nombre_alumno'); // 🔒 Candado de hermanos

    const { data: historial } = await _supabase
        .from('chat_historial')
        .select('*')
        .eq('token_hex', token)
        .eq('email', email)
        .eq('nombre_alumno', nombreHijo) // Filtramos para que no se mezcle con el hermanito
        .order('created_at', { ascending: true });

    chatBox.innerHTML = ''; 
    if (historial && historial.length > 0) {
        historial.forEach(msg => dibujarBurbujaChat(msg.emisor, msg.mensaje));
    } else {
        dibujarBurbujaChat('simu', "¡Hola! Estoy listo para ayudarte a entrenar. Selecciona un nivel o hazme una pregunta directa.");
    }

    // NUEVO: PINTAR MAPA DE VULNERABILIDADES SI ES RECIENTE
    if (contexto === "reciente") {
        const { data: ultimoExamen } = await _supabase.from('resultados_examenes')
            .select('detalles_fallas')
            .eq('token_hex', token).eq('email', email).eq('nombre_alumno', nombreHijo)
            .order('fecha_aplicacion', { ascending: false }).limit(1).single();

        if (ultimoExamen && ultimoExamen.detalles_fallas && ultimoExamen.detalles_fallas.fallas_academicas) {
            const fallas = ultimoExamen.detalles_fallas.fallas_academicas;
            if (fallas.length > 0) {
                let htmlFallas = `<div class="bg-gray-800/80 p-5 rounded-2xl rounded-tl-none border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)] text-gray-200 mt-4 mb-4">
                    <p class="text-[10px] uppercase text-cyan-400 font-black mb-3 tracking-widest border-b border-white/10 pb-2"><i class="fa-solid fa-bullseye mr-1"></i> Vulnerabilidades Detectadas</p>
                    <div class="space-y-3 max-h-72 overflow-y-auto pr-2 scroll-smooth">`;
                
                fallas.forEach(f => {
                    if(f.pregunta && f.correcta) {
                        htmlFallas += `
                        <div class="bg-black/50 border border-slate-700/50 p-4 rounded-xl relative overflow-hidden group">
                            <div class="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                            <span class="text-red-400 text-[9px] font-black uppercase mb-2 block tracking-widest ml-2">${f.materia}</span>
                            <div class="text-gray-300 text-sm mb-3 ml-2 overflow-x-auto">${f.pregunta}</div>
                            <button onclick="pedirExplicacionOficial('${encodeURIComponent(f.pregunta)}', '${encodeURIComponent(f.correcta)}')" 
                                    class="ml-2 w-[calc(100%-0.5rem)] text-cyan-400 font-bold uppercase hover:bg-cyan-900/40 border border-cyan-900 bg-cyan-900/20 py-2 rounded-lg text-[10px] tracking-wider flex items-center justify-center gap-2 transition">
                                <i class="fa-solid fa-brain"></i> Explicar Error (1⚡)
                            </button>
                        </div>`;
                    }
                });
                htmlFallas += `</div></div>`;
                chatBox.innerHTML += htmlFallas;
                chatBox.scrollTop = chatBox.scrollHeight;
            }
        }
    }

}

async function enviarMensajeChat(token) {
    const input = document.getElementById('user-input');
    const textoUsuario = input.value.trim();
    if (!textoUsuario) return;
    
    const email = localStorage.getItem('session_email');
    const nombreHijo = localStorage.getItem('nombre_alumno');

    let energiaElement = document.getElementById('creditos-display');
    let energia = parseInt(energiaElement.innerText) || 0;
    if (energia <= 0) { dibujarBurbujaChat('simu', "Te has quedado sin Energía IA. Usa el botón 'Recargar'."); return; }

    // 1. DESCONTAMOS EL TOKEN
    energia -= 1;
    energiaElement.innerText = energia;
    localStorage.setItem('simu_creditos', energia);
    await guardarCreditosEnBD(energia);
    
    dibujarBurbujaChat('alumno', textoUsuario);
    input.value = '';

    // 💾 2. GUARDAMOS EN SUPABASE (El registro del Alumno)
    await _supabase.from('chat_historial').insert([{
        token_hex: token,
        email: email,
        nombre_alumno: nombreHijo,
        emisor: 'alumno',
        mensaje: textoUsuario
    }]);
    
    const idBurbujaIA = "typing-" + Date.now();
    dibujarBurbujaChat('simu', `<span id="${idBurbujaIA}" class="animate-pulse">Simu está analizando...</span>`);

    try {
        // --- 🧠 ALTERNATIVA A: AHORRO DE TOKENS (SOLO 2 MENSAJES ANTERIORES) ---
        const { data: ultimosMsgs } = await _supabase
            .from('chat_historial')
            .select('emisor, mensaje')
            .eq('token_hex', token).eq('email', email).eq('nombre_alumno', nombreHijo)
            .order('created_at', { ascending: false })
            .limit(2); // Solo extraemos los 2 últimos mensajes para el contexto

        let textoConContexto = textoUsuario;
        if (ultimosMsgs && ultimosMsgs.length > 0) {
            let contextoInfo = "HISTORIAL RECIENTE PARA CONTEXTO:\n";
            // Invertimos para poner el orden cronológico correcto
            ultimosMsgs.reverse().forEach(m => {
                contextoInfo += `${m.emisor.toUpperCase()}: ${m.mensaje}\n`;
            });
            textoConContexto = `${contextoInfo}\nNUEVO MENSAJE DEL ALUMNO: ${textoUsuario}`;
        }
        // -----------------------------------------------------------------------

        const url = `https://pcuopqvmucmhtcdeswxh.supabase.co/functions/v1/chat-simu`;
        const response = await fetch(url, {
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            // Enviamos a la IA la pregunta + el mini-historial inyectado
            body: JSON.stringify({ contents: [{ parts: [{ text: textoConContexto }] }], generationConfig: { temperature: 0.4 } })
        });
        
        if (!response.ok) throw new Error("Falla de red en Gemini");
        
        const data = await response.json();
        const respuestaIA = data.candidates[0].content.parts[0].text;
        
        // 💾 3. GUARDAMOS EN SUPABASE PRIMERO (Solo guardamos la respuesta limpia, no el bloque de contexto)
        await _supabase.from('chat_historial').insert([{
            token_hex: token,
            email: email,
            nombre_alumno: nombreHijo,
            emisor: 'simu',
            mensaje: respuestaIA
        }]);

        // 4. PINTAMOS EN PANTALLA
        const spanBurbuja = document.getElementById(idBurbujaIA);
        if(spanBurbuja && spanBurbuja.parentElement) {
            const contenedor = spanBurbuja.parentElement;
            contenedor.innerHTML = respuestaIA.replace(/\*\*(.*?)\*\*/g, '<strong class="color-cian">$1</strong>');
            
            if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') { 
                window.MathJax.typesetPromise([contenedor.parentElement]).catch(e => console.warn('MathJax cargando...', e)); 
            }
        }
        
    } catch (e) {
        console.error("❌ Falla interceptada en el motor de Chat:", e); 
        const spanBurbuja = document.getElementById(idBurbujaIA);
        if(spanBurbuja && spanBurbuja.parentElement) {
             spanBurbuja.parentElement.innerHTML = "<em>Error de conexión. Intenta de nuevo.</em>";
        }
        
        // Reembolso del token SOLO si de verdad hubo error
        energia += 1;
        energiaElement.innerText = energia;
        localStorage.setItem('simu_creditos', energia);
        await guardarCreditosEnBD(energia);
    }
}

function irAlExamen(nivel, q, t) { 
    localStorage.setItem('simu_nivel', nivel);
    localStorage.setItem('simu_tipo_examen', 'Normal'); 
    localStorage.setItem('simu_preguntas', q); 
    localStorage.setItem('simu_tiempo', t); 
    window.location.href = `examen.html?v=${localStorage.getItem('token_hex_hijo')}`; 
}

function irARepaso(q, t) {
    localStorage.setItem('simu_tipo_examen', 'Repaso'); 
    localStorage.setItem('simu_preguntas', q); 
    localStorage.setItem('simu_tiempo', t); 
    window.location.href = `examen.html?v=${localStorage.getItem('token_hex_hijo')}`; 
}

function cerrarSesion() { localStorage.clear(); window.location.href = 'index.html'; }
window.onload = inicializarDashboard;

document.getElementById('user-input')?.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') enviarMensajeChat(localStorage.getItem('token_hex_hijo'));
});
document.getElementById('btnEnviar')?.addEventListener('click', () => {
    enviarMensajeChat(localStorage.getItem('token_hex_hijo'));
});

window.addEventListener('pageshow', function(event) {
    const modal = document.getElementById('modalEnergia');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('opacity-50', 'pointer-events-none');
    }
});

// NUEVO: FUNCIÓN PARA PEDIR EXPLICACIÓN DEL ERROR DESDE EL DASHBOARD OFICIAL
async function pedirExplicacionOficial(preguntaCodificada, respuestaCodificada) {
    let tokens = parseInt(localStorage.getItem('simu_creditos')) || 0;
    
    if (tokens <= 0) {
        abrirModalEnergia();
        return;
    }

    // Cobrar Token
    tokens -= 1;
    localStorage.setItem('simu_creditos', tokens);
    actualizarDisplayCreditos();
    await guardarCreditosEnBD(tokens);
    
    const pregunta = decodeURIComponent(preguntaCodificada);
    const correcta = decodeURIComponent(respuestaCodificada);
    const inst = localStorage.getItem('plan_institucion');
    const area = localStorage.getItem('plan_area');
    const email = localStorage.getItem('session_email');
    const tokenUser = localStorage.getItem('token_hex_hijo');
    const nombreHijo = localStorage.getItem('nombre_alumno');

    dibujarBurbujaChat('alumno', `¿Me puedes explicar por qué fallé en esta pregunta? \n"${pregunta}"`);
    
    const idBurbujaIA = "typing-" + Date.now();
    dibujarBurbujaChat('simu', `<span id="${idBurbujaIA}" class="animate-pulse">Analizando tu error...</span>`);

    try {
        const { data, error } = await _supabase.functions.invoke('explicacion_ia', {
            body: { 
                pregunta: pregunta, 
                correcta: correcta,
                institucion: inst,
                area: area
            }
        });

        if (error) throw error;
        
        const spanBurbuja = document.getElementById(idBurbujaIA);
        if(spanBurbuja && spanBurbuja.parentElement) {
            const contenedor = spanBurbuja.parentElement;
            contenedor.innerHTML = data.respuesta.replace(/\*\*(.*?)\*\*/g, '<strong class="color-cian">$1</strong>');
            if (window.MathJax) { window.MathJax.typesetPromise([contenedor.parentElement]); }
        }

        // Guardamos en el historial la plática real para que se quede guardada
        await _supabase.from('chat_historial').insert([
            { token_hex: tokenUser, email: email, nombre_alumno: nombreHijo, emisor: 'alumno', mensaje: `Explicación de error: ${pregunta}` },
            { token_hex: tokenUser, email: email, nombre_alumno: nombreHijo, emisor: 'simu', mensaje: data.respuesta }
        ]);

    } catch (error) {
        console.error(error);
        const spanBurbuja = document.getElementById(idBurbujaIA);
        if(spanBurbuja) spanBurbuja.parentElement.innerHTML = "<span class='text-red-500'>Error de red. Te hemos devuelto tu Energía.</span>";
        
        tokens += 1;
        localStorage.setItem('simu_creditos', tokens);
        actualizarDisplayCreditos();
        await guardarCreditosEnBD(tokens);
    }
}
