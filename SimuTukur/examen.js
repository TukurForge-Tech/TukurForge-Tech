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

// --- MEMORIA DE IA Y VIGILANCIA ---
let fallasEspecificas = []; // Guarda los consejos de la IA
let incidenciasVigilancia = []; // Guarda alertas de audio/video
let ultimoAvisoRuido = 0;
let alertasAudio = 0;
let alertasVideo = 0;
let reporteMaterias = {};

async function init() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoElement = document.getElementById('webcam');
        videoElement.srcObject = stream;
        
        setupAudioMonitor(stream);
        setupVideoMonitor(videoElement); // Usando face-api
        
        const planActual = localStorage.getItem('plan_nombre_completo') || localStorage.getItem('plan_actual'); 
        const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;

        let filtroTipos = [];
        if (planActual.includes("UNAM")) {
            const areaMatch = planActual.match(/A[1-4]/); 
            const areaExtraida = areaMatch ? areaMatch[0] : null;
            filtroTipos = ['UNAM_GENERAL'];
            if (areaExtraida) filtroTipos.push(areaExtraida);
        } else {
            filtroTipos = [planActual.split(' ')[0]];
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
            alert(`No hay suficientes reactivos disponibles para el nivel ${nivelLabel}`);
            window.location.href = 'dashboard.html'; 
        }
    } catch (e) { 
        console.error("Error crítico:", e);
        alert("Asegúrate de permitir el acceso a la cámara y micrófono.");
        window.location.href = 'dashboard.html';
    }
}

// --- VIGILANCIA AUDIO ---
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
        
        if (volume > 40 && (Date.now() - ultimoAvisoRuido > 5000)) {
            ultimoAvisoRuido = Date.now();
            alertasAudio++;
            registrarEventoVigilancia("Ruido moderado/fuerte detectado");
            const tiempoActual = document.getElementById('timer').innerText;
            incidenciasVigilancia.push(`Ruido detectado - Min: ${tiempoActual}`);
        }
        requestAnimationFrame(update);
    }
    update();
}

// --- VIGILANCIA VIDEO (face-api local) ---
async function setupVideoMonitor(videoElement) {
    try {
        if (typeof faceapi === 'undefined') {
            console.warn("Face-api no detectado en el HTML. Verifica el script de FaceAPI.");
            return;
        }
        const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

        setInterval(async () => {
            if (videoElement.paused || videoElement.ended) return;
            const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions());
            const tiempoActual = document.getElementById('timer').innerText;

            if (detections.length === 0) {
                alertasVideo++;
                registrarEventoVigilancia("Rostro no detectado (Posible abandono)");
                incidenciasVigilancia.push(`Ausencia - Min: ${tiempoActual}`);
            } else if (detections.length > 1) {
                alertasVideo++;
                registrarEventoVigilancia("Múltiples rostros detectados");
                incidenciasVigilancia.push(`Múltiples personas - Min: ${tiempoActual}`);
            }
        }, 5000); 
    } catch (error) {
        console.warn("Vigilancia de video inactiva:", error);
    }
}

async function confirmarAborto() {
    let msg = esPro ? "¿Desea finalizar la sesión? Su progreso no será guardado." : "ATENCIÓN: Tienes un Plan Básico. Si abandonas ahora, se descontará 1 oportunidad. ¿Deseas continuar?";
    if (confirm(msg)) {
        await registrarEventoVigilancia("Examen abortado por el alumno");
        window.location.href = 'dashboard.html';
    }
}

function render() {
    const r = reactivos[index];
    const nombrePlan = localStorage.getItem('plan_nombre_completo') || localStorage.getItem('plan_actual');
    document.getElementById('label-materia').innerText = `${nombrePlan} | ${r.materia}`;
    document.getElementById('txt-pregunta').innerText = r.pregunta;
    document.getElementById('progreso-txt').innerText = `REACTIVO ${index + 1} DE ${reactivos.length}`;
    
    const g = document.getElementById('opciones-grid'); g.innerHTML = '';
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
    
    // Rastreo de Materia
    if (!reporteMaterias[r.materia]) reporteMaterias[r.materia] = { correctas: 0, totales: 0 };
    reporteMaterias[r.materia].totales++;
    
    if (esCorrecto) {
        reporteMaterias[r.materia].correctas++;
        aciertos++;
    } else {
        // Guardamos el consejo mágico de la IA (Límite 3 para no saturar al alumno)
        if (fallasEspecificas.length < 3 && r.explicacion_ia) {
            fallasEspecificas.push(`📚 En ${r.materia}: ${r.explicacion_ia}`);
        }
    }
    
    const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;
    await registrarPasoPorReactivo(r.id, esCorrecto, nivelID);

    index++; 
    if (index < reactivos.length) render(); 
    else finalizar();
}

function startTimer() {
    setInterval(() => {
        const h = Math.floor(tiempoSeg / 3600), m = Math.floor((tiempoSeg % 3600) / 60), s = tiempoSeg % 60;
        document.getElementById('timer').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        if (tiempoSeg-- <= 0) finalizar();
    }, 1000);
}

async function finalizar() {
    const p = (aciertos / reactivos.length) * 100;
    const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;
    
    // 1. Análisis de Vigilancia
    let riesgo = "Bajo";
    let veredicto = "El comportamiento fue adecuado.";
    let totalAlertas = alertasAudio + alertasVideo;

    if (totalAlertas > 5) {
        riesgo = "Alto";
        veredicto = `Alerta: Detectamos que saliste de cuadro ${alertasVideo} veces y hubo ${alertasAudio} eventos de ruido fuerte.`;
    } else if (totalAlertas > 0) {
        riesgo = "Medio";
        veredicto = `Precaución: Tuvimos ${alertasVideo} alertas de cámara y ${alertasAudio} de audio.`;
    }

    // 2. Diagnóstico de Materias
    let materiasDebiles = [];
    for (let mat in reporteMaterias) {
        let porc = (reporteMaterias[mat].correctas / reporteMaterias[mat].totales) * 100;
        if (porc < 60) materiasDebiles.push(mat); 
    }
    let temasAEstudiar = materiasDebiles.length > 0 ? materiasDebiles.join(", ") : "¡Dominio total!";

    // 3. Guardado en BD con los consejos de la IA incrustados
    const detallesJSON = { 
        aciertos_totales: aciertos, 
        preguntas_totales: reactivos.length, 
        materias_debiles: materiasDebiles,
        consejos_ia: fallasEspecificas // ESTO VIAJA DIRECTO AL CHAT
    };

    // Mandamos todo a Supabase a través de telemetria.js
    await guardarResultadoFinal(p, nivelID, detallesJSON);
    await guardarAnalisisVigilancia({ veredicto: veredicto, riesgo: riesgo });
    await guardarProgresoIA(p, temasAEstudiar);

    // Regresamos al dashboard con el parámetro ?res=
    window.location.href = `dashboard.html?res=${Math.round(p)}`;
}

window.onload = init;
