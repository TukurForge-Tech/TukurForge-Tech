// simu-telemetria.js - Mapeo Milimétrico a Supabase

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

async function registrarEventoVigilancia(evento) {
    const { error } = await _supabase.from('bitacora_vigilancia').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        evento: evento, 
        timestamp: new Date().toISOString()
    });
}

async function guardarResultadoFinal(puntajeFinal, nivelFinal, detallesFallasJSON) {
    const { error } = await _supabase.from('resultados_examenes').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        tipo_prueba: localStorage.getItem('plan_nombre_completo'), 
        puntaje_obtenido: Math.round(puntajeFinal), 
        nivel_examen: parseInt(nivelFinal), 
        detalles_fallas: detallesFallasJSON, // Aquí inyectamos las fallas reales
        fecha_aplicacion: new Date().toISOString() 
    });
    if (error) console.error("Error en resultados_examenes:", error.message);
}

async function ejecutarDescuentoIntento() {
    try {
        const email = localStorage.getItem('session_email');
        const token = localStorage.getItem('token_hex_hijo');
        
        const { data, error } = await _supabase.from('usuarios_membresias')
            .select('intentos_simulacro_restantes')
            .eq('email', email)
            .eq('token_hex', token)
            .maybeSingle(); 

        if (data && data.intentos_simulacro_restantes > 0) {
            await _supabase.from('usuarios_membresias')
                .update({ intentos_simulacro_restantes: data.intentos_simulacro_restantes - 1 })
                .eq('email', email)
                .eq('token_hex', token);
        }
    } catch (e) { console.error("Error silencioso en descuento:", e); }
}

async function guardarAnalisisVigilancia(detalles_analisis) {
    const { error } = await _supabase.from('analisis_vigilancia_ia').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        tipo_sensor: "Audio/Video Local",
        analisis_ia: detalles_analisis.veredicto, 
        nivel_riesgo: detalles_analisis.riesgo,   
        timestamp: new Date().toISOString()
    });
    if (error) console.error("Error en analisis_vigilancia_ia:", error.message);
}

async function guardarProgresoIA(puntaje) {
    let prob = "Baja";
    if (puntaje >= 50 && puntaje < 80) prob = "Media";
    if (puntaje >= 80) prob = "Alta";

    const { error } = await _supabase.from('analisis_progreso_ia').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        materia: localStorage.getItem('plan_nombre_completo'), 
        puntaje_obtenido: Math.round(puntaje),
        probabilidad_ingreso: prob,
        fecha_analisis: new Date().toISOString()
    });
    if (error) console.error("Error en analisis_progreso_ia:", error.message);
}

// ---> FASE 1: MAGIA DEL REPASO <---
// Función para extraer los peores errores del alumno directo de la bitácora
async function obtenerReactivosRepaso(limite) {
    const email = localStorage.getItem('session_email');
    
    // Buscamos los últimos IDs fallados
    const { data: bitacora, error: errBit } = await _supabase.from('bitacora_reactivos_vistos')
        .select('reactivo_id')
        .eq('email', email)
        .eq('es_correcto', false)
        .order('created_at', { ascending: false })
        .limit(limite);
        
    if (errBit || !bitacora || bitacora.length === 0) return [];
    
    const idsFallados = bitacora.map(b => b.reactivo_id);
    
    // Descargamos los reactivos completos usando esos IDs (UUIDs)
    const { data: reactivosMalos, error: errReact } = await _supabase.from('reactivos')
        .select('*')
        .in('id', idsFallados);
        
    if (errReact) console.error("Error extrayendo repaso:", errReact.message);
    return reactivosMalos || [];
}
