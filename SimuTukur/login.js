// login.js - Lógica de Autenticación de Aspirantes

document.addEventListener("DOMContentLoaded", () => {
    // Función para el Ojo de la contraseña
    const toggleIcon = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    toggleIcon.addEventListener('click', () => {
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            toggleIcon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            passwordInput.type = "password";
            toggleIcon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    });
});

// Función Principal de Login (Invocada por el HTML)
async function procesarLogin() {
    const emailValue = document.getElementById('email').value.trim();
    const passwordInput = document.getElementById('password');
    const passwordValue = passwordInput.value; // Toma los símbolos exactos que el usuario tipeó
    
    const msg = document.getElementById('msg');
    const btn = document.getElementById('btnIngresar');

    msg.innerText = "Autenticando...";
    msg.className = "text-center text-xs mt-4 font-bold tracking-widest uppercase h-4 text-cyan-400 animate-pulse";
    btn.disabled = true;

    try {
        // 1. Buscamos al usuario en la BD solo por correo
        const { data, error } = await _supabase
            .from('usuarios_membresias')
            .select('*')
            .eq('email', emailValue)
            .single();

        if (error || !data) {
            mostrarError("Usuario no registrado", btn, msg);
            return;
        }

        // 2. Comparamos la contraseña exactamente como está en la BD
        if (data.password_hijo === passwordValue) {
            
            // Guardado en Memoria
            localStorage.setItem('token_hex', data.token_hex);
            localStorage.setItem('nombre_alumno', data.nombre_alumno);
            localStorage.setItem('session_email', emailValue); 
            
            // EFECTO SPLASH Y REDIRECCIÓN
            document.getElementById('login-box').classList.add('hidden');
            const splash = document.getElementById('splash-screen');
            const video = document.getElementById('splash-video');
            
            splash.classList.remove('hidden');
            video.play();
            
            // Cuando termine el video, manda al Dashboard
            video.onended = () => { window.location.href = 'dashboard.html'; };
            
        } else {
            mostrarError("Contraseña incorrecta", btn, msg);
        }

    } catch (err) {
        console.error("Detalle del error técnico:", err);
        mostrarError("Error de red. Verifica conexión.", btn, msg);
    }
}

function mostrarError(mensaje, btn, msg) {
    msg.innerText = mensaje;
    msg.className = "text-center text-xs mt-4 font-bold tracking-widest uppercase h-4 text-red-500";
    btn.disabled = false;
}
