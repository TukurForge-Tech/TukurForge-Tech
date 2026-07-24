import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Configuración incompleta en el servidor")
    }

    const { accion, payload } = await req.json()
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    let data = null
    let error = null

    switch (accion) {
      case 'obtener_perfil':
        ({ data, error } = await supabaseAdmin
          .from('credenciales_trabajadores')
          .select('nombre, primer_apellido, rol')
          .eq('correo', payload.correo)
          .single())
        break;

      case 'listar_invitaciones':
        ({ data, error } = await supabaseAdmin
          .from('credenciales_trabajadores')
          .select('*')
          .eq('estatus', 'Invitado'))
        break;

      case 'borrar_invitacion':
        ({ error } = await supabaseAdmin
          .from('credenciales_trabajadores')
          .delete()
          .eq('id', payload.id))
        break;

      case 'listar_expedientes':
        ({ data, error } = await supabaseAdmin
          .from('credenciales_trabajadores')
          .select('*, onboarding_trabajadores(*)')
          .eq('estatus', 'Por Validar'))
        break;

      case 'listar_activaciones':
        ({ data, error } = await supabaseAdmin
          .from('credenciales_trabajadores')
          .select('*')
          .eq('estatus', 'Por Firmar'))
        break;

      default:
        throw new Error("Acción no válida")
    }

    if (error) throw new Error(error.message)

    return new Response(JSON.stringify({ success: true, data }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    })
  }
})