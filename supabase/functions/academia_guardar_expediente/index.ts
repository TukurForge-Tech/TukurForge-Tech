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
    // 1. Recibimos la identidad (con los 4 nombres nuevos) y los links de los documentos
    const { 
        trabajador_id, nombre, segundos_nombres, primer_apellido, segundo_apellido, 
        direccion, rfc, clabe, banco_nombre, regimen_contratacion, urls, aviso_privacidad 
    } = await req.json();

    // Candado legal de privacidad
    if (aviso_privacidad !== true) {
        return new Response(JSON.stringify({ error: 'Es obligatorio aceptar el aviso de privacidad' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // Bóveda
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. ACTUALIZAMOS la tabla credenciales_trabajadores con los nombres separados Y el nuevo estatus
    const { error: updateError } = await supabaseAdmin
        .from('credenciales_trabajadores')
        .update({
            nombre: nombre,
            segundos_nombres: segundos_nombres,
            primer_apellido: primer_apellido,
            segundo_apellido: segundo_apellido,
            estatus: 'Por Validar' 
        })
        .eq('id', trabajador_id);

    if (updateError) throw updateError;

    // 3. Armamos el nombre completo limpio por si la tabla onboarding_trabajadores aún lo requiere
    const nombreUnido = `${nombre} ${segundos_nombres ? segundos_nombres + ' ' : ''}${primer_apellido} ${segundo_apellido}`.trim().replace(/\s+/g, ' ');

    // 4. Insertar en la Tabla 2 (onboarding_trabajadores)
    const { error: insertError } = await supabaseAdmin
        .from('onboarding_trabajadores')
        .insert([{
            trabajador_id,
            nombre_completo: nombreUnido,
            direccion,
            rfc,
            clabe,
            banco_nombre,
            regimen_contratacion,
            ine_url: urls.ine_url,
            csf_url: urls.csf_url,
            domicilio_url: urls.domicilio_url,
            banco_url: urls.banco_url,
            estudios_url: urls.estudios_url,
            recomendacion_laboral_url: urls.recomendacion_laboral_url,
            recomendacion_personal_url: urls.recomendacion_personal_url,
            aviso_privacidad
        }]);

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ mensaje: 'Expediente y nombres guardados correctamente' }), {
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