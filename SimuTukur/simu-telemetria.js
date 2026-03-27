// simu-telemetria.js - Mapeo Milimétrico a Supabase

// 1. Registro en bitacora_reactivos_vistos
async function registrarPasoPorReactivo(reactivoId, esCorrecto, nivel) {
    const { error } = await _supabase.from('bitacora_reactivos_vistos').insert({
        email: localStorage.getItem('session_email'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        reactivo_id: reactivoId,
        nivel: parseInt(nivel),
        es_correcto: esCorrecto, // Boolean
        created_at: new Date().toISOString()
    });
    if (error) console.error("Error en bitacora_reactivos_vistos:", error.message);
}

// 2. Registro en bitacora_vigilancia
async function registrarEventoVigilancia(evento) {
    const { error } = await _supabase.from('bitacora_vigilancia').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        evento: evento, // Text
        timestamp: new Date().toISOString()
    });
}

// 3. Registro en resultados_examenes
async function guardarResultadoFinal(puntajeFinal, nivelFinal) {
    const { error } = await _supabase.from('resultados_examenes').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        tipo_prueba: localStorage.getItem('plan_actual'), // Ej: UNAM A4
        puntaje_obtenido: Math.round(puntajeFinal), // Integer
        nivel_examen: parseInt(nivelFinal), // Integer
        fecha_aplicacion: new Date().toISOString() // Timestamp
    });
    if (error) console.error("Error en resultados_examenes:", error.message);
}

// 4. Control de Intentos en usuarios_membresias
async function ejecutarDescuentoIntento() {
    try {
        const email = localStorage.getItem('session_email');
        const token = localStorage.getItem('token_hex_hijo');
        
        const { data, error } = await _supabase.from('usuarios_membresias')
            .select('intentos_simulacro_restantes')
            .eq('email', email)
            .eq('token_hex', token)
            .maybeSingle(); // Usamos maybeSingle para que no truene si hay retraso

        if (data && data.intentos_simulacro_restantes > 0) {
            await _supabase.from('usuarios_membresias')
                .update({ intentos_simulacro_restantes: data.intentos_simulacro_restantes - 1 })
                .eq('email', email)
                .eq('token_hex', token);
        }
    } catch (e) {
        console.error("Error silencioso en descuento:", e);
    }
}
