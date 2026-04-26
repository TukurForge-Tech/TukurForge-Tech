// simulacro_dash.js (Lógica corregida y aislada)

async function validarAccesoPilotoDash() {
    const email = localStorage.getItem('session_email');
    if (!email) { window.location.href = 'acceso_piloto.html'; return; }

    try {
        // Traemos el examen desde la BD
        const { data, error } = await _supabase
            .from('prospectos_simulacro')
            .select('nombre_alumno, examen') 
            .eq('correo', email) 
            .maybeSingle();

        if (error || !data) {
            window.location.href = 'acceso_piloto.html';
            return;
        }

        // Actualizamos el saludo y el Plan Activo
        const saludoSpan = document.getElementById('nombre-span');
        if (saludoSpan) saludoSpan.innerText = data.nombre_tutor || email;

        const planText = document.querySelector('#plan-actual-container span');
        const badgeExamen = document.querySelector('button.btn-tab');

        if (planText) planText.innerText = data.examen || "PLAN ESTÁNDAR";
        if (badgeExamen) badgeExamen.innerText = data.examen || "SIMULACRO";

        // =========================================================
        // NUEVA LÓGICA: Consultar la distribución de materias
        // =========================================================
        let instBusqueda = 'ECOEMS';
        if (data.examen) {
            // Extraer si es UNAM A1, A2, A3, A4, IPN o ECOEMS
            if(data.examen.includes('UNAM')) {
                const partes = data.examen.split('-');
                // ¡AQUÍ ESTÁ EL CAMBIO! Usamos partes[1] en lugar de partes[0]
                if(partes.length > 1) instBusqueda = partes[1].trim(); 
            } else if (data.examen.includes('IPN')) {
                instBusqueda = 'IPN';
            }
        }

        const { data: regla, error: errR } = await _supabase
            .from('reglas_simulador')
            .select('distribucion_materias')
            .eq('institucion', instBusqueda)
            .eq('nivel', 'Avanzado') 
            .maybeSingle();

        if (regla && regla.distribucion_materias) {
            // Mandamos llamar el cálculo matemático para 50 preguntas
            renderizarTimelinePiloto(regla.distribucion_materias, 50); 
        } else {
             document.getElementById('contenedor-historial').innerHTML = "<p class='text-xs text-gray-500 italic p-4'>No se encontró distribución. Usa el formato general.</p>";
        }

        // Gestión de tokens (Energía IA)
        if (!localStorage.getItem('simu_creditos')) {
            localStorage.setItem('simu_creditos', 2);
        }
        document.getElementById('energia-display').innerText = localStorage.getItem('simu_creditos');

    } catch (err) { console.error("Error en validación dash:", err); }
}

function renderizarTimelinePiloto(distReal, totalPiloto) {
    let totalReal = 0;
    let materiasArr = [];

    // 1. Contar total real de preguntas en el examen oficial
    for (let mat in distReal) { totalReal += distReal[mat]; }

    // 2. Calcular cuotas base y decimales para 50 preguntas
    let sumPiloto = 0;
    for (let mat in distReal) {
        let cuotaExacta = (distReal[mat] / totalReal) * totalPiloto;
        let base = Math.floor(cuotaExacta);
        materiasArr.push({ materia: mat, real: distReal[mat], asignadas: base, residuo: cuotaExacta - base });
        sumPiloto += base;
    }

    // 3. Repartir los lugares que faltan por culpa de los decimales
    let faltantes = totalPiloto - sumPiloto;
    materiasArr.sort((a, b) => b.residuo - a.residuo); 
    for (let i = 0; i < faltantes; i++) {
        materiasArr[i].asignadas += 1;
    }

    const contenedor = document.getElementById('contenedor-historial');
    contenedor.innerHTML = ""; // Limpiar el contenedor "Cargando..."

    // 4. Preparar objeto final de distribución para inyectárselo al motor del examen
    const distribucionFinal = {};
    
    // 5. Pintar en el HTML y guardar
    materiasArr.sort((a, b) => b.asignadas - a.asignadas).forEach(m => {
        if (m.asignadas > 0) {
            distribucionFinal[m.materia] = m.asignadas;
            const div = document.createElement('div');
            div.className = "flex items-center space-x-3 p-2 border-l-2 border-cyan-500/20 hover:border-cyan-400 transition-all";
            div.innerHTML = `
                <div class="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></div>
                <div>
                    <p class="text-sm font-black text-white uppercase tracking-wide">${m.materia}</p>
                    <p class="text-xs text-gray-400 mt-0.5">Reactivos: <span class="font-bold text-cyan-400">${m.asignadas}</span></p>
                </div>
            `;
            contenedor.appendChild(div);
        }
    });
    
    // ¡CRÍTICO! Guardamos esta distribución en el localStorage para que simulacro_motor.html sepa cuántas sacar de cada una.
    localStorage.setItem('piloto_distribucion', JSON.stringify(distribucionFinal));
}

