// login.js - Lógica de Autenticación con Temporizador de Splash

document.addEventListener("DOMContentLoaded", () => {
    const toggleIcon = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    if (toggleIcon && passwordInput) {
        toggleIcon.addEventListener('click', () => {
            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                toggleIcon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                passwordInput.type = "password";
                toggleIcon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    }
});

async function procesarLogin() {
    const emailValue = document.getElementById('email').value.trim();
    const passwordInput = document.getElementById('password');
    const passwordValue = passwordInput.value; 
    
    const msg = document.getElementById('msg');
    const btn = document.getElementById('btnIngresar');

    if (!emailValue || !passwordValue) {
        mostrarError("Por favor llena todos los campos", btn, msg);
        return;
    }

    msg.innerText = "Autenticando...";
    msg.className = "text-center text-xs mt-4 font-bold tracking-widest uppercase h-4 text-cyan-400 animate-pulse";
    btn.disabled = true;

    try {
        const { data, error } = await _supabase
            .from('usuarios_membresias')
            .select('*')
            .eq('email', emailValue);

        if (error || !data || data.length === 0) {
            mostrarError("Usuario no registrado", btn, msg);
            return;
        }

        let passwordTecleadoLimpio = passwordValue.trim();
        let perfilHijoEncontrado = null;
        let perfilPadreEncontrado = false;

        for (const registro of data) {
            let passHijoLimpio = (registro.password_hijo || "").replace(/&amp;/g, "&").trim();
            let passPadreLimpio = (registro.password_padre || "").replace(/&amp;/g, "&").trim();

            if (passHijoLimpio === passwordTecleadoLimpio) {
                perfilHijoEncontrado = registro;
                break;
            } else if (passPadreLimpio === passwordTecleadoLimpio) {
                perfilPadreEncontrado = true;
            }
        }

        if (perfilHijoEncontrado) {
            localStorage.setItem('token_hex', perfilHijoEncontrado.token_hex); 
            localStorage.setItem('nombre_alumno', perfilHijoEncontrado.nombre_alumno);
            localStorage.setItem('session_email', emailValue); 
            
            document.getElementById('login-box').classList.add('hidden');
            const splash = document.getElementById('splash-screen');
            const video = document.getElementById('splash-video');
            
            if (splash && video) {
                splash.classList.remove('hidden');
                
                // --- LÓGICA DE SALIDA SEGURA (PARACAÍDAS) ---
                let redirigido = false;
                const irAlDashboard = () => {
                    if (!redirigido) {
                        redirigido = true;
                        window.location.href = 'dashboard.html';
                    }
                };

                // El video termina o falla, o pasan 4 segundos
                video.onended = irAlDashboard;
                video.onerror = irAlDashboard;
                setTimeout(irAlDashboard, 4000); 

                let playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => {
                        console.warn("Reproducción bloqueada, saltando...");
                        irAlDashboard();
                    });
                }
            } else {
                window.location.href = 'dashboard.html';
            }
            
        } else if (perfilPadreEncontrado) {
            mostrarError("Panel de tutores en desarrollo. Usa la contraseña del alumno.", btn, msg);
        } else {
            mostrarError("Contraseña incorrecta", btn, msg);
        }

    } catch (err) {
        console.error("Error técnico:", err);
        mostrarError("Error de red. Verifica tu conexión.", btn, msg);
    }
}

function mostrarError(mensaje, btn, msg) {
    msg.innerText = mensaje;
    msg.className = "text-center text-xs mt-4 font-bold tracking-widest uppercase h-4 text-red-500";
    btn.disabled = false;
}

async function procesarRecuperacion() {
    const email = document.getElementById('email-recuperar').value.trim();
    const msg = document.getElementById('msg-recuperar');
    const btn = document.getElementById('btn-enviar-recuperacion');
    const icono = document.getElementById('icono-recuperar');

    if(!email) { 
        msg.innerText = "⚠️ Ingresa un correo válido."; 
        msg.className = "text-xs mt-4 text-red-400 block font-bold"; 
        return; 
    }

    btn.disabled = true;
    icono.className = "fa-solid fa-spinner fa-spin mr-2";
    msg.innerText = "Buscando tu cuenta...";
    msg.className = "text-xs mt-4 text-cyan-400 block animate-pulse font-bold";

    try {
        // 1. Validar si existe en la BD
        const { data, error } = await _supabase.from('usuarios_membresias').select('id, nombre_alumno').eq('email', email).single();

        if (error || !data) throw new Error("No encontramos ninguna cuenta con este correo.");

        // 2. Generar nueva contraseña aleatoria estilo "Simu-X9F2"
        const nuevaPass = "Simu-" + Math.random().toString(36).substring(2, 6).toUpperCase() + Math.floor(Math.random() * 10);

        // 3. Actualizar la contraseña en la BD
        const { error: updateError } = await _supabase.from('usuarios_membresias').update({ password_hijo: nuevaPass }).eq('email', email);
        if (updateError) throw updateError;

        // 4. Llamar al nuevo cartero (Edge Function)
        await fetch('https://pcuopqvmucmhtcdeswxh.supabase.co/functions/v1/recuperar-pass', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, nombre: data.nombre_alumno, nueva_pass: nuevaPass })
        });

        msg.innerText = "✅ ¡Listo! Revisa tu bandeja de entrada o Spam.";
        msg.className = "text-xs mt-4 text-green-400 block font-bold";
        icono.className = "fa-solid fa-check mr-2";

    } catch (err) {
        msg.innerText = "❌ " + (err.message || "Error de red. Intenta más tarde.");
        msg.className = "text-xs mt-4 text-red-400 block font-bold";
        btn.disabled = false;
        icono.className = "fa-solid fa-paper-plane mr-2";
    }
}
