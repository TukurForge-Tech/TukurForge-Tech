let referenciaUnica = "";
let passwordValido = false;
let metodoPago = "STRIPE"; // Inicia siempre en Stripe

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

function validarPasswordRules(password) {
    const rules = {
        mayus: /[A-Z]/.test(password),
        minus: /[a-z]/.test(password),
        num: /[0-9]/.test(password),
        especial: /[@#$!%*?&]/.test(password),
        length: password.length >= 8
    };

    actualizarRuleUI('rule-mayus', rules.mayus);
    actualizarRuleUI('rule-minus', rules.minus);
    actualizarRuleUI('rule-num', rules.num);
    actualizarRuleUI('rule-especial', rules.especial);
    actualizarRuleUI('rule-length', rules.length);

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
    for (let i = 0; i < 5; i++) codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    referenciaUnica = codigo;
    document.getElementById('ref-display').innerText = referenciaUnica;
}

document.addEventListener("DOMContentLoaded", () => {
    generarReferencia();

    const form = document.getElementById('registroForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const btnIcon = document.getElementById('btnIcon');
    const btnText = document.getElementById('btnText');
    const inputPass = document.getElementById('password');
    const inputConfirm = document.getElementById('confirm_password');
    const errorMatch = document.getElementById('match-error');

    // Validación en tiempo real
    inputPass.addEventListener('input', () => {
        passwordValido = validarPasswordRules(inputPass.value);
        validarFormulario();
    });

    inputConfirm.addEventListener('input', () => {
        const coinciden = inputPass.value === inputConfirm.value;
        if (coinciden) {
            errorMatch.classList.add('hidden');
        } else if (inputConfirm.value.length > 0) {
            errorMatch.classList.remove('hidden');
        }
        validarFormulario();
    });

    const validarFormulario = () => {
        const formValidity = form.checkValidity();
        const passesMatch = inputPass.value === inputConfirm.value;
        btnSubmit.disabled = !(formValidity && passwordValido && passesMatch);
    };

    form.addEventListener('input', validarFormulario);
    form.addEventListener('change', validarFormulario);

    // LÓGICA DE CUPONES (Supabase)
    const btnAplicar = document.getElementById('btnAplicar');
    btnAplicar.addEventListener('click', async () => {
        const codigo = document.getElementById('codigoPromo').value.trim().toUpperCase();
        const msg = document.getElementById('msgPromo');
        
        msg.innerText = "Validando...";
        msg.classList.remove('hidden', 'text-green-400', 'text-red-400');
        msg.classList.add('animate-pulse', 'text-cyan-400');

        try {
            const { data, error } = await _supabase.from('cupones_descuento').select('*').eq('codigo', codigo).eq('estatus', 'Activo').single();

            if (error || !data) throw new Error("Cupón inválido");

            msg.classList.remove('animate-pulse', 'text-cyan-400');
            msg.innerText = `¡Cupón de ${data.descuento_porcentaje}% aplicado! Paga sin comisiones.`;
            msg.classList.add('text-green-400');
            
            // Precios calculados
            const precioEcoemsBase = 499;
            const precioUniBase = 599;
            const factorDescuento = (100 - data.descuento_porcentaje) / 100;

            document.getElementById('precio-ecoems-old').classList.remove('hidden');
            document.getElementById('precio-ecoems').innerText = "$" + Math.round(precioEcoemsBase * factorDescuento);
            document.getElementById('precio-uni-old').classList.remove('hidden');
            document.getElementById('precio-uni').innerText = "$" + Math.round(precioUniBase * factorDescuento);

            // MODO TRANSFERENCIA
            metodoPago = "TRANSFERENCIA";
            document.getElementById('area-transferencia').classList.remove('hidden');
            document.getElementById('area-archivo').classList.remove('hidden');
            document.getElementById('comprobanteFile').required = true;
            
            // MOSTRAR AVISO DE 24H SOLO PARA TRANSFERENCIA
            document.getElementById('aviso-transferencia').classList.remove('hidden');

            // CAMBIAR BOTÓN A CYAN
            btnSubmit.classList.remove('bg-blue-600', 'hover:bg-blue-500');
            btnSubmit.classList.add('bg-cyan-600', 'hover:bg-cyan-500');
            btnIcon.className = "fa-solid fa-cloud-arrow-up text-xl";
            btnText.innerText = "Enviar Comprobante";

        } catch (err) {
            msg.classList.remove('animate-pulse', 'text-cyan-400');
            msg.innerText = "Cupón inválido o expirado.";
            msg.classList.add('text-red-400');
        }
        validarFormulario(); 
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        const passesMatch = inputPass.value === inputConfirm.value;
        if(!passwordValido || !passesMatch) return;

        btnSubmit.disabled = true;
        btnIcon.className = "fa-solid fa-spinner fa-spin text-xl";
        btnText.innerText = "Procesando...";

        const archivo = document.getElementById('comprobanteFile').files[0];
        let urlArchivo = "PAGO_STRIPE_PENDIENTE";

        try {
            if (metodoPago === "TRANSFERENCIA" && archivo) {
                if (archivo.size > 5 * 1024 * 1024) throw new Error("El archivo excede los 5MB permitidos.");

                const fileExt = archivo.name.split('.').pop();
                const fileName = `${referenciaUnica}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await _supabase.storage.from('comprobantes').upload(fileName, archivo);
                if (uploadError) throw uploadError;
                const { data: publicUrlData } = _supabase.storage.from('comprobantes').getPublicUrl(fileName);
                urlArchivo = publicUrlData.publicUrl;
            }

            const { error: dbError } = await _supabase.from('registro_pagos').insert({
                nombre_tutor: document.getElementById('nombreTutor').value,
                nombre_alumno: document.getElementById('nombreAlumno').value,
                correo: document.getElementById('correo').value,
                password_hijo: inputPass.value,
                telefono: document.getElementById('telefono').value,
                tipo_examen: document.getElementById('tipoExamen').value,
                referencia_pago: referenciaUnica,
                comprobante_url: urlArchivo,
                terminos_aceptados: document.getElementById('checkLegal').checked,
                estatus: metodoPago === "STRIPE" ? "Pendiente Stripe" : "Pendiente Transferencia"
            });

            if (dbError) throw dbError;

            // RUTEO FINAL
            if (metodoPago === "STRIPE") {
                // Aquí va tu link de Stripe
                alert("Redirigiendo a Stripe para pagar de forma segura...");
                window.location.href = "index.html"; // Cambiar por link de Stripe
            } else {
                document.getElementById('contenedor-formulario').classList.add('hidden');
                document.getElementById('area-transferencia').classList.add('hidden');
                document.getElementById('ref-exito').innerText = referenciaUnica;
                document.getElementById('pantalla-exito').classList.remove('hidden');
            }

        } catch (error) {
            console.error(error);
            alert(error.message || "Error al procesar el registro.");
            btnSubmit.disabled = false;
            
            if(metodoPago === "STRIPE"){
                btnIcon.className = "fa-brands fa-stripe text-xl";
                btnText.innerText = "Pagar Seguro con Tarjeta";
            } else {
                btnIcon.className = "fa-solid fa-cloud-arrow-up text-xl";
                btnText.innerText = "Enviar Comprobante";
            }
        }
    });
});
