// examen.js - Lógica del Simulador de Exámenes

const params = new URLSearchParams(window.location.search);
const token = params.get('v');
const nivelLabel = localStorage.getItem('simu_nivel');
const cantQ = parseInt(localStorage.getItem('simu_preguntas'));
const mins = parseInt(localStorage.getItem('simu_tiempo'));
const esPro = localStorage.getItem('es_pro') === "true";

let reactivos = [];
let index = 0;
let aciertos = 0;
let seleccionActual = null;
let tiempoSeg = mins * 60;
let incidenciasVigilancia = [];
let ultimoAvisoRuido = 0;

async function init() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoElement = document.getElementById('webcam'); // Guardamos el elemento en variable
        videoElement.srcObject = stream;
        setupAudioMonitor(stream);
        setupVideoMonitor(videoElement);
        
        const inst = localStorage.getItem('plan_institucion'); 
        const area = localStorage.getItem('plan_area'); 
        const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;

        let filtroTipos = [];
        if (inst === "UNAM") {
            filtroTipos = ["UNAM_GENERAL", area];
        } else {
            filtroTipos = [inst];
        }

        const { data, error } = await _supabase
            .from('reactivos')
            .select('*')
            .in('tipo_examen', filtroTipos)
            .eq('nivel', nivelID)
            .limit(cantQ);

        if (data && data.length > 0) {
            reactivos = data.sort(() => Math.random() - 0.5);
            if (!esPro) ejecutarDescuentoIntento(); 
            render(); 
            startTimer();
        } else { 
            console.error("No se encontraron reactivos para:", filtroTipos);
            alert(`No hay reactivos para ${inst} ${area} en nivel ${nivelLabel}`);
            window.location.href = 'dashboard.html'; 
        }
    } catch (e) { 
        console.error("Error crítico:", e);
        alert("Asegúrate de permitir el acceso a la cámara y micrófono.");
        window.location.href = 'dashboard.html';
    }
}

function setupAudioMonitor(stream) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function update() {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
        document.getElementById('audio-fill').style.width = Math.min(volume * 4, 100) + "%";
        
        // CORRECCIÓN: Bajamos la sensibilidad a 40 y ponemos un candado de 5 segundos (5000ms)
        if (volume > 40 && (Date.now() - ultimoAvisoRuido > 5000)) {
            ultimoAvisoRuido = Date.now();
            
            // 1. Mandamos la bitácora individual
            registrarEventoVigilancia("Ruido moderado/fuerte detectado");
            
            // 2. Guardamos memoria local para el veredicto final
            const tiempoActual = document.getElementById('timer').innerText;
            incidenciasVigilancia.push(`Pico de ruido detectado en el minuto ${tiempoActual}`);
        }
        requestAnimationFrame(update);
    }
    update();
}

async function confirmarAborto() {
    let msg = esPro ? "¿Desea finalizar la sesión? Su progreso no será guardado." : "ATENCIÓN: Cuenta con un Plan Básico. Si abandona ahora, se descontará 1 oportunidad. ¿Desea continuar?";
    if (confirm(msg)) {
        await registrarEventoVigilancia("Examen abortado por el alumno");
        window.location.href = 'dashboard.html';
    }
}

function render() {
    const r = reactivos[index];
    document.getElementById('label-materia').innerText = `${localStorage.getItem('plan_nombre_completo')} | ${r.materia}`;
    document.getElementById('txt-pregunta').innerText = r.pregunta;
    document.getElementById('progreso-txt').innerText = `REACTIVO ${index + 1} DE ${reactivos.length}`;
    
    const g = document.getElementById('opciones-grid'); 
    g.innerHTML = '';
    
    const contenido = [
        { id: 'a', t: r.opcion_a }, { id: 'b', t: r.opcion_b },
        { id: 'c', t: r.opcion_c }, { id: 'd', t: r.opcion_d }
    ].sort(() => Math.random() - 0.5);

    const letras = ['A', 'B', 'C', 'D'];
    contenido.forEach((op, i) => {
        const b = document.createElement('button');
        b.className = "w-full text-left p-6 rounded-xl border border-slate-800 bg-slate-900/50 flex items-center gap-5 transition-all text-lg italic hover:border-cyan-500 shadow-sm";
        b.innerHTML = `<span class="min-w-[2.5rem] w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-sm font-black text-cyan-400">${letras[i]}</span> <span class="text-slate-200 leading-relaxed">${op.t}</span>`;
        
        b.onclick = () => {
            seleccionActual = op.id;
            document.querySelectorAll('button').forEach(x => x.classList.remove('option-selected'));
            b.classList.add('option-selected');
            document.getElementById('btn-confirm').disabled = false;
        };
        g.appendChild(b);
    });
    document.getElementById('btn-confirm').disabled = true;
}

