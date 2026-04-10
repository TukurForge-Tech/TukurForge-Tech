const cantQ = parseInt(localStorage.getItem('simu_preguntas'));
let reactivos = [];         
let reactivosFallados = []; 
let incidenciasAudio = [];
let incidenciasVideo = [];
let index = 0;
let aciertos = 0;
let seleccionActual = null;
let syncInterval;
let masterCheckInterval;
let ultimoAvisoRuido = 0;

// ==========================================
// ESCUDO ANTI-TRAMPAS (Botón Atrás)
// ==========================================
history.pushState(null, null, location.href);
window.onpopstate = function () {
    history.go(1);
    alert("⛔ ACCIÓN DENEGADA: No puedes retroceder durante una evaluación oficial.");
};

async function init() {
    // ==========================================
    // ESCUDO ANTI-F5 (Detección de Recarga)
    // ==========================================
    if (sessionStorage.getItem('mina_terrestre_activa') === 'true') {
        alert("⛔ ALERTA: Recargaste la página. El examen ha sido cancelado por seguridad.");
        registrarIncidencia('video', 'ALERTA ROJA: El alumno recargó la página (F5).');
        await finalizarExamenPiloto(); 
        return; // Detiene todo
    }
    // Activamos la mina para que si recarga, truene.
    sessionStorage.setItem('mina_terrestre_activa', 'true');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoElement = document.getElementById('webcam'); 
        videoElement.srcObject = stream;
        setupAudioMonitor(stream);
        setupVideoMonitor(videoElement);
        
        const reactivosBrutos = await cargarReactivosPiloto();
        reactivos = reactivosBrutos;
        
        render();
        iniciarEscuchaMaestra(); 

    } catch (err) {
        alert("Necesitas dar permisos de cámara y micrófono.");
    }
}

// ==========================================
// 2. COSECHA ESPECIAL PILOTO (60 Reactivos)
// ==========================================
async function cargarReactivosPiloto() {
    document.getElementById('txt-pregunta').innerHTML = "Construyendo Matriz del Simulacro...";
    
    const materias = [
        { nombre: 'Habilidad Matemática', cant: 8 },
        { nombre: 'Español', cant: 6 },
        { nombre: 'Matemáticas', cant: 6 },
        { nombre: 'Física', cant: 6 },
        { nombre: 'Historia', cant: 6 },
        { nombre: 'Biología', cant: 5 },
        { nombre: 'Química', cant: 5 },
        { nombre: 'Geografía', cant: 5 },
        { nombre: 'Cívica y Ética', cant: 5 }
    ];

    let poolFinal = [];

    for (const m of materias) {
        const { data, error } = await _supabase
            .from('reactivos')
            .select('*')
            .eq('tipo_examen', 'ECOEMS')
            .eq('materia', m.nombre)
            .in('complejidad', [2, 3]) 
            .limit(m.cant);
        
        if (data) poolFinal.push(...data);
    }

    // Habilidad Verbal (Bloques de lectura)
    const { data: lecturas } = await _supabase
        .from('reactivos')
        .select('*')
        .eq('materia', 'Habilidad Verbal')
        .limit(8); 
    
    if (lecturas) poolFinal.push(...lecturas);

    return poolFinal;
}

// ==========================================
// 3. RENDERIZADO Y CONTROL
// ==========================================
function render() {
    if (index >= reactivos.length || index >= cantQ) { finalizarExamenPiloto(); return; }

    const item = reactivos[index];
    seleccionActual = null;
    
    document.getElementById('label-materia').innerText = item.materia;
    document.getElementById('progreso-txt').innerText = `Q. ${index + 1} / ${Math.min(reactivos.length, cantQ)}`;
    
    const wBar = ((index) / Math.min(reactivos.length, cantQ)) * 100;
    document.getElementById('progress-bar').style.width = wBar + "%";
    
    const btnConfirm = document.getElementById('btn-confirm');
    btnConfirm.disabled = true;

    // Manejo de JSON de Lectura
    let textoHtml = "";
    if (item.texto_lectura && item.texto_lectura.trim() !== "") {
        textoHtml = `<div class="bg-slate-900 border border-slate-700 p-4 rounded-xl text-sm text-slate-300 mb-4 max-h-48 overflow-y-auto italic">
                        <i class="fa-solid fa-book-open text-cyan-500 mr-2"></i> ${item.texto_lectura}
                     </div>`;
    }

    let preguntaTex = typeof MathJax !== 'undefined' ? item.pregunta : item.pregunta; 
    document.getElementById('txt-pregunta').innerHTML = textoHtml + preguntaTex;

    const divOpciones = document.getElementById('opciones-grid');
    divOpciones.innerHTML = '';
    
    const letras = ['A', 'B', 'C', 'D'];
    [item.opcion_a, item.opcion_b, item.opcion_c, item.opcion_d].forEach((op, i) => {
        if (!op) return;
        
        const btn = document.createElement('button');
        btn.className = 'w-full text-left bg-black/40 border border-slate-700 p-4 rounded-xl hover:border-cyan-500 transition-all text-sm md:text-base flex items-start gap-4 focus:outline-none op-btn';
        
        let opTex = typeof MathJax !== 'undefined' ? op : op;
        
        btn.innerHTML = `
            <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold shrink-0 mt-0.5 border border-slate-700">${letras[i]}</div>
            <div class="flex-1 pt-1 overflow-x-auto latex-container">${opTex}</div>
        `;
        
        btn.onclick = () => {
            document.querySelectorAll('.op-btn').forEach(b => {
                b.classList.remove('border-cyan-500', 'bg-cyan-900/20');
                b.querySelector('div').classList.remove('bg-cyan-500', 'text-black', 'border-cyan-400');
            });
            btn.classList.add('border-cyan-500', 'bg-cyan-900/20');
            btn.querySelector('div').classList.add('bg-cyan-500', 'text-black', 'border-cyan-400');
            seleccionActual = letras[i];
            btnConfirm.disabled = false;
        };
        divOpciones.appendChild(btn);
    });

    if(typeof MathJax !== 'undefined') MathJax.typesetPromise();
}

