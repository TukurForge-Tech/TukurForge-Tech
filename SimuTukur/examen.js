// examen.js - Motor Adaptativo e IA del Simulador

const params = new URLSearchParams(window.location.search);
const token = params.get('v');
const nivelLabel = localStorage.getItem('simu_nivel');
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
        
        const inst = localStorage.getItem('plan_institucion'); 
        const area = localStorage.getItem('plan_area'); 
        
        const institucionRegla = inst.includes('ECOEMS') ? 'ECOEMS' : (inst.includes('UNAM') ? 'UNAM A4' : inst);
        
        let filtroTipos = [];
        if (inst.includes('ECOEMS')) {
            filtroTipos = ['ECOEMS']; 
        } else if (inst.includes('UNAM')) {
            filtroTipos = ['UNAM_GENERAL', area]; 
        } else {
            filtroTipos = [inst];
        }

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

        // --- FASE 2: COSECHA INTELIGENTE BLINDADA ---
        const nivelID = (nivelLabel === "Principiante") ? 1 : (nivelLabel === "Medio") ? 2 : 3;
        const nivelColchonID = nivelID < 3 ? nivelID + 1 : 3;

        const { data: regla } = await _supabase.from('reglas_simulador')
            .select('distribucion_materias')
            .eq('institucion', institucionRegla)
            .eq('nivel', nivelLabel)
            .single();

        if (!regla || !regla.distribucion_materias) {
            alert(`Error estructural: No hay distribución configurada para ${institucionRegla} en ${nivelLabel}.`);
            window.location.href = 'dashboard.html';
            return;
        }

        const distribucion = regla.distribucion_materias;
        let reactivosPuros = [];
        
        for (const [materia, cantidad] of Object.entries(distribucion)) {
            const { data: todos } = await _supabase.from('reactivos')
                .select('*').in('tipo_examen', filtroTipos).eq('nivel', nivelID).eq('materia', materia);

            if (todos && todos.length > 0) {
                let grupos = {};
                todos.forEach(r => {
                    // Agrupación perfecta usando tu UUID de base de datos
                    let llave = "suelta_" + r.id;
                    if (r.id_grupo_lectura) {
                        llave = "grupo_" + r.id_grupo_lectura;
                    } else if (r.texto_lectura && r.texto_lectura.trim() !== "") {
                        llave = "txt_" + r.texto_lectura.trim().substring(0, 30);
                    }
                    
                    if (!grupos[llave]) grupos[llave] = [];
                    grupos[llave].push(r);
                });

                let llavesLectura = Object.keys(grupos).filter(k => k.startsWith("grupo_") || k.startsWith("txt_")).sort(() => Math.random() - 0.5);
                let llavesSueltas = Object.keys(grupos).filter(k => k.startsWith("suelta_")).sort(() => Math.random() - 0.5);
                let seleccionados = [];

                // 1. Intentamos meter bloques completos de lectura sin romperlos
                for (let llave of llavesLectura) {
                    let bloque = grupos[llave].sort(() => Math.random() - 0.5);
                    if (seleccionados.length + bloque.length <= cantidad) {
                        seleccionados.push(...bloque);
                    } else if (seleccionados.length === 0 && bloque.length >= cantidad) {
                        seleccionados.push(...bloque.slice(0, cantidad));
                    }
                }

                // 2. Rellenamos lo que falte con preguntas sueltas
                for (let llave of llavesSueltas) {
                    if (seleccionados.length < cantidad) {
                        seleccionados.push(grupos[llave][0]);
                    }
                }

                // 3. Si aún faltan, partimos una lectura a la fuerza (solo como último recurso)
                if (seleccionados.length < cantidad) {
                    for (let llave of llavesLectura) {
                        let bloque = grupos[llave];
                        for (let p of bloque) {
                            if (!seleccionados.includes(p) && seleccionados.length < cantidad) {
                                seleccionados.push(p);
                            }
                        }
                    }
                }
                reactivosPuros.push(...seleccionados);
            }

            // Descargamos el colchón extra (nivel superior)
            if (nivelID < 3) {
                const cantColchon = Math.ceil(cantidad * 0.5);
                const { data: colchonTodos } = await _supabase.from('reactivos')
                    .select('*').in('tipo_examen', filtroTipos).eq('nivel', nivelColchonID).eq('materia', materia);

                if (colchonTodos && colchonTodos.length > 0) {
                    let colchonShuffled = colchonTodos.sort(() => Math.random() - 0.5).slice(0, cantColchon);
                    colchonReactivos.push(...colchonShuffled);
                }
            }
        }

        // --- FASE 2.5: ORDENAMIENTO EN PANTALLA ---
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
                let bloque = subGrupos[llave].sort(() => Math.random() - 0.5);
                reactivos.push(...bloque);
            });
        });

        colchonReactivos = colchonReactivos.sort(() => Math.random() - 0.5);

        if (reactivos.length > 0) {
            if (!esPro) ejecutarDescuentoIntento(); 
            render(); 
            startTimer();
        } else { 
            alert(`Base de datos vacía. El sistema intentó buscar en: ${filtroTipos.join(", ")}`);
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

function render() {
    const r = reactivos[index];
    const panelLectura = document.getElementById('panel-lectura');

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
    document.getElementById('panel-preguntas').scrollTop = 0; 
}

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
            // Buscamos una pregunta futura de la misma materia que NO sea de lectura para no romper bloques
            const idxReemplazo = reactivos.findIndex((re, i) => {
                if (i <= index) return false;
                if (re.materia !== r.materia) return false;
                if (re.texto_lectura && re.texto_lectura.trim() !== "") return false;
                return true;
            });

            // Buscamos una pregunta difícil del colchón que tampoco sea de lectura
            const idxColchon = colchonReactivos.findIndex(c => c.materia === r.materia && (!c.texto_lectura || c.texto_lectura.trim() === ""));
            
            if (idxReemplazo !== -1 && idxColchon !== -1) {
                const preguntaDura = colchonReactivos.splice(idxColchon, 1)[0];
                reactivos[idxReemplazo] = preguntaDura;
                console.log("🔥 Racha perfecta: Inyectando reactivo de nivel superior de forma segura.");
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
