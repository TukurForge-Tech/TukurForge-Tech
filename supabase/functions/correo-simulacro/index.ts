import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Manejo de CORS (Para que no te bloquee el navegador)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error("No se encontró la API Key de Resend")
    }

    // 2. Recibir los datos del Frontend
    const { tutor_nombre, alumno_nombre, correo_destino, examen_elegido, horario_elegido, link_meet } = await req.json()

    // 3. Limpiar el formato del horario para que se vea bonito
    const horarioFormateado = horario_elegido.replace('_', ' a las ').replace('AM', ' AM').replace('PM', ' PM')

    // 4. Construir el correo en HTML
    const htmlCorreo = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #050a14; padding: 20px; text-align: center;">
          <h2 style="color: #06b6d4; margin: 0; font-style: italic;">🚨 Accesos e Instrucciones</h2>
          <p style="color: #fff; margin: 5px 0 0 0;">Tu Simulacro en Vivo: ${examen_elegido}</p>
        </div>
        
        <div style="padding: 20px; background-color: #f9fafb;">
          <p><strong>Estimado(a) ${tutor_nombre} y aspirante ${alumno_nombre}:</strong></p>
          <p>Es un gusto saludarlos. Todo está listo para su Simulacro en Vivo este <strong>${horarioFormateado}</strong>.</p>
          
          <p>Para ingresar al examen, no necesitas contraseñas. Ingresa directamente con tu correo electrónico haciendo clic en el siguiente enlace <strong>10 minutos antes</strong> de la hora acordada:</p>
          
          <div style="background-color: #e0f2fe; border-left: 4px solid #0ea5e9; padding: 20px; margin: 20px 0; text-align: center;">
            <a href="https://simutukur.tukurforge.com/acceso_piloto.html" style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; margin-bottom: 15px; font-size: 16px;">Ir al Simulador</a>
            <br>
            <a href="https://simutukur.tukurforge.com" style="color: #0369a1; text-decoration: underline; font-size: 14px;">Conoce nuestra Página Principal</a>
          </div>

          <p>Para garantizar el éxito de esta prueba y simular las condiciones exactas del examen oficial, es indispensable que el alumno cumpla con los siguientes lineamientos:</p>

          <h3 style="color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px;">1. Requisitos Técnicos del Equipo</h3>
          <ul style="line-height: 1.6;">
            <li><strong>Dispositivo:</strong> Computadora de escritorio o laptop (NO celulares ni tablets).</li>
            <li><strong>Hardware:</strong> Cámara web y micrófono 100% funcionales y encendidos. <em>(Nota: NO está permitido el uso de audífonos)</em>.</li>
            <li><strong>Software:</strong> Google Chrome o Firefox. Cerrar WhatsApp Web, Discord, Spotify, etc.</li>
          </ul>

          <h3 style="color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px;">2. Condiciones del Entorno (Muy Importante)</h3>
          <ul style="line-height: 1.6;">
            <li><strong>Privacidad Absoluta:</strong> El aspirante debe estar solo. El sistema detecta rostros y voces adicionales (motivo de cancelación).</li>
            <li><strong>Iluminación:</strong> Evitar estar a contraluz. Fondo libre de distracciones.</li>
            <li><strong>Cero Ruido:</strong> Ambiente libre de televisión, música o pláticas.</li>
          </ul>

          <h3 style="color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 5px;">3. Preparación del Aspirante</h3>
          <ul style="line-height: 1.6;">
            <li><strong>Energía al 100%:</strong> Presentarse desayunado e hidratado. No se permite comer frente a la cámara ni levantarse.</li>
          </ul>

          <p style="text-align: center; font-size: 18px; font-weight: bold; margin-top: 30px; color: #0284c7;">
            ¡Nos vemos en línea para poner a prueba todo su potencial!
          </p>
        </div>
        
        <div style="background-color: #1e293b; padding: 15px; text-align: center; color: #94a3b8; font-size: 12px;">
          <p style="margin: 0;">El equipo de SimuTukur</p>
        </div>
      </div>
    `

    // 5. Enviar usando Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'SimuTukur <inscripciones@tukurforge.com>', // ⚠️ CAMBIA ESTO POR TU CORREO OFICIAL
        to: [correo_destino],
        subject: `🚨 Accesos e Instrucciones: Simulacro en Vivo ${examen_elegido}`,
        html: htmlCorreo,
      }),
    })

    if (!res.ok) {
      const errorData = await res.text()
      throw new Error(`Error en Resend: ${errorData}`)
    }

    return new Response(JSON.stringify({ success: true, message: "Correo enviado" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
        // 🔥 ESTA LÍNEA ES NUEVA: Imprime el error exacto en los logs de Supabase
        console.error("ERROR FATAL AL ENVIAR CORREO:", error.message)
        
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    })