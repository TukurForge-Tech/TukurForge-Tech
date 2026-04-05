// login.js - Lógica de Autenticación de Aspirantes

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
        // Petición a Supabase usando el cliente oficial
        const { data, error } = await _supabase
            .from('usuarios_membresias')
            .select('*')
            .eq('email', emailValue)
            .single();

        if (error || !data) {
            mostrarError("Usuario no registrado", btn, msg);
            return;
        }

        // ==========================================
        // BLINDAJE DE CARACTERES ESPECIALES
        // ==========================================
        // 1. Limpiamos la BD: Si guardó & como &amp;, lo devolvemos a &.
        // 2. Usamos trim() en ambos lados para matar espacios invisibles accidentales.
        let passwordBDLimpio = (data.password_hijo || "").replace(/&amp;/g, "&").trim();
        let passwordTecleadoLimpio = passwordValue.trim();

        // Comparación estricta ya limpia
        if (passwordBDLimpio === passwordTecleadoLimpio) {
            
            // Guardado en Memoria
            localStorage.setItem('token_hex', data.token_hex);
            localStorage.setItem('nombre_alumno', data.nombre_alumno);
            localStorage.setItem('session_email', emailValue); 
            
            // Transición de éxito
            document.getElementById('login-box').classList.add('hidden');
            const splash = document.getElementById('splash-screen');
            const video = document.getElementById('splash-video');
            
            if (splash && video) {
                splash.classList.remove('hidden');
                video.play();
                video.onended = () => { window.location.href = 'dashboard.html'; };
            } else {
                // Paracaídas por si el video no carga
                window.location.href = 'dashboard.html';
            }
            
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
