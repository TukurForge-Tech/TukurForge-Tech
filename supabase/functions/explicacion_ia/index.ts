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
    // 🛡️ AHORA RECIBIMOS LA IDENTIDAD DEL ALUMNO
    const { email, token_hex, pregunta, correcta, institucion, area } = await req.json();
    
    // --- 🛡️ INICIO DE BÓVEDA DE TOKENS ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscamos cuánto dinero/energía tiene realmente en la NUEVA COLUMNA
    const { data: usuario } = await supabaseAdmin
      .from('usuarios_membresias')
      .select('id, energia_ia') 
      .eq('email', email)
      .eq('token_hex', token_hex)
      .single();

    if (!usuario || usuario.energia_ia <= 0) {
      return new Response(JSON.stringify({ error: 'Energía IA agotada.' }), { status: 403, headers: corsHeaders });
    }

    // Descontamos 1 token en la BD de forma silenciosa e inquebrantable
    const nuevoSaldo = usuario.energia_ia - 1;
    await supabaseAdmin
      .from('usuarios_membresias')
      .update({ energia_ia: nuevoSaldo })
      .eq('id', usuario.id);
    // --- 🛡️ FIN DE BÓVEDA DE TOKENS ---

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error("Llave de IA no encontrada.");

    // LÓGICA UNIVERSAL E INDEPENDIENTE
    let nombreExamen = 'nuestra plataforma';
    if (institucion && area) {
        nombreExamen = `${institucion} Área ${area}`;
    } else if (institucion) {
        nombreExamen = `${institucion}`;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`;
    
    // 🧠 EL CEREBRO DE LA IA PARA EXPLICACIONES DE ERRORES
    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

            REGLAS DE FORMATO ESTRICTAS PARA EXPLICACIONES:
            - NO uses Markdown. Está estrictamente prohibido usar asteriscos para negritas o símbolos para títulos.
            - Usa EXCLUSIVAMENTE etiquetas HTML para darle estilo a tu texto. Usa <strong> para resaltar palabras o frases clave, <br><br> para separar párrafos, y <ul><li> para listas.
            - Mantén las fórmulas matemáticas exactamente en formato LaTeX usando signos de dólar ($ o $$).`
            }]
        },
        contents: [{
          parts: [{
            text: `El alumno se equivocó en la siguiente pregunta del simulacro para ${nombreExamen}: "${pregunta}". La respuesta correcta es: "${correcta}". Tu objetivo es explicarle al alumno paso a paso, de forma clara, amigable y muy completa, por qué esa es la respuesta correcta y cómo puede recordarlo en el futuro. Cierra tu explicación dándole un breve consejo o tip específico para su examen de ${nombreExamen}. Responde directamente con la explicación sin rodeos.`
          }]
        }],
        generationConfig: { temperature: 0.4 }
      })
    });

    const geminiData = await geminiResponse.json();
    
    // Validamos que Gemini haya respondido correctamente
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
       throw new Error("La IA no devolvió una respuesta válida.");
    }
    
    const respuestaFinal = geminiData.candidates[0].content.parts[0].text;

    // 🛡️ DEVOLVEMOS LA RESPUESTA Y EL NUEVO SALDO OFICIAL
    return new Response(JSON.stringify({ 
        respuesta: respuestaFinal,
        saldo_restante: nuevoSaldo 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error en el Tutor IA:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});