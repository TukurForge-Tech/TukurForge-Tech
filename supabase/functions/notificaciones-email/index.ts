import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Respuesta rápida para el CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { alumno_nombre, alumno_email, password, metodo_pago, referencia } = await req.json()
    const resendKey = Deno.env.get('RESEND_API_KEY')

    if (!resendKey) throw new Error("Falta la llave de Resend en la bóveda.")

    // 1. CORREO DE BIENVENIDA PARA EL ALUMNO
    const htmlAlumno = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; background-color: #050a14; color: white; padding: 30px; border-radius: 10px; border: 1px solid #06b6d4;">
        <h1 style="color: #06b6d4; font-style: italic;">¡Bienvenido a SimuTukur, ${alumno_nombre}!</h1>
        <p style="color: #cbd5e1;">Tu entrenamiento profesional con Inteligencia Artificial ha comenzado.</p>
        <div style="background-color: #0f172a; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #94a3b8;"><strong>Tu Usuario:</strong> ${alumno_email}</p>
          <p style="margin: 5px 0 0 0; color: #94a3b8;"><strong>Tu Contraseña:</strong> ${password}</p>
        </div>
        <p style="color: #cbd5e1;">${metodo_pago === 'TRANSFERENCIA' ? '<em>Nota: Por cortesía ya tienes acceso, nuestro equipo validará tu transferencia en breve.</em>' : 'Tu pago por Stripe ha sido procesado con éxito.'}</p>
        <a href="https://simutukur.tukurforge.com/login.html" style="display: inline-block; background-color: #06b6d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px;">Iniciar Sesión Ahora</a>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SimuTukur <inscripciones@tukurforge.com>', // <-- Tu dominio oficial
        to: [alumno_email],
        subject: '¡Tu entrenamiento comienza hoy! 🚀',
        html: htmlAlumno
      })
    });

    // 2. CORREO DE ALERTA PARA TI (SOLO SI ES TRANSFERENCIA)
    if (metodo_pago === 'TRANSFERENCIA') {
      const htmlAdmin = `
        <div style="font-family: sans-serif; padding: 20px; background: #fff1f2; border-left: 5px solid #e11d48;">
          <h2 style="color: #e11d48; margin-top:0;">🚨 Nueva Transferencia Pendiente</h2>
          <p><strong>Alumno:</strong> ${alumno_nombre}</p>
          <p><strong>Correo:</strong> ${alumno_email}</p>
          <p><strong>Referencia:</strong> ${referencia}</p>
          <p>Por favor, revisa tu cuenta bancaria y el panel de Supabase para confirmar el acceso.</p>
        </div>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Sistema SimuTukur <inscripciones@tukurforge.com>', // <-- Tu dominio oficial
          to: ['homar.rodriguez@hlevare.com'], // <-- Tu correo administrativo
          subject: `💰 Validar Pago: ${referencia}`,
          html: htmlAdmin
        })
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})