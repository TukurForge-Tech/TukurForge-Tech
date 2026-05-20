// examen-demo.js - Motor Clon Oficial (Adaptado para 15 mins y Embudo de Ventas)

let reactivos = [];         
let reactivosFallados = []; 
let incidenciasAudio = [];
let incidenciasVideo = [];
let index = 0;
let aciertos = 0;
let seleccionActual = null;
let tiempoSeg = 15 * 60; // 15 Minutos EXACTOS
let timerIntervalLocal;
let ultimoAvisoRuido = 0;

// ==========================================
// ESCUDO ANTI-TRAMPAS (Botón Atrás)
// ==========================================

async function init() {
    // Escudo Anti-F5
    if (sessionStorage.getItem('demo_mina_activa') === 'true') {
        alert("⛔ ALERTA: Recargaste la página. El diagnóstico ha sido cancelado.");
        registrarIncidencia('video', 'El alumno recargó la página (F5).');
        finalizarDemo(); 
        return; 
    }
    sessionStorage.setItem('demo_mina_activa', 'true');

    // 👇 NUEVO: ESCUDO DE TOKEN EN URL 👇
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('v');
    const localToken = localStorage.getItem('demo_token_hex');

    if (!urlToken || urlToken !== localToken) {
        alert("⛔ Acceso denegado: Token de examen inválido o manipulado.");
        window.location.href = 'index.html';
        return;
    }
    // 👆 FIN DEL ESCUDO 👆

    try {
        // Inicializar Biometría Visual
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoElement = document.getElementById('webcam'); 
        videoElement.srcObject = stream;
        setupAudioMonitor(stream);
        setupVideoMonitor(videoElement);
        
        // Cargar los reactivos basados en la Matriz Proporcional
        reactivos = await cargarReactivosDesdeMatriz();
        
        if(reactivos.length > 0) {
            document.getElementById('lbl-estado').innerText = "Vigilancia Biométrica Activa";
            render();
            iniciarCronometro(); 
        }

    } catch (err) {
        alert("Para vivir la experiencia real del simulador, debes otorgar permisos de cámara y micrófono.");
        window.location.href = 'index.html';
    }
}

