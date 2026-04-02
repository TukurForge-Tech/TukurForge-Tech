// dashboard.js - Lógica del Panel de Control

async function inicializarDashboard() {
    const email = localStorage.getItem('session_email');
    if (!email) { window.location.href = 'index.html'; return; }
    
    // Mostrar los créditos almacenados (o 0 temporalmente)
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
    
    const esPro = data.config_examenes.plan === 'PRO';
    document.getElementById('plan-actual-container').innerHTML = `
        <p class="text-xs uppercase font-bold text-gray-400 italic tracking-widest">
            Plan Activo: <span class="text-white">${nombrePlan}</span> 
            <span class="ml-3 px-3 py-1 rounded ${esPro ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'} font-black">
                ${esPro ? 'MEMBRESÍA PRO (ILIMITADA)' : `PLAN BÁSICO (${data.intentos_simulacro_restantes} RESTANTES)`}
            </span>
        </p>
    `;
    
    // Variables de sesión intocables
    localStorage.setItem('nombre_alumno', data.nombre_alumno);
    localStorage.setItem('token_hex_hijo', data.token_hex);
    localStorage.setItem('plan_institucion', conf.institucion);
    localStorage.setItem('plan_area', conf.area);               
    localStorage.setItem('plan_nombre_completo', nombrePlan);   
    localStorage.setItem('es_pro', esPro);

    // ---> SINCRONIZACIÓN DE CRÉDITOS IA CON BD <---
    // Guardamos en el navegador los intentos_simulacro_restantes que vienen de la BD
    localStorage.setItem('simu_creditos', data.intentos_simulacro_restantes || 0);
    actualizarDisplayCreditos();

    cargarHistorial(data.token_hex);
    
    // ---> CORRECCIÓN ECOEMS <---
    // Pasamos conf.institucion limpio a cargarNiveles
    cargarNiveles(conf.institucion);

    const params = new URLSearchParams(window.location.search);
    const puntajeReciente = params.get('res');
    
    if (puntajeReciente) {
        mostrarFeedbackIA(puntajeReciente, data.token_hex);
    } else {
        document.getElementById('chat-box').innerHTML = `
            <p class="bg-gray-800/40 p-5 rounded-2xl rounded-tl-none border border-white/5 max-w-[85%] leading-relaxed">
                Sesión iniciada. Seleccione una pestaña superior para cargar el entrenamiento correspondiente.
            </p>
        `;
    }
}

async function cargarNiveles(institucion) {
    const contenedor = document.getElementById('contenedor-niveles');
    const { data } = await _supabase.from('reglas_simulador').select('*').eq('institucion', institucion).order('id', { ascending: true });
    
    const params = new URLSearchParams(window.location.search);
    const puntaje = parseInt(params.get('res')) || 100; 
    const estaBloqueado = puntaje < 70;

    let html = '';

    if (estaBloqueado) {
        html += `
            <div class="bg-red-900/20 border border-red-500/50 p-4 rounded-xl mb-5 text-center">
                <h4 class="text-red-400 font-bold text-sm uppercase mb-1">Entrenamiento Bloqueado (< 70%)</h4>
                <p class="text-xs text-gray-400">Aprueba el Reto de Repaso para avanzar.</p>
            </div>
            <div class="card-glass p-5 nivel-card border-red-500/50 hover:border-red-400" onclick="irAlExamen('Repaso', 10, 15)">
                <h4 class="text-red-400 font-bold text-xs uppercase italic tracking-tighter mb-2"><i class="fa-solid fa-fire mr-1"></i> Reto de Repaso</h4>
                <p class="text-sm font-black text-white">10 Reactivos de tus errores</p>
            </div>
        `;
    }

    if (data) {
        html += data.map(n => {
            const isLocked = estaBloqueado || n.nivel !== 'Principiante'; 
            return `
                <div class="card-glass p-5 nivel-card ${isLocked ? 'locked' : ''}" onclick="${isLocked ? '' : `irAlExamen('${n.nivel}', ${n.cantidad_preguntas}, ${n.tiempo_minutos})`}">
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="color-cian font-bold text-xs uppercase italic tracking-tighter">${n.nivel}</h4>
                        <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-lock-open'} text-sm text-gray-700"></i>
                    </div>
                    <p class="text-base font-black text-white">${n.cantidad_preguntas} Reactivos | ${n.tiempo_minutos} Min</p>
                </div>`;
        }).join('');
    }
    
    contenedor.innerHTML = html;
}

