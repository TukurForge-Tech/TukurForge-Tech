// dash-demo.js - El Cierre de Ventas y Análisis

function inicializarDashDemo() {
    const correo = localStorage.getItem('demo_email_capturado') || 'Aspirante';
    const institucion = localStorage.getItem('demo_institucion');
    const area = localStorage.getItem('demo_area');
    
    document.getElementById('lbl-correo-lead').innerText = correo;
    document.getElementById('lbl-matriz-usada').innerText = (institucion === 'ECOEMS') ? 'ECOEMS' : `${institucion} ${area}`;

    // Extraer datos del demo
    const aciertos = parseInt(localStorage.getItem('simu_aciertos')) || 0;
    const totalPreguntas = parseInt(localStorage.getItem('demo_total_preguntas')) || 15;
    const fallas = JSON.parse(localStorage.getItem('simu_fallas') || '[]');
    
    // Semáforo de Telemetría
    const incAudio = JSON.parse(localStorage.getItem('simu_inc_audio') || '[]').length;
    const incVideo = JSON.parse(localStorage.getItem('simu_inc_video') || '[]').length;

    const semaforoAudio = incAudio === 0 ? '🟢 Excelente' : (incAudio <= 2 ? '🟡 Ruido Menor' : '🔴 Crítico');
    const semaforoVideo = incVideo === 0 ? '🟢 Excelente' : (incVideo <= 2 ? '🟡 Distracción' : '🔴 Crítico');
    
    const score = (aciertos / totalPreguntas) * 100;
    const colorCalif = score >= 70 ? 'text-green-500' : 'text-red-500';

    // Pintar resultados en el chat
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML = `
        <div class="mb-3 animate-fade-in">
            <div class="bg-gray-800/80 p-5 rounded-2xl rounded-tl-none border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)] text-gray-200">
                <strong class="text-cyan-400 font-black italic text-[11px] uppercase flex items-center gap-2 mb-4 border-b border-white/10 pb-2"><i class="fa-solid fa-brain"></i> Análisis Oficial de Diagnóstico</strong>
                
                <div class="text-center mb-6">
                    <p class="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Aciertos Totales</p>
                    <p class="text-5xl font-black ${colorCalif}">${aciertos} <span class="text-xl text-gray-500">/ ${totalPreguntas}</span></p>
                    <p class="text-xs mt-2 ${colorCalif} font-bold">${score >= 70 ? 'Competitivo' : 'Requiere Entrenamiento Urgente'}</p>
                </div>
                
                <div class="grid grid-cols-2 gap-3 mb-6">
                    <div class="bg-black/60 p-3 rounded-xl border border-slate-700 flex flex-col items-center text-center">
                        <span class="text-[9px] uppercase font-bold text-gray-400 mb-1"><i class="fa-solid fa-microphone"></i> Concentración Audio</span>
                        <span class="text-[10px] uppercase font-bold">${semaforoAudio}</span>
                    </div>
                    <div class="bg-black/60 p-3 rounded-xl border border-slate-700 flex flex-col items-center text-center">
                        <span class="text-[9px] uppercase font-bold text-gray-400 mb-1"><i class="fa-solid fa-camera"></i> Monitoreo Visual</span>
                        <span class="text-[10px] uppercase font-bold">${semaforoVideo}</span>
                    </div>
                </div>

                <p class="text-[10px] uppercase text-cyan-400 font-black mb-3 tracking-widest border-b border-white/10 pb-2"><i class="fa-solid fa-bullseye mr-1"></i> Mapa de Vulnerabilidades (Fallas)</p>
                <div id="lista-fallas" class="space-y-3 max-h-72 overflow-y-auto pr-2 scroll-smooth"></div>
            </div>
        </div>
    `;

    const listaHtml = document.getElementById('lista-fallas');
    
    if (fallas.length === 0) {
        listaHtml.innerHTML = `<p class="text-center text-gray-500 italic py-4">Examen perfecto. ¡Excelente trabajo!</p>`;
    } else {
        fallas.forEach((falla) => {
            listaHtml.innerHTML += `
                <div class="bg-black/50 border border-slate-700/50 p-4 rounded-xl relative overflow-hidden group">
                    <div class="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                    <span class="text-red-400 text-[9px] font-black uppercase mb-2 block tracking-widest ml-2">${falla.materia}</span>
                    <div class="text-gray-300 text-sm mb-3 ml-2 overflow-x-auto">${falla.pregunta}</div>
                    
                    <button onclick="pedirExplicacionIADemo('${encodeURIComponent(falla.pregunta)}', '${encodeURIComponent(falla.correcta)}')" 
                            class="ml-2 w-[calc(100%-0.5rem)] text-cyan-400 font-bold uppercase hover:bg-cyan-900/40 hover:border-cyan-400 transition text-center border border-cyan-900 bg-cyan-900/20 py-2 rounded-lg text-[10px] tracking-wider flex items-center justify-center gap-2 group-hover:shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                        <i class="fa-solid fa-brain"></i> Explicar Error (Cuesta 1⚡)
                    </button>
                </div>
            `;
        });
    }

    if (typeof MathJax !== 'undefined') MathJax.typesetPromise();
}

