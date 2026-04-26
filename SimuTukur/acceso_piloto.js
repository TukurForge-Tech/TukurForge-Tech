// acceso_piloto.js

async function validarLoginPiloto() {
    const input = document.getElementById('email_input');
    const email = input.value.trim().toLowerCase();
    const btnText = document.getElementById('btn_text');
    const btnSpinner = document.getElementById('btn_spinner');
    const errorMsg = document.getElementById('error_msg');

    const terminos = document.getElementById('terminos_checkbox');

    if (!email) {
        mostrarError("Por favor, ingresa tu correo.");
        return;
    }

    // NUEVO: Validamos que esté activado
    if (!terminos.checked) {
        mostrarError("Debes aceptar el Aviso de Privacidad y el uso de cámara/micrófono para continuar.");
        return;
    }

    btnText.innerText = "Validando...";
    btnSpinner.classList.remove('hidden');
    errorMsg.classList.add('hidden');

    try {
        // Aquí usamos _supabase directo porque viene heredado del client
        const { data, error } = await _supabase
            .from('prospectos_simulacro')
            .select('*')
            .eq('correo', email)
            .maybeSingle();

        if (error || !data) {
            mostrarError("Acceso denegado. Este correo no está registrado en el grupo Piloto.");
        } else {
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
