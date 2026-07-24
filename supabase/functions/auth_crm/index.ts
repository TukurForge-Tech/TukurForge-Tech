import { createClient } from 'npm:@supabase/supabase-js'
import * as bcrypt from 'npm:bcryptjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { accion, codigo_empleado, password, nuevaPassword, correo } = body

    // ==========================================
    // 🚀 LÍNEA DE RASTREO (LOG DE AUDITORÍA)
    // ==========================================
    console.log(`[AUDITORÍA] Intento detectado - Acción: ${accion} | Empleado: ${codigo_empleado || 'Vacio'}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // ==========================================
    // ACCIÓN 1: LOGIN E INTERCEPTOR (TRIPLE CANDADO)
    // ==========================================
    if (accion === 'login') {
      const { data: usuario, error } = await supabase
        .from('credenciales_trabajadores')
        .select('*')
        .eq('codigo_empleado', codigo_empleado)
        .single()

      // Candado 1 y 2: Validar existencia, Estatus Activo y Rol Vendedor
      if (error || !usuario || usuario.estatus !== 'Activo' || usuario.rol !== 'Vendedor') {
        console.log(`[RECHAZO] Credenciales incorrectas o sin permisos para: ${codigo_empleado}`);
        return new Response(JSON.stringify({ success: false, mensaje: 'Acceso denegado. Credenciales incorrectas o sin permisos de Venta.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
      }

      // Candado 3: Contraseña
      const passwordValida = await bcrypt.compare(password, usuario.password_hash)
      if (!passwordValida) {
        console.log(`[RECHAZO] Contraseña incorrecta para: ${codigo_empleado}`);
        return new Response(JSON.stringify({ success: false, mensaje: 'Acceso denegado. Contraseña incorrecta.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
      }

      // Formatear el nombre completo
      const nombreCompleto = [usuario.nombre, usuario.segundos_nombres, usuario.primer_apellido, usuario.segundo_apellido].filter(Boolean).join(' ');

      if (password.toLowerCase().includes('tukur')) {
        console.log(`[ÉXITO] Primer ingreso detectado. Pidiendo cambio de pass a: ${codigo_empleado}`);
        return new Response(JSON.stringify({ success: true, requiereCambio: true, correo: usuario.correo_corporativo, mensaje: 'Primer ingreso detectado.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      console.log(`[ÉXITO] Login exitoso para: ${codigo_empleado}`);
      return new Response(JSON.stringify({ 
        success: true, requiereCambio: false, usuarioId: usuario.id, 
        nombreCompleto: nombreCompleto, correoCorporativo: usuario.correo_corporativo 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==========================================
    // ACCIÓN 2: CAMBIAR CONTRASEÑA
    // ==========================================
    if (accion === 'cambiar_password') {
      console.log(`[AUDITORÍA] Cambio de contraseña solicitado para correo: ${correo}`);
      const salt = await bcrypt.genSalt(10)
      const nuevoHash = await bcrypt.hash(nuevaPassword, salt)
      const { error } = await supabase.from('credenciales_trabajadores').update({ password_hash: nuevoHash }).eq('correo_corporativo', correo)
      if (error) throw error
      console.log(`[ÉXITO] Contraseña actualizada para correo: ${correo}`);
      return new Response(JSON.stringify({ success: true, mensaje: 'Contraseña actualizada.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Acción no válida' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  } catch (err: any) {
    console.error(`[ERROR FATAL] ${err.message}`);
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})