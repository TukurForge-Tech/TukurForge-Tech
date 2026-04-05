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
