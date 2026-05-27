import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, token_hex, nombre_alumno, tipo_examen, cant_q, nivel_label, inst, area } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: membresia } = await supabaseAdmin.from('usuarios_membresias')
      .select('id').eq('email', email).eq('token_hex', token_hex).eq('nombre_alumno', nombre_alumno).single()

    if (!membresia) return new Response(JSON.stringify({ error: 'Acceso denegado.' }), { status: 403, headers: corsHeaders })

    let reactivosFinales: any[] = [];
    const institucionRegla = inst.includes('ECOEMS') ? 'ECOEMS' : ((inst.includes('UNAM') || inst.includes('IPN')) ? `${inst} ${area}` : inst);

    // 1. EL NIVEL SE TRADUCE A COMPLEJIDAD EN LA BD (1, 2, 3)
    const complejidadID = (nivel_label === "Principiante") ? 1 : (nivel_label === "Medio") ? 2 : 3;

    if (tipo_examen === 'Repaso') {
        const { data: ultimoFallo } = await supabaseAdmin.from('resultados_examenes')
            .select('detalles_fallas, nivel_examen').eq('email', email).eq('token_hex', token_hex).eq('nombre_alumno', nombre_alumno)
            .lte('puntaje_obtenido', 70).order('fecha_aplicacion', { ascending: false }).limit(1).single();

        if (ultimoFallo?.detalles_fallas?.fallas_academicas) {
            const materiasDebiles = [...new Set(ultimoFallo.detalles_fallas.fallas_academicas.map((f: any) => f.materia))];
            const complejidadRepaso = ultimoFallo.nivel_examen; 

            const { data: poolRepaso } = await supabaseAdmin.from('reactivos')
                .select('*')
                .eq('institucion', inst)
                .eq('complejidad', complejidadRepaso)
                .in('materia', materiasDebiles);

            reactivosFinales = (poolRepaso || []).sort(() => Math.random() - 0.5).slice(0, 10);
        }
    } else {
        const { data: regla } = await supabaseAdmin.from('reglas_simulador')
            .select('distribucion_materias').eq('institucion', institucionRegla).eq('nivel', nivel_label).single();

        if (!regla) return new Response(JSON.stringify({ error: 'No hay regla' }), { status: 400, headers: corsHeaders })
        const distribucion = regla.distribucion_materias;

        for (const mat of Object.keys(distribucion)) {
            const { data: reactivos } = await supabaseAdmin.from('reactivos')
                .select('*').eq('institucion', inst).eq('materia', mat)
                .eq('complejidad', complejidadID); 

            if (reactivos) {
                const filtrados = reactivos.filter((r: any) => {
                    const t = Array.isArray(r.tipo_examen) ? r.tipo_examen.join(",") : (r.tipo_examen || "");
                    return t.toUpperCase().includes(institucionRegla.toUpperCase()) || t.toUpperCase().includes("GENERAL");
                });

                let seleccionados: any[] = [];
                // 2. AQUÍ ESTÁ EL ARREGLO DE INGLÉS QUE PREGUNTABAS
                const esLectura = ['Habilidad Verbal', 'Comprensión de Lectura', 'Reading Comprehension', 'Competencia Lectora'].includes(mat);

                if (esLectura) {
                    let grupos: any = {};
                    let sueltas: any[] = [];

                    filtrados.forEach((r: any) => {
                        let llave = r.id_grupo_lectura ? "grupo_" + r.id_grupo_lectura : (r.texto_lectura?.trim() ? "txt_" + r.texto_lectura.trim().substring(0,30) : "");
                        if (llave) {
                            if(!grupos[llave]) grupos[llave] = [];
                            grupos[llave].push(r);
                        } else sueltas.push(r);
                    });

                    let llaves = Object.keys(grupos).sort(() => Math.random() - 0.5);
                    for (let llave of llaves) {
                        let bloque = grupos[llave].sort((a:any, b:any) => a.id - b.id);
                        if (seleccionados.length === 0 || seleccionados.length + bloque.length <= distribucion[mat] + 1) {
                            seleccionados.push(...bloque);
                        }
                        if (seleccionados.length >= distribucion[mat]) break;
                    }
                    sueltas = sueltas.sort(() => Math.random() - 0.5);
                    while (seleccionados.length < distribucion[mat] && sueltas.length > 0) seleccionados.push(sueltas.pop());
                } else {
                    seleccionados = filtrados.sort(() => Math.random() - 0.5).slice(0, distribucion[mat]);
                }

                reactivosFinales.push(...seleccionados);
            }
        }
    }

    if (reactivosFinales.length > cant_q) reactivosFinales = reactivosFinales.slice(0, cant_q);

    // 🕵️‍♂️ EL CHISMOSO DE MANDO (SOLO VISIBLE EN LOS LOGS DE SUPABASE)
    console.log(`🚀 REPORTE SEGURO DE EXAMEN PARA: ${email}`);
    console.log(`📊 Nivel: ${nivel_label} | Institución: ${institucionRegla} | Total: ${reactivosFinales.length} preguntas`);
    
    const reporteSeguro = reactivosFinales.map(r => ({
        ID: r.id,
        // 👈 ¡CORRECCIÓN! Leemos de tipo_examen. Si es un arreglo, lo unimos con comas.
        Origen: Array.isArray(r.tipo_examen) ? r.tipo_examen.join(', ') : (r.tipo_examen || 'N/A'), 
        Materia: r.materia,
        Complejidad: r.complejidad || 'N/A',
        Bloque: r.id_grupo_lectura ? `ID Grupo: ${r.id_grupo_lectura}` : (r.texto_lectura ? 'Texto Integrado' : 'Pregunta Suelta'),
        Respuesta_Correcta: r.respuesta_correcta
    }));
    
    console.table(reporteSeguro);

    // 🛡️ Borramos la respuesta antes de mandar al navegador
    const reactivosLimpios = reactivosFinales.map(r => { const { respuesta_correcta, ...resto } = r; return resto; });

    return new Response(JSON.stringify({ 
        success: true, 
        reactivos: reactivosLimpios
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }})

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})