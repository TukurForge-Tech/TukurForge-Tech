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

    // Envío del Formulario
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const emailValue = document.getElementById('email').value.trim();
        const passwordValue = passwordInput.value; // Supabase lo empaqueta seguro, acepta &
        const msg = document.getElementById('msg');
        const btn = document.getElementById('btnIngresar');

        msg.innerText = "Autenticando...";
        msg.className = "text-center text-xs mt-4 font-bold tracking-widest uppercase h-4 text-cyan-400 animate-pulse";
        btn.disabled = true;

        try {
            // Buscamos al usuario en la tabla de accesos
            const { data, error } = await _supabase
                .from('usuarios_membresias')
                .select('*')
                .eq('email', emailValue)
                .single();

            if (data) {
                // Validación estricta de contraseña (Case Sensitive)
                if (data.password_hijo === passwordValue) {
                    
                    // Guardado en Memoria (Cookies locales)
                    localStorage.setItem('token_hex', data.token_hex);
                    localStorage.setItem('nombre_alumno', data.nombre_alumno);
                    localStorage.setItem('session_email', emailValue); 
                    
                    // EFECTO SPLASH Y REDIRECCIÓN
                    document.getElementById('login-box').classList.add('hidden');
                    const splash = document.getElementById('splash-screen');
                    const video = document.getElementById('splash-video');
                    
                    splash.classList.remove('hidden');
                    video.play();
                    
                    // Redirección al terminar el video (Aquí lo mandas al dashboard real)
                    video.onended = () => { window.location.href = 'dashboard.html'; };
                    
                } else {
                    mostrarError("Contraseña incorrecta", btn, msg);
                }
            } else {
                mostrarError("Usuario no registrado", btn, msg);
            }
        } catch (err) {
            console.error("Detalle del error técnico:", err);
            mostrarError("Error de red. Verifica conexión.", btn, msg);
        }
    });
});

function mostrarError(mensaje, btn, msg) {
    msg.innerText = mensaje;
    msg.className = "text-center text-xs mt-4 font-bold tracking-widest uppercase h-4 text-red-500";
    btn.disabled = false;
}