async function pedirExplicacionIADemo(preguntaCodificada, respuestaCodificada) {
    let tokens = parseInt(localStorage.getItem('simu_creditos')) || 0;
    const chatBox = document.getElementById('chat-box');
    
    // EL GRAN CIERRE DE VENTAS: Si ya no tiene tokens
    if (tokens <= 0) {
        chatBox.innerHTML += `
            <div class="mb-3 animate-fade-in flex justify-center mt-6">
                <div class="bg-gradient-to-b from-gray-900 to-black p-6 rounded-2xl border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)] text-center max-w-md w-full">
                    <i class="fa-solid fa-battery-empty text-5xl text-red-500 mb-4 animate-pulse"></i>
                    <h4 class="text-white font-black italic uppercase tracking-tighter mb-2 text-xl">Energía IA Agotada</h4>
                    <p class="text-gray-400 text-sm mb-6 leading-relaxed">Te has quedado sin tokens demostrativos. Para seguir aprendiendo de tus errores y tener acceso a simulacros completos, necesitas una cuenta activa.</p>
                    <a href="registro.html" class="inline-block w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-xl uppercase tracking-widest text-sm shadow-lg transition-transform hover:-translate-y-1">
                        Inscribirme Ahora
                    </a>
                </div>
            </div>
        `;
        chatBox.scrollTop = chatBox.scrollHeight;
        return;
    }

    // Cobrar Token
    tokens--;
    localStorage.setItem('simu_creditos', tokens);
    document.getElementById('energia-display').innerText = tokens;
    
    const pregunta = decodeURIComponent(preguntaCodificada);
    const correcta = decodeURIComponent(respuestaCodificada);
    
    chatBox.innerHTML += `
        <div class="mb-3 flex justify-end animate-fade-in">
            <div class="bg-cyan-900/40 p-3 rounded-xl rounded-tr-none border border-cyan-500/30 max-w-[85%] text-sm text-cyan-100">
                ¿Me puedes explicar por qué fallé en esta pregunta?
            </div>
        </div>
        <div class="mb-3 text-center" id="spinner-demo"><i class="fa-solid fa-circle-notch fa-spin text-cyan-500 text-2xl"></i></div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        // Rescatamos la institución y área para mandárselas a la IA
        const instActual = localStorage.getItem('demo_institucion') || 'SimuTukur';
        const areaActual = localStorage.getItem('demo_area') || '';

        // Llama a la función de Supabase enviando TODAS las variables
        const { data, error } = await _supabase.functions.invoke('explicacion_ia', {
            body: { 
                pregunta: pregunta, 
                correcta: correcta,
                institucion: instActual,
                area: areaActual
            }
        });

        if (error) throw error;
        
        document.getElementById('spinner-demo').remove();
        
        chatBox.innerHTML += `
            <div class="mb-3 animate-fade-in">
                <div class="bg-gray-800/60 p-5 rounded-2xl rounded-tl-none border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm text-gray-200">
                    <strong class="text-cyan-400 font-black italic text-[11px] uppercase flex items-center gap-2 mb-3 border-b border-white/10 pb-2"><i class="fa-solid fa-brain"></i> Explicación Didáctica</strong>
                    <div class="leading-relaxed space-y-2 text-sm overflow-x-auto">${data.respuesta}</div>
                    <div class="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                        <span class="text-[9px] text-gray-500 uppercase tracking-widest">Respuesta Generada</span>
                        <span class="text-[10px] text-yellow-500 font-bold bg-yellow-900/20 px-2 py-1 rounded-md">⚡ Te quedan ${tokens} tokens</span>
                    </div>
                </div>
            </div>
        `;
        
        if (typeof MathJax !== 'undefined') MathJax.typesetPromise();
        chatBox.scrollTop = chatBox.scrollHeight;

    } catch (error) {
        document.getElementById('spinner-demo').remove();
        chatBox.innerHTML += `<div class="text-red-500 text-xs text-center p-2 bg-red-900/20 rounded border border-red-500/30">Error conectando con la IA. Se ha devuelto tu Token.</div>`;
        tokens++;
        localStorage.setItem('simu_creditos', tokens);
        document.getElementById('energia-display').innerText = tokens;
    }
}

window.onload = inicializarDashDemo;
