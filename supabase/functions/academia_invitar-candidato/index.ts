import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import bcrypt from "https://esm.sh/bcryptjs@2.4.3"

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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Configuración incompleta en el servidor")
    }

    // Recibimos los datos del frontend
    const { correo_personal, password_temporal, link_portal } = await req.json()

    // 1. Encriptamos la contraseña inmediatamente (Seguridad Total)
    const hashed = bcrypt.hashSync(password_temporal, 10);

    // 2. Insertamos en la BD usando la Service Role Key (El portero que todo lo ve)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { error: dbError } = await supabaseAdmin
      .from('credenciales_trabajadores')
      .insert([{ 
        correo: correo_personal, 
        password_hash: hashed, // Guardamos el HASH, nunca el texto plano
        estatus: 'Invitado' 
      }]);

    if (dbError) throw new Error("Error al guardar en base de datos: " + dbError.message);

    // 3. Preparamos los correos (Usamos el link_portal dinámico que nos mandaste)
    const htmlCorreo1 = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #050a14; padding: 20px; text-align: center;">
          <h2 style="color: #06b6d4; margin: 0; font-style: italic;">Bienvenido a TukurForge Tech</h2>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <p><strong>Estimado(a) candidato(a),</strong></p>
          <p>Es un placer invitarte a formar parte de nuestra fuerza comercial. Para continuar con tu proceso de alta y generación de contrato, es necesario que subas tu expediente digital.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${link_portal}" style="background-color: #06b6d4; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir al Portal de Expedientes</a>
          </p>
        </div>
      </div>
    `;

    const htmlCorreo2 = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #050a14; padding: 20px; text-align: center;">
          <h2 style="color: #06b6d4; margin: 0; font-style: italic;">Credenciales de Acceso</h2>
        </div>
        <div style="padding: 20px; background-color: #f9fafb;">
          <p><strong>Clave de seguridad generada:</strong></p>
          <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; text-align: center; font-size: 20px; letter-spacing: 2px;">
            <strong>${password_temporal}</strong>
          </div>
        </div>
      </div>
    `;

    // Disparamos correos
    const headersResend = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` };
    
    await Promise.all([
      fetch('https://api.resend.com/emails', { method: 'POST', headers: headersResend, body: JSON.stringify({ from: 'Talento TukurForge <talento@tukurforge.com>', to: [correo_personal], subject: 'Paso 1: Sube tu Expediente', html: htmlCorreo1 }) }),
      fetch('https://api.resend.com/emails', { method: 'POST', headers: headersResend, body: JSON.stringify({ from: 'Talento TukurForge <talento@tukurforge.com>', to: [correo_personal], subject: 'Paso 2: Tu Contraseña Temporal', html: htmlCorreo2 }) })
    ]);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})