// ==========================================
// 5. MÓDULOS DE VIGILANCIA (Audio/Video)
// ==========================================
function setupAudioMonitor(stream) {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaStreamSource(stream);
    const analyzer = actx.createAnalyser();
    analyzer.fftSize = 256;
    src.connect(analyzer);
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    const meter = document.getElementById('audio-meter');

    setInterval(() => {
        analyzer.getByteFrequencyData(dataArray);
        let sum = dataArray.reduce((a, b) => a + b, 0);
        let avg = sum / dataArray.length;
        let p = Math.min((avg / 128) * 100, 100);
        
        if(meter) meter.style.width = p + "%";
        
        if (p > 40) { // Umbral de ruido
            const ahora = Date.now();
            if (ahora - ultimoAvisoRuido > 10000) { 
                // CORRECCIÓN: Usa la nueva función en lugar del push viejo
                registrarIncidencia('audio', `Ruido detectado en el minuto ${document.getElementById('timer').innerText}`);
                ultimoAvisoRuido = ahora;
            }
        }
    }, 200);
}

async function setupVideoMonitor(videoElement) {
    try {
        const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

        setInterval(async () => {
            if (videoElement.paused || videoElement.ended) return;

            const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions());
            const tiempoActual = document.getElementById('timer').innerText;

            if (detections.length === 0) {
                // CORRECCIÓN: Usa la nueva función de guardado local
                registrarIncidencia('video', `Ausencia detectada en cámara en el minuto ${tiempoActual}`);
            } else if (detections.length > 1) {
                // CORRECCIÓN: Usa la nueva función de guardado local
                registrarIncidencia('video', `Múltiples personas en cámara en el minuto ${tiempoActual}`);
            }
        }, 5000); 

    } catch (error) {
        console.warn("La vigilancia de video falló al iniciar.", error);
    }
}

// 1. ESCUCHA AL MAESTRO Y CRONÓMETRO LOCAL
let timerIntervalLocal;

function iniciarEscuchaMaestra() {
    const el = document.getElementById('timer');
    let examenIniciadoLocal = false;
    let tiempoLocal = 5400; // 90 minutos por defecto

    masterCheckInterval = setInterval(async () => {
        const { data } = await _supabase.from('control_simulacro').select('estado, tiempo_restante').eq('id', 1).single();
        
        // Cuando arranca el examen
        if (data.estado === 'en_curso' && !examenIniciadoLocal) {
            examenIniciadoLocal = true;
            document.getElementById('lbl-estado').innerText = "Supervisión Activa";
            tiempoLocal = data.tiempo_restante; 
            iniciarGuardadoPorLotes(); 
            
            // Iniciar el cronómetro visual cada segundo (Incidencia 2a y 2b)
            timerIntervalLocal = setInterval(() => {
                tiempoLocal--;
                let h = Math.floor(tiempoLocal / 3600);
                let m = Math.floor((tiempoLocal % 3600) / 60);
                let s = tiempoLocal % 60;
                
                el.innerText = (h > 0) 
                    ? `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
                    : `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
                
                if(tiempoLocal <= 0) clearInterval(timerIntervalLocal);
            }, 1000);
        }

        // Cuando TÚ oprimes finalizar
        if (data.estado === 'finalizado') {
            clearInterval(masterCheckInterval);
            clearInterval(syncInterval);
            if(timerIntervalLocal) clearInterval(timerIntervalLocal);
            
            // INCIDENCIA 4b: Guardar todas las preguntas que no alcanzó a contestar como "No contestada"
            while(index < reactivos.length) {
                reactivosFallados.push({
                    pregunta: reactivos[index].pregunta,
                    materia: reactivos[index].materia,
                    tu_respuesta: "No contestada (Tiempo finalizado)",
                    correcta: reactivos[index].correcta
                });
                index++;
            }
            // Guardamos el arreglo completo de fallas actualizadas
            localStorage.setItem('simu_fallas', JSON.stringify(reactivosFallados));

            await sincronizarConBD(); 
            finalizarExamenPiloto();
        }
    }, 3000); // INCIDENCIA 2c: Revisamos cada 3 segundos para respuesta rápida
}

