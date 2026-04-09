// simu_dash.js
const SUPABASE_URL = "https://pcuopqvmucmhtcdeswxh.supabase.co";
const SUPABASE_KEY = "TU_KEY_AQUÍ"; // Usa la de tukur_ecoems_master.py
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function validarAcceso() {
    const email = localStorage.getItem('session_email');
    if (!email) { window.location.href = 'index.html'; return; }

    // Validar si es uno de los 13 prospectos
    const { data, error } = await _supabase
        .from('prospectos_simulacro')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

    if (error || !data) {
        alert("🚨 Lo sentimos, este correo no está registrado para el Piloto. Contacta al soporte.");
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('user-display').innerText = `Aspirante: ${data.nombre_padre || email}`;
    localStorage.setItem('simu_creditos', 2); // Forzamos 2 tokens para la IA
}

function iniciarSimulacro() {
    localStorage.setItem('simu_nivel', 'PILOTO_60');
    localStorage.setItem('simu_preguntas', 60);
    localStorage.setItem('simu_tiempo', 90);
    window.location.href = 'simulacro_motor.html';
}

window.onload = validarAcceso;
