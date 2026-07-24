import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { trabajador_nombre, trabajador_email } = await req.json();

    // AQUÍ ESTÁ EL CAMBIO CLAVE: .com
    const from_email = "onboarding@tukurforge.com"; 

    // 1. CORREO PARA EL TRABAJADOR
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `TukurForge Tech <${from_email}>`, 
        to: trabajador_email,
        subject: "¡Expediente recibido con éxito!",
        html: `
          <h1>¡Hola, ${trabajador_nombre}!</h1>
          <p>Hemos recibido tu documentación correctamente.</p>
          <p>Nuestro equipo de administración ya la está revisando. Te notificaremos vía correo electrónico en cuanto tu contrato esté listo para firma.</p>
          <br>
          <p>Saludos,<br>Equipo de TukurForge Tech</p>
        `,
      }),
    });

    // 2. CORREO PARA EL ADMINISTRADOR (TÚ)
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Portal Onboarding <${from_email}>`,
        to: "homar.rodriguez@hlevare.com", // Tu correo para recibir las alertas
        subject: `🚨 NUEVO EXPEDIENTE: ${trabajador_nombre}`,
        html: `
          <h2>Nuevo expediente recibido</h2>
          <p>El trabajador <strong>${trabajador_nombre}</strong> (${trabajador_email}) acaba de subir sus documentos al portal.</p>
          <p>Por favor, ingresa al panel de Supabase (tabla <em>onboarding_trabajadores</em>) para auditar los archivos.</p>
        `,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});