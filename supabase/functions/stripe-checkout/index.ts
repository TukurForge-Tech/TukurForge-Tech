import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "npm:stripe@14.14.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

// ==========================================
// 1. DICCIONARIO DE EXÁMENES
// Ya está listo para el futuro. Si la página pide UNAM, cobrará UNAM.
// ==========================================
const PRECIOS_EXAMENES: Record<string, string> = {
  'ECOEMS': 'price_1TJjgDFx36mVfqKOsIiLBRdh',
  'UNAM': 'price_1TJjteFx36mVfqKOWpQAVtmB',
  'IPN': 'price_1TJjwNFx36mVfqKOMvJhM04U',
  'UAM': 'price_1TJjyKFx36mVfqKOJpVuHSkt',
  'SIMULACRO_VIVO': 'price_1TUGH9Fx36mVfqKOxqlDs1rt'
};

// ==========================================
// 2. DICCIONARIO DE ENERGÍA (Para cuando crees los productos)
// ==========================================
const PRECIOS_RECARGAS: Record<string, string> = {
  '100': 'price_1TK2XaFx36mVfqKOQpVJCLBx',
  '250': 'price_1TK2rBFx36mVfqKOwwuP1fN1',
  '600': 'price_1TK2sZFx36mVfqKOrvFfsqPE'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }

  try {
    const secret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secret) throw new Error("Falta la llave de Stripe.");

    // LEEMOS EL PAQUETE UNA SOLA VEZ
    const reqData = await req.json();
    
    // EXTRAEMOS TODO DE reqData

    const { 
        tipo_examen, correo, nombre_alumno, referencia_pago, es_recarga, tokens,
        tutor, telefono, dia_elegido, toma_curso, institucion_curso, nombre_escuela, objetivo 
    } = reqData;

    // RUTAS DE RETORNO
    let successUrl = `${req.headers.get('origin')}/registro.html?pago=exito&ref=${referencia_pago}`;
    let cancelUrl = `${req.headers.get('origin')}/registro.html`;

    if (es_recarga) {
        successUrl = `${req.headers.get('origin')}/dashboard.html?pago=exito&items=${tokens}`;
        cancelUrl = `${req.headers.get('origin')}/dashboard.html`;
    } else if (tipo_examen === 'SIMULACRO_VIVO') {
        // NUEVA RUTA EXCLUSIVA PARA LOS DE 58 PESOS
        successUrl = `${req.headers.get('origin')}/simulacro.html?pago_simulacro=exito&ref=${referencia_pago}`;
        cancelUrl = `${req.headers.get('origin')}/simulacro.html`;
    }

    // LÓGICA DE COBRO
    let lineItem;

    if (es_recarga) {
        const stringTokens = String(tokens);
        lineItem = {
            price: PRECIOS_RECARGAS[stringTokens],
            quantity: 1,
        };
    } else {
        lineItem = {
            price: PRECIOS_EXAMENES[tipo_examen],
            quantity: 1,
        };
    }

    // 1. Armamos la metadata BASE (La que no podemos borrar por tus clientes actuales)
    let sessionMetadata: any = {
        nombre_alumno: nombre_alumno,
        tipo_examen: tipo_examen,
        referencia: referencia_pago
    };

    // 2. Si es el evento en vivo, le INYECTAMOS los datos extra
    if (tipo_examen === 'SIMULACRO_VIVO') {
        sessionMetadata.tipo_registro = 'SIMULACRO_VIVO';
        sessionMetadata.tutor = tutor || '';
        sessionMetadata.telefono = telefono || '';
        sessionMetadata.dia_elegido = dia_elegido || '';
        sessionMetadata.toma_curso = toma_curso || '';
        sessionMetadata.institucion_curso = institucion_curso || '';
        sessionMetadata.nombre_escuela = nombre_escuela || '';
        sessionMetadata.objetivo = objetivo || '';
    }

    // 3. CREACIÓN DE SESIÓN EN STRIPE
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [lineItem],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: correo,
      client_reference_id: referencia_pago,
      metadata: sessionMetadata // <--- Usamos el objeto dinámico
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})