async function cargarHistorial(token) {
    const contenedor = document.getElementById('contenedor-historial');
    const { data, error } = await _supabase.from('resultados_examenes')
        .select('*')
        .eq('token_hex', token)
        .order('fecha_aplicacion', { ascending: false });

    if (error || !data || data.length === 0) {
        contenedor.innerHTML = `<div class="card-glass p-6 text-xs text-gray-500 italic border-dashed text-center">Sin actividad registrada.</div>`;
        return;
    }
    
    contenedor.innerHTML = data.map(reg => `
        <div class="card-glass p-4 border-l-4 border-cyan-500 bg-white/5 transition-all hover:bg-white/10">
            <div class="flex justify-between items-center text-[10px] sm:text-xs mb-2">
                <span class="text-cyan-400 font-black uppercase tracking-tighter">${reg.tipo_prueba}</span>
                <span class="text-gray-500">${new Date(reg.fecha_aplicacion).toLocaleDateString()}</span>
            </div>
            <p class="text-2xl font-black text-white">${reg.puntaje_obtenido}% <span class="text-xs text-gray-500 font-normal italic">Aciertos</span></p>
        </div>
    `).join('');
}

function irAlExamen(nivel, q, t) {
    localStorage.setItem('simu_nivel', nivel);
    localStorage.setItem('simu_preguntas', q);
    localStorage.setItem('simu_tiempo', t);
    window.location.href = `examen.html?v=${localStorage.getItem('token_hex_hijo')}`; 
}

function cerrarSesion() { localStorage.clear(); window.location.href = 'index.html'; }

// ==========================================
// IA Y TOKENS (Sincronizado con Supabase)
// ==========================================

function actualizarDisplayCreditos() { 
    document.getElementById('creditos-display').innerText = parseInt(localStorage.getItem('simu_creditos')) || 0; 
}

// ---> FUNCIÓN PARA GUARDAR EN TU COLUMNA ORIGINAL DE SUPABASE <---
async function guardarCreditosEnBD(creditosNuevos) {
    const email = localStorage.getItem('session_email');
    const token = localStorage.getItem('token_hex_hijo');
    
    if (_supabase && email && token) {
        await _supabase.from('usuarios_membresias')
            .update({ intentos_simulacro_restantes: creditosNuevos })
            .eq('email', email)
            .eq('token_hex', token);
    }
}

async function simularCompra() {
    let creditos = parseInt(localStorage.getItem('simu_creditos')) || 0;
    creditos += 100;
    localStorage.setItem('simu_creditos', creditos);
    actualizarDisplayCreditos();
    await guardarCreditosEnBD(creditos); // Dispara el guardado en SQL
    document.getElementById('chat-box').innerHTML = '';
    printChat("Simu", "¡Energía IA restablecida al 100%! Puedes continuar preguntando.");
}

async function mostrarFeedbackIA(puntaje, token) {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = ''; 
    
    let probabilidad = "ALTA";
    if (puntaje < 50) probabilidad = "BAJA";
    else if (puntaje < 80) probabilidad = "MEDIA";

    const promptInvisible = `Eres el tutor de SimuTukur. El estudiante acaba de terminar su examen de ${localStorage.getItem('plan_nombre_completo')}. Su calificación fue ${puntaje}% (Probabilidad de ingreso: ${probabilidad}). Su nivel es Principiante. Salúdalo por su nombre (${localStorage.getItem('nombre_alumno')}), dile brevemente tu evaluación de su puntaje, anímalo y pregúntale en qué reactivo tiene dudas. REGLA ESTRICTA: Tu respuesta no debe superar las 3 líneas. Sé claro, concreto y no te salgas del tema.`;

    const idLoader = printChat("Simu", "Analizando tus resultados y telemetría...", true);

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptInvisible }] }],
                generationConfig: { maxOutputTokens: 150, temperature: 0.3 }
            })
        });
        const data = await response.json();
        actualizarLoader(idLoader, data.candidates[0].content.parts[0].text);
    } catch (e) {
        actualizarLoader(idLoader, `Análisis guardado. Puntaje: ${puntaje}%. ¿En qué puedo ayudarte?`);
    }
}

