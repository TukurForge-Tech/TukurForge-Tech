// acceso_piloto.js
const SUPABASE_URL = "https://pcuopqvmucmhtcdeswxh.supabase.co";
const SUPABASE_KEY = "TU_KEY_AQUÍ"; // Pon tu llave
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function validarLoginPiloto() {
    const input = document.getElementById('email_input');
    const email = input.value.trim().toLowerCase();
    const btnText = document.getElementById('btn_text');
    const btnSpinner = document.getElementById('btn_spinner');
    const errorMsg = document.getElementById('error_msg');

    if (!email) {
        mostrarError("Por favor, ingresa tu correo.");
        return;
    }

    btnText.innerText = "Validando...";
    btnSpinner.classList.remove('hidden');
    errorMsg.classList.add('hidden');

    try {
        const { data, error } = await _supabase
            .from('prospectos_simulacro')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !data) {
            mostrarError("Acceso denegado. Este correo no está registrado en el grupo Piloto.");
        } else {
            // Guardamos sesión y lo mandamos al dashboard aislado
            localStorage.setItem('session_email', email);
            window.location.href = 'simulacro_dash.html';
        }
    } catch (err) {
        mostrarError("Error de conexión. Intenta de nuevo.");
    } finally {
        btnText.innerText = "Acceder al Simulador";
        btnSpinner.classList.add('hidden');
    }
}

function mostrarError(mensaje) {
    const errorMsg = document.getElementById('error_msg');
    errorMsg.innerText = mensaje;
    errorMsg.classList.remove('hidden');
}

document.getElementById('email_input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') validarLoginPiloto();
});
