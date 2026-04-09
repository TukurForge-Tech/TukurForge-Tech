async function validarAcceso() {
    const email = localStorage.getItem('session_email');
    
    // Lo pateamos a la nueva puerta del piloto
    if (!email) { window.location.href = 'acceso_piloto.html'; return; }

    const { data, error } = await _supabase
        .from('prospectos_simulacro')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !data) {
        window.location.href = 'acceso_piloto.html';
        return;
    }

    document.getElementById('user-display').innerText = `Aspirante: ${data.nombre_padre || email}`;
    localStorage.setItem('simu_creditos', 2); 
}
