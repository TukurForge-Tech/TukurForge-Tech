// simu-telemetria.js - Mapeo Milimétrico a Supabase

// 1. Registro en bitacora_reactivos_vistos
async function registrarPasoPorReactivo(reactivoId, esCorrecto, nivel) {
    const { error } = await _supabase.from('bitacora_reactivos_vistos').insert({
        email: localStorage.getItem('session_email'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        reactivo_id: reactivoId,
        nivel: parseInt(nivel),
        es_correcto: esCorrecto, 
        created_at: new Date().toISOString()
    });
    if (error) console.error("Error en bitacora_reactivos_vistos:", error.message);
}

// 2. Registro en bitacora_vigilancia
async function registrarEventoVigilancia(evento) {
    const { error } = await _supabase.from('bitacora_vigilancia').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo') || 'N/A',
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        evento: evento, 
        timestamp: new Date().toISOString()
    });
    if (error) console.error("Error vigilancia:", error.message);
}

// 3. Registro en resultados_examenes (AQUÍ GUARDAMOS EL JSON CON LOS CONSEJOS)
async function guardarResultadoFinal(puntajeFinal, nivelFinal, detallesFallasJSON) {
    const { error } = await _supabase.from('resultados_examenes').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo') || 'N/A',
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        tipo_examen: localStorage.getItem('plan_institucion'), // "UNAM", "ECOEMS"
        nivel: parseInt(nivelFinal),
        puntaje_obtenido: puntajeFinal,
        detalles: detallesFallasJSON, // Esto permite al Chat leer los consejos
        created_at: new Date().toISOString()
    });
    if (error) console.error("Error en resultados_examenes:", error.message);
}

// 4. Registro de Accesos
async function registrarAccesoPlataforma() {
    const { error } = await _supabase.from('registro_accesos').insert({
        email: localStorage.getItem('session_email'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        dispositivo: navigator.userAgent,
        created_at: new Date().toISOString()
    });
}

// 5. Analisis Consolidado de Vigilancia
async function guardarAnalisisVigilancia(detalles_analisis) {
    const { error } = await _supabase.from('analisis_vigilancia_ia').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo') || 'N/A',
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        tipo_sensor: "Audio/Video Local",
        analisis_ia: detalles_analisis.veredicto,
        nivel_riesgo: detalles_analisis.riesgo, 
        timestamp: new Date().toISOString()
    });
    if (error) console.error("Error en analisis_vigilancia_ia:", error.message);
}

// 6. Registro de Progreso y Probabilidad
async function guardarProgresoIA(puntaje, temasAEstudiar) {
    let prob = "Baja";
    if (puntaje >= 50 && puntaje < 80) prob = "Media";
    if (puntaje >= 80) prob = "Alta";

    const { error } = await _supabase.from('analisis_progreso_ia').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo') || 'N/A',
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        materia: localStorage.getItem('plan_nombre_completo'), 
        puntaje_obtenido: Math.round(puntaje),
        probabilidad_ingreso: prob,
        sugerencias_estudio: temasAEstudiar,
        timestamp: new Date().toISOString()
    });
    if (error) console.error("Error en progreso:", error.message);
}
