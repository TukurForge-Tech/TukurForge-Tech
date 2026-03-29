// dashboard.js - Lógica del Panel de Control y Asistente IA

// ==========================================
// 1. INICIALIZACIÓN Y NAVEGACIÓN DE CURSOS
// ==========================================
async function inicializarDashboard() {
    const email = localStorage.getItem('session_email');
    if (!email) { window.location.href = 'index.html'; return; }

    try {
        const { data: suscripciones, error } = await _supabase
            .from('usuarios_membresias')
            .select('*, config_examenes(*)')
            .eq('email', email);

        if (error || !suscripciones || suscripciones.length === 0) {
            document.getElementById('pestanas-cursos').innerHTML = "<p class='text-sm text-red-500 font-bold uppercase'>Error de vinculación o sin cursos activos.</p>";
            return;
        }

        const contenedorTabs = document.getElementById('pestanas-cursos');
        contenedorTabs.innerHTML = "";

        suscripciones.forEach((s, index) => {
            const nombreTab = s.config_examenes.area ? `${s.config_examenes.institucion} ${s.config_examenes.area}` : s.config_examenes.institucion;
            const btn = document.createElement('button');
            btn.className = `btn-tab px-6 py-3 rounded-full text-xs font-black uppercase whitespace-nowrap bg-gray-800 text-gray-400 hover:text-white transition-colors`;
            btn.innerText = nombreTab;
            btn.onclick = () => seleccionarCurso(s, btn);
            contenedorTabs.appendChild(btn);
            
            // Seleccionar el primero por defecto
            if (index === 0) seleccionarCurso(s, btn);
        });
    } catch (err) { console.error("Error inicializando dashboard:", err); }
}

async function seleccionarCurso(data, btn) {
    // UI: Resaltar botón activo
    document.querySelectorAll('.btn-tab').forEach(b => {
        b.classList.remove('bg-cyan-600', 'text-white');
        b.classList.add('bg-gray-800', 'text-gray-400');
    });
    btn.classList.remove('bg-gray-800', 'text-gray-400');
    btn.classList.add('bg-cyan-600', 'text-white');

    // Memoria local para el simulador
    localStorage.setItem('plan_institucion', data.config_examenes.institucion);
    localStorage.setItem('plan_area', data.config_examenes.area || '');
    localStorage.setItem('plan_nombre_completo', btn.innerText);

    // Cargar los niveles disponibles
    await cargarNiveles(data.config_examenes.institucion);

    // 🧠 INYECTAR LA INTELIGENCIA ARTIFICIAL
    obtenerConsejosIA(btn.innerText);
}

// ==========================================
// 2. CARGA DE NIVELES / SIMULADORES
// ==========================================
async function cargarNiveles(plan) {
    const { data } = await _supabase
        .from('reglas_simulador')
        .select('*')
        .eq('institucion', plan)
        .order('id', { ascending: true });
        
    const contenedor = document.getElementById('contenedor-niveles');
    
    if(!data || data.length === 0) {
        contenedor.innerHTML = "<p class='text-xs text-gray-500'>Niveles en construcción...</p>";
        return;
    }

    contenedor.innerHTML = data.map(n => {
        const isLocked = n.nivel !== 'Principiante'; 
        
        return `
            <div class="bg-gray-900/50 p-5 rounded-2xl border ${isLocked ? 'border-gray-800 opacity-50 cursor-not-allowed' : 'border-cyan-500/30 hover:border-cyan-500/80 cursor-pointer hover:-translate-y-1 transition-all'} " onclick="${isLocked ? '' : `irAlExamen('${n.nivel}', ${n.cantidad_preguntas}, ${n.tiempo_minutos})`}">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-cyan-400 font-bold text-xs uppercase italic tracking-tighter">${n.nivel}</h4>
                    <i class="fa-solid ${isLocked ? 'fa-lock text-gray-700' : 'fa-play text-cyan-400'} text-sm"></i>
                </div>
                <p class="text-base font-black text-white">${n.cantidad_preguntas} Reactivos <span class="text-gray-500 font-normal">| ${n.tiempo_minutos} Min</span></p>
            </div>`;
    }).join('');
}

