// instrucciones-demo.js - Arquitectura de Captura y Matemáticas Proporcionales

const params = new URLSearchParams(window.location.search);
const tokenHex = params.get('v');
let distribucionFinalDemo = null; 
let configData = null;

async function inicializarEntorno() {
    if (!tokenHex) {
        alert("Token de examen no válido.");
        window.location.href = 'index.html';
        return;
    }

    try {
        // 1. Extraer configuración del token
        const { data: config, error: errConf } = await _supabase
            .from('config_examenes')
            .select('institucion, area')
            .eq('token_hex', tokenHex)
            .single();

        if (errConf || !config) throw errConf;
        configData = config;

        // 2. Armar llave de búsqueda (Ej. "ECOEMS" o "UNAM A1")
        const instBusqueda = (config.institucion === 'ECOEMS') 
            ? 'ECOEMS' 
            : `${config.institucion} ${config.area}`;
            
        document.getElementById('lbl-institucion').innerText = instBusqueda;

        // 3. Buscar el JSON de distribución en el nivel Avanzado
        const { data: regla, error: errRegla } = await _supabase
            .from('reglas_simulador')
            .select('distribucion_materias')
            .eq('institucion', instBusqueda)
            .eq('nivel', 'Avanzado')
            .single();

        if (errRegla || !regla || !regla.distribucion_materias) {
            document.getElementById('tabla-materias').innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-400">Distribución no encontrada.</td></tr>`;
            return;
        }

        // 4. Inyectar a la Lógica Proporcional
        calcularYRenderizarProporciones(regla.distribucion_materias);

    } catch (error) {
        console.error(error);
        alert("Error cargando la matriz del examen.");
    }
}

// ALGORITMO DE REPARTO PROPORCIONAL EXACTO (Largest Remainder Method)
function calcularYRenderizarProporciones(distReal) {
    let totalReal = 0;
    const totalDemo = 15;
    let materiasArr = [];

    // Contar total real
    for (let mat in distReal) { totalReal += distReal[mat]; }

    // Calcular cuotas base y residuos para el motor (INTERNO)
    let sumDemo = 0;
    for (let mat in distReal) {
        let cuotaExacta = (distReal[mat] / totalReal) * totalDemo;
        let base = Math.floor(cuotaExacta);
        materiasArr.push({ materia: mat, real: distReal[mat], asignadas: base, residuo: cuotaExacta - base });
        sumDemo += base;
    }

    // Repartir los lugares que faltan por culpa de los decimales
    let faltantes = totalDemo - sumDemo;
    materiasArr.sort((a, b) => b.residuo - a.residuo); 
    for (let i = 0; i < faltantes; i++) {
        materiasArr[i].asignadas += 1;
    }

    // Preparar objeto final para el examen (Mantiene todo separado y exacto a la BD)
    distribucionFinalDemo = {};
    materiasArr.forEach(m => {
        if (m.asignadas > 0) distribucionFinalDemo[m.materia] = m.asignadas;
    });

    // --- MAGIA VISUAL: Consolidar SOLO para UNAM ---
    let vistaMaterias = {};
    materiasArr.forEach(m => {
        let nombreVista = m.materia;
        
        // REGLA DE NEGOCIO: Solo si es UNAM, sumamos Comprensión a Español
        if (configData && configData.institucion === 'UNAM') {
            if (nombreVista === 'Comprensión de Textos') {
                nombreVista = 'Español';
            }
        }
        
        if (!vistaMaterias[nombreVista]) {
            vistaMaterias[nombreVista] = { real: 0, asignadas: 0 };
        }
        vistaMaterias[nombreVista].real += m.real;
        vistaMaterias[nombreVista].asignadas += m.asignadas;
    });

    // Convertir el objeto de vista a un arreglo para ordenarlo
    let vistaArr = Object.keys(vistaMaterias).map(k => ({
        materia: k,
        real: vistaMaterias[k].real,
        asignadas: vistaMaterias[k].asignadas
    }));

    // --- RENDERIZAR HTML ---
    let html = "";
    // 🛡️ CORRECCIÓN: Ordenamos primero por el Demo, y si empatan, desempatamos por el Examen Real
    vistaArr.sort((a, b) => {
        if (b.asignadas !== a.asignadas) {
            return b.asignadas - a.asignadas; // 1. Ordenar por preguntas del Demo
        }
        return b.real - a.real; // 2. Desempate: Ordenar por preguntas Reales
    }).forEach(m => {
        if (m.asignadas > 0) {
            html += `
                <tr class="hover:bg-white/5 transition">
                    <td class="p-3 font-bold">${m.materia}</td>
                    <td class="p-3 text-center text-gray-400">${m.real}</td>
                    <td class="p-3 text-center font-black text-cyan-400 bg-cyan-900/10">${m.asignadas}</td>
                </tr>
            `;
        }
    });

    document.getElementById('tabla-materias').innerHTML = html;
    document.getElementById('lbl-total-real').innerText = totalReal;

    // Habilitar Botón
    const btn = document.getElementById('btn-comenzar');
    btn.disabled = false;
    btn.className = "w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all transform hover:-translate-y-1";
    btn.innerHTML = 'Comenzar Diagnóstico <i class="fa-solid fa-play ml-2"></i>';
}