// Adecuación 9: Iniciar el Simulacro Piloto a motor.html
function iniciarSimulacro() {
    localStorage.setItem('simu_nivel', 'PILOTO_VIP'); // Nivel adaptativo Medio-Alto
    localStorage.setItem('simu_preguntas', 50);
    localStorage.setItem('simu_tiempo', 75);
    window.location.href = 'simulacro_motor.html'; // Tu motor aislado
}

async function checarSiTerminoExamen() {
    if (localStorage.getItem('simu_terminado') === 'true') {
        
        // Bloqueamos el botón de examen para que no lo vuelva a hacer
        document.getElementById('contenedor-niveles').innerHTML = `
            <div class="card-glass p-5 border-gray-800 opacity-50">
                <h4 class="text-gray-500 font-bold text-xs uppercase italic tracking-tighter mb-2"><i class="fa-solid fa-check mr-1"></i> Simulacro Piloto</h4>
                <p class="text-sm font-black text-gray-600">Evaluación Completada</p>
                <p class="text-[9px] text-gray-700 font-bold mt-2 uppercase"><i class="fa-solid fa-lock"></i> Finalizado</p>
            </div>
        `;
        
        const aciertos = localStorage.getItem('simu_aciertos') || 0;
        const fallas = JSON.parse(localStorage.getItem('simu_fallas') || '[]');
        const incAudio = JSON.parse(localStorage.getItem('simu_inc_audio') || '[]').length;
        const incVideo = JSON.parse(localStorage.getItem('simu_inc_video') || '[]').length;

        const semaforoAudio = incAudio <= 2 ? '🟢 Excelente' : (incAudio <= 5 ? '🟡 Precaución' : '🔴 Crítico');
        const semaforoVideo = incVideo <= 2 ? '🟢 Excelente' : (incVideo <= 5 ? '🟡 Precaución' : '🔴 Crítico');
        const colorCalif = aciertos >= 40 ? 'text-green-500' : 'text-red-500';

        // INCIDENCIA 4a: Pintamos los resultados ADENTRO del Chat de la IA
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = `
            <div class="mb-3 animate-fade-in">
                <div class="bg-gray-800/80 p-5 rounded-2xl rounded-tl-none border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)] text-gray-200">
                    <strong class="color-cian font-black italic text-[11px] uppercase flex items-center gap-2 mb-4 border-b border-white/10 pb-2"><i class="fa-solid fa-brain"></i> Análisis Oficial ECOEMS</strong>
                    
                    <div class="text-center mb-4">
                        <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Tu Puntaje Global</p>
                        <p class="text-4xl font-black ${colorCalif}">${aciertos} <span class="text-lg text-gray-500">/ 60</span></p>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-2 mb-6">
                        <div class="bg-black/60 p-3 rounded-xl border border-slate-700 flex flex-col items-center text-center justify-center">
                            <span class="text-[9px] uppercase font-bold text-gray-400 mb-1"><i class="fa-solid fa-microphone"></i> Audio</span>
                            <span class="text-[10px] uppercase font-bold">${semaforoAudio}</span>
                        </div>
                        <div class="bg-black/60 p-3 rounded-xl border border-slate-700 flex flex-col items-center text-center justify-center">
                            <span class="text-[9px] uppercase font-bold text-gray-400 mb-1"><i class="fa-solid fa-camera"></i> Video</span>
                            <span class="text-[10px] uppercase font-bold">${semaforoVideo}</span>
                        </div>
                    </div>

                    <p class="text-[10px] uppercase text-cyan-400 font-black mb-3 tracking-widest"><i class="fa-solid fa-bullseye mr-1"></i> Áreas de Oportunidad</p>
                    <div id="lista-fallas" class="space-y-3 max-h-64 overflow-y-auto pr-2 scroll-smooth"></div>
                </div>
            </div>
        `;

        const listaHtml = document.getElementById('lista-fallas');
        fallas.forEach((falla) => {
            listaHtml.innerHTML += `
                <div class="bg-black/50 border border-slate-700/50 p-4 rounded-xl mb-3">
                    <span class="text-red-400 text-[10px] font-black uppercase mb-1.5 block tracking-widest">${falla.materia}</span>
                    <p class="text-gray-200 text-sm font-medium mb-3 line-clamp-3">${falla.pregunta}</p>
                    <button onclick="pedirExplicacionIA('${encodeURIComponent(falla.pregunta)}', '${encodeURIComponent(falla.correcta)}')" 
                            class="text-cyan-400 font-bold uppercase hover:text-cyan-300 transition w-full text-center border border-cyan-900 bg-cyan-900/20 py-2 rounded-lg text-[10px] tracking-wider">
                        <i class="fa-solid fa-brain mr-1"></i> Explicar con IA (1⚡)
                    </button>
                </div>
            `;
        });

        // NUEVO: Renderizar matemáticas de la lista de errores
        if (typeof MathJax !== 'undefined') {
            MathJax.typesetPromise();
        }
        document.getElementById('chat-box').scrollTop = 0;
    }
}