async function procesarRespuesta() {
    const r = reactivos[index];
    const respuestaBD = String(r.respuesta_correcta).trim().toLowerCase();
    const seleccionUser = String(seleccionActual).trim().toLowerCase();
    const esCorrecto = (seleccionUser === respuestaBD);
    
    const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;
    await registrarPasoPorReactivo(r.id, esCorrecto, nivelID);

    if (esCorrecto) aciertos++;
    index++; 
    if (index < reactivos.length) render(); 
    else finalizar();
}

function startTimer() {
    setInterval(() => {
        const h = Math.floor(tiempoSeg / 3600);
        const m = Math.floor((tiempoSeg % 3600) / 60);
        const s = tiempoSeg % 60;
        document.getElementById('timer').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        if (tiempoSeg-- <= 0) finalizar();
    }, 1000);
}

async function finalizar() {
    const p = (aciertos / reactivos.length) * 100;
    const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;
    
    // --- MOTOR DE VEREDICTO LOCAL (Costo $0) ---
    let riesgo = "Bajo";
    let veredicto = "El comportamiento fue adecuado. No se detectaron anomalías significativas.";

    if (incidenciasVigilancia.length > 5) {
        riesgo = "Alto";
        veredicto = `Alerta: Se detectaron ${incidenciasVigilancia.length} eventos de ruido fuerte durante la prueba. Posible asistencia externa.`;
    } else if (incidenciasVigilancia.length > 0) {
        riesgo = "Medio";
        veredicto = `Precaución: Se registraron ${incidenciasVigilancia.length} ruidos aislados. Se sugiere advertir al alumno.`;
    }

    // Armamos el JSON con el reporte detallado
    const detallesJSON = {
        aciertos_totales: aciertos,
        preguntas_totales: reactivos.length,
        log_vigilancia: incidenciasVigilancia
    };

    // 1. Guardamos el resultado del examen (como ya funciona)
    await guardarResultadoFinal(p, nivelID, detallesJSON);
    
    // 2. Guardamos el análisis de la IA simulada
    await guardarAnalisisVigilancia({
        veredicto: veredicto,
        riesgo: riesgo
    });
    
    window.location.href = `dashboard.html?res=${Math.round(p)}`;
}

// --- MOTOR DE VISIÓN IA (Detección de Rostros Local) ---
async function setupVideoMonitor(videoElement) {
    try {
        // 1. Cargamos el modelo matemático desde un repositorio público seguro
        const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

        // 2. Escaneamos la cámara cada 5 segundos (5000 ms)
        setInterval(async () => {
            if (videoElement.paused || videoElement.ended) return;

            // La IA cuenta cuántos rostros hay en el fotograma actual
            const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions());
            const tiempoActual = document.getElementById('timer').innerText;

            if (detections.length === 0) {
                // CERO rostros: El alumno no está frente a la cámara
                registrarEventoVigilancia("Rostro no detectado (Posible abandono)");
                incidenciasVigilancia.push(`Ausencia detectada en cámara en el minuto ${tiempoActual}`);
            } else if (detections.length > 1) {
                // DOS o más rostros: Alguien le está ayudando
                registrarEventoVigilancia("Múltiples rostros detectados");
                incidenciasVigilancia.push(`Múltiples personas en cámara en el minuto ${tiempoActual}`);
            }
        }, 5000); 

    } catch (error) {
        console.warn("La vigilancia de video no pudo iniciar:", error);
    }
}

// Iniciar el simulador al cargar la página
window.onload = init;
