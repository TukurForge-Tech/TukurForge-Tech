// examen.js - Motor Adaptativo e IA del Simulador (Versión Universal)

const params = new URLSearchParams(window.location.search);
const token = params.get('v');
let nivelLabel = localStorage.getItem('simu_nivel');
const tipoPruebaEnMemoria = localStorage.getItem('simu_tipo_examen'); // Nueva variable
const cantQ = parseInt(localStorage.getItem('simu_preguntas'));
const mins = parseInt(localStorage.getItem('simu_tiempo'));
const esPro = localStorage.getItem('es_pro') === "true";

let reactivos = [];         
let colchonReactivos = [];  
let reactivosFallados = []; 
let index = 0;
let aciertos = 0;
let rachaAciertos = 0;      
let seleccionActual = null;
let respuestasAlumno = []; // Nueva memoria temporal
let preguntasMarcadas = [];
let tiempoSeg = mins * 60;
let incidenciasVigilancia = [];
let ultimoAvisoRuido = 0;

async function init() {
    try {
        // --- 🛡️ CHECKLIST DE REQUISITOS TÉCNICOS ---
        console.log("🔍 Validando entorno de examen...");
        
        // 1. Validar MathJax con MUCHA paciencia (Hasta 10 segundos)
        let intentosMath = 0;
        while (intentosMath < 20) {
            // Si ya existe y está listo, rompemos el ciclo y avanzamos
            if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
                console.log("✅ Motor de matemáticas listo.");
                break; 
            }
            console.log(`⏳ Esperando matemáticas... (Intento ${intentosMath + 1}/20)`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Espera medio segundo
            intentosMath++;
        }

        // Si después de 10 largos segundos de verdad no cargó, entonces sí abortamos
        if (!window.MathJax || typeof window.MathJax.typesetPromise !== 'function') {
            console.warn("⚠️ MathJax no detectado tras límite de tiempo.");
            alert("Tu conexión a internet parece inestable y el motor de matemáticas no pudo descargar. Por favor, asegúrate de no tener un bloqueador de anuncios (AdBlock) activo y recarga la página.");
            return; // Detenemos el inicio del examen
        }

        // 2. Validar que sea Computadora (Basado en el tamaño de pantalla o UserAgent)
        const esMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (esMobile) {
            alert("Este simulador solo está permitido en computadoras de escritorio o laptops por seguridad.");
            window.location.href = 'dashboard.html';
            return;
        }

        // 3. Validar Cámara y Audio (Lo que ya tenías)

        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: { 
                noiseSuppression: true, 
                echoCancellation: true, 
                autoGainControl: true 
            } 
        });
        const videoElement = document.getElementById('webcam'); 
        videoElement.srcObject = stream;
        setupAudioMonitor(stream);
        setupVideoMonitor(videoElement);
        
        const emailPadre = localStorage.getItem('session_email');
        const nombreHijo = localStorage.getItem('nombre_alumno');

        // 1. Extraemos de la memoria
        let instRaw = localStorage.getItem('plan_institucion'); 
        let areaRaw = localStorage.getItem('plan_area'); 

        // 2. EL ESCUDO: Si la memoria dice "undefined" o está sucia, ponemos UNAM y A1 por defecto para que NO truene la página.
        const inst = (instRaw && instRaw !== "undefined" && instRaw !== "null") ? instRaw : "UNAM";
        let area = (areaRaw && areaRaw !== "undefined" && areaRaw !== "null") ? areaRaw : "A1";

        // 3. EL PARCHE ECOEMS: Forzamos el área a 'ECOEMS' en lugar de 'GENERAL' para que encuentre las preguntas en la base de datos.
        if (inst === 'ECOEMS') {
            area = 'ECOEMS'; 
        }

       // 4. Asignamos la regla final
        const institucionRegla = inst.includes('ECOEMS') ? 'ECOEMS' : ((inst.includes('UNAM') || inst.includes('IPN')) ? `${inst} ${area}` : inst);

        // 🛡️ EL NUEVO MOTOR: LLAMADA A LA API BÓVEDA
        // Ya no necesitamos buscar niveles ni distribuciones aquí, la API lo hace por nosotros.
        
        const paramsAPI = {
            email: emailPadre,
            token_hex: token, // El 'v' de la URL
            nombre_alumno: nombreHijo,
            tipo_examen: tipoPruebaEnMemoria,
            cant_q: cantQ,
            nivel_label: nivelLabel,
            inst: inst,
            area: area
        };

        try {
            console.log("🚀 Solicitando examen a la Bóveda...");
            const response = await fetch('https://pcuopqvmucmhtcdeswxh.supabase.co/functions/v1/generar-examen', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${supabaseKey}` 
                },
                body: JSON.stringify(paramsAPI)
            });

            const dataAPI = await response.json();

            if (!dataAPI.success) {
                throw new Error(dataAPI.error || "Error desconocido en la API");
            }

            // Cargamos los reactivos que la API ya filtró, revolvió y limpió de respuestas
            reactivos = dataAPI.reactivos;

            console.log(`🎯 Examen recibido: ${reactivos.length} reactivos listos.`);

            if (reactivos.length > 0) {
                const loader = document.getElementById('pantalla-carga');
                document.getElementById('lbl-institucion').innerText = institucionRegla;
                document.getElementById('lbl-aspirante').innerText = nombreHijo;
                if (loader) loader.classList.add('hidden'); // Apaga la carga
                const appContainer = document.getElementById('app-container');
                if (appContainer) appContainer.classList.remove('hidden'); // Muestra el examen
                
                // Solo si no es PRO, descontamos intento (si tienes esa función activa)
                if (!esPro && typeof ejecutarDescuentoIntento === 'function') ejecutarDescuentoIntento(); 
                
                render(); 
                startTimer();
            } else { 
                alert(`La API no encontró reactivos para tu plan actual.`);
                window.location.href = 'dashboard.html'; 
            }

        } catch (apiErr) {
            console.error("Falla en la Bóveda:", apiErr);
            alert(`Error de conexión segura: ${apiErr.message}`);
            window.location.href = 'dashboard.html';
        }

    } catch (e) { 
        console.error("Error crítico en init:", e);
        alert(`Sistema interrumpido: ${e.message}`);
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
        document.getElementById('audio-meter').style.width = Math.min(volume * 4, 100) + "%";
        
        if (volume > 40 && (Date.now() - ultimoAvisoRuido > 5000)) {
            ultimoAvisoRuido = Date.now();
            if (typeof registrarEventoVigilancia === 'function') registrarEventoVigilancia("Ruido moderado/fuerte detectado");
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
        if (typeof registrarEventoVigilancia === 'function') await registrarEventoVigilancia("Examen abortado por el alumno");
        window.location.href = 'dashboard.html';
    }
}

function render() {
    renderGrid(); // Pintamos los cuadritos
    
    const r = reactivos[index];
    const colLectura = document.getElementById('col-lectura');
    const colPregunta = document.getElementById('col-pregunta');

    // 1. Mostrar/Ocultar Texto de Lectura
    if (r.texto_lectura && r.texto_lectura.trim() !== "") {
        if(colLectura) {
            colLectura.classList.remove('hidden');
            colLectura.classList.add('lg:flex', 'lg:w-[55%]');
        }
        if(colPregunta) colPregunta.className = 'w-full lg:w-[45%] h-full overflow-y-auto custom-scrollbar transition-all duration-300 pr-2 pb-4';
        document.getElementById('txt-lectura').innerHTML = r.texto_lectura;
    } else {
        if(colLectura) {
            colLectura.classList.add('hidden');
            colLectura.classList.remove('lg:flex', 'lg:w-[55%]');
        }
        if(colPregunta) colPregunta.className = 'w-full h-full overflow-y-auto custom-scrollbar transition-all duration-300 pr-2 pb-4';
    }

    // 2. Textos
    document.getElementById('label-materia').innerText = `${localStorage.getItem('plan_nombre_completo')} | ${r.materia}`;
    document.getElementById('txt-pregunta').innerHTML = `<span class="font-black text-cyan-400 mr-2">${index + 1})</span> ${r.pregunta}`;
    
    // 3. Pintar Opciones (Diseño Demo)
    const g = document.getElementById('opciones-grid'); 
    g.innerHTML = '';
    
    // No las revolvemos si no quieres, o las podemos dejar directas. Así respeta A,B,C,D:
    const contenido = [
        { id: 'a', t: r.opcion_a }, { id: 'b', t: r.opcion_b },
        { id: 'c', t: r.opcion_c }, { id: 'd', t: r.opcion_d }
    ];

    const letras = ['A', 'B', 'C', 'D'];
    const miRespuestaGuardada = respuestasAlumno[index] ? respuestasAlumno[index].seleccion : null;

    contenido.forEach((op, i) => {
        if (!op.t) return; // Si la opción está vacía, no la pinta
        const b = document.createElement('button');
        const esSeleccionada = miRespuestaGuardada === op.id;
        
        b.className = 'w-full text-left bg-black/40 border p-3 rounded-xl transition-all text-sm flex items-start gap-3 focus:outline-none op-btn group ' + 
                       (esSeleccionada ? 'border-cyan-400 bg-cyan-900/30' : 'border-slate-800 hover:border-cyan-500');
        
        const divLetraClass = 'w-6 h-6 text-xs rounded-md flex items-center justify-center font-bold shrink-0 mt-0.5 border transition-transform ' +
                             (esSeleccionada ? 'bg-cyan-500 text-black border-cyan-400 scale-110' : 'bg-slate-800 border-slate-700 group-hover:scale-110 text-cyan-400');

        b.innerHTML = `<div class="${divLetraClass}">${letras[i]}</div><div class="flex-1 latex-container text-slate-200">${op.t}</div>`;
        
        b.onclick = () => {
            seleccionActual = op.id;
            respuestasAlumno[index] = { id_pregunta: r.id, seleccion: seleccionActual };
            render(); // Redibuja al instante
        };
        g.appendChild(b);
    });

    // 4. Lógica de Botones (Anterior, Finalizar, Siguiente)
    const btnAnt = document.getElementById('btn-anterior');
    const btnSig = document.getElementById('btn-siguiente');

    if (index === 0) {
        if(btnAnt) btnAnt.classList.add('invisible');
    } else { 
        if(btnAnt) btnAnt.classList.remove('invisible'); 
    }

    if (index === reactivos.length - 1) {
        if(btnSig) {
            btnSig.innerHTML = '<i class="fa-solid fa-flag-checkered mr-2"></i> Finalizar';
            btnSig.className = "px-3 md:px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)] transition-all flex items-center justify-center font-bold text-[10px] md:text-xs uppercase tracking-wider";
            btnSig.onclick = () => finalizar(); // ENVÍO MASIVO
        }
    } else {
        if(btnSig) {
            btnSig.innerHTML = 'Siguiente <i class="fa-solid fa-chevron-right ml-2"></i>';
            btnSig.className = "px-3 md:px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center font-bold text-[10px] md:text-xs uppercase tracking-wider";
            btnSig.onclick = () => siguientePregunta();
        }
    }

    if(typeof MathJax !== 'undefined') MathJax.typesetPromise();
    //if(colPregunta) colPregunta.scrollTop = 0;
}

// Seleccionar opción (Solo la guarda en memoria y pinta el botón)
function seleccionarOpcion(letra) {
    seleccionActual = letra.toLowerCase();
    
    // Guardamos la selección en la posición exacta del examen
    respuestasAlumno[index] = {
        id_pregunta: reactivos[index].id,
        seleccion: seleccionActual
    };
    
    render(); // Redibuja para que se ilumine de azul la opción
}

// Botón Siguiente
function siguientePregunta() {
    if (index < reactivos.length - 1) {
        const lecturaAnterior = reactivos[index].texto_lectura; // Memoria de la lectura actual
        index++;
        const lecturaNueva = reactivos[index].texto_lectura; // Memoria de la lectura siguiente
        
        seleccionActual = respuestasAlumno[index] ? respuestasAlumno[index].seleccion : null;
        render();
        
        // La columna de las preguntas y opciones SIEMPRE sube
        const colPregunta = document.getElementById('col-pregunta');
        if (colPregunta) colPregunta.scrollTop = 0;
        
        // 👇 SOLUCIÓN: La lectura SOLO sube si el texto cambió
        if (lecturaAnterior !== lecturaNueva) {
            const txtLectura = document.getElementById('txt-lectura');
            if (txtLectura && txtLectura.parentElement) txtLectura.parentElement.scrollTop = 0;
        }
    }
}

// Botón Anterior
function preguntaAnterior() {
    if (index > 0) {
        const lecturaAnterior = reactivos[index].texto_lectura;
        index--;
        const lecturaNueva = reactivos[index].texto_lectura;
        
        seleccionActual = respuestasAlumno[index] ? respuestasAlumno[index].seleccion : null;
        render();
        
        const colPregunta = document.getElementById('col-pregunta');
        if (colPregunta) colPregunta.scrollTop = 0;
        
        // 👇 SOLUCIÓN: La lectura SOLO sube si el texto cambió al retroceder
        if (lecturaAnterior !== lecturaNueva) {
            const txtLectura = document.getElementById('txt-lectura');
            if (txtLectura && txtLectura.parentElement) txtLectura.parentElement.scrollTop = 0;
        }
    }
}

// Botón Marcar (Pin amarillo)
function toggleMarcarPregunta() {
    const pId = reactivos[index].id;
    const pos = preguntasMarcadas.indexOf(pId);
    if (pos > -1) {
        preguntasMarcadas.splice(pos, 1); // La desmarcamos
    } else {
        preguntasMarcadas.push(pId); // La marcamos
    }
    render(); // Redibuja el mapa de cuadritos
}

async function procesarRespuesta() {
    const r = reactivos[index];
    const seleccionUser = String(seleccionActual).trim().toLowerCase();
    
    // 1. Guardamos la letra en la memoria temporal
    respuestasAlumno.push({
        id_pregunta: r.id,
        seleccion: seleccionUser
    });
    
    // 2. Pasamos a la siguiente pregunta al instante (Cero lag)
    index++; 
    if (index < reactivos.length) {
        seleccionActual = null; // Limpiamos la selección
        render(); 
    } else {
        finalizar();
    }
}

function startTimer() {
    // 👇 NUEVO: Calcular hora actual y hora de fin
    const ahora = new Date();
    const fin = new Date(ahora.getTime() + tiempoSeg * 1000);
    
    const lblInicio = document.getElementById('lbl-hora-inicio');
    const lblFin = document.getElementById('lbl-hora-fin');
    
    // Pintamos las horas en la pantalla (Ej. 12:44 P.M.)
    if (lblInicio) lblInicio.innerText = `INICIO: ${ahora.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    if (lblFin) lblFin.innerText = `FIN: ${fin.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    // 👆 FIN DE LO NUEVO

    const timerInterval = setInterval(() => {
        const h = Math.floor(tiempoSeg / 3600);
        const m = Math.floor((tiempoSeg % 3600) / 60);
        const s = tiempoSeg % 60;
        const timerEl = document.getElementById('timer');
        if(timerEl) timerEl.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        
        if (tiempoSeg-- <= 0) {
            clearInterval(timerInterval);
            finalizar();
        }
    }, 1000);
    
    // Guardamos la referencia en el objeto window para poder limpiarlo al finalizar manual
    window.timerIntervalRef = timerInterval;
}

async function finalizar() {
    if (window.timerIntervalRef) clearInterval(window.timerIntervalRef);
    
    // Cambiamos el texto de la pantalla para que el alumno sepa que estamos calificando
    const panelPreguntas = document.getElementById('panel-preguntas');
    if (panelPreguntas) {
        panelPreguntas.innerHTML = `<div class="text-center p-10"><h2 class="text-2xl font-black text-cyan-400 animate-pulse">CALIFICANDO EXAMEN...</h2><p class="text-gray-400 mt-2">No cierres esta ventana, estamos procesando tus respuestas.</p></div>`;
    }

    const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;
    const emailPadre = localStorage.getItem('session_email');
    const token = localStorage.getItem('token_hex_hijo');
    const nombreHijo = localStorage.getItem('nombre_alumno');

        // ⚠️ ATENCIÓN: URL TEMPORAL PARA PRUEBAS LOCALES EN Docker
        //const response = await fetch('http://127.0.0.1:54321/functions/v1/validar-respuesta', {

    try {
        console.log("🚀 Enviando paquete masivo a la Bóveda...");
        
        // --- ⚙️ CONTROL DE ENTORNOS ---
        // PRODUCCIÓN (Oficial):
         const nombreAPI = 'validar-respuesta';
        
        // DESARROLLO (Pruebas seguras):
        //const nombreAPI = 'validar-respuesta-des';

        // 🛡️ SOLUCIÓN AL 401: Cliente oficial de Supabase
        const { data: dataAPI, error } = await _supabase.functions.invoke(nombreAPI, {
            body: {
                email: emailPadre,
                token_hex: token,
                nombre_alumno: nombreHijo,
                nivel_label: nivelLabel, 
                respuestas_alumno: respuestasAlumno 
            }
        });

        if (error) throw new Error(error.message);
        if (!dataAPI || !dataAPI.success) throw new Error(dataAPI?.error || "Falla al calificar masivamente.");

        // Seteamos los resultados oficiales
        aciertos = dataAPI.aciertos;
        reactivosFallados = dataAPI.fallas_academicas;
        const p = (aciertos / reactivos.length) * 100;
        
        // Estructuración de reportes secundarios
        let riesgo = "Bajo";
        let veredicto = "El comportamiento fue adecuado.";
        if (incidenciasVigilancia.length > 5) { riesgo = "Alto"; veredicto = `Alerta: ${incidenciasVigilancia.length} anomalías.`; }
        else if (incidenciasVigilancia.length > 0) { riesgo = "Medio"; veredicto = `Precaución: ${incidenciasVigilancia.length} incidencias.`; }

        const detallesJSON = {
            aciertos_totales: aciertos,
            preguntas_totales: reactivos.length,
            log_vigilancia: incidenciasVigilancia,
            fallas_academicas: reactivosFallados
        };

        const nombrePlan = localStorage.getItem('plan_nombre_completo') || 'EXAMEN GENERAL';
        const nombreFinalPrueba = (tipoPruebaEnMemoria === 'Repaso') ? 'Reto de Repaso' : nombrePlan;

        // Guardado coordinado
        await guardarResultadoFinal(p, nivelID, detallesJSON, nombreFinalPrueba);
        if (typeof guardarAnalisisVigilancia === 'function') await guardarAnalisisVigilancia({ veredicto: veredicto, riesgo: riesgo });
        if (typeof guardarProgresoIA === 'function') await guardarProgresoIA(p);
        
        setTimeout(() => {
            window.location.href = `dashboard.html?res=${Math.round(p)}`;
        }, 1500);

    } catch (error) {
        console.error("❌ Error Crítico en Cierre Masivo:", error);
        alert("Ocurrió un inconveniente al sincronizar tus respuestas. Verifica tu conexión e inténtalo de nuevo.");
    }
}

async function guardarResultadoFinal(p, nID, detalles, nombrePrueba) {
    const email = localStorage.getItem('session_email');
    const token = localStorage.getItem('token_hex_hijo');
    const nombre = localStorage.getItem('nombre_alumno');

    await _supabase.from('resultados_examenes').insert([{
        tipo_prueba: nombrePrueba,
        puntaje_obtenido: Math.round(p),
        detalles_fallas: detalles,
        email: email,
        token_hex: token,
        nombre_alumno: nombre,
        nivel_examen: nID
    }]);
}

async function setupVideoMonitor(videoElement) {
    try {
        const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

        setInterval(async () => {
            if (videoElement.paused || videoElement.ended) return;

            const detections = await faceapi.detectAllFaces(videoElement, new faceapi.TinyFaceDetectorOptions());
            const timerEl = document.getElementById('timer');
            const tiempoActual = timerEl ? timerEl.innerText : "00:00";

            if (detections.length === 0) {
                if (typeof registrarEventoVigilancia === 'function') registrarEventoVigilancia("Rostro no detectado (Posible abandono)");
                incidenciasVigilancia.push(`Ausencia detectada en cámara en el minuto ${tiempoActual}`);
            } else if (detections.length > 1) {
                if (typeof registrarEventoVigilancia === 'function') registrarEventoVigilancia("Múltiples rostros detectados");
                incidenciasVigilancia.push(`Múltiples personas en cámara en el minuto ${tiempoActual}`);
            }
        }, 5000); 

    } catch (error) {
        console.warn("La vigilancia de video no pudo iniciar:", error);
    }
}

// 🛡️ FUNCIÓN DE BITÁCORA EXACTA (Alineada al esquema de BD)
async function registrarPasoPorReactivo(idReactivo, fueCorrecto, nivelActual) {
    try {
        // Sacamos los datos correctos de la memoria
        const emailHijo = localStorage.getItem('session_email');
        const nombreHijo = localStorage.getItem('nombre_alumno');

        // Si por alguna razón no hay sesión, no intentamos guardar para evitar errores
        if (!emailHijo) return; 

        // Inserción con los nombres EXACTOS de tus columnas
        await _supabase.from('bitacora_reactivos_vistos').insert([{
            email: emailHijo,
            nombre_alumno: nombreHijo,
            reactivo_id: idReactivo,
            nivel: nivelActual,
            es_correcto: fueCorrecto
        }]);
        
    } catch (err) {
        console.error("Error silencioso guardando en la bitácora:", err);
        // Si la bitácora falla, el examen sigue fluyendo sin molestar al alumno
    }
}

function renderGrid() {
    const grid = document.getElementById('grid-navegacion');
    if (!grid) return;
    grid.innerHTML = '';
    
    let respondidas = 0; // 👈 Iniciamos el contador
    
    for (let i = 0; i < reactivos.length; i++) {
        const btn = document.createElement('button');
        const estaRespondida = respuestasAlumno[i] && respuestasAlumno[i].seleccion;
        const estaMarcada = preguntasMarcadas.includes(reactivos[i].id);
        
        if (estaRespondida) respondidas++; // 👈 Sumamos si ya eligió una letra
        
        let clases = 'w-6 h-6 rounded text-[10px] font-bold transition-all flex items-center justify-center border ';
        
        if (i === index) {
            clases += 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.5)] scale-110 z-10';
        } else if (estaMarcada) {
            clases += 'bg-yellow-400 border-yellow-300 text-black shadow-[0_0_10px_rgba(250,204,21,0.6)] hover:bg-yellow-300';
        } else if (estaRespondida) {
            clases += 'bg-red-900/60 border-red-500 text-red-400 hover:bg-red-800';
        } else {
            clases += 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600';
        }

        btn.className = clases;
        
        if (estaMarcada) {
            btn.innerHTML = '<i class="fa-solid fa-xmark text-xs"></i>';
        } else if (estaRespondida) {
            btn.innerHTML = '<i class="fa-solid fa-check text-[10px]"></i>';
        } else {
            btn.innerHTML = (i + 1);
        }
        
        btn.onclick = () => { index = i; render(); }; 
        grid.appendChild(btn);
    }

    // 👇 Actualizamos el texto "RESPONDIDAS: X / 35"
    const progresoTxt = document.getElementById('progreso-txt');
    if (progresoTxt) {
        progresoTxt.innerText = `RESPONDIDAS: ${respondidas} / ${reactivos.length}`;
    }
}

window.onload = init;
