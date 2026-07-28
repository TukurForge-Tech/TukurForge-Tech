// examen-demo.js - Motor Clon Oficial (Adaptado para 15 mins y Embudo de Ventas)

let reactivos = [];         
let respuestasUsuario = []; // NUEVA: Matriz exacta de 15 espacios
let preguntasMarcadas = [];
let incidenciasAudio = [];
let incidenciasVideo = [];
let index = 0;
let tiempoSeg = 15 * 60; // 15 Minutos EXACTOS
let timerIntervalLocal;
let ultimoAvisoRuido = 0;
/*let reactivos = [];         
let historialRespuestas = []; 
let incidenciasAudio = [];
let incidenciasVideo = [];
let index = 0;
let aciertos = 0;
let seleccionActual = null;
let tiempoSeg = 15 * 60; // 15 Minutos EXACTOS
let timerIntervalLocal;
let ultimoAvisoRuido = 0;*/

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
            respuestasUsuario = new Array(reactivos.length).fill(null);
            preguntasMarcadas = new Array(reactivos.length).fill(false);

            document.getElementById('pantalla-carga').style.display = 'none';
            render();
            iniciarCronometro(); 
        }

    } catch (err) {
        console.error("Error real del sistema:", err);
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

    return poolFinal;
}

// Función para dibujar la cuadrícula superior (Iconos más pequeños para 140 preguntas)
function renderGrid() {
    const grid = document.getElementById('grid-navegacion');
    grid.innerHTML = '';
    let respondidas = 0;

    for (let i = 0; i < reactivos.length; i++) {
        const btn = document.createElement('button');
        const estaRespondida = respuestasUsuario[i] !== null;
        if (estaRespondida) respondidas++;

        // Cajas más pequeñas (w-6 h-6) y texto diminuto (text-[10px])
        let clases = 'w-6 h-6 rounded text-[10px] font-bold transition-all flex items-center justify-center border ';
        const estaMarcada = preguntasMarcadas[i];
        
        if (i === index) {
            clases += 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)] scale-110 z-10';
        } else if (estaMarcada) {
            clases += 'bg-yellow-400 border-yellow-300 text-black shadow-[0_0_10px_rgba(250,204,21,0.6)] hover:bg-yellow-300'; // AMARILLO ELÉCTRICO
            btn.innerHTML = '<i class="fa-solid fa-xmark text-xs"></i>';
        } else if (estaRespondida) {
            clases += 'bg-red-900/60 border-red-500 text-red-400 hover:bg-red-800'; // ROJO para contestadas
            btn.innerHTML = '<i class="fa-solid fa-check text-[10px]"></i>';
        } else {
            clases += 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'; // Vacío
            btn.innerHTML = (i + 1);
        }

        btn.className = clases;
        btn.innerHTML = estaRespondida ? '<i class="fa-solid fa-check text-[10px]"></i>' : (i + 1);
        btn.onclick = () => { index = i; render(); }; 
        
        grid.appendChild(btn);
    }
    document.getElementById('progreso-txt').innerText = `RESPONDIDAS: ${respondidas} / ${reactivos.length}`;
}

// El Renderizado Maestro
function render() {
    if (index >= reactivos.length) { finalizarDemo(); return; }

    const item = reactivos[index];
    renderGrid(); 
    document.getElementById('label-materia').innerText = item.materia;
    
    const colLectura = document.getElementById('col-lectura');
    const colPregunta = document.getElementById('col-pregunta');

    if (item.texto_lectura && item.texto_lectura.trim() !== "") {
        colLectura.classList.remove('hidden');
        colLectura.classList.add('lg:flex', 'lg:w-[55%]'); 
        colPregunta.className = 'w-full lg:w-[45%] h-full overflow-y-auto custom-scrollbar transition-all duration-300 pr-2 pb-4';
        document.getElementById('txt-lectura').innerHTML = item.texto_lectura;
    } else {
        colLectura.classList.add('hidden');
        colLectura.classList.remove('lg:flex', 'lg:w-[55%]');
        colPregunta.className = 'w-full h-full overflow-y-auto custom-scrollbar transition-all duration-300 pr-2 pb-4';
    }

    // Inyectamos el número 1), 2) antes de la pregunta
    document.getElementById('txt-pregunta').innerHTML = `<span class="font-black text-cyan-400 mr-2">${index + 1})</span> ${item.pregunta}`;

    const divOpciones = document.getElementById('opciones-grid');
    divOpciones.innerHTML = '';
    
    const letras = ['A', 'B', 'C', 'D'];
    const miRespuestaGuardada = respuestasUsuario[index] ? respuestasUsuario[index].seleccion : null;

    [item.opcion_a, item.opcion_b, item.opcion_c, item.opcion_d].forEach((op, i) => {
        if (!op) return;
        const btn = document.createElement('button');
        const esSeleccionada = miRespuestaGuardada === letras[i];
        
        // Cajas de respuesta más compactas (p-3 en lugar de p-4 y gap-3)
        btn.className = 'w-full text-left bg-black/40 border p-3 rounded-xl transition-all text-sm flex items-start gap-3 focus:outline-none op-btn group ' + 
                       (esSeleccionada ? 'border-red-500 bg-red-900/20' : 'border-slate-700 hover:border-cyan-500');
        
        // Letras A, B, C, D más compactas (w-6 h-6 en lugar de w-8 h-8)
        const divLetraClass = 'w-6 h-6 text-xs rounded-md flex items-center justify-center font-bold shrink-0 mt-0.5 border transition-transform ' +
                             (esSeleccionada ? 'bg-red-500 text-white border-red-400 scale-110' : 'bg-slate-800 border-slate-700 group-hover:scale-110');

        btn.innerHTML = `<div class="${divLetraClass}">${letras[i]}</div><div class="flex-1 latex-container">${op}</div>`;
        btn.onclick = () => procesarRespuestaActuario(letras[i], item);
        divOpciones.appendChild(btn);
    });

    // Botones de Íconos (Tamaño reducido)
    const btnAnt = document.getElementById('btn-anterior');
    const btnSig = document.getElementById('btn-siguiente');

    if (index === 0) btnAnt.classList.add('invisible');
    else { btnAnt.classList.remove('invisible'); btnAnt.onclick = () => { index--; render(); }; }

    if (index === reactivos.length - 1) {
        btnSig.innerHTML = '<i class="fa-solid fa-flag-checkered mr-2"></i> Finalizar';
        btnSig.className = "px-3 md:px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)] transition-all flex items-center justify-center font-bold text-[10px] md:text-xs uppercase tracking-wider";
        btnSig.onclick = () => validarCierreExamen(false);
    } else {
        btnSig.innerHTML = 'Siguiente <i class="fa-solid fa-chevron-right ml-2"></i>';
        btnSig.className = "px-3 md:px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center font-bold text-[10px] md:text-xs uppercase tracking-wider";
        btnSig.onclick = () => { index++; render(); };
    }

    if(typeof MathJax !== 'undefined') MathJax.typesetPromise();
    
    // 👇 EL TOQUE MÁGICO: Reiniciar el scroll hacia arriba al cambiar de pregunta
    document.getElementById('col-pregunta').scrollTop = 0;
}

