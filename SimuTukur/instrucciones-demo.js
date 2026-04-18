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
/*function calcularYRenderizarProporciones(distReal) {
    let totalReal = 0;
    const totalDemo = 15;
    let materiasArr = [];

    // Contar total real
    for (let mat in distReal) { totalReal += distReal[mat]; }

    // Calcular cuotas base y residuos
    let sumDemo = 0;
    for (let mat in distReal) {
        let cuotaExacta = (distReal[mat] / totalReal) * totalDemo;
        let base = Math.floor(cuotaExacta);
        materiasArr.push({ materia: mat, real: distReal[mat], asignadas: base, residuo: cuotaExacta - base });
        sumDemo += base;
    }

    // Repartir los lugares que faltan por culpa de los decimales
    let faltantes = totalDemo - sumDemo;
    materiasArr.sort((a, b) => b.residuo - a.residuo); // Ordenar por quien "merece" más el decimal
    for (let i = 0; i < faltantes; i++) {
        materiasArr[i].asignadas += 1;
    }

    // Preparar objeto final y renderizar HTML
    distribucionFinalDemo = {};
    let html = "";
    
    // Lo ordenamos de mayor a menor para que se vea premium
    materiasArr.sort((a, b) => b.asignadas - a.asignadas).forEach(m => {
        if (m.asignadas > 0) {
            distribucionFinalDemo[m.materia] = m.asignadas;
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
}*/

// ALGORITMO DE REPARTO PROPORCIONAL EXACTO (Largest Remainder Method)
/*function calcularYRenderizarProporciones(distReal) {
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

    // Preparar objeto final para el examen (Mantiene todo separado)
    distribucionFinalDemo = {};
    materiasArr.forEach(m => {
        if (m.asignadas > 0) distribucionFinalDemo[m.materia] = m.asignadas;
    });

    // --- MAGIA VISUAL: Consolidar Español y Comprensión para la tabla ---
    let vistaMaterias = {};
    materiasArr.forEach(m => {
        let nombreVista = m.materia;
        // Si es Comprensión, la sumamos a Español para la vista
        if (nombreVista === 'Comprensión de Textos' || nombreVista === 'Habilidad Verbal') { // Ajusta el nombre si usas ECOEMS
            nombreVista = 'Español';
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
    // Lo ordenamos de mayor a menor para que se vea premium
    vistaArr.sort((a, b) => b.asignadas - a.asignadas).forEach(m => {
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
}*/

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
    // Lo ordenamos de mayor a menor para que se vea premium
    vistaArr.sort((a, b) => b.asignadas - a.asignadas).forEach(m => {
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

    // GUARDADO ESTRATÉGICO EN MEMORIA PARA EL MOTOR
    localStorage.setItem('demo_email_capturado', emailInput);
    localStorage.setItem('demo_token_hex', tokenHex);
    localStorage.setItem('demo_institucion', configData.institucion);
    localStorage.setItem('demo_area', configData.area);
    
    // Aquí le pasamos el JSON con la distribución matemática exacta al examen
    localStorage.setItem('demo_distribucion_materias', JSON.stringify(distribucionFinalDemo));
    
    // Limpieza de caché de exámenes pasados
    localStorage.removeItem('simu_fallas');
    localStorage.removeItem('simu_aciertos');
    localStorage.setItem('simu_creditos', 2); // Regalo IA
    
    setTimeout(() => { window.location.href = 'examen-demo.html'; }, 800);
}

document.addEventListener("DOMContentLoaded", () => {
    inicializarEntorno();
    document.getElementById('email-demo')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') arrancarDemo();
    });
});