// ==========================================
// 2. COSECHA PROPORCIONAL DE LA MATRIZ (LÓGICA UNAM CORREGIDA Y LIMPIA)
// ==========================================
async function cargarReactivosDesdeMatriz() {
    document.getElementById('txt-pregunta').innerHTML = "Generando entorno de evaluación...";
    
    const matrizStr = localStorage.getItem('demo_distribucion_materias');
    const institucion = localStorage.getItem('demo_institucion'); // Ej. UNAM
    const area = localStorage.getItem('demo_area'); // Ej. A1

    if (!matrizStr) {
        alert("Error de seguridad: No se detectó configuración de examen.");
        window.location.href = 'index.html';
        return [];
    }

    const distribucion = JSON.parse(matrizStr);
    let poolFinal = [];
        
    // Arreglo para guardar los chivatos de error
    let alertasDebug = [];

    // Materias que son iguales para TODAS las áreas de la UNAM
    const materiasGeneralesUNAM = [
        "Español", "Historia Universal", "Historia de México", 
        "Geografía", "Literatura", "Comprensión de Lectura" 
    ];

    for (const [materia, cantidad] of Object.entries(distribucion)) {
        
        // PUENTE AUTOMÁTICO: Si el JSON dice "Textos", busca "Lectura"
        let materiaBusqueda = materia;
        if (materiaBusqueda === "Comprensión de Textos") {
            materiaBusqueda = "Comprensión de Lectura";
        }

        let tipoBusqueda = '';

        // Definimos las materias de tronco común para desviar la búsqueda
        const materiasGeneralesUNAM = [
            "Español", "Historia Universal", "Historia de México", 
            "Geografía", "Literatura", "Comprensión de Lectura" 
        ];
        const materiasGeneralesIPN = [
            "Historia", "Competencia Lectora", "Competencia Escrita", "Reading Comprehension"
        ];

        if (institucion === 'UNAM') {
            if (materiasGeneralesUNAM.includes(materiaBusqueda)) {
                tipoBusqueda = 'UNAM_GENERAL';
            } else {
                tipoBusqueda = `UNAM ${area}`; 
            }
        } else if (institucion === 'IPN') {
            // LÓGICA IPN: Tronco común a la bolsa general, ciencias y mate a la bolsa específica
            if (materiasGeneralesIPN.includes(materiaBusqueda)) {
                tipoBusqueda = 'IPN_GENERAL';
            } else {
                tipoBusqueda = `IPN ${area}`; 
            }
        } else {
            // LÓGICA ECOEMS
            tipoBusqueda = institucion; 
        }

        // Buscamos preguntas de Nivel Medio (2) y Avanzado (3)
        const { data, error } = await _supabase
            .from('reactivos')
            .select('*')
            .eq('tipo_examen', tipoBusqueda) 
            .eq('materia', materiaBusqueda) 
            .in('nivel', [2, 3]) 
            .limit(cantidad * 4); // Traemos de sobra para poder filtrar
        
        if (error) {
            console.error(`Error buscando ${materiaBusqueda} en ${tipoBusqueda}:`, error);
            continue;
        }

        if (data && data.length > 0) {
            // Filtramos textos muy largos para el demo
            let filtrados = data.filter(r => !r.id_grupo_lectura && (!r.texto_lectura || r.texto_lectura.length < 150));
            
            // Si nos quedamos sin preguntas filtradas, usamos las normales
            if (filtrados.length < cantidad) filtrados = data;

            if (filtrados.length >= cantidad) {
                // Todo perfecto: Las mezclamos y tomamos la cantidad que dicta la matriz
                let seleccion = filtrados.sort(() => Math.random() - 0.5).slice(0, cantidad);
                poolFinal.push(...seleccion);
            } else {
                // Faltan preguntas: Guardamos el error para avisarte
                alertasDebug.push(`- ${materiaBusqueda} (${tipoBusqueda}): Pide ${cantidad}, solo hay ${filtrados.length} válidas.`);
                poolFinal.push(...filtrados); 
            }
        } else {
            // Cero preguntas
            alertasDebug.push(`- ${materiaBusqueda} (${tipoBusqueda}): CERO preguntas encontradas.`);
        }
    }

    // Mostrar el alert si faltó algo (Ideal para que depures rápido)
    if (alertasDebug.length > 0) {
        alert("⚠️ REPORTE DE BD (Solo para ti, socio):\nFaltan preguntas para cumplir la matriz:\n\n" + alertasDebug.join("\n"));
    }

    return poolFinal.sort(() => Math.random() - 0.5);
}

