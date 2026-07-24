import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { accion, vendedor_id, payload } = body

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. LISTAR PROSPECTOS
    if (accion === 'listar_prospectos') {
      const { data, error } = await supabase.from('crm_prospectos').select('*').eq('vendedor_id', vendedor_id).order('created_at', { ascending: false })
      if (error) throw error
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. GUARDAR NUEVO PROSPECTO
    if (accion === 'guardar_prospecto') {
      const { error } = await supabase.from('crm_prospectos').insert([payload])
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. ACTUALIZAR ESTATUS DEL PROSPECTO
    if (accion === 'actualizar_estatus') {
      const { id_prospecto, nuevo_estatus } = payload
      const { error } = await supabase.from('crm_prospectos').update({ estatus: nuevo_estatus }).eq('id', id_prospecto)
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 4. CARGAR EXPEDIENTE RH
    if (accion === 'cargar_expediente') {
      let { data, error } = await supabase.from('onboarding_trabajadores').select('*').eq('trabajador_id', vendedor_id).single()
      if (!data) {
         // Si no existe, creamos su fila vacía
         const { data: newData, error: errInsert } = await supabase.from('onboarding_trabajadores').insert([{ trabajador_id: vendedor_id }]).select().single()
         if (errInsert) throw errInsert
         data = newData
      }
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 5. REGISTRAR DOCUMENTO SUBIDO EN LA BD
    if (accion === 'actualizar_documento_rh') {
      const { col_url, url_path, col_estatus } = payload
      const updateData = {}
      updateData[col_url] = url_path
      updateData[col_estatus] = 'En Revisión'
      
      const { error } = await supabase.from('onboarding_trabajadores').update(updateData).eq('trabajador_id', vendedor_id)
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Acción no válida' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})