// CORRECCIÓN DEL BUG: Usamos obtenerTextoOpcionNueva
function procesarRespuestaActuario(letra, item) {
    const miSeleccion = letra.trim().toUpperCase();
    const correctaBD = (item.respuesta_correcta || "").trim().toUpperCase();
    
    respuestasUsuario[index] = {
        pregunta: item.pregunta,
        materia: item.materia,
        correcta: obtenerTextoOpcionNueva(correctaBD, item), // <-- Aquí estaba el error
        tu_respuesta: obtenerTextoOpcionNueva(miSeleccion, item), // <-- Aquí estaba el error
        seleccion: miSeleccion,
        es_acierto: (miSeleccion === correctaBD)
    };
    
    render();
}

// NUEVA FUNCIÓN: Pone o quita la bandera amarilla
function toggleMarcarPregunta() {
    preguntasMarcadas[index] = !preguntasMarcadas[index];
    renderGrid(); // Solo repintamos la cuadrícula de arriba sin recargar la pregunta
}

function iniciarCronometro() {
    const el = document.getElementById('timer');
    const ahora = new Date();
    const fin = new Date(ahora.getTime() + tiempoSeg * 1000);
    document.getElementById('lbl-hora-inicio').innerText = `Inicio: ${ahora.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    document.getElementById('lbl-hora-fin').innerText = `Termina: ${fin.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    timerIntervalLocal = setInterval(() => {
        tiempoSeg--;
        let m = Math.floor(tiempoSeg / 60);
        let s = tiempoSeg % 60;
        
        el.innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        
        if (tiempoSeg <= 300) el.classList.add('text-red-500', 'animate-pulse');
        
        if(tiempoSeg <= 0) {
            clearInterval(timerIntervalLocal);
            // Mandamos llamar el cierre limpio, forzando la entrega sin preguntar
            validarCierreExamen(true); 
        }
    }, 1000);
}

// NUEVA FUNCIÓN: Valida el cierre del examen (Con parámetro para cuando se acaba el tiempo)
function validarCierreExamen(forzadoPorTiempo = false) {
    const faltantes = respuestasUsuario.filter(r => r === null).length;
    
    // Si el usuario le dio clic a finalizar, le preguntamos. Si el tiempo se acabó, no preguntamos.
    if (faltantes > 0 && !forzadoPorTiempo) {
        if (!confirm(`Te faltan ${faltantes} preguntas por contestar en el mapa. ¿Seguro que quieres entregar el examen?`)) return;
    }
    
    // Contamos aciertos
    let aciertosFinales = respuestasUsuario.filter(r => r !== null && r.es_acierto).length;
    
    // Rellenamos las vacías para que el Dashboard no falle
    const historialLimpio = respuestasUsuario.map((r, i) => {
        if (r !== null) return r;
        const item = reactivos[i];
        return {
            pregunta: item.pregunta,
            materia: item.materia,
            correcta: obtenerTextoOpcionNueva((item.respuesta_correcta || ""), item),
            tu_respuesta: "No respondida / Dejada en blanco",
            seleccion: null,
            es_acierto: false
        };
    });

    localStorage.setItem('simu_historial', JSON.stringify(historialLimpio));
    localStorage.setItem('simu_aciertos', aciertosFinales);
    finalizarDemo();
}

// Nueva función auxiliar de texto
function obtenerTextoOpcionNueva(letra, item) {
    if (!letra) return "No respondida";
    const letraLimpia = letra.trim().toUpperCase(); 
    const mapa = { 'A': item.opcion_a, 'B': item.opcion_b, 'C': item.opcion_c, 'D': item.opcion_d };
    return mapa[letraLimpia] || letra; 
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
