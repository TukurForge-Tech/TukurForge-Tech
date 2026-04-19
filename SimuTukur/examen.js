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
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
        const institucionRegla = inst.includes('ECOEMS') ? 'ECOEMS' : (inst.includes('UNAM') ? `${inst} ${area}` : inst);
        
        // 🧠 LA INTELIGENCIA: Si es un Repaso, buscamos el nivel en la BD
        if (tipoPruebaEnMemoria === 'Repaso') {
            console.log("🔍 Modo Repaso detectado. Buscando nivel reprobado en Supabase...");
            
            const { data: ultimoFallo } = await _supabase
                .from('resultados_examenes')
                .select('nivel_examen')
                .eq('email', emailPadre)
                .eq('nombre_alumno', nombreHijo)
                .eq('token_hex', token) // El token viene de la URL (v)
                .lt('puntaje_obtenido', 70) // Solo los que no pasaron
                .order('fecha_aplicacion', { ascending: false })
                .limit(1)
                .single();

            if (ultimoFallo) {
                const etiquetas = { 1: "Principiante", 2: "Medio", 3: "Avanzado" };
                nivelLabel = etiquetas[ultimoFallo.nivel_examen];
                console.log(`✅ Nivel recuperado de la BD: ${nivelLabel}`);
            } else {
                console.warn("⚠️ No se halló examen fallado previo. Usando Principiante por defecto.");
                nivelLabel = "Principiante";
            }
        }

        // Definimos el ID numérico final para la consulta de reactivos
        const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;

        let filtroTipos = [];
        if (inst.includes('ECOEMS')) {
            filtroTipos = ['ECOEMS']; 
        } else if (inst.includes('UNAM')) {
            filtroTipos = ['UNAM_GENERAL', area]; 
        } else {
            filtroTipos = [inst];
        }

        // --- FASE 1: DESVÍO DE REPASO ---
        if (tipoPruebaEnMemoria === "Repaso") { // CORREGIDO: Evaluamos la bandera, no el nivelLabel
            let reactivosRepaso = await obtenerReactivosRepaso(cantQ); 
            if (!reactivosRepaso || reactivosRepaso.length === 0) {
                alert("¡Expediente limpio! No tienes suficientes errores registrados para armar un repaso.");
                window.location.href = 'dashboard.html';
                return;
            }

            let subGrupos = {};
            reactivosRepaso.forEach(p => {
                let llave = "suelta_" + p.id;
                if (p.id_grupo_lectura) llave = "grupo_" + p.id_grupo_lectura;
                else if (p.texto_lectura && p.texto_lectura.trim() !== "") llave = "txt_" + p.texto_lectura.trim().substring(0, 30);
                
                if(!subGrupos[llave]) subGrupos[llave] = [];
                subGrupos[llave].push(p);
            });

            let llavesSubGrupo = Object.keys(subGrupos).sort(() => Math.random() - 0.5);
            llavesSubGrupo.forEach(llave => {
                reactivos.push(...subGrupos[llave]); // Empuja el bloque de lectura pegado
            });

            render();
            startTimer();
            return; 
        }

        // --- FASE 2: COSECHA UNIVERSAL (Sin datos en duro) ---
        const nivelColchonID = nivelID < 3 ? nivelID + 1 : 3;
        const { data: regla } = await _supabase.from('reglas_simulador')
            .select('distribucion_materias')
            .eq('institucion', institucionRegla)
            .eq('nivel', nivelLabel)
            .single();

        if (!regla || !regla.distribucion_materias) {
            alert(`Error: No hay distribución para ${institucionRegla} en ${nivelLabel}.`);
            window.location.href = 'dashboard.html';
            return;
        }

        const distribucion = regla.distribucion_materias;

        // 🕵️‍♂️ NUEVO: EL "CHISMOSO" PARA LA CONSOLA (F12)
        console.log("=========================================");
        console.log("🚀 INICIANDO GENERACIÓN DE EXAMEN");
        console.log(`🏢 Institución: ${inst}`);
        console.log(`🎯 Área: ${area} (Regla aplicada: ${institucionRegla})`);
        console.log(`📈 Nivel: ${nivelLabel} (ID: ${nivelID})`);
        console.log("📦 JSON de Materias extraído de Supabase:");
        console.table(distribucion); // Esto dibujará una tabla hermosa en tu consola
        
        // Sumamos los valores para ver cuánto pidió realmente la base de datos
        let totalPedidos = Object.values(distribucion).reduce((a, b) => a + b, 0);
        console.log(`🧮 TOTAL DE REACTIVOS PEDIDOS POR EL JSON: ${totalPedidos}`);
        console.log("=========================================");

        let reactivosPuros = [];
        
        let palabrasPermitidas = [institucionRegla, inst, area];
        
        if (inst.includes('UNAM')) {
            // LÓGICA ESTRICTA UNAM: Tronco común (UNAM_GENERAL) + Área Específica
            palabrasPermitidas = ['UNAM_GENERAL', institucionRegla]; 
        }

        // 🚀 MODO TURBO: 1 SOLA CONSULTA A SUPABASE (Baja el tiempo de 5 seg a 0.5 seg)
        const materiasRequeridas = Object.keys(distribucion);
        console.log("⏳ Descargando base de datos (Modo Turbo)...");
        
        const { data: todaLaDataCruda } = await _supabase.from('reactivos')
            .select('*')
            .eq('institucion', inst)
            .in('materia', materiasRequeridas);

        console.log(`✅ ¡Descarga lista! Se trajeron ${todaLaDataCruda ? todaLaDataCruda.length : 0} reactivos en bruto.`);

        // Ahora procesamos en la memoria local, rapidísimo
        for (const [materia, cantidad] of Object.entries(distribucion)) {
            
            let dataCruda = todaLaDataCruda ? todaLaDataCruda.filter(r => r.materia === materia) : [];

            let todos = [];
            if (dataCruda && dataCruda.length > 0) {
                // Filtramos localmente con BLINDAJE ESTRICTO
                todos = dataCruda.filter(r => {
                    let tipoDB = r.tipo_examen;
                    if (!tipoDB) return false;

                    let tipoStrLimpio = "";
                    if (Array.isArray(tipoDB)) {
                        tipoStrLimpio = tipoDB.join(",").toUpperCase();
                    } else if (typeof tipoDB === 'string') {
                        tipoStrLimpio = tipoDB.toUpperCase();
                    }

                    if (inst === 'ECOEMS') {
                        return tipoStrLimpio.includes('ECOEMS');
                    } else if (inst.includes('UNAM')) {
                        return palabrasPermitidas.some(p => tipoStrLimpio.includes(p.toUpperCase()));
                    } else {
                        return palabrasPermitidas.some(p => tipoStrLimpio.includes(p.toUpperCase()));
                    }
                });
            }

            if (todos && todos.length > 0) {
                let gruposLectura = {};
                let sueltasBase = [];
                let sueltasColchon = [];

                todos.forEach(r => {
                    let esLectura = false;
                    let llave = "";
                    if (r.id_grupo_lectura) {
                        llave = "grupo_" + r.id_grupo_lectura;
                        esLectura = true;
                    } else if (r.texto_lectura && r.texto_lectura.trim() !== "") {
                        llave = "txt_" + r.texto_lectura.trim().substring(0, 30);
                        esLectura = true;
                    }

                    if (esLectura) {
                        if (!gruposLectura[llave]) gruposLectura[llave] = [];
                        gruposLectura[llave].push(r);
                    } else {
                        if (r.nivel === nivelID) sueltasBase.push(r);
                        if (r.nivel === nivelColchonID) sueltasColchon.push(r);
                    }
                });

                let seleccionados = [];
                let llavesLectura = Object.keys(gruposLectura).sort(() => Math.random() - 0.5);
                sueltasBase = sueltasBase.sort(() => Math.random() - 0.5);

                for (let llave of llavesLectura) {
                    let bloque = gruposLectura[llave].sort((a, b) => a.id - b.id);
                    if (seleccionados.length + bloque.length <= cantidad + 1) { 
                        seleccionados.push(...bloque);
                    } else if (seleccionados.length === 0) {
                        seleccionados.push(...bloque);
                    }
                    if (seleccionados.length >= cantidad) break;
                }

                while (seleccionados.length < cantidad && sueltasBase.length > 0) {
                    seleccionados.push(sueltasBase.pop());
                }
                reactivosPuros.push(...seleccionados);

                if (nivelID < 3) {
                    const cantColchon = Math.ceil(cantidad * 0.5);
                    colchonReactivos.push(...sueltasColchon.slice(0, cantColchon));
                }
            }
        }

        // ✂️ RECORTADOR INTELIGENTE (Fuerza la cantidad exacta a lo que diga el dashboard)
        if (reactivosPuros.length > cantQ) {
            console.log(`⚠️ Excedente detectado: Se armaron ${reactivosPuros.length} reactivos, pero se pidieron ${cantQ}. Aplicando recorte inteligente...`);
            let numAQuitar = reactivosPuros.length - cantQ;
            let reactivosAjustados = [];
            // Recorremos de atrás para adelante quitando preguntas "sueltas" para compensar
            for (let i = reactivosPuros.length - 1; i >= 0; i--) {
                let r = reactivosPuros[i];
                let esLectura = r.id_grupo_lectura || (r.texto_lectura && r.texto_lectura.trim() !== "");
                if (!esLectura && numAQuitar > 0) {
                    numAQuitar--; 
                } else {
                    reactivosAjustados.unshift(r); 
                }
            }
            reactivosPuros = reactivosAjustados;
            
            if (reactivosPuros.length > cantQ) {
                reactivosPuros = reactivosPuros.slice(0, cantQ);
            }
        }
        
        console.log(`🎯 TOTAL FINAL LISTO PARA EL EXAMEN: ${reactivosPuros.length} reactivos.`);

        // --- FASE 2.5: ORDENAMIENTO GARANTIZADO ---
        let reactivosAgrupados = {};
        reactivosPuros.forEach(r => {
            if (!reactivosAgrupados[r.materia]) reactivosAgrupados[r.materia] = [];
            reactivosAgrupados[r.materia].push(r);
        });

        let materiasAleatorias = Object.keys(reactivosAgrupados).sort(() => Math.random() - 0.5);
        
        materiasAleatorias.forEach(mat => {
            let preguntasMateria = reactivosAgrupados[mat];
            let subGrupos = {};
            
            preguntasMateria.forEach(p => {
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
        });

        colchonReactivos = colchonReactivos.sort(() => Math.random() - 0.5);

        if (reactivos.length > 0) {
            if (!esPro && typeof ejecutarDescuentoIntento === 'function') ejecutarDescuentoIntento(); 
            render(); 
            startTimer();
        } else { 
            alert(`Base de datos vacía para: ${filtroTipos.join(", ")}`);
            window.location.href = 'dashboard.html'; 
        }
    } catch (e) { 
        console.error("Error crítico detectado:", e);
        alert(`Sistema interrumpido: ${e.message}. \n\nRevisa los permisos de cámara/audio o la consola.`);
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
    const respuestaBD = String(r.respuesta_correcta).trim().toLowerCase();
    const seleccionUser = String(seleccionActual).trim().toLowerCase();
    const esCorrecto = (seleccionUser === respuestaBD);
    
    const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;
    if (typeof registrarPasoPorReactivo === 'function') await registrarPasoPorReactivo(r.id, esCorrecto, nivelID);

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
            pregunta: r.pregunta,          // NUEVO: Guardamos el texto
            correcta: r.respuesta_correcta // NUEVO: Guardamos la respuesta
        });
    }
    
    index++; 
    if (index < reactivos.length) render(); 
    else finalizar();
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

    // Calculamos el nombre correcto del examen
    const inst = localStorage.getItem('plan_institucion') || '';
    const nombreFinalPrueba = (tipoPruebaEnMemoria === 'Repaso') ? 'Reto de Repaso' : (inst.includes('ECOEMS') ? 'ECOEMS GENERAL' : 'UNAM GENERAL');

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
