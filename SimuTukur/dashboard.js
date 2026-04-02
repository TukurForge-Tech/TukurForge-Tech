// dashboard.js - Lógica del Panel de Control

async function inicializarDashboard() {
    const email = localStorage.getItem('session_email');
    if (!email) { window.location.href = 'index.html'; return; }
    
    // NUEVO: Cargar los créditos al iniciar
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
        
        // NUEVO: Leer qué curso estaba viendo antes del examen
        const cursoPrevio = localStorage.getItem('plan_institucion');
        let indexSeleccionado = 0;

        suscripciones.forEach((s, index) => {
            const nombreTab = s.config_examenes.area ? `${s.config_examenes.institucion} ${s.config_examenes.area}` : s.config_examenes.institucion;
            
            // Si coincide con el que estaba guardado, marcamos este índice
            if (s.config_examenes.institucion === cursoPrevio) indexSeleccionado = index;

            const btn = document.createElement('button');
            btn.className = `btn-tab px-6 py-3 rounded-full text-xs font-black uppercase whitespace-nowrap`;
            btn.innerText = nombreTab;
            btn.onclick = () => seleccionarCurso(s, btn);
            contenedorTabs.appendChild(btn);
            
            // Auto-selecciona el guardado (o el primero si es nuevo)
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
    localStorage.setItem('nombre_alumno', data.nombre_alumno);

    const esPro = data.config_examenes.plan === 'PRO';
    document.getElementById('plan-actual-container').innerHTML = `
        <p class="text-xs uppercase font-bold text-gray-400 italic tracking-widest">
            Plan Activo: <span class="text-white">${nombrePlan}</span> 
            <span class="ml-3 px-3 py-1 rounded ${esPro ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'} font-black">
                ${esPro ? 'MEMBRESÍA PRO (ILIMITADA)' : `PLAN BÁSICO (${data.intentos_simulacro_restantes} RESTANTES)`}
            </span>
        </p>
    `;
    
    localStorage.setItem('token_hex_hijo', data.token_hex);
    localStorage.setItem('plan_institucion', conf.institucion);
    localStorage.setItem('plan_area', conf.area);               
    localStorage.setItem('plan_nombre_completo', nombrePlan);   
    localStorage.setItem('es_pro', esPro);

    cargarHistorial(data.token_hex);
    cargarNiveles(nombrePlan);

    // --- NUEVO: REVISAR SI VENIMOS DE UN EXAMEN ---
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

// --- NUEVO: FUNCIÓN PARA EL CHAT DE IA ---
async function mostrarFeedbackIA(puntaje, token) {
    const chatBox = document.getElementById('chat-box');
    
    // 1. Evaluación Académica
    let probabilidad = ""; let colorProb = ""; let msj = "";
    if (puntaje < 50) {
        probabilidad = "BAJA"; colorProb = "text-red-400";
        msj = "Detecto áreas de oportunidad críticas. Necesitamos reforzar los fundamentos.";
    } else if (puntaje < 80) {
        probabilidad = "MEDIA"; colorProb = "text-yellow-400";
        msj = "Vas por buen camino, pero aún hay conceptos que debemos afinar para asegurar tu lugar.";
    } else {
        probabilidad = "ALTA"; colorProb = "text-green-400";
        msj = "¡Excelente rendimiento! Tienes un dominio sólido de los temas. Mantén este ritmo.";
    }

    // 2. Traer el último veredicto de vigilancia de la BD
    const { data: vigData } = await _supabase.from('analisis_vigilancia_ia')
        .select('nivel_riesgo, analisis_ia')
        .eq('token_hex', token)
        .order('timestamp', { ascending: false })
        .limit(1);

    let reporteVis = "Sin reporte de vigilancia reciente.";
    let colorVis = "text-gray-400";
    if (vigData && vigData.length > 0) {
        reporteVis = vigData[0].analisis_ia;
        colorVis = vigData[0].nivel_riesgo === "Alto" ? "text-red-400" : (vigData[0].nivel_riesgo === "Medio" ? "text-yellow-400" : "text-green-400");
    }

    // 3. Pintar el reporte en Tukur
    chatBox.innerHTML = `
        <div class="bg-gray-800/40 p-5 rounded-2xl rounded-tl-none border border-white/5 max-w-[95%] leading-relaxed space-y-3">
            <p class="text-white font-bold border-b border-white/10 pb-2">📊 Reporte Final del Simulacro</p>
            <p>Tu puntaje fue de <span class="font-black text-cyan-400">${puntaje}%</span>. ${msj}</p>
            <p class="mt-2 text-xs text-gray-300">📈 Probabilidad de Ingreso: <span class="font-black ${colorProb}">${probabilidad}</span></p>
            <div class="mt-4 p-4 bg-black/50 rounded-lg border border-white/5">
                <p class="text-[10px] uppercase text-gray-500 font-bold mb-1">👁️ Análisis de Vigilancia</p>
                <p class="text-xs ${colorVis} italic">${reporteVis}</p>
            </div>
        </div>
    `;
}

// ... (Resto del código intacto: cargarHistorial, cargarNiveles, irAlExamen, cerrarSesion)

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

async function cargarNiveles(plan) {
    const contenedor = document.getElementById('contenedor-niveles');
    const { data } = await _supabase.from('reglas_simulador').select('*').eq('institucion', plan).order('id', { ascending: true });
    
    // NUEVO: Leemos el puntaje reciente (si acaba de hacer examen)
    const params = new URLSearchParams(window.location.search);
    const puntaje = parseInt(params.get('res')) || 100; // Si no hay puntaje, asume 100 para no bloquear
    const estaBloqueado = puntaje < 70;

    let html = '';

    // Si sacó menos de 70, pintamos el botón de Repaso
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

    // Pintamos los botones normales (Bloqueados si aplica)
    if (data) {
        html += data.map(n => {
            // Se bloquea si sacó < 70, o si la BD dice que no es Principiante
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


function irAlExamen(nivel, q, t) {
    localStorage.setItem('simu_nivel', nivel);
    localStorage.setItem('simu_preguntas', q);
    localStorage.setItem('simu_tiempo', t);
    window.location.href = `examen.html?v=${localStorage.getItem('token_hex_hijo')}`; 
}

function cerrarSesion() { localStorage.clear(); window.location.href = 'index.html'; }

window.onload = inicializarDashboard;

// ==========================================
// NUEVO MOTOR DE INTELIGENCIA ARTIFICIAL (IA)
// ==========================================

function actualizarDisplayCreditos() { 
    document.getElementById('creditos-display').innerText = parseInt(localStorage.getItem('simu_creditos')) || 50; 
}

function simularCompra() {
    let creditos = parseInt(localStorage.getItem('simu_creditos')) || 50;
    creditos += 100;
    localStorage.setItem('simu_creditos', creditos);
    actualizarDisplayCreditos();
    printChat("Simu", "¡Energía restablecida!");
}

// Sobrescribimos la función para que, en lugar de solo imprimir el mensaje, llame a la IA
async function mostrarFeedbackIA(puntaje, token) {
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = ''; // Limpiamos el mensaje de bienvenida
    
    // Prompt Oculto para Simu
    const promptInvisible = `
        Eres el tutor de SimuTukur. El estudiante acaba de terminar su examen de ${localStorage.getItem('plan_nombre_completo')}. 
        Su calificación fue ${puntaje}%. Su nivel es Principiante. 
        Salúdalo por su nombre (${localStorage.getItem('nombre_alumno')}), dile brevemente tu evaluación de su puntaje, anímalo y pregúntale en qué reactivo tiene dudas. 
        REGLA ESTRICTA: Tu respuesta no debe superar las 3 o 4 líneas. Sé claro, concreto y no te salgas del tema.
    `;

    // Pintamos un loader mientras Simu piensa el mensaje inicial
    const idLoader = printChat("Simu", "Analizando tus resultados y telemetría...", true);

    try {
        // Hacemos el llamado a Gemini usando la llave global de supabase-client.js
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
        const textoIA = data.candidates[0].content.parts[0].text;
        actualizarLoader(idLoader, textoIA); // Reemplazamos el loader por el saludo
    } catch (e) {
        actualizarLoader(idLoader, `Análisis guardado. Puntaje: ${puntaje}%. ¿En qué puedo ayudarte?`);
    }
}

// Función que se activa cuando el usuario escribe en el input
async function procesarEnvioChat() {
    const input = document.getElementById('user-input');
    const msg = input.value.trim();
    if (!msg) return;

    let creditos = parseInt(localStorage.getItem('simu_creditos')) || 50;
    if (creditos <= 0) { 
        printChat("Simu", "Te has quedado sin Energía IA. Compra más tickets en el botón superior."); 
        return; 
    }

    // Cobramos 1 token
    creditos -= 1;
    localStorage.setItem('simu_creditos', creditos);
    actualizarDisplayCreditos();

    printChat("Tú", msg);
    input.value = '';
    const idLoader = printChat("Simu", "Procesando duda...", true);

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
        const payload = {
            contents: [{ parts: [{ text: msg }] }],
            systemInstruction: { parts: [{ text: "Eres Simu de SimuTukur. REGLA 1: Máximo 3 líneas. REGLA 2: Solo explica dudas académicas sin dar la respuesta directa. REGLA 3: Si preguntan cosas fuera del tema, responde que solo procesas dudas del examen." }] },
            generationConfig: { maxOutputTokens: 100, temperature: 0.2 }
        };

        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error("Interferencia en la red neuronal.");
        
        const data = await response.json();
        actualizarLoader(idLoader, data.candidates[0].content.parts[0].text);
    } catch (e) {
        actualizarLoader(idLoader, e.message, true);
        // Si falla, le devolvemos su token
        localStorage.setItem('simu_creditos', creditos + 1);
        actualizarDisplayCreditos();
    }
}

// Utilidades para pintar los mensajes en el recuadro negro
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
