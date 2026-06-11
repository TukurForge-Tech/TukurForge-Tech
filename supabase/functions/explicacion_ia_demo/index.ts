import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { pregunta, correcta, institucion, area } = await req.json();
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error("Llave no configurada.");

    let nombreExamen = (institucion && area) ? `${institucion} Área ${area}` : (institucion || 'nuestra plataforma');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`;
    
    const geminiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `Eres 'Simu', el Tutor IA exclusivo de SimuTukur. Explica de forma amigable y concisa por qué el alumno falló. REGLAS: Usa HTML (<strong>, <br>, <ul>). NO uses Markdown. Mantén fórmulas en LaTeX con $. No inventes materias. Sé directo.` }] },
        contents: [{ parts: [{ text: `El alumno falló en el demo para ${nombreExamen}: Pregunta: "${pregunta}". Correcta: "${correcta}". Explica por qué es correcta y dale un tip.` }] }],
        generationConfig: { temperature: 0.4 }
      })
    });

    const geminiData = await geminiResponse.json();
    const respuestaFinal = geminiData.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ respuesta: respuestaFinal }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});