// 2. GUARDADO LOCAL Y POR LOTES (Cada 10 mins)
function procesarRespuesta() {
    if (!seleccionActual) return;
    const item = reactivos[index];
    
    if (seleccionActual === item.correcta) {
        aciertos++;
    } else {
        reactivosFallados.push({
            pregunta: item.pregunta,
            materia: item.materia,
            tu_respuesta: seleccionActual,
            correcta: item.correcta
        });
    }
    
    // Guardado Local Inmediato (Anti-apagones)
    localStorage.setItem('simu_fallas', JSON.stringify(reactivosFallados));
    localStorage.setItem('simu_aciertos', aciertos);
    
    index++;
    render();
}

function iniciarGuardadoPorLotes() {
    syncInterval = setInterval(async () => {
        await sincronizarConBD();
    }, 600000); // 600,000 ms = 10 minutos
}

async function sincronizarConBD() {
    const email = localStorage.getItem('session_email');
    if (!email) return;
    
    // Vaciamos el localStorage a Supabase
    await _supabase.from('simulacros_resultados').upsert([{
        email: email,
        aciertos: parseInt(localStorage.getItem('simu_aciertos')) || 0,
        incidencias_audio: JSON.parse(localStorage.getItem('simu_inc_audio') || '[]'),
        incidencias_video: JSON.parse(localStorage.getItem('simu_inc_video') || '[]'),
        ultimo_guardado: new Date().toISOString()
    }], { onConflict: 'email' });
}

// 3. VIGILANCIA MODIFICADA (Guarda localmente)
function registrarIncidencia(tipo, mensaje) {
    if (tipo === 'audio') {
        incidenciasAudio.push(mensaje);
        localStorage.setItem('simu_inc_audio', JSON.stringify(incidenciasAudio));
    } else {
        incidenciasVideo.push(mensaje);
        localStorage.setItem('simu_inc_video', JSON.stringify(incidenciasVideo));
    }
}

// ==========================================
// 4. EL CRONÓMETRO Y FINALIZACIÓN (MODIFICADO PARA ESPERA ESTRATÉGICA)
// ==========================================

async function finalizarExamenPiloto() {
    // 1. Forzamos el último guardado por si terminó antes
    await sincronizarConBD(); 
    localStorage.setItem('simu_terminado', 'true');
    
    // 2. Detenemos la cámara y micrófono para no seguir gastando batería/recursos
    const videoEl = document.getElementById('webcam');
    if(videoEl && videoEl.srcObject) {
        videoEl.srcObject.getTracks().forEach(track => track.stop());
    }

    // 3. Pintamos la PANTALLA DE ESPERA (Sala de control)
    document.body.innerHTML = `
        <div class="fixed inset-0 bg-[#050a14] flex flex-col justify-center items-center text-center p-10 z-[9999]">
            <i class="fa-solid fa-lock text-6xl text-cyan-500 mb-6 animate-pulse"></i>
            <h2 class="text-4xl font-black text-cyan-400 mb-4 uppercase tracking-tighter">Evaluación Concluida</h2>
            <p class="text-xl text-slate-300 mb-8 max-w-lg">
                Tus respuestas, video y audio han sido encriptados y enviados a la base de datos central.
            </p>
            
            <div class="bg-black/50 p-8 rounded-3xl border border-cyan-500/30 mb-8 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                <p class="text-sm uppercase tracking-widest text-cyan-500 font-bold mb-2">Protocolo de Seguridad</p>
                <p class="text-lg text-white">Esperando autorización del Director para liberar resultados...</p>
                <div class="mt-6 flex justify-center space-x-2">
                    <div class="w-3 h-3 bg-cyan-500 rounded-full animate-bounce"></div>
                    <div class="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                    <div class="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                </div>
            </div>
            
            <p class="text-gray-500 italic text-xs uppercase tracking-widest">
                <i class="fa-solid fa-triangle-exclamation text-yellow-500 mr-1"></i> Por favor, llama a tu tutor o padre de familia a la pantalla.
            </p>
        </div>
    `;

    // 4. EL TRUCO DE MAGIA: Seguir escuchando tu Control Maestro
    // Usamos el mismo masterCheckInterval que ya teníamos
    clearInterval(masterCheckInterval); // Limpiamos el anterior por seguridad
    
    masterCheckInterval = setInterval(async () => {
        const { data } = await _supabase.from('control_simulacro').select('estado').eq('id', 1).single();
        
        // Cuando tú oprimas "Finalizar y Liberar Dash" en tu control_mando.html
        if (data && data.estado === 'finalizado') {
            clearInterval(masterCheckInterval);
            sessionStorage.removeItem('mina_terrestre_activa');
            window.location.href = 'simulacro_dash.html'; // Los teletransporta a todos al mismo tiempo
        }
    }, 5000); // Revisa cada 5 segundos para que el cambio sea casi instantáneo en el Meet
}
// Arrancar el motor al cargar la página
window.onload = init;