// 6. La Función Monitoreada por Tokens
async function pedirExplicacionIA(preguntaCodificada, respuestaCodificada) {
    let tokens = parseInt(localStorage.getItem('simu_creditos')) || 0;
    if (tokens <= 0) {
        alert("No tienes Energía IA suficiente. Debes recargar.");
        return;
    }

    // Cobrar Token
    tokens--;
    localStorage.setItem('simu_creditos', tokens);
    document.getElementById('energia-display').innerText = tokens;
    // Aquí actualizarías el número en tu HTML: document.getElementById('tokens-display').innerText = tokens;
    
    const pregunta = decodeURIComponent(preguntaCodificada);
    const correcta = decodeURIComponent(respuestaCodificada);

    // Mandar mensaje al chat de la izquierda
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML += `
        <div class="mb-3 flex justify-end">
            <div class="bg-cyan-900/40 p-3 rounded-xl rounded-tr-none border border-cyan-500/30 max-w-[85%] text-sm text-cyan-100">
                Por favor, explícame por qué la respuesta a "${pregunta.substring(0, 30)}..." es correcta.
            </div>
        </div>
        <div class="mb-3 text-center"><i class="fa-solid fa-circle-notch fa-spin text-cyan-500"></i></div>
    `;

    try {
        const { data, error } = await _supabase.functions.invoke('explicacion_ia', {
            body: { 
                pregunta: pregunta, 
                correcta: correcta 
            }
        });

        if (error) throw error;
        
        const respuestaLibreIA = data.respuesta;

        chatBox.lastElementChild.remove(); // Quita spinner
        
        // Inyectamos la respuesta libre de la IA al chat
        chatBox.innerHTML += `
            <div class="mb-3 animate-fade-in">
                <div class="bg-gray-800/60 p-5 rounded-2xl rounded-tl-none border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm text-gray-200">
                    <strong class="color-cian font-black italic text-[11px] uppercase flex items-center gap-2 mb-3 border-b border-white/10 pb-2"><i class="fa-solid fa-brain"></i> Análisis Profundo IA</strong>
                    
                    <div class="leading-relaxed space-y-2">
                        ${respuestaLibreIA}
                    </div>
                    
                    <div class="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                        <span class="text-[9px] text-gray-500 uppercase tracking-widest">Explicación Generada</span>
                        <span class="text-[10px] text-yellow-500 font-bold bg-yellow-900/20 px-2 py-1 rounded-md">⚡ Te quedan ${tokens} tokens</span>
                    </div>
                </div>
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;

        // NUEVO: Renderizar matemáticas de la respuesta de la IA
        if (typeof MathJax !== 'undefined') {
            MathJax.typesetPromise();
        }

    } catch (error) {
        console.error("Error conectando con la IA:", error);
        chatBox.lastElementChild.remove();
        chatBox.innerHTML += `<div class="text-red-500 text-xs text-center p-2 bg-red-900/20 rounded">Error de conexión con el Búho IA. Intenta de nuevo.</div>`;
        
        // Le regresamos su token porque hubo error
        tokens++;
        localStorage.setItem('simu_creditos', tokens);
        document.getElementById('energia-display').innerText = tokens;
    }

    /*setTimeout(() => {
        chatBox.lastElementChild.remove(); // Quita spinner
        chatBox.innerHTML += `
            <div class="mb-3">
                <div class="bg-gray-800/60 p-4 rounded-xl rounded-tl-none border border-white/5 max-w-[85%] shadow-sm text-sm text-gray-200">
                    <strong class="color-cian font-black italic text-[10px] uppercase flex items-center gap-2 mb-2"><i class="fa-solid fa-brain"></i> Tutor Simu</strong>
                    <p>La respuesta correcta es <strong>${correcta}</strong> porque... [AQUÍ VA LA RESPUESTA DE TU IA].</p>
                    <hr class="border-white/10 my-2">
                    <p class="text-[10px] text-yellow-500">⚡ Te quedan ${tokens} tokens. Selecciona otra pregunta en el panel derecho si deseas otra explicación.</p>
                </div>
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 2000); // Simulación de tiempo de respuesta*/
}

// Iniciar protocolo al cargar
window.onload = async () => {
    await validarAccesoPilotoDash(); // Checa quién entró
    await checarSiTerminoExamen();   // Checa si viene regresando del examen
};
