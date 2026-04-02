// examen.js - Motor Adaptativo e IA del Simulador

const params = new URLSearchParams(window.location.search);
const token = params.get('v');
const nivelLabel = localStorage.getItem('simu_nivel');
const cantQ = parseInt(localStorage.getItem('simu_preguntas'));
const mins = parseInt(localStorage.getItem('simu_tiempo'));
const esPro = localStorage.getItem('es_pro') === "true";

let reactivos = [];         // El examen activo
let colchonReactivos = [];  // Las preguntas de nivel superior ocultas
let reactivosFallados = []; // Memoria para la IA
let index = 0;
let aciertos = 0;
let rachaAciertos = 0;      // Gatillo de adrenalina
let seleccionActual = null;
let tiempoSeg = mins * 60;
let incidenciasVigilancia = [];
let ultimoAvisoRuido = 0;

async function init() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoElement = document.getElementById('webcam'); 
        videoElement.srcObject = stream;
        setupAudioMonitor(stream);
        setupVideoMonitor(videoElement);
        
        const inst = localStorage.getItem('plan_institucion'); 
        const area = localStorage.getItem('plan_area'); 
        let filtroTipos = inst === "UNAM" ? ["UNAM_GENERAL", area] : [inst];

        // --- FASE 1: DESVÍO DE REPASO ---
        if (nivelLabel === "Repaso") {
            reactivos = await obtenerReactivosRepaso(cantQ); 
            if (!reactivos || reactivos.length === 0) {
                alert("¡Expediente limpio! No tienes suficientes errores registrados para armar un repaso. Sigue entrenando niveles normales.");
                window.location.href = 'dashboard.html';
                return;
            }
            reactivos = reactivos.sort(() => Math.random() - 0.5);
            render();
            startTimer();
            return; 
        }

        // --- FASE 2: COSECHA DEL COLCHÓN ADAPTATIVO ---
        const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;
        const nivelColchonID = nivelID < 3 ? nivelID + 1 : 3;
        
        const institucionRegla = inst.includes('ECOEMS') ? 'ECOEMS' : inst;

        const { data: regla } = await _supabase.from('reglas_simulador')
            .select('distribucion_materias')
            .eq('institucion', institucionRegla)
            .eq('nivel', nivelLabel)
            .single();

        if (!regla || !regla.distribucion_materias) {
            alert(`No hay distribución configurada para ${institucionRegla} en ${nivelLabel}. Consulta a TukurForge.`);
            window.location.href = 'dashboard.html';
            return;
        }

        const distribucion = regla.distribucion_materias;
        
        for (const [materia, cantidad] of Object.entries(distribucion)) {
            const { data: base } = await _supabase.from('reactivos')
                .select('*').in('tipo_examen', filtroTipos).eq('nivel', nivelID).eq('materia', materia)
                .limit(cantidad);
            if (base) reactivos.push(...base);

            if (nivelID < 3) {
                const cantColchon = Math.ceil(cantidad * 0.5);
                const { data: colchon } = await _supabase.from('reactivos')
                    .select('*').in('tipo_examen', filtroTipos).eq('nivel', nivelColchonID).eq('materia', materia)
                    .limit(cantColchon);
                if (colchon) colchonReactivos.push(...colchon);
            }
        }

        reactivos = reactivos.sort(() => Math.random() - 0.5);
        colchonReactivos = colchonReactivos.sort(() => Math.random() - 0.5);

        if (reactivos.length > 0) {
            if (!esPro) ejecutarDescuentoIntento(); 
            render(); 
            startTimer();
        } else { 
            alert(`Base de datos vacía para estos filtros.`);
            window.location.href = 'dashboard.html'; 
        }
    } catch (e) { 
        console.error("Error crítico:", e);
        alert("Asegúrate de permitir el acceso a la cámara y micrófono para iniciar el simulador.");
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
        
        if (volume > 40 && (Date.now() - ultimoAvisoRuido > 5000)) {
            ultimoAvisoRuido = Date.now();
            registrarEventoVigilancia("Ruido moderado/fuerte detectado");
            const tiempoActual = document.getElementById('timer').innerText;
            incidenciasVigilancia.push(`Pico de ruido detectado en el minuto ${tiempoActual}`);
        }
        requestAnimationFrame(update);
    }
    update();
}

async function confirmarAborto() {
    let msg = esPro ? "¿Desea finalizar la sesión? Su progreso no será guardado." : "ATENCIÓN: Cuenta con un Plan Básico. Si abandona ahora, se descontará 1 oportunidad. ¿Desea finalizar?";
    if (confirm(msg)) {
        await registrarEventoVigilancia("Examen abortado por el alumno");
        window.location.href = 'dashboard.html';
    }
}

