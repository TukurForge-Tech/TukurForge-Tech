// simulacro_dash.js (Lógica corregida y aislada)

async function validarAccesoPilotoDash() {
    const email = localStorage.getItem('session_email');
    
    // Lo pateamos a la puerta del piloto si no hay sesión
    if (!email) { 
        window.location.href = 'acceso_piloto.html'; 
        return; 
    }

    try {
        // Obtenemos el nombre real de la base de datos
        // NOTA: Asumo que la columna es 'nombre_papa' de la tabla 'prospectos_simulacro'
        // ya que el prompt del socio tenía un error de redundancia.
        const { data, error } = await _supabase
            .from('prospectos_simulacro')
            .select('nombre_tutor') 
            .eq('correo', email) // 'correo' es el nombre real de tu columna
            .maybeSingle();

        if (error || !data) {
            // Si por algo no existe, lo sacamos
            window.location.href = 'acceso_piloto.html';
            return;
        }

        // Adecuación 2: Ponemos el nombre del papa en el saludo
        const saludoSpan = document.getElementById('username-display');
        saludoSpan.innerText = `Saludo, ${data.nombre_papa || email}`;

    } catch (err) {
        console.error("Error en validación dash:", err);
    }
}

// Adecuación 9: Iniciar el Simulacro Piloto a motor.html
function iniciarSimulacro() {
    localStorage.setItem('simu_nivel', 'PILOTO_VIP'); // Nivel adaptativo Medio-Alto
    localStorage.setItem('simu_preguntas', 60);
    localStorage.setItem('simu_tiempo', 90);
    window.location.href = 'simulacro_motor.html'; // Tu motor aislado
}

// Iniciar protocolo al cargar
window.onload = validarAccesoPilotoDash;