function irAlExamen(nivel, q, t) {
    localStorage.setItem('simu_nivel', nivel);
    localStorage.setItem('simu_preguntas', q);
    localStorage.setItem('simu_tiempo', t);
    window.location.href = 'examen.html'; 
}

function cerrarSesion() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// ==========================================
// 3. 🧠 MOTOR DEL CHAT DE INTELIGENCIA ARTIFICIAL (SIMU)
// ==========================================

async function obtenerConsejosIA(nombreCurso) {
    const email = localStorage.getItem('session_email');
    const params = new URLSearchParams(window.location.search);
    const recienTerminado = params.has('res'); // ¿Viene regresando de un examen?

    document.getElementById('chat-box').innerHTML = ''; // Limpiar chat anterior
    agregarMensajeChat("Simu", `Analizando tu telemetría y desempeño en **${nombreCurso}**... ⏳`);

    try {
        if (recienTerminado) {
            // LIMPIAR URL: Quitamos el ?res= para que no se repita si recarga la página
            window.history.replaceState({}, document.title, window.location.pathname);

            // Buscar en BD los resultados exactos del examen que acaba de terminar
            const [{ data: examenes }, { data: vigilancia }] = await Promise.all([
                _supabase.from('resultados_examenes').select('*').eq('email', email).order('created_at', { ascending: false }).limit(1),
                _supabase.from('analisis_vigilancia_ia').select('*').eq('email', email).order('timestamp', { ascending: false }).limit(1)
            ]);

            document.getElementById('chat-box').innerHTML = '';

            if (examenes && examenes.length > 0) {
                const ultimoExamen = examenes[0];
                const jsonDetalles = ultimoExamen.detalles || {};
                const puntaje = ultimoExamen.puntaje_obtenido || params.get('res');
                
                // Cálculo de probabilidad
                let prob = "Baja 🔴";
                if (puntaje >= 50 && puntaje < 80) prob = "Media 🟡";
                if (puntaje >= 80) prob = "Alta 🟢";

                // 1. REPORTE GENERAL INMEDIATO
                let msgAnalisis = `¡Bienvenido de vuelta! Terminaste tu simulacro de **${nombreCurso}**.<br><br>`;
                msgAnalisis += `🎯 **Puntaje:** ${Math.round(puntaje)}%<br>`;
                msgAnalisis += `📈 **Probabilidad de Ingreso:** ${prob}<br>`;
                
                if (vigilancia && vigilancia.length > 0) {
                    msgAnalisis += `👁️ **Vigilancia:** <span class="text-gray-400">${vigilancia[0].analisis_ia}</span><br>`;
                }
                agregarMensajeChat("Simu", msgAnalisis);

                // 2. RETOS RÁPIDOS (FALLAS ESPECÍFICAS)
                if (jsonDetalles.consejos_ia && jsonDetalles.consejos_ia.length > 0) {
                    agregarMensajeChat("Simu", `🔥 **Aquí tienes tus Retos Rápidos basados en las preguntas que fallaste en esta sesión:**`);
                    jsonDetalles.consejos_ia.forEach(consejo => {
                        agregarMensajeChat("Simu", consejo);
                    });
                } else if (puntaje >= 90) {
                    agregarMensajeChat("Simu", `¡Excelente trabajo! No detecté fallas críticas. Tienes un dominio casi perfecto. 🏆`);
                } else {
                    // Si no hubo consejos guardados, llamamos al historial general
                    fetchFallosGenerales(email, nombreCurso);
                }
            }
        } else {
            // Lógica normal de cuando entra al dashboard (Historial General)
            fetchFallosGenerales(email, nombreCurso);
        }

    } catch (error) {
        console.error("Error al cargar IA:", error);
        document.getElementById('chat-box').innerHTML = ''; 
        agregarMensajeChat("Simu", "Hubo un pequeño error al cargar tu telemetría, pero el simulador está listo para ti.");
    }
}

