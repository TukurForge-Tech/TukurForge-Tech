// acceso_piloto.js
// ==========================================
// CORTINA DE ACCESO (RELOJ BLOQUEADOR)
// ==========================================
// Fecha y hora exacta en la que se abrirá la puerta del examen (16 Mayo 2026 10:00 AM)
const fechaAperturaExamen = new Date('2026-05-16T10:00:00').getTime();

document.addEventListener('DOMContentLoaded', () => {
    iniciarRelojBloqueador();
});

function iniciarRelojBloqueador() {
    const reloj = document.getElementById('contenedorRelojAcceso');
    const formulario = document.getElementById('formularioLogin');

    const intervalo = setInterval(() => {
        const ahora = new Date().getTime();
        const distancia = fechaAperturaExamen - ahora;

        if (distancia > 0) {
            // Aún falta tiempo: Calculamos y pintamos los números
            const dias = Math.floor(distancia / (1000 * 60 * 60 * 24));
            const horas = Math.floor((distancia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutos = Math.floor((distancia % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((distancia % (1000 * 60)) / 1000);

            if (document.getElementById("dias_acceso")) document.getElementById("dias_acceso").innerText = dias.toString().padStart(2, '0');
            if (document.getElementById("horas_acceso")) document.getElementById("horas_acceso").innerText = horas.toString().padStart(2, '0');
            if (document.getElementById("minutos_acceso")) document.getElementById("minutos_acceso").innerText = minutos.toString().padStart(2, '0');
            if (document.getElementById("segundos_acceso")) document.getElementById("segundos_acceso").innerText = segundos.toString().padStart(2, '0');
        } else {
            // ¡LLEGÓ LA HORA! Ocultar el reloj y mostrar el formulario para ingresar
            clearInterval(intervalo);
            if (reloj) reloj.classList.add('hidden');
            if (formulario) formulario.classList.remove('hidden');
        }
    }, 1000);
}

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
            await _supabase
                .from('prospectos_simulacro')
                .update({ aceptacion_telemetria_examen: true }) // La columna que creaste en Supabase
                .eq('correo', email);
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
