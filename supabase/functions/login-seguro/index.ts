import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Configuramos las puertas para que tu página web pueda hablar con la API (CORS)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Manejo del pre-vuelo (Regla de seguridad de los navegadores)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Recibimos lo que el alumno escribió en la pantalla de login
    const { email, password } = await req.json()

    // Validamos que no nos manden datos vacíos
    if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Correo y contraseña son obligatorios' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400, // Bad Request
        })
    }

    // 3. LA MAGIA: Nos conectamos a la base de datos usando la LLAVE MAESTRA.
    // Esto permite que la API vea la tabla aunque la bloqueemos al público.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscamos si el correo existe en la tabla de membresías
    const { data: usuarios, error } = await supabaseAdmin
      .from('usuarios_membresias')
      .select('token_hex, password_hijo, password_padre, nombre_alumno')
      .eq('email', email.trim().toLowerCase()) // Limpiamos espacios y mayúsculas por si acaso

    if (error) throw error

    // Si la base de datos regresa vacío, el correo no existe
    if (!usuarios || usuarios.length === 0) {
      return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // 4. LÓGICA DE NEGOCIO: ¿Es el Papá o es el Hijo?
    let role = null;
    let tokens_permitidos: string[] = [];

    for (const user of usuarios) {
      // ¿La contraseña coincide con la del padre?
      if (user.password_padre && password === user.password_padre) {
        role = 'padre';
        break; // Si es el papá, detenemos la búsqueda, tiene acceso a todo.
      } 
      // ¿La contraseña coincide con la del hijo?
      else if (user.password_hijo && password === user.password_hijo) {
        role = 'hijo';
        tokens_permitidos.push(user.token_hex); // Le damos solo la llave de este curso específico
      }
    }

    // Si detectamos que es el papá, le pasamos TODOS los tokens que compró
    if (role === 'padre') {
        tokens_permitidos = usuarios.map(u => u.token_hex);
    }

    // Si después de buscar no hubo coincidencias, la contraseña está mal
    if (tokens_permitidos.length === 0) {
      return new Response(JSON.stringify({ error: 'Contraseña incorrecta' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401, // Unauthorized
      })
    }

    // 5. ¡ACCESO CONCEDIDO! Le devolvemos el perfil al navegador
    return new Response(JSON.stringify({
      success: true,
      role: role,
      tokens: tokens_permitidos,
      nombre_alumno: usuarios[0].nombre_alumno
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    // Si algo falla, atrapamos el error para que la API no explote
    return new Response(JSON.stringify({ error: 'Error interno del servidor', detalles: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})