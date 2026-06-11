import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, nombre, nueva_pass } = await req.json()
    const resendKey = Deno.env.get('RESEND_API_KEY')

    const html = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; background-color: #050a14; color: white; padding: 30px; border-radius: 10px; border: 1px solid #06b6d4;">
        <h2 style="color: #06b6d4;">Recuperación de Acceso</h2>
        <p>Hola ${nombre},</p>
        <p>Se ha solicitado un restablecimiento de contraseña para tu cuenta en SimuTukur.</p>
        <div style="background-color: #0f172a; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; color: #94a3b8; font-size: 14px;">Tu nueva contraseña temporal es:</p>
          <h1 style="color: #fff; letter-spacing: 2px; margin: 10px 0;">${nueva_pass}</h1>
        </div>
        <p style="color: #cbd5e1; font-size: 12px;">Por seguridad, te recomendamos iniciar sesión con esta contraseña y guardarla en un lugar seguro.</p>
        <a href="https://simutukur.tukurforge.com/login.html" style="display: inline-block; background-color: #06b6d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Iniciar Sesión</a>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SimuTukur Soporte <inscripciones@tukurforge.com>',
        to: [email],
        subject: '🔒 Tu nueva contraseña de SimuTukur',
        html: html
      })
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})