// Función auxiliar para leer los últimos 5 fallos históricos si no viene de un examen
async function fetchFallosGenerales(email, nombreCurso) {
    const { data: errores } = await _supabase
        .from('bitacora_reactivos_vistos')
        .select('reactivo_id')
        .eq('email', email)
        .eq('es_correcto', false)
        .order('created_at', { ascending: false })
        .limit(5);

    document.getElementById('chat-box').innerHTML = ''; 

    if (!errores || errores.length === 0) {
        agregarMensajeChat("Simu", `¡Hola! Veo que vas perfecto o aún no has hecho simulacros de **${nombreCurso}**. <br><br>💡 **Mi sugerencia:** Elige un nivel en el panel derecho para empezar tu entrenamiento. Mientras respondas, yo detectaré tus áreas débiles y te daré 'Retos Rápidos' para mejorar.`);
        return;
    }

    const ids = errores.map(e => e.reactivo_id);
    const { data: reactivos_fallados } = await _supabase
        .from('reactivos')
        .select('materia, explicacion_ia')
        .in('id', ids);

    agregarMensajeChat("Simu", `¡Hola de nuevo! Analicé tu historial de simulacros. Noté algunas áreas de oportunidad en las que podemos trabajar. <br><br>🔥 **Aquí tienes Retos Rápidos para repasar:**`);

    let materiasMostradas = new Set();
    reactivos_fallados.forEach(r => {
        if (r.explicacion_ia && !materiasMostradas.has(r.materia)) {
            materiasMostradas.add(r.materia);
            agregarMensajeChat("Simu", `📌 **En ${r.materia}:**<br><span class="text-gray-300">${r.explicacion_ia}</span>`);
        }
    });

    if(materiasMostradas.size === 0) {
         agregarMensajeChat("Simu", "Te sugiero repasar tus apuntes generales. ¡Sigue practicando, cada intento cuenta!");
    }
}

// Lógica Visual del Chat (Burbujas)
function agregarMensajeChat(remitente, mensaje) {
    const chatBox = document.getElementById('chat-box');
    const div = document.createElement('div');
    
    // Formato de texto simple (convierte **negritas** a <b>negritas</b> para que se vea bonito)
    const msjFormateado = mensaje.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-400">$1</strong>');

    if (remitente === "Simu") {
        div.className = "bg-gray-800/60 p-5 rounded-2xl rounded-tl-none border border-white/5 max-w-[90%] leading-relaxed text-gray-200 shadow-md";
        div.innerHTML = `<strong class="text-cyan-400 font-black italic text-xs uppercase mb-2 flex items-center gap-2"><i class="fa-solid fa-robot"></i> SIMU IA</strong> ${msjFormateado}`;
    } else {
        div.className = "bg-cyan-900/60 p-5 rounded-2xl rounded-tr-none border border-cyan-500/30 max-w-[85%] leading-relaxed text-white ml-auto shadow-md";
        div.innerHTML = `<strong class="text-cyan-200 font-black italic text-xs uppercase mb-2 flex items-center justify-end gap-2">TÚ <i class="fa-solid fa-user"></i></strong> ${msjFormateado}`;
    }
    
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll hacia abajo
}

// Cuando el usuario escribe algo manual en la caja de texto
function enviarMensajeUsuario() {
    const input = document.getElementById('user-input');
    const msj = input.value.trim();
    if(!msj) return;

    // Pintar mensaje del usuario
    agregarMensajeChat("Tú", msj);
    input.value = '';

    // Respuesta programada del bot
    setTimeout(() => {
        agregarMensajeChat("Simu", "Por ahora mi red neuronal está concentrada 100% en analizar tu telemetría de fallos. Realiza un simulacro y regresaré aquí con consejos automáticos basados en tus errores. ¡A trabajar!");
    }, 800);
}