// --- FASE 4: PANTALLA ADAPTATIVA (División Horizontal) ---
function render() {
    const r = reactivos[index];
    const panelLectura = document.getElementById('panel-lectura');

    // AJUSTE: Lógica simplificada. Si hay lectura, mostramos el panel superior.
    if (r.texto_lectura && r.texto_lectura.trim() !== "") {
        panelLectura.classList.remove('hidden');
        document.getElementById('texto-lectura-content').innerText = r.texto_lectura;
    } else {
        panelLectura.classList.add('hidden');
    }

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
        // El tamaño de letra ya estaba unificado a text-base md:text-lg, perfecto.
        b.className = "w-full text-left p-5 md:p-6 rounded-2xl border border-slate-800 bg-black/20 flex items-center gap-4 transition-all text-base md:text-lg italic hover:border-cyan-500 hover:bg-slate-800/80 shadow-inner group";
        b.innerHTML = `<span class="min-w-[2.5rem] w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-sm font-black text-cyan-400 shrink-0 group-hover:scale-110 transition-transform">${letras[i]}</span> <span class="text-slate-200 leading-relaxed">${op.t}</span>`;
        
        b.onclick = () => {
            seleccionActual = op.id;
            document.querySelectorAll('#opciones-grid button').forEach(x => {
                x.classList.remove('border-cyan-400', 'bg-cyan-900/30');
                x.classList.add('border-slate-800', 'bg-black/20');
            });
            b.classList.remove('border-slate-800', 'bg-black/20');
            b.classList.add('border-cyan-400', 'bg-cyan-900/30');
            document.getElementById('btn-confirm').disabled = false;
        };
        g.appendChild(b);
    });
    document.getElementById('btn-confirm').disabled = true;
    document.getElementById('panel-preguntas').scrollTop = 0; // Reinicia el scroll al inicio de la pregunta
}

// ... (Resto del código intacto)
async function procesarRespuesta() {
    const r = reactivos[index];
    const respuestaBD = String(r.respuesta_correcta).trim().toLowerCase();
    const seleccionUser = String(seleccionActual).trim().toLowerCase();
    const esCorrecto = (seleccionUser === respuestaBD);
    
    const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;
    await registrarPasoPorReactivo(r.id, esCorrecto, nivelID);

    if (esCorrecto) {
        aciertos++;
        rachaAciertos++;
        
        if (rachaAciertos >= 3 && colchonReactivos.length > 0) {
            const idxReemplazo = reactivos.findIndex((re, i) => i > index && re.materia === r.materia);
            const idxColchon = colchonReactivos.findIndex(c => c.materia === r.materia);
            
            if (idxReemplazo !== -1 && idxColchon !== -1) {
                const preguntaDura = colchonReactivos.splice(idxColchon, 1)[0];
                reactivos[idxReemplazo] = preguntaDura;
                console.log("🔥 Racha perfecta: Inyectando reactivo de nivel superior.");
            }
            rachaAciertos = 0; 
        }
    } else {
        rachaAciertos = 0; 
        reactivosFallados.push({
            materia: r.materia,
            tema: r.tema_guia || "General",
            pregunta_id: r.id
        });
    }
    
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
    
    let riesgo = "Bajo";
    let veredicto = "El comportamiento fue adecuado. No se detectaron anomalías significativas.";

    if (incidenciasVigilancia.length > 5) {
        riesgo = "Alto";
        veredicto = `Alerta: Se detectaron ${incidenciasVigilancia.length} eventos anómalos (ausencias o ruidos) durante la prueba.`;
    } else if (incidenciasVigilancia.length > 0) {
        riesgo = "Medio";
        veredicto = `Precaución: Se registraron ${incidenciasVigilancia.length} incidencias leves.`;
    }

    const detallesJSON = {
        aciertos_totales: aciertos,
        preguntas_totales: reactivos.length,
        log_vigilancia: incidenciasVigilancia,
        fallas_academicas: reactivosFallados
    };

    await guardarResultadoFinal(p, nivelID, detallesJSON);
    await guardarAnalisisVigilancia({ veredicto: veredicto, riesgo: riesgo });
    await guardarProgresoIA(p);
    
    window.location.href = `dashboard.html?res=${Math.round(p)}`;
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
                registrarEventoVigilancia("Rostro no detectado (Posible abandono)");
                incidenciasVigilancia.push(`Ausencia detectada en cámara en el minuto ${tiempoActual}`);
            } else if (detections.length > 1) {
                registrarEventoVigilancia("Múltiples rostros detectados");
                incidenciasVigilancia.push(`Múltiples personas en cámara en el minuto ${tiempoActual}`);
            }
        }, 5000); 

    } catch (error) {
        console.warn("La vigilancia de video no pudo iniciar:", error);
    }
}

window.onload = init;
