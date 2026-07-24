import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 1. Recibimos los datos separados (ya no pedimos el correo, lo vamos a crear)
  const { nombre, segundos_nombres, primer_apellido, segundo_apellido, password, rol, empresa } = await req.json()

  // Función interna para quitar acentos, espacios extra y pasar a minúsculas
  const limpiarTexto = (texto: string) => {
    return texto ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : '';
  }

  // 1.5 ¡LA MAGIA! Creamos el correo corporativo automáticamente
  const dominio = empresa === 'TF' ? 'tukurforge.com' : 'hlevare.com';
  const correoGenerado = `${limpiarTexto(nombre)}.${limpiarTexto(primer_apellido)}@${dominio}`;

  // Conectamos a Supabase...
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 2. Definimos las reglas de tu Corporativo (Letra y Bloque Numérico)
  let letraRol = '';
  let limiteInferior = 0;
  let limiteSuperior = 0;

  switch (rol) {
    case 'Direccion':       letraRol = 'D'; limiteInferior = 1; limiteSuperior = 99; break;
    case 'Administracion':  letraRol = 'A'; limiteInferior = 100; limiteSuperior = 199; break;
    case 'Desarrollo':      letraRol = 'T'; limiteInferior = 200; limiteSuperior = 299; break;
    case 'Ventas':          letraRol = 'V'; limiteInferior = 300; limiteSuperior = 399; break;
  }

  // 3. Calculamos el Año Actual (ej. "26")
  const añoActual = new Date().getFullYear().toString().slice(-2);
  const prefijoBusqueda = `${empresa}MX${letraRol}${añoActual}`; // Ej. "TFMXV26"

  // 4. Buscamos en la base de datos el último código creado de ese bloque este año
  const { data: empleadosMismoBloque, error: errorBusqueda } = await supabaseAdmin
    .from('credenciales_trabajadores')
    .select('codigo_empleado')
    .like('codigo_empleado', `${prefijoBusqueda}%`)
    .order('codigo_empleado', { ascending: false })
    .limit(1);

  let numeroConsecutivo = limiteInferior; // Empezamos en la base del bloque (Ej. 300)

  // Si ya existen empleados en ese bloque, le sumamos 1 al último
  if (empleadosMismoBloque && empleadosMismoBloque.length > 0) {
    const ultimoCodigo = empleadosMismoBloque[0].codigo_empleado;
    const ultimoNumeroFormateado = parseInt(ultimoCodigo.slice(-3)); // Extrae los últimos 3 dígitos
    numeroConsecutivo = ultimoNumeroFormateado + 1;
  }

  // Si nos pasamos del límite del bloque (ej. más de 100 vendedores en un año), marcamos error
  if (numeroConsecutivo > limiteSuperior) {
    return new Response(JSON.stringify({ error: "Límite de empleados excedido para este rol." }), { status: 400 });
  }

  // 5. ¡ARMAMOS EL CÓDIGO FINAL! (Añadimos ceros a la izquierda si es necesario)
  const consecutivoString = numeroConsecutivo.toString().padStart(3, '0');
  const codigoEmpleadoFinal = `${prefijoBusqueda}${consecutivoString}`; // Ej. TFMXV26300

  // 6. Creamos al usuario en el sistema de Autenticación de Supabase
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: correo,
    password: password,
    email_confirm: true // Se salta el correo de confirmación porque tú ya les diste el acceso
  })

  if (authError) throw authError;

  // 7. Guardamos su perfil con los nombres separados
  const { error: insertError } = await supabaseAdmin
    .from('credenciales_trabajadores')
    .insert([{
      id: authData.user.id,
      codigo_empleado: codigoEmpleadoFinal,
      correo_corporativo: correoGenerado, // Usamos el que generó el sistema
      rol: rol,
      nombre: nombre,
      segundos_nombres: segundos_nombres,
      primer_apellido: primer_apellido,
      segundo_apellido: segundo_apellido
    }])

  if (insertError) throw insertError;

  // Si todo salió bien, devolvemos el código nuevo para que lo veas en pantalla
  return new Response(JSON.stringify({ success: true, codigo: codigoEmpleadoFinal }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  })
})