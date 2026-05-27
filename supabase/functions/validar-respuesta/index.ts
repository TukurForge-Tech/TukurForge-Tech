import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, token_hex, nombre_alumno, nivel_label, respuestas_alumno } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Validar Membresía Segura
    const { data: membresia } = await supabaseAdmin.from('usuarios_membresias')
      .select('id').eq('email', email).eq('token_hex', token_hex).eq('nombre_alumno', nombre_alumno).single()

    if (!membresia) return new Response(JSON.stringify({ error: 'Acceso denegado.' }), { status: 403, headers: corsHeaders })

    // 2. Extraer las preguntas (Ignorando las que dejó en blanco/null)
    const respuestasValidas = (respuestas_alumno || []).filter((r: any) => r && r.id_pregunta);
    const idsPreguntas = respuestasValidas.map((r: any) => r.id_pregunta);

    // 3. Traer las respuestas correctas maestras de la BD
    const { data: reactivosBD } = await supabaseAdmin.from('reactivos')
        .select('id, materia, tema_guia, pregunta, respuesta_correcta')
        .in('id', idsPreguntas);

    let aciertos = 0;
    let fallas_academicas: any[] = [];
    let bitacoraInsert: any[] = [];

    const nivelID = (nivel_label === "Principiante") ? 1 : (nivel_label === "Medio") ? 2 : 3;

    // 4. Calificadora Automática
    respuestasValidas.forEach((resAlumno: any) => {
        const reactivoBD = reactivosBD?.find(r => r.id === resAlumno.id_pregunta);
        if (reactivoBD) {
            const correctaBD = (reactivoBD.respuesta_correcta || "").trim().toLowerCase();
            const seleccionUser = (resAlumno.seleccion || "").trim().toLowerCase();
            const esCorrecto = (correctaBD === seleccionUser);

            if (esCorrecto) {
                aciertos++;
            } else {
                fallas_academicas.push({
                    materia: reactivoBD.materia,
                    tema: reactivoBD.tema_guia || "General",
                    pregunta_id: reactivoBD.id,
                    pregunta: reactivoBD.pregunta,
                    correcta: reactivoBD.respuesta_correcta
                });
            }

            // Preparar guardado masivo para la columna nueva
            bitacoraInsert.push({
                email: email,
                nombre_alumno: nombre_alumno,
                reactivo_id: reactivoBD.id,
                nivel: nivelID,
                es_correcto: esCorrecto,
                opcion_seleccionada: seleccionUser
            });
        }
    });

    // 5. Guardado masivo en la bitácora
    if (bitacoraInsert.length > 0) {
        await supabaseAdmin.from('bitacora_reactivos_vistos').insert(bitacoraInsert);
    }

    return new Response(JSON.stringify({
        success: true,
        aciertos: aciertos,
        fallas_academicas: fallas_academicas
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})