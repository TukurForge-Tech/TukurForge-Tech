import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Importamos bcryptjs
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = { 
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { correo, password } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscamos al trabajador en la bóveda
    const { data: usuario, error } = await supabaseAdmin
      .from('credenciales_trabajadores')
      .select('*')
      .eq('correo', correo)
      .single();

    if (error || !usuario) {
      return new Response(JSON.stringify({ error: "Credenciales incorrectas" }), { status: 401, headers: corsHeaders });
    }

    // 2. Validación de Contraseña (Encriptada)
    const esValida = bcrypt.compareSync(password, usuario.password_hash);
    if (!esValida) {
      return new Response(JSON.stringify({ error: "Contraseña incorrecta" }), { status: 401, headers: corsHeaders });
    }

    // 3. LA LÓGICA DE ESTADOS (Portero Exclusivo)
    // Solo permitimos el acceso si es 'Invitado'. 
    // Bloqueamos explícitamente los otros estados para evitar duplicidad.
    
    if (usuario.estatus === 'Por Firmar') {
        return new Response(JSON.stringify({ error: "Tu expediente ya fue recibido y está en proceso de firma. No puedes volver a subir documentos." }), { status: 401, headers: corsHeaders });
    }
    
    if (usuario.estatus === 'Activo') {
        return new Response(JSON.stringify({ error: "Ya eres parte de la fuerza comercial. Tu expediente está cerrado." }), { status: 401, headers: corsHeaders });
    }

    if (usuario.estatus !== 'Invitado') {
        return new Response(JSON.stringify({ error: "Estatus de usuario no válido para acceso." }), { status: 401, headers: corsHeaders });
    }
    
    // Si llega aquí, es porque es 'Invitado' y todo está perfecto.
    return new Response(JSON.stringify({ id: usuario.id, mensaje: "Login exitoso" }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});