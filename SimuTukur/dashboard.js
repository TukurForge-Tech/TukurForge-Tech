// dashboard.js - Lógica del Panel de Control

async function inicializarDashboard() {
    const email = localStorage.getItem('session_email');
    if (!email) { window.location.href = 'index.html'; return; }

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

        suscripciones.forEach((s, index) => {
            const nombreTab = s.config_examenes.area ? `${s.config_examenes.institucion} ${s.config_examenes.area}` : s.config_examenes.institucion;
            const btn = document.createElement('button');
            btn.className = `btn-tab px-6 py-3 rounded-full text-xs font-black uppercase whitespace-nowrap`;
            btn.innerText = nombreTab;
            btn.onclick = () => seleccionarCurso(s, btn);
            contenedorTabs.appendChild(btn);
            if (index === 0) seleccionarCurso(s, btn);
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
    const { data } = await _supabase.from('reglas_simulador').select('*').eq('institucion', plan).order('id', { ascending: true });
    const contenedor = document.getElementById('contenedor-niveles');
    contenedor.innerHTML = data.map(n => {
        const isLocked = n.nivel !== 'Principiante';
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

function irAlExamen(nivel, q, t) {
    localStorage.setItem('simu_nivel', nivel);
    localStorage.setItem('simu_preguntas', q);
    localStorage.setItem('simu_tiempo', t);
    window.location.href = `examen.html?v=${localStorage.getItem('token_hex_hijo')}`; 
}

function cerrarSesion() { localStorage.clear(); window.location.href = 'index.html'; }

window.onload = inicializarDashboard;
