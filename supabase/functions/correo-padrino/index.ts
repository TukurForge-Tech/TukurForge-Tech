import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) throw new Error("No se encontró la API Key de Resend")

    // 🔥 Recibimos las nuevas variables estadísticas
    const { 
        correo_padrino, 
        codigo_usado, 
        correo_enmascarado, 
        examen_aplicado, 
        tipo_institucion, 
        tomo_curso, 
        objetivo, 
        usos_actuales, 
        limite_usos 
    } = await req.json()

    const htmlCorreo = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #050a14; padding: 20px; text-align: center;">
          <h2 style="color: #06b6d4; margin: 0; font-style: italic;">🌟 ¡Beca Asignada con Éxito!</h2>
          <p style="color: #fff; margin: 5px 0 0 0;">Programa de Patrocinio SimuTukur</p>
        </div>
        
        <div style="padding: 20px; background-color: #f9fafb;">
          <p><strong>Estimado Patrocinador,</strong></p>
          <p>Le informamos que un nuevo estudiante acaba de utilizar su código de beca (<strong>${codigo_usado}</strong>). Protegiendo la identidad del menor, le compartimos el perfil estadístico del beneficiario:</p>
          
          <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; font-size: 14px; line-height: 1.6;">
            <p style="margin: 0 0 8px 0;">📧 <strong>Usuario:</strong> ${correo_enmascarado}</p>
            <p style="margin: 0 0 8px 0;">📝 <strong>Examen a Presentar:</strong> ${examen_aplicado}</p>
            <p style="margin: 0 0 8px 0;">🏫 <strong>Origen Educativo:</strong> Escuela ${tipo_institucion}</p>
            <p style="margin: 0 0 8px 0;">📚 <strong>Preparación Previa:</strong> ${tomo_curso}</p>
            <p style="margin: 0;">🎯 <strong>Objetivo del Estudiante:</strong><br> <em>"${objetivo}"</em></p>
          </div>

          <p style="text-align: center; font-size: 14px; color: #64748b; background-color: #e2e8f0; padding: 10px; border-radius: 5px;">
            Estadísticas de su Código:<br>
            <strong>${usos_actuales}</strong> becas entregadas de un total de <strong>${limite_usos}</strong> disponibles.
          </p>

          <p>Gracias a su apoyo, estamos brindando herramientas tecnológicas de primer nivel para el futuro de la educación.</p>
        </div>
        
        <div style="background-color: #1e293b; padding: 15px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p style="margin: 0;">TukurForge Tech | Reporte de Auditoría y Transparencia</p>
        </div>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'SimuTukur <inscripciones@tukurforge.com>',
        to: [correo_padrino],
        subject: `✅ Nueva Beca Asignada: Usuario ${correo_enmascarado}`,
        html: htmlCorreo,
      }),
    })

    if (!res.ok) throw new Error(await res.text())

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error) {
    console.error("ERROR CORREO PADRINO:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})