async function procesarEnvioChat() {
    const input = document.getElementById('user-input');
    const msg = input.value.trim();
    if (!msg) return;

    let creditos = parseInt(localStorage.getItem('simu_creditos')) || 0;
    if (creditos <= 0) { 
        printChat("Simu", "Te has quedado sin Energía IA. Usa el botón 'Comprar' en la parte superior."); 
        return; 
    }

    // Cobramos el intento
    creditos -= 1;
    localStorage.setItem('simu_creditos', creditos);
    actualizarDisplayCreditos();
    await guardarCreditosEnBD(creditos); // Dispara el guardado en SQL

    printChat("Tú", msg);
    input.value = '';
    const idLoader = printChat("Simu", "Procesando duda...", true);

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            contents: [{ parts: [{ text: msg }] }],
            systemInstruction: { parts: [{ text: "Eres Simu de SimuTukur. REGLA 1: Máximo 3 líneas. REGLA 2: Solo explica dudas académicas del examen. REGLA 3: Si preguntan cosas fuera del tema, responde que solo procesas dudas del examen." }] },
            generationConfig: { maxOutputTokens: 100, temperature: 0.2 }
        };

        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error("Interferencia en la red neuronal.");
        
        const data = await response.json();
        actualizarLoader(idLoader, data.candidates[0].content.parts[0].text);
    } catch (e) {
        actualizarLoader(idLoader, e.message, true);
        // Devolución si algo falló
        creditos += 1;
        localStorage.setItem('simu_creditos', creditos);
        actualizarDisplayCreditos();
        await guardarCreditosEnBD(creditos);
    }
}

function printChat(quien, texto, isLoader = false) {
    const box = document.getElementById('chat-box');
    const div = document.createElement('div');
    const id = 'msg-' + Date.now();
    div.id = id;
    const textoFormat = texto.replace(/\*\*(.*?)\*\*/g, '<strong class="color-cian">$1</strong>');
    
    if (quien === 'Tú') {
        div.className = "flex justify-end";
        div.innerHTML = `<p class="bg-cyan-900/40 p-4 rounded-2xl rounded-tr-none border border-cyan-500/30 text-white max-w-[85%]">${textoFormat}</p>`;
    } else {
        div.innerHTML = isLoader ? `<p class="text-xs text-cyan-500 animate-pulse italic">${texto}</p>` : `<div class="bg-gray-800/60 p-5 rounded-2xl rounded-tl-none border border-white/5"><strong class="color-cian font-black italic text-[10px] uppercase flex items-center gap-2 mb-2"><i class="fa-solid fa-brain"></i> Tutor Simu</strong><p class="text-gray-200 leading-relaxed">${textoFormat}</p></div>`;
    }
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return id;
}

function actualizarLoader(id, texto, error = false) {
    const div = document.getElementById(id);
    const textoFormat = texto.replace(/\*\*(.*?)\*\*/g, '<strong class="color-cian">$1</strong>');
    div.innerHTML = error ? `<p class="text-xs text-red-500">${textoFormat}</p>` : `<div class="bg-gray-800/60 p-5 rounded-2xl rounded-tl-none border border-white/5"><strong class="color-cian font-black italic text-[10px] uppercase flex items-center gap-2 mb-2"><i class="fa-solid fa-brain"></i> Tutor Simu</strong><p class="text-gray-200 leading-relaxed">${textoFormat}</p></div>`;
}

window.onload = inicializarDashboard;
