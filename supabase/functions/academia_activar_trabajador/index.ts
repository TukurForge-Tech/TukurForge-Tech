import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { trabajador_id, rol, correo_corporativo } = await req.json()

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '' 
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

        // 0. TRAER EL CORREO PERSONAL DEL TRABAJADOR
        const { data: empleado, error: errEmpleado } = await supabaseAdmin
            .from('credenciales_trabajadores')
            .select('correo, nombre')
            .eq('id', trabajador_id)
            .single();
        
        if (errEmpleado) throw new Error("No se encontró al trabajador.");
        const correoPersonal = empleado.correo;
        const nombrePila = empleado.nombre;

        // ==========================================
        // 1. ESCUDO VALIDADOR Y AUTO-NUMERADOR DE CORREO
        // ==========================================
        const [basePrefijo, dominio] = correo_corporativo.split('@');
        
        const { data: emailsExistentes } = await supabaseAdmin
            .from('credenciales_trabajadores')
            .select('correo_corporativo')
            .ilike('correo_corporativo', `${basePrefijo}%@${dominio}`);

        let correoOficial = correo_corporativo;

        if (emailsExistentes && emailsExistentes.length > 0) {
            let maxContador = 0;
            let existeExacto = false;

            emailsExistentes.forEach(row => {
                const mail = row.correo_corporativo;
                if (!mail) return;
                if (mail === correo_corporativo) existeExacto = true;
                
                const prefijoActual = mail.split('@')[0];
                const sufijoNum = prefijoActual.replace(basePrefijo, ''); 
                
                if (sufijoNum) {
                    const num = parseInt(sufijoNum, 10);
                    if (!isNaN(num) && num > maxContador) {
                        maxContador = num;
                    }
                }
            });

            if (existeExacto || maxContador > 0) {
                correoOficial = `${basePrefijo}${maxContador > 0 ? maxContador + 1 : 2}@${dominio}`;
            }
        }

        // ==========================================
        // 2. MOTOR MATEMÁTICO DE MATRÍCULA TFMX
        // ==========================================
        let letraRol = 'X';
        let baseNumero = 0;
        const rolNormalizado = rol.toLowerCase();

        if (rolNormalizado.includes('vendedor')) {
            letraRol = 'V'; baseNumero = 300; 
        } else if (rolNormalizado.includes('admin')) {
            letraRol = 'A'; baseNumero = 200; 
        } else if (rolNormalizado.includes('direct')) {
            letraRol = 'D'; baseNumero = 100; 
        } else if (rolNormalizado.includes('dueño') || rolNormalizado.includes('socio')) {
            letraRol = 'O'; baseNumero = 0;   
        }

        const prefijoBusqueda = `TFMX${letraRol}26%`;
        const { data: usuariosRegistrados } = await supabaseAdmin
            .from('credenciales_trabajadores')
            .select('codigo_empleado')
            .not('codigo_empleado', 'is', null)
            .like('codigo_empleado', prefijoBusqueda);

        let maxNumero = baseNumero - 1; 
        if (usuariosRegistrados && usuariosRegistrados.length > 0) {
            usuariosRegistrados.forEach(user => {
                const numDecimal = parseInt(user.codigo_empleado.slice(-3), 10);
                if (!isNaN(numDecimal) && numDecimal > maxNumero) maxNumero = numDecimal;
            });
        }

        const matriculaOficial = `TFMX${letraRol}26${(maxNumero + 1).toString().padStart(3, '0')}`;

        // ==========================================
        // 3. CANDADO DE SEGURIDAD Y ACTUALIZACIÓN BD
        // ==========================================
        const randomPass = 'Tukur-' + Math.random().toString(36).slice(-5).toUpperCase();
        
        const salt = bcrypt.genSaltSync(8);
        const passwordHash = bcrypt.hashSync(randomPass, salt);

        // A. Actualizamos la tabla maestra de credenciales
        const { error: updateError } = await supabaseAdmin
            .from('credenciales_trabajadores')
            .update({ 
                estatus: 'Activo',
                codigo_empleado: matriculaOficial,
                correo_corporativo: correoOficial,
                password_hash: passwordHash
            })
            .eq('id', trabajador_id);

        if (updateError) throw updateError;

        // B. Actualizamos el rastreador físico del contrato (NUEVO)
        const { error: errorContrato } = await supabaseAdmin
            .from('onboarding_trabajadores')
            .update({ 
                estatus_contrato: 'Firmado'
            })
            .eq('trabajador_id', trabajador_id);

        if (errorContrato) throw errorContrato;

        // ==========================================
        // 4. EL CARTERO (RESEND - DOBLE DISPARO)
        // ==========================================
        const headersResend = {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
        };

        const htmlBienvenida = `
            <div style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                <h2 style="color: #06b6d4;">¡Bienvenido a H Levare Group!</h2>
                <p>Hola ${nombrePila},</p>
                <p>Es un honor informarte que tu expediente ha sido validado y tu contrato ha sido activado exitosamente.</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Tu Matrícula Oficial:</strong> ${matriculaOficial}</p>
                    <p><strong>Tu Correo Corporativo:</strong> ${correoOficial}</p>
                </div>
                <p>Puedes acceder a tu entorno de trabajo corporativo desde la siguiente liga:</p>
                <p><a href="https://tukurforge.com/crm_vendedor" style="background-color: #06b6d4; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Acceder al CRM</a></p>
                <br>
                <p>Atentamente,<br><strong>La Dirección</strong></p>
            </div>
        `;

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: headersResend,
            body: JSON.stringify({
                from: 'H Levare Group <no-reply@tukurforge.com>', 
                to: correoPersonal,
                subject: 'Tu código de empleado y accesos - H Levare Group',
                html: htmlBienvenida
            })
        });

        const htmlSeguridad = `
            <div style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                <h3 style="color: #ef4444;">Aviso de Seguridad</h3>
                <p>Hola ${nombrePila},</p>
                <p>Por políticas de seguridad corporativa, la contraseña temporal que utilizaste durante tu proceso de selección ha sido revocada.</p>
                <p>Tu nueva clave temporal de acceso al CRM es:</p>
                <div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; font-size: 18px; letter-spacing: 2px;">
                    <strong>${randomPass}</strong>
                </div>
                <p style="font-size: 12px; color: #666; margin-top: 20px;">Te recomendamos guardar esta clave en un lugar seguro.</p>
            </div>
        `;

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: headersResend,
            body: JSON.stringify({
                from: 'Sistemas TukurForge <no-reply@tukurforge.com>',
                to: correoPersonal,
                subject: 'Actualización de Seguridad - Credenciales CRM',
                html: htmlSeguridad
            })
        });

        // ==========================================
        // FIN DEL PROCESO: Retornamos éxito sin la contraseña
        // ==========================================
        return new Response(
            JSON.stringify({ 
                mensaje: "Activación exitosa", 
                matricula_asignada: matriculaOficial,
                correo_oficial: correoOficial
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})