// ==========================================
// 3. RENDERIZADO IDENTICO AL OFICIAL
// ==========================================
function render() {
    if (index >= reactivos.length) { finalizarDemo(); return; }

    const item = reactivos[index];
    seleccionActual = null;
    
    document.getElementById('label-materia').innerText = item.materia;
    document.getElementById('progreso-txt').innerText = `Q. ${index + 1} / ${reactivos.length}`;
    
    const wBar = ((index) / reactivos.length) * 100;
    document.getElementById('progress-bar').style.width = wBar + "%";
    
    const btnConfirm = document.getElementById('btn-confirm');
    btnConfirm.disabled = true;

    // Manejo de textos
    let textoHtml = "";
    if (item.texto_lectura && item.texto_lectura.trim() !== "") {
        textoHtml = `<div class="bg-slate-900 border border-slate-700 p-4 rounded-xl text-sm text-slate-300 mb-4 max-h-48 overflow-y-auto italic">
                        <i class="fa-solid fa-book-open text-cyan-500 mr-2"></i> ${item.texto_lectura}
                     </div>`;
    }

    document.getElementById('txt-pregunta').innerHTML = textoHtml + item.pregunta;

    const divOpciones = document.getElementById('opciones-grid');
    divOpciones.innerHTML = '';
    
    const letras = ['A', 'B', 'C', 'D'];
    [item.opcion_a, item.opcion_b, item.opcion_c, item.opcion_d].forEach((op, i) => {
        if (!op) return;
        
        const btn = document.createElement('button');
        btn.className = 'w-full text-left bg-black/40 border border-slate-700 p-4 rounded-xl hover:border-cyan-500 transition-all text-sm md:text-base flex items-start gap-4 focus:outline-none op-btn group';
        
        btn.innerHTML = `
            <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-bold shrink-0 mt-0.5 border border-slate-700 group-hover:scale-110 transition-transform">${letras[i]}</div>
            <div class="flex-1 pt-1 overflow-x-auto latex-container">${op}</div>
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

// Función auxiliar para traducir la letra (A,B,C,D) al texto real de la respuesta
function obtenerTextoOpcion(letra, item) {
    if (!letra) return "No respondida / Tiempo agotado";
    const mapa = { 'A': item.opcion_a, 'B': item.opcion_b, 'C': item.opcion_c, 'D': item.opcion_d };
    // Si la BD guarda la letra devuelve el texto, si la BD ya guardaba el texto, lo devuelve tal cual
    return mapa[letra] || letra; 
}

function procesarRespuesta() {
    if (!seleccionActual) return;
    const item = reactivos[index];
    
    if (seleccionActual === item.respuesta_correcta) {
        aciertos++;
    } else {
        reactivosFallados.push({
            pregunta: item.pregunta,
            materia: item.materia,
            correcta: obtenerTextoOpcion(item.respuesta_correcta, item),
            tu_respuesta: obtenerTextoOpcion(seleccionActual, item) // AQUÍ CAPTURAMOS LO QUE ÉL PUSO
        });
    }
    
    // Guardado Local (Nada de BD para no gastar dinero en prospectos)
    localStorage.setItem('simu_fallas', JSON.stringify(reactivosFallados));
    localStorage.setItem('simu_aciertos', aciertos);
    
    index++;
    render();
}

// ==========================================
// 4. CRONÓMETRO AUTÓNOMO
// ==========================================
function iniciarCronometro() {
    const el = document.getElementById('timer');
    timerIntervalLocal = setInterval(() => {
        tiempoSeg--;
        let m = Math.floor(tiempoSeg / 60);
        let s = tiempoSeg % 60;
        
        el.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        
        if (tiempoSeg <= 300) el.classList.add('text-red-500', 'animate-pulse'); // Presión últimos 5 mins
        
        if(tiempoSeg <= 0) {
            clearInterval(timerIntervalLocal);
            // Si se acaba el tiempo, marcamos las restantes como mal
            while(index < reactivos.length) {
                reactivosFallados.push({
                    pregunta: reactivos[index].pregunta,
                    materia: reactivos[index].materia,
                    correcta: obtenerTextoOpcion(reactivos[index].respuesta_correcta, reactivos[index]),
                    tu_respuesta: "No respondida / Tiempo agotado" // SI NO CONTESTÓ, LE DECIMOS POR QUÉ
                });
                index++;
            }
            localStorage.setItem('simu_fallas', JSON.stringify(reactivosFallados));
            finalizarDemo();
        }
    }, 1000);
}

// ==========================================
// 5. VIGILANCIA BIOMÉTRICA (Efecto Placebo)
// ==========================================
function setupAudioMonitor(stream) {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaStreamSource(stream);
    const analyzer = actx.createAnalyser();
    src.connect(analyzer);
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    const meter = document.getElementById('audio-meter');

    setInterval(() => {
        analyzer.getByteFrequencyData(dataArray);
        let sum = dataArray.reduce((a, b) => a + b, 0);
        let p = Math.min((sum / dataArray.length) * 4, 100);
        if(meter) meter.style.width = p + "%";
        
        if (p > 40 && (Date.now() - ultimoAvisoRuido > 10000)) { 
            registrarIncidencia('audio', `Ruido detectado min ${document.getElementById('timer').innerText}`);
            ultimoAvisoRuido = Date.now();
        }
    }, 200);
}

async function setupVideoMonitor(videoElement) {
    try {
        const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        setInterval(async () => {
            if (videoElement.paused) return;
            const det = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions());
            if (det.length === 0) registrarIncidencia('video', `Ausencia min ${document.getElementById('timer').innerText}`);
            else if (det.length > 1) registrarIncidencia('video', `Múltiples rostros min ${document.getElementById('timer').innerText}`);
        }, 5000); 
    } catch (e) { console.warn(e); }
}

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
// 6. FINALIZACIÓN RÁPIDA (Salto al Embudo)
// ==========================================
function finalizarDemo() {
    clearInterval(timerIntervalLocal);
    sessionStorage.removeItem('demo_mina_activa');
    localStorage.setItem('simu_terminado', 'true');
    localStorage.setItem('demo_total_preguntas', reactivos.length); // Guardamos total para sacar la calificación
    
    // Apagar cámara
    const videoEl = document.getElementById('webcam');
    if(videoEl && videoEl.srcObject) videoEl.srcObject.getTracks().forEach(t => t.stop());

    // SALTO DIRECTO AL DASHBOARD DEMO (Para la venta final)
    window.location.href = 'dash-demo.html'; 
}

window.onload = init;
