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
        document.getElementById('audio-fill').style.width = Math.min(volume * 4, 100) + "%";
        
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
    const r = reactivos[index];
    const panelLectura = document.getElementById('panel-lectura');

    if (r.texto_lectura && r.texto_lectura.trim() !== "") {
        if(panelLectura) panelLectura.classList.remove('hidden');
        document.getElementById('texto-lectura-content').innerText = r.texto_lectura;
    } else {
        if(panelLectura) panelLectura.classList.add('hidden');
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
        b.className = "w-full text-left p-3 md:p-4 rounded-xl border border-slate-800 bg-black/20 flex items-center gap-4 transition-all text-sm md:text-base italic hover:border-cyan-500 hover:bg-slate-800/80 shadow-inner group";
        b.innerHTML = `<span class="min-w-[2rem] w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-xs font-black text-cyan-400 shrink-0 group-hover:scale-110 transition-transform">${letras[i]}</span> <span class="text-slate-200 leading-relaxed">${op.t}</span>`;
        
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
    const panelQ = document.getElementById('panel-preguntas');
    if(panelQ) panelQ.scrollTop = 0;
}

async function procesarRespuesta() {
    const r = reactivos[index];
    const seleccionUser = String(seleccionActual).trim().toLowerCase();
    const btnConfirm = document.getElementById('btn-confirm');
    
    // Bloqueamos el botón para que no le dé doble clic mientras la red trabaja
    btnConfirm.disabled = true;
    const textoOriginalBtn = btnConfirm.innerText;
    btnConfirm.innerText = "VALIDANDO...";

    try {
        // 🛡️ ENVIAMOS LA RESPUESTA A LA BÓVEDA
        const response = await fetch('https://pcuopqvmucmhtcdeswxh.supabase.co/functions/v1/validar-respuesta', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${supabaseKey}` 
            },
            body: JSON.stringify({
                email: localStorage.getItem('session_email'),
                token_hex: localStorage.getItem('token_hex_hijo'),
                nombre_alumno: localStorage.getItem('nombre_alumno'),
                id_pregunta: r.id,
                respuesta_alumno: seleccionUser
            })
        });

        const dataAPI = await response.json();

        if (!dataAPI.success) {
            throw new Error(dataAPI.error || "Falla de comunicación con el servidor");
        }

        const esCorrecto = dataAPI.es_correcto;
        const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;
        
        // Guardamos en la bitácora silenciosa de BD
        if (typeof registrarPasoPorReactivo === 'function') await registrarPasoPorReactivo(r.id, esCorrecto, nivelID);

        // Lógica de calificación local
        if (esCorrecto) {
            aciertos++;
            rachaAciertos++;
            
            if (rachaAciertos >= 3 && colchonReactivos.length > 0) {
                const idxReemplazo = reactivos.findIndex((re, i) => {
                    if (i <= index) return false;
                    if (re.materia !== r.materia) return false;
                    if (re.texto_lectura && re.texto_lectura.trim() !== "") return false; 
                    return true;
                });

                if (idxReemplazo !== -1) {
                    const preguntaDura = colchonReactivos.shift(); 
                    reactivos[idxReemplazo] = preguntaDura;
                }
                rachaAciertos = 0; 
            }
        } else {
            rachaAciertos = 0; 
            reactivosFallados.push({
                materia: r.materia,
                tema: r.tema_guia || "General",
                pregunta_id: r.id,
                pregunta: r.pregunta,          
                correcta: dataAPI.respuesta_real // 🔒 La respuesta secreta nos la da la API solo si falló
            });
        }
        
        // Pasamos a la siguiente pregunta
        index++; 
        if (index < reactivos.length) {
            render(); 
        } else {
            finalizar();
        }

    } catch (error) {
        console.error("Error al calificar:", error);
        alert("Hubo un ligero corte de internet al validar tu respuesta. Por favor intenta de nuevo.");
        btnConfirm.disabled = false;
        btnConfirm.innerText = textoOriginalBtn;
    }
}

function startTimer() {
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

    // Calculamos el nombre correcto del examen sacándolo directo de la memoria
    const nombrePlan = localStorage.getItem('plan_nombre_completo') || 'EXAMEN GENERAL';
    const nombreFinalPrueba = (tipoPruebaEnMemoria === 'Repaso') ? 'Reto de Repaso' : nombrePlan;

    // 🛡️ CORRECCIÓN: Envolvemos en try/catch para obligar al sistema a esperar
    try {
        console.log("Iniciando guardado de resultados...");
        await guardarResultadoFinal(p, nivelID, detallesJSON, nombreFinalPrueba);
        
        if (typeof guardarAnalisisVigilancia === 'function') await guardarAnalisisVigilancia({ veredicto: veredicto, riesgo: riesgo });
        if (typeof guardarProgresoIA === 'function') await guardarProgresoIA(p);
        
        // Le damos 500ms (medio segundo) a Supabase para cerrar la conexión antes de saltar de página
        setTimeout(() => {
            window.location.href = `dashboard.html?res=${Math.round(p)}`;
        }, 500);

    } catch (errorGuardado) {
        console.error("Error crítico guardando el examen:", errorGuardado);
        alert("Hubo un error guardando tus resultados. Por favor contacta a soporte.");
        window.location.href = `dashboard.html?res=${Math.round(p)}`;
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

window.onload = init;
