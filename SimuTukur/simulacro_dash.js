// simulacro_dash.js (Lógica corregida y aislada)

async function validarAccesoPilotoDash() {
    const email = localStorage.getItem('session_email');
    
    // Lo pateamos a la puerta del piloto si no hay sesión
    if (!email) { 
        window.location.href = 'acceso_piloto.html'; 
        return; 
    }

    try {

        const { data, error } = await _supabase
            .from('prospectos_simulacro')
            .select('nombre_tutor') 
            .eq('correo', email) // 'correo' es el nombre real de tu columna
            .maybeSingle();

        if (error || !data) {
            // Si por algo no existe, lo sacamos
            window.location.href = 'acceso_piloto.html';
            return;
        }

        // Adecuación 2: Ponemos el nombre del papa en el saludo
        const saludoSpan = document.getElementById('nombre-span');// username-display
        if (saludoSpan) {
            saludoSpan.innerText = data.nombre_tutor || email;
        }

    } catch (err) {
        console.error("Error en validación dash:", err);
    }
}

// Adecuación 9: Iniciar el Simulacro Piloto a motor.html
function iniciarSimulacro() {
    localStorage.setItem('simu_nivel', 'PILOTO_VIP'); // Nivel adaptativo Medio-Alto
    localStorage.setItem('simu_preguntas', 60);
    localStorage.setItem('simu_tiempo', 90);
    window.location.href = 'simulacro_motor.html'; // Tu motor aislado
}

async function checarSiTerminoExamen() {
    if (localStorage.getItem('simu_terminado') === 'true') {
        
        // 1. Ocultar los entrenamientos viejos
        document.getElementById('contenedor-niveles').innerHTML = '';
        
        // 2. Extraer información local
        const aciertos = localStorage.getItem('simu_aciertos') || 0;
        const fallas = JSON.parse(localStorage.getItem('simu_fallas') || '[]');
        const incAudio = JSON.parse(localStorage.getItem('simu_inc_audio') || '[]').length;
        const incVideo = JSON.parse(localStorage.getItem('simu_inc_video') || '[]').length;

        // 3. Lógica de Semáforos
        const semaforoAudio = incAudio <= 2 ? '🟢 Excelente' : (incAudio <= 5 ? '🟡 Precaución' : '🔴 Crítico (Riesgo Cancelación)');
        const semaforoVideo = incVideo <= 2 ? '🟢 Excelente' : (incVideo <= 5 ? '🟡 Precaución' : '🔴 Crítico (Riesgo Cancelación)');
        const colorCalif = aciertos >= 40 ? 'text-green-500' : 'text-red-500';

        // 4. Renderizar Panel de Resultados
        document.getElementById('contenedor-niveles').innerHTML = `
            <div class="card-glass p-6 border-cyan-500 mb-6">
                <h3 class="text-xl font-black italic text-cyan-400 uppercase mb-4">Resultados Oficiales</h3>
                <p class="text-3xl font-black ${colorCalif} mb-4">${aciertos} / 60 Aciertos</p>
                
                <div class="bg-black/50 p-4 rounded-xl border border-slate-700 mb-2 flex justify-between">
                    <span class="text-xs uppercase font-bold text-gray-400">Proctoring Audio:</span>
                    <span class="text-xs uppercase font-bold">${semaforoAudio} (${incAudio} alertas)</span>
                </div>
                <div class="bg-black/50 p-4 rounded-xl border border-slate-700 flex justify-between">
                    <span class="text-xs uppercase font-bold text-gray-400">Proctoring Video:</span>
                    <span class="text-xs uppercase font-bold">${semaforoVideo} (${incVideo} alertas)</span>
                </div>
            </div>

            <h3 class="text-gray-500 font-bold text-xs uppercase tracking-widest mb-4 italic">Tus Áreas de Oportunidad</h3>
            <div id="lista-fallas" class="space-y-3 max-h-96 overflow-y-auto pr-2"></div>
        `;

        // 5. Renderizar Lista de Fallas
        const listaHtml = document.getElementById('lista-fallas');
        fallas.forEach((falla, idx) => {
            listaHtml.innerHTML += `
                <div class="bg-black/40 border border-red-900/50 p-4 rounded-xl text-xs">
                    <span class="bg-red-900 text-red-200 px-2 py-1 rounded-md text-[10px] font-bold uppercase mb-2 inline-block">${falla.materia}</span>
                    <p class="text-gray-300 italic mb-2">${falla.pregunta.substring(0, 80)}...</p>
                    <button onclick="pedirExplicacionIA('${encodeURIComponent(falla.pregunta)}', '${encodeURIComponent(falla.correcta)}')" 
                            class="mt-2 text-cyan-400 font-bold uppercase hover:text-cyan-300 transition w-full text-left bg-cyan-900/20 p-2 rounded-lg">
                        <i class="fa-solid fa-brain mr-1"></i> Explicar con IA (Consume 1 ⚡)
                    </button>
                </div>
            `;
        });
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

    // AQUI HACES TU LLAMADA REAL AL BACKEND (Gemini)
    // Cuando conteste, reemplazas el spinner con la respuesta y agregas:
    setTimeout(() => {
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
    }, 2000); // Simulación de tiempo de respuesta
}

// Iniciar protocolo al cargar
window.onload = async () => {
    await validarAccesoPilotoDash(); // Checa quién entró
    await checarSiTerminoExamen();   // Checa si viene regresando del examen
};
