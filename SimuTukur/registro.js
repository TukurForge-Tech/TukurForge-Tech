// registro.js - Lógica de Inscripción y Pagos

let referenciaUnica = "";
let passwordValido = false;
let metodoPago = "STRIPE"; 

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
        element.querySelector('i').classList.replace('fa-circle', 'fa-check-circle');
    } else {
        element.classList.remove('text-green-400');
        element.classList.add('text-gray-500');
        element.querySelector('i').classList.replace('fa-check-circle', 'fa-circle');
    }
}

function generarReferencia() {
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let codigo = "ST-";
    for (let i = 0; i < 5; i++) codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    referenciaUnica = codigo;
    const display = document.getElementById('ref-display');
    if(display) display.innerText = referenciaUnica;
}

// Carga de Exámenes desde Supabase
async function cargarExamenesBD() {
    const select = document.getElementById('tipoExamen');
    try {
        const { data, error } = await _supabase
            .from('config_examenes')
            .select('token_hex, institucion, descripcion')
            .eq('plan', 'PRO')
            .order('institucion', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            select.innerHTML = '<option value="" disabled selected class="text-gray-400">No hay exámenes disponibles en BD</option>';
            return;
        }

        const grupos = {};
        data.forEach(ex => {
            if (!grupos[ex.institucion]) grupos[ex.institucion] = [];
            grupos[ex.institucion].push(ex);
        });

        select.innerHTML = '<option value="" disabled selected class="text-gray-400">Selecciona tu examen...</option>';

        for (const inst in grupos) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `--- ${inst} ---`;
            grupos[inst].forEach(ex => {
                const option = document.createElement('option');
                option.value = ex.token_hex; 
                option.text = ex.descripcion; 
                option.dataset.nombreExamen = `${inst} - ${ex.descripcion}`; 
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        }
    } catch (err) {
        console.error("Error conectando a Supabase:", err);
        select.innerHTML = '<option value="" disabled selected class="text-red-400">Error de red. Recarga la página.</option>';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    generarReferencia();
    cargarExamenesBD(); 

    const form = document.getElementById('registroForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const btnIcon = document.getElementById('btnIcon');
    const btnText = document.getElementById('btnText');
    const inputPass = document.getElementById('password');
    const inputConfirm = document.getElementById('confirm_password');
    const errorMatch = document.getElementById('match-error');

    // Validación de Contraseña en vivo
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

    // ==========================================
    // LÓGICA DE CUPONES (CON REVERSA Y CHECK)
    // ==========================================
    const inputPromo = document.getElementById('codigoPromo');
    const btnAplicar = document.getElementById('btnAplicar');
    const msgPromo = document.getElementById('msgPromo');

    const revertirStripe = () => {
        metodoPago = "STRIPE";
        // Restaurar precios
        document.getElementById('precio-ecoems-old').classList.add('hidden');
        document.getElementById('precio-ecoems').innerText = "$499";
        document.getElementById('precio-uni-old').classList.add('hidden');
        document.getElementById('precio-uni').innerText = "$599";
        
        // Ocultar sección de transferencia
        document.getElementById('area-transferencia').classList.add('hidden');
        document.getElementById('area-archivo').classList.add('hidden');
        document.getElementById('comprobanteFile').required = false;
        document.getElementById('aviso-transferencia').classList.add('hidden');

        // Restaurar botón a Stripe
        btnSubmit.classList.add('enabled:bg-blue-600', 'enabled:hover:bg-blue-500', 'enabled:shadow-[0_0_15px_rgba(37,99,235,0.4)]');
        btnSubmit.classList.remove('enabled:bg-cyan-600', 'enabled:hover:bg-cyan-500', 'enabled:shadow-[0_0_15px_rgba(6,182,212,0.4)]');
        btnIcon.className = "fa-brands fa-stripe text-xl";
        btnText.innerText = "Pagar Seguro con Tarjeta";
    };

    // Auto-reversa al borrar texto
    inputPromo.addEventListener('input', (e) => {
        if (e.target.value.trim() === "") {
            msgPromo.className = "text-[10px] mt-1 hidden";
            revertirStripe();
            validarFormulario();
        }
    });

    // Acción del botón Aplicar
    btnAplicar.addEventListener('click', async () => {
        const codigo = inputPromo.value.trim().toUpperCase();
        if(!codigo) {
            msgPromo.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-1"></i> Escribe un código primero';
            msgPromo.className = "text-[10px] mt-2 text-red-400 font-bold block";
            revertirStripe();
            validarFormulario();
            return;
        }
        
        msgPromo.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Validando...';
        msgPromo.className = "text-[10px] mt-2 text-cyan-400 animate-pulse font-bold block";

        try {
            const { data, error } = await _supabase.from('cupones_descuento')
                .select('*')
                .eq('codigo', codigo)
                .eq('estatus', 'Activo')
                .single();
                
            if (error || !data) throw new Error("Cupón inválido");

            // CHECK VISUAL DE ÉXITO
            msgPromo.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i> ¡Cupón de ${data.descuento_porcentaje}% aplicado!`;
            msgPromo.className = "text-[10px] mt-2 text-green-400 font-bold block";
            
            // Recálculo Matemático
            const precioEcoemsBase = 499;
            const precioUniBase = 599;
            const factorDescuento = (100 - data.descuento_porcentaje) / 100;

            document.getElementById('precio-ecoems-old').classList.remove('hidden');
            document.getElementById('precio-ecoems').innerText = "$" + Math.round(precioEcoemsBase * factorDescuento);
            document.getElementById('precio-uni-old').classList.remove('hidden');
            document.getElementById('precio-uni').innerText = "$" + Math.round(precioUniBase * factorDescuento);

            // Transición Visual a Transferencia
            metodoPago = "TRANSFERENCIA";
            document.getElementById('area-transferencia').classList.remove('hidden');
            document.getElementById('area-archivo').classList.remove('hidden');
            document.getElementById('comprobanteFile').required = true;
            document.getElementById('aviso-transferencia').classList.remove('hidden');

            // Actualización del Botón Principal
            btnSubmit.classList.remove('enabled:bg-blue-600', 'enabled:hover:bg-blue-500', 'enabled:shadow-[0_0_15px_rgba(37,99,235,0.4)]');
            btnSubmit.classList.add('enabled:bg-cyan-600', 'enabled:hover:bg-cyan-500', 'enabled:shadow-[0_0_15px_rgba(6,182,212,0.4)]');
            btnIcon.className = "fa-solid fa-cloud-arrow-up text-xl";
            btnText.innerText = "Enviar Comprobante";

        } catch (err) {
            msgPromo.innerHTML = '<i class="fa-solid fa-circle-xmark mr-1"></i> Cupón inválido o expirado';
            msgPromo.className = "text-[10px] mt-2 text-red-400 font-bold block";
            revertirStripe(); 
        }
        validarFormulario(); 
    });

    // ==========================================
    // ENVÍO DE FORMULARIO A BD
    // ==========================================
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        
        const passesMatch = inputPass.value === inputConfirm.value;
        if(!passwordValido || !passesMatch) return;

        btnSubmit.disabled = true;
        btnIcon.className = "fa-solid fa-spinner fa-spin text-xl";
        btnText.innerText = "Procesando...";

        const selectExamen = document.getElementById('tipoExamen');
        const tokenSeleccionado = selectExamen.value; 
        const nombreExamenFinanzas = selectExamen.options[selectExamen.selectedIndex].dataset.nombreExamen; 

        const archivo = document.getElementById('comprobanteFile').files[0];
        let urlArchivo = "PAGO_STRIPE_PENDIENTE";

        try {
            if (metodoPago === "TRANSFERENCIA" && archivo) {
                if (archivo.size > 5 * 1024 * 1024) throw new Error("El archivo excede los 5MB.");
                const fileExt = archivo.name.split('.').pop();
                const fileName = `${referenciaUnica}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await _supabase.storage.from('comprobantes').upload(fileName, archivo);
                if (uploadError) throw uploadError;
                const { data: publicUrlData } = _supabase.storage.from('comprobantes').getPublicUrl(fileName);
                urlArchivo = publicUrlData.publicUrl;
            }

            const { error: dbPagosError } = await _supabase.from('registro_pagos').insert({
                nombre_tutor: document.getElementById('nombreTutor').value,
                nombre_alumno: document.getElementById('nombreAlumno').value,
                correo: document.getElementById('correo').value,
                password_hijo: inputPass.value,
                telefono: document.getElementById('telefono').value,
                tipo_examen: nombreExamenFinanzas, 
                referencia_pago: referenciaUnica,
                comprobante_url: urlArchivo,
                terminos_aceptados: document.getElementById('checkLegal').checked,
                estatus: metodoPago === "STRIPE" ? "Pendiente Stripe" : "Pendiente Transferencia"
            });
            if (dbPagosError) throw dbPagosError;

            const { error: dbMembresiaError } = await _supabase.from('usuarios_membresias').insert({
                nombre_tutor: document.getElementById('nombreTutor').value,
                nombre_alumno: document.getElementById('nombreAlumno').value,
                email: document.getElementById('correo').value,
                password_hijo: inputPass.value, 
                token_hex: tokenSeleccionado, 
                intentos_simulacro_restantes: 200 
            });
            if (dbMembresiaError) throw dbMembresiaError;

            if (metodoPago === "STRIPE") {
                alert("Simulación: Redirigiendo a pasarela Stripe segura...");
            } else {
                document.getElementById('contenedor-formulario').classList.add('hidden');
                document.getElementById('area-transferencia').classList.add('hidden');
                document.getElementById('ref-exito').innerText = referenciaUnica;
                document.getElementById('pantalla-exito').classList.remove('hidden');
            }

        } catch (error) {
            console.error(error);
            alert(error.message || "Error al procesar el registro (Revisa conexión).");
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
