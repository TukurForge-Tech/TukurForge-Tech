// examen-demo.js - Motor de Diagnóstico (Versión Marketing)

let reactivos = [];         
let index = 0;
let aciertos = 0;
let seleccionActual = null;
let tiempoSeg = 15 * 60; // 15 Minutos de Demo
let timerInterval; // 🛑 NUEVA VARIABLE PARA CONTROLAR EL RELOJ

async function initDemo() {
    try {
        // Inicializar Biométrica Visual (Marketing)
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoElement = document.getElementById('webcam'); 
        videoElement.srcObject = stream;
        setupAudioMonitor(stream);
        setupVideoMonitor(videoElement);
        
        // Extraer reactivos de Nivel Avanzado (ID 3) para asustarlos un poco
        const { data: todos } = await _supabase.from('reactivos')
            .select('*')
            .eq('nivel', 3)
            .eq('tipo_examen', 'ECOEMS') // 🛑 AQUÍ ESTÁ EL NUEVO FILTRO
            .limit(100); 

        if (!todos || todos.length === 0) {
            alert("Error conectando con la BD de la demo.");
            window.location.href = 'index.html';
            return;
        }

        // Filtramos para evitar lecturas largas en el demo por rapidez (Estrategia de Ventas)
        const filtrados = todos.filter(r => !r.texto_lectura && !r.id_grupo_lectura);
        
        // Mezclamos y tomamos exactamente 15
        reactivos = filtrados.sort(() => Math.random() - 0.5).slice(0, 15);

        if (reactivos.length > 0) {
            render(); 
            startTimer();
        }
    } catch (e) { 
        console.error(e);
        alert(`Otorga permisos de cámara y micrófono para vivir la experiencia IA.`);
    }
}

function render() {
    const r = reactivos[index];
    const g = document.getElementById('opciones-grid'); 
    
    document.getElementById('label-materia').innerText = `DIAGNÓSTICO | ${r.materia}`;
    document.getElementById('txt-pregunta').innerText = r.pregunta;
    document.getElementById('progreso-txt').innerText = `REACTIVO ${index + 1} DE ${reactivos.length}`;
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
    
    // Invocamos traductor LaTeX
    if (window.MathJax) { window.MathJax.typesetPromise(); }
}

function procesarRespuesta() {
    const r = reactivos[index];
    const respuestaBD = String(r.respuesta_correcta).trim().toLowerCase();
    const seleccionUser = String(seleccionActual).trim().toLowerCase();
    
    if (seleccionUser === respuestaBD) aciertos++;
    
    index++; 
    if (index < reactivos.length) render(); 
    else finalizarDemo();
}

function startTimer() {
    // 🛑 ASIGNAMOS EL INTERVALO A LA VARIABLE
    timerInterval = setInterval(() => {
        const m = Math.floor(tiempoSeg / 60);
        const s = tiempoSeg % 60;
        document.getElementById('timer').innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        if (tiempoSeg-- <= 0) finalizarDemo();
    }, 1000);
}

function finalizarDemo() {
    // 🛑 DETENEMOS EL RELOJ
    clearInterval(timerInterval);

    // Apagamos la cámara
    const video = document.getElementById('webcam');
    if(video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }

    // Calculamos calificación y mostramos PANTALLA DE VENTAS
    const score = (aciertos / reactivos.length) * 100;
    document.getElementById('score-demo').innerText = Math.round(score) + "%";
    
    document.getElementById('quiz-ui').classList.add('hidden');
    document.getElementById('modal-ventas').classList.remove('hidden');
}

// Simulador Visual de Audio (Solo para dar el efecto IA en el demo)
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
        requestAnimationFrame(update);
    }
    update();
}

// Inicializar detector de caras visual (Sin guardado en BD)
async function setupVideoMonitor(videoElement) {
    try {
        const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    } catch (error) { console.warn(error); }
}

// ==========================================
// MOTOR DE CHAT IA PARA DEMO (2 TOKENS)
// ==========================================
let tokensDemo = 2;

async function enviarChatDemo() {
    const input = document.getElementById('demo-chat-input');
    const box = document.getElementById('demo-chat-box');
    const texto = input.value.trim();
    
    if (!texto) return;
    if (tokensDemo <= 0) {
        box.innerHTML += `<div class="bg-red-900/30 border border-red-500/50 p-3 rounded-lg text-red-400 text-xs">Tokens agotados. Inscríbete al plan PRO para desbloquear Energía IA ilimitada.</div>`;
        box.scrollTop = box.scrollHeight;
        return;
    }

    // Descontar token y mostrar mensaje usuario
    tokensDemo--;
    document.getElementById('demo-tokens').innerText = tokensDemo;
    box.innerHTML += `<div class="flex justify-end"><div class="bg-cyan-900/40 border border-cyan-500/30 p-2 rounded-lg text-white max-w-[85%]">${texto}</div></div>`;
    input.value = '';
    
    const idBurbuja = "typing-" + Date.now();
    box.innerHTML += `<div class="bg-gray-800 p-3 rounded-lg text-gray-300 max-w-[85%]"><span id="${idBurbuja}" class="animate-pulse">Analizando...</span></div>`;
    box.scrollTop = box.scrollHeight;

    try {
        const url = `https://pcuopqvmucmhtcdeswxh.supabase.co/functions/v1/chat-simu`;
        const response = await fetch(url, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ contents: [{ parts: [{ text: texto }] }] })
        });
        
        const data = await response.json();
        const respuestaIA = data.candidates[0].content.parts[0].text;
        document.getElementById(idBurbuja).parentElement.innerHTML = respuestaIA.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-400">$1</strong>');
        if (window.MathJax) { window.MathJax.typesetPromise(); }
    } catch (e) {
        document.getElementById(idBurbuja).innerText = "Error de conexión en el Demo.";
        tokensDemo++; // Le regresamos el token si falla
        document.getElementById('demo-tokens').innerText = tokensDemo;
    }
}

document.getElementById('demo-chat-input')?.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') enviarChatDemo();
});

window.onload = initDemo;
