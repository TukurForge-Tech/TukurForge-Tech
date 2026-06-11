import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 🛡️ RECIBIMOS LA IDENTIDAD DEL ALUMNO JUNTO CON SU MENSAJE
    const { email, token_hex, contents, generationConfig } = await req.json();

    // --- 🛡️ INICIO DE BÓVEDA DE TOKENS ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Revisamos su saldo real en la nueva columna energia_ia
    const { data: usuario } = await supabaseAdmin
      .from('usuarios_membresias')
      .select('id, energia_ia')
      .eq('email', email)
      .eq('token_hex', token_hex)
      .single();

    if (!usuario || usuario.energia_ia <= 0) {
      return new Response(JSON.stringify({ error: 'Energía IA agotada.' }), { status: 403, headers: corsHeaders });
    }

    // Descontamos 1 token de la BD y guardamos el nuevo saldo
    const nuevoSaldo = usuario.energia_ia - 1;
    await supabaseAdmin
      .from('usuarios_membresias')
      .update({ energia_ia: nuevoSaldo })
      .eq('id', usuario.id);
    // --- 🛡️ FIN DE BÓVEDA DE TOKENS ---

    // LLAMAMOS A GEMINI NORMALMENTE
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error("Llave de IA no encontrada.");

    //const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`;

    // 🧠 AQUÍ INYECTAMOS TU FRAGMENTO DE PERSONALIDAD Y REGLAS ESTRICTAS
    // --- INICIO DE IA CON ESCUDO ANTI-CAÍDAS ---
    let geminiResponse;
    let geminiData;
    let intentos = 3;

    // Ciclo de protección: Si Google dice 503, reintenta en automático sin que el usuario lo note
    for (let i = 0; i < intentos; i++) {
        
        // 🔥 IMPORTANTE: Asegúrate de que la URL apunte a "gemini-1.5-flash"
        geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{
                      text: `Eres 'Simu', el Tutor IA exclusivo de la plataforma SimuTukur. ESTRICTAMENTE PROHIBIDO responder cosas que no sean temas de estudio para exámenes de admisión. NO INVENTES DATOS NI MATERIAS. Aquí tienes la estructura EXACTA de cada examen (materia y cantidad de preguntas) tal como existen en nuestra base de datos:
                      
                      - ECOEMS (128 preguntas): Física (12), Español (12), Historia (12), Química (12), Biología (12), Geografía (12), Matemáticas (12), Cívica y Ética (12), Habilidad Verbal (16), Habilidad Matemática (16). ¡CERO INGLÉS!
                      - UNAM A1 (120 preguntas): Física (16), Español (13), Química (10), Biología (10), Geografía (10), Literatura (10), Matemáticas (26), Historia Universal (10), Historia de México (10), Comprensión de Lectura (5). ¡CERO INGLÉS!
                      - UNAM A2 (120 preguntas): Física (12), Español (13), Química (13), Biología (13), Geografía (10), Literatura (10), Matemáticas (24), Historia Universal (10), Historia de México (10), Comprensión de Lectura (5). ¡CERO INGLÉS!
                      - UNAM A3 (120 preguntas): Física (10), Español (13), Química (10), Biología (10), Geografía (10), Literatura (10), Matemáticas (24), Historia Universal (14), Historia de México (14), Comprensión de Lectura (5). ¡CERO INGLÉS!
                      - UNAM A4 (120 preguntas): Física (10), Español (13), Química (10), Biología (10), Filosofía (10), Geografía (10), Literatura (10), Matemáticas (22), Historia Universal (10), Historia de México (10), Comprensión de Lectura (5). ¡CERO INGLÉS!
                      - IPN IyCFM (140 preguntas): Física (17), Historia (10), Química (17), Biología (9), Matemáticas (37), Competencia Escrita (20), Competencia Lectora (20), Reading Comprehension (10).
                      - IPN CMB (140 preguntas): Física (13), Historia (10), Química (17), Biología (17), Matemáticas (33), Competencia Escrita (20), Competencia Lectora (20), Reading Comprehension (10).
                      - IPN CSyA (140 preguntas): Física (10), Historia (20), Química (10), Biología (10), Matemáticas (35), Competencia Escrita (25), Competencia Lectora (20), Reading Comprehension (10).

                      REGLAS INQUEBRANTABLES:
                      1. El examen de ingreso a la UNAM y ECOEMS NO incluye Inglés en absoluto.
                      2. EL ÚNICO examen que SÍ evalúa Inglés (Reading Comprehension) es el del IPN.
                      Si el alumno te pregunta por una materia que no está en la lista de su área, dile tajantemente que esa materia NO viene en su examen. Si te preguntan de cosas no académicas (recetas, chistes, programación, etc.), responde ÚNICAMENTE: 'Lo siento, como tutor de SimuTukur solo puedo ayudarte con temas de tu examen de admisión'.`
                    }]
                },
                contents, 
                generationConfig 
            })
        });

        geminiData = await geminiResponse.json();

        // Evalúa si Google tuvo su "pestañeo" (Error 503)
        if (geminiData.error && geminiData.error.code === 503) {
            console.warn(`[Saturación Google] Intento ${i + 1} de ${intentos} fallido. Reintentando en 1.5s...`);
            // Si falla y no es el último intento, hacemos una pausa mágica de 1.5 segundos
            if (i < intentos - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        } else {
            // Si contestó bien (o es un error distinto), sale del ciclo y continúa
            break; 
        }
    }

    // 🕵️‍♂️ LOG de diagnóstico
    console.log("=== RESPUESTA CRUDA DE GOOGLE GEMINI ===");
    console.log(JSON.stringify(geminiData, null, 2));
    
    // Validamos que Gemini haya respondido correctamente al final de los intentos
    if (!geminiData || !geminiData.candidates || geminiData.candidates.length === 0) {
       console.error("Error detallado de la IA:", geminiData);
       throw new Error(`La IA rechazó la petición tras ${intentos} intentos. Revisa los logs de Supabase.`);
    }
    // --- FIN DE IA CON ESCUDO ANTI-CAÍDAS ---
    
    const respuestaFinal = geminiData.candidates[0].content.parts[0].text;

    // 🛡️ DEVOLVEMOS LA RESPUESTA LIMPIA Y EL NUEVO SALDO OFICIAL
    return new Response(JSON.stringify({ 
        respuesta: respuestaFinal,
        saldo_restante: nuevoSaldo 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error en el Chat Libre IA:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});