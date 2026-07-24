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
    // 1. Recibimos la orden de tu JS (El Director)
    const { 
        trabajador_id, 
        decision_general, // 'Aprobado', 'En Corrección', 'Rechazado_Definitivo'
        estatus_docs // Objeto JSON con los 14 campos granulares
    } = await req.json();

    // 2. Conectamos con la Llave Maestra (Service Role Key)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Guardamos la auditoría granular (14 campos) y el dictamen de revisión
    const { error: updateOnboardingError } = await supabaseAdmin
        .from('onboarding_trabajadores')
        .update({
            estatus_ine: estatus_docs.estatus_ine,
            motivo_ine: estatus_docs.motivo_ine,
            
            estatus_csf: estatus_docs.estatus_csf,
            motivo_csf: estatus_docs.motivo_csf,
            
            estatus_domicilio: estatus_docs.estatus_domicilio,
            motivo_domicilio: estatus_docs.motivo_domicilio,
            
            estatus_banco: estatus_docs.estatus_banco,
            motivo_banco: estatus_docs.motivo_banco,
            
            estatus_estudios: estatus_docs.estatus_estudios,
            motivo_estudios: estatus_docs.motivo_estudios,
            
            estatus_recomendacion_laboral: estatus_docs.estatus_recomendacion_laboral,
            motivo_recomendacion_laboral: estatus_docs.motivo_recomendacion_laboral,
            
            estatus_recomendacion_personal: estatus_docs.estatus_recomendacion_personal,
            motivo_recomendacion_personal: estatus_docs.motivo_recomendacion_personal,
            
            estatus_revision: decision_general 
        })
        .eq('trabajador_id', trabajador_id);

    if (updateOnboardingError) throw updateOnboardingError;

    // 4. Actualizamos el Estatus Maestro del trabajador
    let estatusMaestro = 'Por Firmar';
    if (decision_general === 'Rechazado_Definitivo') {
        estatusMaestro = 'Rechazado';
    }

    const { error: updateCredencialesError } = await supabaseAdmin
        .from('credenciales_trabajadores')
        .update({ estatus: estatusMaestro })
        .eq('id', trabajador_id);

    if (updateCredencialesError) throw updateCredencialesError;

    return new Response(JSON.stringify({ mensaje: 'Expediente dictaminado correctamente' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});