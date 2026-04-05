// login.js - Lógica de Autenticación de Aspirantes Multi-Curso

document.addEventListener("DOMContentLoaded", () => {
    // Función del Ojo de contraseña
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

// Función Principal de Login
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
        // 1. Petición a Supabase SIN .single() porque un correo puede tener varios cursos
        const { data, error } = await _supabase
            .from('usuarios_membresias')
            .select('*')
            .eq('email', emailValue);

        if (error || !data || data.length === 0) {
            mostrarError("Usuario no registrado", btn, msg);
            return;
        }

        // 2. Limpieza de lo que tecleó el usuario
        let passwordTecleadoLimpio = passwordValue.trim();
        
        let perfilHijoEncontrado = null;
        let perfilPadreEncontrado = false;

        // 3. Recorremos TODOS los cursos comprados bajo ese correo buscando la contraseña
        for (const registro of data) {
            // Limpiamos los &amp; y espacios invisibles de la BD
            let passHijoLimpio = (registro.password_hijo || "").replace(/&amp;/g, "&").trim();
            let passPadreLimpio = (registro.password_padre || "").replace(/&amp;/g, "&").trim();

            if (passHijoLimpio === passwordTecleadoLimpio) {
                perfilHijoEncontrado = registro;
                break; // Match perfecto de alumno, detenemos la búsqueda
            } else if (passPadreLimpio === passwordTecleadoLimpio) {
                perfilPadreEncontrado = true;
            }
        }

        // 4. Verificación de Vías
        if (perfilHijoEncontrado) {
            
            // Guardado en Memoria (El dashboard.js usa session_email para pintar las pestañas)
            localStorage.setItem('token_hex', perfilHijoEncontrado.token_hex); 
            localStorage.setItem('nombre_alumno', perfilHijoEncontrado.nombre_alumno);
            localStorage.setItem('session_email', emailValue); 
            
            // Transición de éxito al Dashboard
            document.getElementById('login-box').classList.add('hidden');
            const splash = document.getElementById('splash-screen');
            const video = document.getElementById('splash-video');
            
            if (splash && video) {
                splash.classList.remove('hidden');
                video.play();
                video.onended = () => { window.location.href = 'dashboard.html'; };
            } else {
                window.location.href = 'dashboard.html';
            }
            
        } else if (perfilPadreEncontrado) {
            // La carretera del padre que me indicaste que no está activa aún
            mostrarError("Panel de tutores en desarrollo. Usa la contraseña del alumno.", btn, msg);
        } else {
            mostrarError("Contraseña incorrecta", btn, msg);
        }

    } catch (err) {
        console.error("Detalle del error técnico:", err);
        mostrarError("Error de red. Verifica tu conexión a internet.", btn, msg);
    }
}

function mostrarError(mensaje, btn, msg) {
    msg.innerText = mensaje;
    msg.className = "text-center text-xs mt-4 font-bold tracking-widest uppercase h-4 text-red-500";
    btn.disabled = false;
}
