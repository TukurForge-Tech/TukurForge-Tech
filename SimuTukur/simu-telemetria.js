// simu-telemetria.js - Motor de Datos para SimuTukur

// 1. Registro de cada pregunta contestada
async function registrarPasoPorReactivo(reactivoId, esCorrecto, nivel) {
    const { error } = await _supabase.from('bitacora_reactivos_vistos').insert({
        email: localStorage.getItem('session_email'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        reactivo_id: reactivoId,
        nivel: parseInt(nivel),
        es_correcto: esCorrecto,
        created_at: new Date().toISOString()
    });
    if (error) console.error("Error en bitacora_reactivos:", error.message);
}

// 2. Registro de incidencias (Ruido, cámara, abandonos)
async function registrarEventoVigilancia(evento) {
    const { error } = await _supabase.from('bitacora_vigilancia').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        evento: evento,
        timestamp: new Date().toISOString()
    });
}

// 3. Registro final del examen
async function guardarResultadoFinal(puntajeFinal, nivelFinal) {
    // Mapeo exacto a tus columnas: puntaje_obtenido y nivel_examen
    const { error } = await _supabase.from('resultados_examenes').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        tipo_prueba: localStorage.getItem('plan_actual'),
        puntaje_obtenido: Math.round(puntajeFinal),
        nivel_examen: parseInt(nivelFinal),
        fecha_aplicacion: new Date().toISOString()
    });
    if (error) console.error("Error en resultados_examenes:", error.message);
}

// 4. Descuento de intentos para Plan Básico
async function ejecutarDescuentoIntento() {
    const email = localStorage.getItem('session_email');
    const token = localStorage.getItem('token_hex_hijo');
    
    const { data } = await _supabase.from('usuarios_membresias')
        .select('intentos_simulacro_restantes')
        .eq('email', email).eq('token_hex', token).single();

    if (data) {
        await _supabase.from('usuarios_membresias')
            .update({ intentos_simulacro_restantes: data.intentos_simulacro_restantes - 1 })
            .eq('email', email).eq('token_hex', token);
    }
}
