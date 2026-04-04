// registro.js - Lógica de inscripción y pagos profesional
let referenciaUnica = "";
let passwordValido = false;

// Función para ver/ocultar password (OBS 3)
function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = "password";
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

// LÓGICA DE VALIDACIÓN DE REGLAS DE CONTRASEÑA (OBS 5)
function validarPasswordRules(password) {
    const rules = {
        mayus: /[A-Z]/.test(password),
        minus: /[a-z]/.test(password),
        num: /[0-9]/.test(password),
        especial: /[@#$!%*?&]/.test(password), // & Incluido pero blindado en backend
        length: password.length >= 8
    };

    // Actualizar UI
    actualizarRuleUI('rule-mayus', rules.mayus);
    actualizarRuleUI('rule-minus', rules.minus);
    actualizarRuleUI('rule-num', rules.num);
    actualizarRuleUI('rule-especial', rules.especial);
    actualizarRuleUI('rule-length', rules.length);

    // Retorna true si cumple todas las reglas
    return Object.values(rules).every(Boolean);
}

function actualizarRuleUI(elementId, cumplido) {
    const element = document.getElementById(elementId);
    if (cumplido) {
        element.classList.remove('text-gray-500');
        element.classList.add('text-green-400');
        element.querySelector('i').classList.remove('fa-circle', 'text-gray-700');
        element.querySelector('i').classList.add('fa-check-circle', 'text-green-400');
    } else {
        element.classList.remove('text-green-400');
        element.classList.add('text-gray-500');
        element.querySelector('i').classList.remove('fa-check-circle', 'text-green-400');
        element.querySelector('i').classList.add('fa-circle', 'text-gray-700');
    }
}

function generarReferencia() {
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let codigo = "ST-";
    for (let i = 0; i < 5; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    referenciaUnica = codigo;
    document.getElementById('ref-display').innerText = referenciaUnica;
}

document.addEventListener("DOMContentLoaded", () => {
    generarReferencia();

    const form = document.getElementById('registroForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const inputPass = document.getElementById('password');
    const inputConfirm = document.getElementById('confirm_password');
    const errorMatch = document.getElementById('match-error');

    // Listener para validación en tiempo real de password
    inputPass.addEventListener('input', () => {
        passwordValido = validarPasswordRules(inputPass.value);
        validarFormulario(); // Revisa si puede activar botón
    });

    // Listener para validación de coincidencia
    inputConfirm.addEventListener('input', () => {
        const coinciden = inputPass.value === inputConfirm.value;
        if (coinciden) {
            errorMatch.classList.add('hidden');
        } else if (inputConfirm.value.length > 0) {
            errorMatch.classList.remove('hidden');
        }
        validarFormulario();
    });

    // Función inteligente de validación final (activa/desactiva botón)
    const validarFormulario = () => {
        const formValidity = form.checkValidity(); // Revisa required y types nativos
        const passwordsCoinciden = inputPass.value === inputConfirm.value;
        
        // Habilitar botón solo si cumple TODO (form, reglas pass, y coinciden)
        const habilitar = formValidity && passwordValido && passwordsCoinciden;
        
        btnSubmit.disabled = !habilitar;
    };

    // Escuchar cambios en todo el form
    form.addEventListener('input', validarFormulario);
    form.addEventListener('change', validarFormulario);


    // LÓGICA DE CUPONES (Misma lógica anterior conectada a Supabase)
    const btnAplicar = document.getElementById('btnAplicar');
    btnAplicar.addEventListener('click', async () => {
        const codigo = document.getElementById('codigoPromo').value.trim().toUpperCase();
        const msg = document.getElementById('msgPromo');
        
        msg.innerText = "Validando...";
        msg.classList.remove('hidden', 'text-green-400', 'text-red-400');
        msg.classList.add('animate-pulse', 'text-cyan-400');

        try {
            const { data, error } = await _supabase.from('cupones_descuento').select('*').eq('codigo', codigo).single();

            if (error || !data) throw new Error("Cupón inválido");

            msg.classList.remove('animate-pulse', 'text-cyan-400');
            msg.innerText = `¡Cupón de ${data.descuento_porcentaje}% aplicado! Paga sin comisiones.`;
            msg.classList.add('text-green-400');
            
            // Lógica visual de precios tachados
            document.getElementById('precio-ecoems-old').classList.remove('hidden');
            document.getElementById('precio-ecoems').innerText = "$399"; // Ejemplo visual 20%
            document.getElementById('precio-uni-old').classList.remove('hidden');
            document.getElementById('precio-uni').innerText = "$479"; // Ejemplo visual 20%

            // Mostrar área de archivo (Se vuelve obligatorio)
            document.getElementById('area-transferencia').classList.remove('hidden');
            document.getElementById('area-archivo').classList.remove('hidden');
            document.getElementById('comprobanteFile').required = true;

        } catch (err) {
            msg.classList.remove('animate-pulse', 'text-cyan-400');
            msg.innerText = "Cupón inválido o expirado.";
            msg.classList.add('text-red-400');
        }
        validarFormulario(); // Revalida form por si cambió required de archivo
    });

    // ENVÍO DE FORMULARIO
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        // Blindaje final: no dejar enviar si pass no son válidos (por si hackean HTML)
        const passesMatch = inputPass.value === inputConfirm.value;
        if(!passwordValido || !passesMatch) {
            alert("La contraseña no cumple las reglas de seguridad o no coinciden.");
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';

        const archivo = document.getElementById('comprobanteFile').files[0];
        let urlArchivo = "PAGO_STRIPE_PENDIENTE"; // Valor por defecto si no usan cupón

        try {
            // SI HAY ARCHIVO (USARON CUPÓN), SUBIRLO
            if (archivo) {
                const fileExt = archivo.name.split('.').pop();
                const fileName = `${referenciaUnica}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await _supabase.storage.from('comprobantes').upload(fileName, archivo);
                if (uploadError) throw uploadError;
                const { data: publicUrlData } = _supabase.storage.from('comprobantes').getPublicUrl(fileName);
                urlArchivo = publicUrlData.publicUrl;
            }

            // GUARDAR DATOS EN SUPABASE (SOLO EL PRIMER PASSWORD)
            const { error: dbError } = await _supabase.from('registro_pagos').insert({
                nombre_tutor: document.getElementById('nombreTutor').value,
                nombre_alumno: document.getElementById('nombreAlumno').value,
                correo: document.getElementById('correo').value,
                password_hijo: inputPass.value, // GUARDAMOS LA PRIMERA (OBS 3)
                telefono: document.getElementById('telefono').value,
                tipo_examen: document.getElementById('tipoExamen').value,
                referencia_pago: referenciaUnica,
                comprobante_url: urlArchivo,
                terminos_aceptados: document.getElementById('checkLegal').checked
            });

            if (dbError) throw dbError;

            // Mostrar Éxito
            document.getElementById('contenedor-formulario').classList.add('hidden');
            document.getElementById('ref-exito').innerText = referenciaUnica;
            document.getElementById('pantalla-exito').classList.remove('hidden');

        } catch (error) {
            console.error(error);
            alert("Error al procesar el registro. Revisa tu conexión.");
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Enviar Comprobante';
        }
    });
});