function arrancarDemo() {
    const emailInput = document.getElementById('email-demo').value.trim();
    const errorMsg = document.getElementById('msg-error');
    const btnComenzar = document.getElementById('btn-comenzar');
    
    if (!emailInput || !emailInput.includes('@') || !emailInput.includes('.')) {
        errorMsg.classList.remove('hidden');
        return;
    }

    errorMsg.classList.add('hidden');
    btnComenzar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Preparando Entorno...';
    btnComenzar.disabled = true;

    // 🛡️ MAGIA DE TOKENS: Anclamos la energía al correo del prospecto
    let tokensDelProspecto = localStorage.getItem(`demo_energia_${emailInput}`);
    if (tokensDelProspecto === null) {
        localStorage.setItem(`demo_energia_${emailInput}`, 2);
    }

    // GUARDADO ESTRATÉGICO
    localStorage.setItem('demo_email_capturado', emailInput);
    localStorage.setItem('demo_token_hex', tokenHex);
    localStorage.setItem('demo_institucion', configData.institucion);
    localStorage.setItem('demo_area', configData.area);
    localStorage.setItem('demo_distribucion_materias', JSON.stringify(distribucionFinalDemo));
    
    localStorage.removeItem('simu_fallas');
    localStorage.removeItem('simu_aciertos');

    const nombreExamenGuardado = configData.institucion + (configData.area && configData.area !== 'GENERAL' ? ' ' + configData.area : '');
    
    _supabase.from('prospectos_simulacro').insert([{
        correo: emailInput,
        nombre_tutor: "Prospecto Demo",     // Comodín para cumplir regla de tabla
        dia_elegido: "Demo Permanente",     // Comodín para cumplir regla de tabla
        examen: nombreExamenGuardado,
        token_hex: tokenHex,
        tokens_ia: 2,
        terminos_aceptados: true
    }]).then(({error}) => {
        if(error) console.warn("Error guardando prospecto:", error);
    });
    
    // 🎬 INYECCIÓN DEL VIDEO OFICIAL 
    const overlayHtml = `
        <div id="video-overlay" class="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in">
            <video id="video-instrucciones" class="w-full max-w-4xl rounded-xl shadow-[0_0_40px_rgba(6,182,212,0.4)]" autoplay playsinline>
                <source src="https://pcuopqvmucmhtcdeswxh.supabase.co/storage/v1/object/public/reactivos-assets/SimuTukur/SimuTukur.mp4" type="video/mp4">
            </video>
            <button onclick="saltarVideo()" class="mt-8 text-gray-400 hover:text-white uppercase tracking-widest text-[10px] font-black transition-colors">
                Omitir Video <i class="fa-solid fa-forward-step ml-1"></i>
            </button>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', overlayHtml);
    
    // Lógica para saltar al examen cuando termine el video
    const vid = document.getElementById('video-instrucciones');
    vid.onended = saltarVideo;
}

// Función global para saltar o cuando termine el video
window.saltarVideo = function() {
    window.location.href = `examen-demo.html?v=${localStorage.getItem('demo_token_hex')}`;
}

document.addEventListener("DOMContentLoaded", () => {
    inicializarEntorno();
    document.getElementById('email-demo')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') arrancarDemo();
    });
});
