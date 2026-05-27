// simu-telemetria.js - Mapeo Milimétrico a Supabase

async function registrarPasoPorReactivo(reactivoId, esCorrecto, nivel) {
    // 🛑 APAGADO ESTRATÉGICO: 
    // Ya no guardamos pregunta por pregunta desde el navegador. 
    // Ahora la API validar-respuesta hará el guardado masivo al finalizar el examen.
    return; 
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
    // 1. Detectamos si es un examen normal o un castigo
    let nombrePrueba = localStorage.getItem('plan_nombre_completo');
    if (localStorage.getItem('simu_nivel') === "Repaso") {
        nombrePrueba = "RETO DE REPASO"; 
    }

    // 2. Lo guardamos en la base de datos con su etiqueta correcta
    const { error } = await _supabase.from('resultados_examenes').insert({
        email: localStorage.getItem('session_email'),
        token_hex: localStorage.getItem('token_hex_hijo'),
        nombre_alumno: localStorage.getItem('nombre_alumno'),
        tipo_prueba: nombrePrueba, 
        puntaje_obtenido: Math.round(puntajeFinal), 
        nivel_examen: parseInt(nivelFinal), 
        detalles_fallas: detallesFallasJSON, // Aquí va el JSON de fallas
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
async function obtenerReactivosRepaso(limite = 10) {
    const email = localStorage.getItem('session_email');
    const inst = localStorage.getItem('plan_institucion');
    const area = localStorage.getItem('plan_area');
    
    // Armamos el filtro para buscar preguntas solo del tipo de examen del alumno
    let filtroTipos = [];
    if (inst && inst.includes('ECOEMS')) filtroTipos = ['ECOEMS'];
    else if (inst && inst.includes('UNAM')) filtroTipos = ['UNAM_GENERAL', area];
    else filtroTipos = [inst];

    // 1. Obtener la bitácora histórica (últimos 150 reactivos vistos)
    const { data: bitacora } = await _supabase.from('bitacora_reactivos_vistos')
        .select('reactivo_id, es_correcto')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(150);

    if (!bitacora || bitacora.length === 0) return []; 

    // 2. LA CUARENTENA: Bloquear los últimos 30 vistos (aprox 3 repasos de 10)
    const recientesIds = bitacora.slice(0, 30).map(b => b.reactivo_id);
    const historicoTotalIds = bitacora.map(b => b.reactivo_id); 

    // 3. CAZADOR DE FALLAS: Buscar hasta 3 fallas que NO estén en la cuarentena
    const fallasViejas = bitacora.filter(b => b.es_correcto === false && !recientesIds.includes(b.reactivo_id));
    const idsFallasAntiguas = [...new Set(fallasViejas.map(f => f.reactivo_id))].slice(0, 3);

    // 4. Descubrir las materias débiles leyendo su último examen
    let materiasDebiles = [];
    const token = localStorage.getItem('token_hex_hijo') || localStorage.getItem('token_hex');
    const { data: ultExamenes } = await _supabase.from('resultados_examenes')
        .select('detalles_fallas')
        .eq('token_hex', token)
        .order('fecha_aplicacion', { ascending: false })
        .limit(3);

    if (ultExamenes) {
        for (let ex of ultExamenes) {
            // Buscamos el examen más reciente que sí tenga fallas registradas
            if (ex.detalles_fallas && ex.detalles_fallas.fallas_academicas && ex.detalles_fallas.fallas_academicas.length > 0) {
                materiasDebiles = [...new Set(ex.detalles_fallas.fallas_academicas.map(f => f.materia))];
                break; 
            }
        }
    }

    let reactivosFinales = [];

    // 5. Inyectar las 3 preguntas reprobadas antiguas (si existen y ya pasaron la cuarentena)
    if (idsFallasAntiguas.length > 0) {
        const { data: pregsViejas } = await _supabase.from('reactivos')
            .select('*').in('id', idsFallasAntiguas);
        if (pregsViejas) reactivosFinales.push(...pregsViejas);
    }

    // 6. Rellenar el resto (7 o 10) con preguntas TOTALMENTE NUEVAS de sus materias débiles
    let faltantes = limite - reactivosFinales.length;
    
    if (faltantes > 0 && materiasDebiles.length > 0) {
        const { data: pregsNuevas } = await _supabase.from('reactivos')
            .select('*')
            .in('tipo_examen', filtroTipos)
            .in('materia', materiasDebiles);

        if (pregsNuevas && pregsNuevas.length > 0) {
            // Filtro estricto: Buscar preguntas que NUNCA haya visto en su historia
            let puramenteNuevas = pregsNuevas.filter(p => !historicoTotalIds.includes(p.id));
            
            // Si ya consumió toda la base de datos inédita, le damos preguntas que no haya visto "recientemente"
            if (puramenteNuevas.length < faltantes) {
                puramenteNuevas = pregsNuevas.filter(p => !recientesIds.includes(p.id));
            }

            puramenteNuevas = puramenteNuevas.sort(() => Math.random() - 0.5).slice(0, faltantes);
            reactivosFinales.push(...puramenteNuevas);
        }
    }

    // 7. Seguro contra pantallas en blanco: Si por alguna razón la BD es chiquita y no llegamos a 10, rellenamos
    faltantes = limite - reactivosFinales.length;
    if (faltantes > 0) {
        const { data: relleno } = await _supabase.from('reactivos')
            .select('*').in('tipo_examen', filtroTipos).limit(50);
        if (relleno) {
            let rellenoLimpio = relleno.filter(r => !reactivosFinales.some(rf => rf.id === r.id)).sort(() => Math.random() - 0.5).slice(0, faltantes);
            reactivosFinales.push(...rellenoLimpio);
        }
    }

    return reactivosFinales;
}
