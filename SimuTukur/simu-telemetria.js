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

// 3. Registro en resultados_examenes (AHORA SÍ RECIBE EL JSON)
async function guardarResultadoFinal(puntajeFinal, nivelFinal, detallesFallasJSON) {
    const { error } = await _supabase.from('resultados_examenes').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        tipo_prueba: localStorage.getItem('plan_nombre_completo'), 
        puntaje_obtenido: Math.round(puntajeFinal), 
        nivel_examen: parseInt(nivelFinal), 
        detalles_fallas: detallesFallasJSON, // Aquí se inyecta el JSON
        fecha_aplicacion: new Date().toISOString() 
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

// 5. Guardar el veredicto final de vigilancia sin usar API de pago
async function guardarAnalisisVigilancia(detalles_analisis) {
    const { error } = await _supabase.from('analisis_vigilancia_ia').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        tipo_sensor: "Audio/Video Local",
        analisis_ia: detalles_analisis.veredicto, // Texto del veredicto
        nivel_riesgo: detalles_analisis.riesgo,   // "Bajo", "Medio", "Alto"
        timestamp: new Date().toISOString()
    });
    if (error) console.error("Error en analisis_vigilancia_ia:", error.message);
}

// 6. Registro de Progreso y Probabilidad
async function guardarProgresoIA(puntaje) {
    // Cálculo lógico de probabilidad
    let prob = "Baja";
    if (puntaje >= 50 && puntaje < 80) prob = "Media";
    if (puntaje >= 80) prob = "Alta";

    // Nota: Asegúrate de tener estas columnas en tu tabla en Supabase
    const { error } = await _supabase.from('analisis_progreso_ia').insert({
        email: localStorage.getItem('session_email'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        materia: localStorage.getItem('plan_nombre_completo'), 
        // Si no tienes las siguientes columnas, créalas en tu tabla:
        // puntaje_obtenido: Math.round(puntaje),
        // probabilidad_ingreso: prob,
        // fecha_analisis: new Date().toISOString()
    });
    if (error) console.error("Error en analisis_progreso_ia:", error.message);
}
