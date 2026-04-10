// simulacro_motor.js - Motor Piloto (Versión Integral basada en tu original)

const params = new URLSearchParams(window.location.search);
const token = params.get('v'); // Aunque no se use en el piloto, lo mantenemos por si acaso
const nivelLabel = localStorage.getItem('simu_nivel');
const cantQ = parseInt(localStorage.getItem('simu_preguntas'));
const mins = parseInt(localStorage.getItem('simu_tiempo'));

let reactivos = [];         
let colchonReactivos = []; // Se mantiene para compatibilidad con el resto del código
let reactivosFallados = []; 
let index = 0;
let aciertos = 0;
let rachaAciertos = 0;      
let seleccionActual = null;
let tiempoSeg = mins * 60;
let incidenciasVigilancia = [];
let ultimoAvisoRuido = 0;

// ==========================================
// 1. EL NÚCLEO (ARRANQUE)
// ==========================================
async function init() {
    try {
        // Iniciar vigilancia
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoElement = document.getElementById('webcam'); 
        videoElement.srcObject = stream;
        setupAudioMonitor(stream);
        setupVideoMonitor(videoElement);
        
        // Carga especial del Piloto (Matriz de Complejidad 2 y 3)
        const reactivosBrutos = await cargarReactivosPiloto();
        
        if (!reactivosBrutos || reactivosBrutos.length === 0) {
            alert("Error: No se pudieron cargar los reactivos del simulacro.");
            window.location.href = 'simulacro_dash.html';
            return;
        }

        // Aplicar la misma lógica de "Agrupamiento de Lecturas" de tu examen.js original
        let subGrupos = {};
        reactivosBrutos.forEach(p => {
            let llave = "suelta_" + p.id;
            if (p.id_grupo_lectura) llave = "grupo_" + p.id_grupo_lectura;
            else if (p.texto_lectura && p.texto_lectura.trim() !== "") llave = "txt_" + p.texto_lectura.trim().substring(0, 30);
            
            if(!subGrupos[llave]) subGrupos[llave] = [];
            subGrupos[llave].push(p);
        });

        let llavesSubGrupo = Object.keys(subGrupos).sort(() => Math.random() - 0.5);
        llavesSubGrupo.forEach(llave => {
            reactivos.push(...subGrupos[llave]);
        });

        render();
        startTimer();

    } catch (err) {
        console.error("Error iniciando simulador:", err);
        alert("Necesitas dar permisos de cámara y micrófono para el proctoring.");
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

function procesarRespuesta() {
    if (!seleccionActual) return;
    const item = reactivos[index];
    if (seleccionActual === item.correcta) {
        aciertos++;
    } else {
        reactivosFallados.push(item);
    }
    index++;
    render();
}

// ==========================================
// 4. EL CRONÓMETRO Y FINALIZACIÓN
// ==========================================
function startTimer() {
    const el = document.getElementById('timer');
    const lbl = document.getElementById('lbl-estado');
    lbl.innerText = "Supervisión Activa";
    
    const interval = setInterval(() => {
        tiempoSeg--;
        let m = Math.floor(tiempoSeg / 60);
        let s = tiempoSeg % 60;
        el.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        
        if (tiempoSeg <= 300) { el.classList.add('text-red-500'); } // 5 mins rojo
        if (tiempoSeg <= 0) {
            clearInterval(interval);
            finalizarExamenPiloto();
        }
    }, 1000);
}

async function finalizarExamenPiloto() {
    let califFinal = (aciertos / cantQ) * 10;
    
    // Guardado básico de resultados para el papá (o lo que tengas configurado)
    const email = localStorage.getItem('session_email');
    if (email) {
        await _supabase.from('simulacros_resultados').insert([{
            email: email,
            aciertos: aciertos,
            calificacion: califFinal,
            incidencias: incidenciasVigilancia.join(" | ")
        }]);
    }
    
    // La pantalla de finalización de la que hablamos
    document.body.innerHTML = `
        <div class="fixed inset-0 bg-[#050a14] flex flex-col justify-center items-center text-center p-10 z-[9999]">
            <h2 class="text-4xl font-black text-cyan-400 mb-6 uppercase">¡SIMULACRO COMPLETADO!</h2>
            <p class="text-xl text-white mb-8">La Inteligencia Artificial está analizando tus incidencias de audio y video.</p>
            <div class="bg-white/5 p-8 rounded-3xl border border-cyan-500/30 mb-10">
                <p class="text-sm uppercase tracking-widest text-gray-400 mb-4">Próximo paso obligatorio:</p>
                <a href="LINK_DE_TU_MEET_AQUI" target="_blank" class="bg-cyan-600 hover:bg-cyan-400 text-white font-black py-4 px-10 rounded-2xl text-2xl animate-bounce inline-block">
                    ENTRAR AL MEET DE RESULTADOS
                </a>
            </div>
            <p class="text-gray-500 italic text-sm">Tu calificación será liberada en vivo por el Director.</p>
        </div>
    `;
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
                incidenciasVigilancia.push(`Ruido detectado en el minuto ${document.getElementById('timer').innerText}`);
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
                incidenciasVigilancia.push(`Ausencia detectada en cámara en el minuto ${tiempoActual}`);
            } else if (detections.length > 1) {
                incidenciasVigilancia.push(`Múltiples personas en cámara en el minuto ${tiempoActual}`);
            }
        }, 5000); 

    } catch (error) {
        console.warn("La vigilancia de video falló al iniciar.", error);
    }
}

// Iniciar el motor
window.onload = init;
