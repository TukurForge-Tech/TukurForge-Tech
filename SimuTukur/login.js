// login.js - Lógica de Autenticación de Aspirantes

document.addEventListener("DOMContentLoaded", () => {
    // Función del Ojo de contraseña
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

// Función Principal de Login (Invocada directamente por el botón)
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
            .eq('email', emailValue)
            .single();

        if (error || !data) {
            mostrarError("Usuario no registrado", btn, msg);
            return;
        }

        // ---> AGREGA ESTA LÍNEA DE RAYOS X AQUÍ <---
        console.log("De la BD llegó:", data.password_hijo, "| Del HTML se lee:", passwordValue);
        
        // Validación estricta que permite &, $, % y emojis
        if (data.password_hijo === passwordValue) {
            localStorage.setItem('token_hex', data.token_hex);
            localStorage.setItem('nombre_alumno', data.nombre_alumno);
            localStorage.setItem('session_email', emailValue); 
            
            document.getElementById('login-box').classList.add('hidden');
            const splash = document.getElementById('splash-screen');
            const video = document.getElementById('splash-video');
            
            splash.classList.remove('hidden');
            video.play();
            video.onended = () => { window.location.href = 'dashboard.html'; };
            
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
