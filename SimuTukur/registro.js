// registro.js - Lógica de Inscripción y Pagos

let referenciaUnica = "";
let passwordValido = false;
let metodoPago = "STRIPE"; 

document.addEventListener("DOMContentLoaded", async () => {
    // 🛑 INTERCEPTOR STRIPE: Creación de cuenta SOLO si el pago fue exitoso
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('pago') === 'exito') {
        document.getElementById('contenedor-formulario').classList.add('hidden');
        document.getElementById('area-transferencia').classList.add('hidden');
        const refExito = urlParams.get('ref') || '--';
        document.getElementById('ref-exito').innerText = refExito;
        document.getElementById('pantalla-exito').classList.remove('hidden');
        
        if(refExito !== '--') {
            // 1. Actualizamos en BD que el pago es exitoso
            await _supabase.from('registro_pagos').update({ estatus: 'Pagado Stripe' }).eq('referencia_pago', refExito);
            
            // 2. CREAMOS LA MEMBRESÍA USANDO LA MEMORIA DEL NAVEGADOR
            const tempCorreo = localStorage.getItem('simu_correo');
            const tempNombre = localStorage.getItem('simu_alumno') || "Aspirante"; // <-- Rescatamos el nombre
            
            if(tempCorreo) {
                await _supabase.from('usuarios_membresias').insert({
                    nombre_tutor: localStorage.getItem('simu_tutor'),
                    nombre_alumno: localStorage.getItem('simu_alumno'),
                    email: tempCorreo,
                    password_hijo: localStorage.getItem('simu_pass'),
                    token_hex: localStorage.getItem('simu_token'),
                    intentos_simulacro_restantes: 200
                });
                
                // 3. Borramos la memoria por seguridad
                localStorage.removeItem('simu_tutor');
                localStorage.removeItem('simu_alumno');
                localStorage.removeItem('simu_correo');
                localStorage.removeItem('simu_pass');
                localStorage.removeItem('simu_token');

                // 4. MANDAMOS EL CORREO DE BIENVENIDA STRIPE (Ya con las variables correctas)
                notificarPorCorreo(tempNombre, tempCorreo, "Tu contraseña (la que creaste en el registro)", "STRIPE", refExito);
            }
        }
        return; 
    }

    generarReferencia();
    cargarExamenesBD(); 

    const form = document.getElementById('registroForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const btnIcon = document.getElementById('btnIcon');
    const btnText = document.getElementById('btnText');
    const inputPass = document.getElementById('password');
    const inputConfirm = document.getElementById('confirm_password');
    const errorMatch = document.getElementById('match-error');
    const comprobanteFile = document.getElementById('comprobanteFile');

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

    comprobanteFile.addEventListener('change', function() {
        if (this.files.length > 0) {
            const fileSize = this.files[0].size / 1024 / 1024; 
            if (fileSize > 5) {
                alert("⚠️ El archivo es muy pesado. El límite máximo es de 5MB.");
                this.value = ""; 
            }
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
    // LÓGICA DE CUPONES
    // ==========================================
    const inputPromo = document.getElementById('codigoPromo');
    const btnAplicar = document.getElementById('btnAplicar');
    const msgPromo = document.getElementById('msgPromo');
    const checkTransferencia = document.getElementById('checkTransferencia');

    const revertirStripe = () => {
        metodoPago = "STRIPE";
        document.getElementById('precio-ecoems-old').classList.add('hidden');
        document.getElementById('precio-ecoems').innerText = "$499";
        document.getElementById('precio-uni-old').classList.add('hidden');
        document.getElementById('precio-uni').innerText = "$599";
        
        document.getElementById('area-transferencia').classList.add('hidden');
        document.getElementById('area-archivo').classList.add('hidden');
        comprobanteFile.required = false;
        
        document.getElementById('aviso-transferencia').classList.add('hidden');
        checkTransferencia.required = false;
        checkTransferencia.checked = false;

        btnSubmit.classList.add('enabled:bg-blue-600', 'enabled:hover:bg-blue-500', 'enabled:shadow-[0_0_15px_rgba(37,99,235,0.4)]');
        btnSubmit.classList.remove('enabled:bg-cyan-600', 'enabled:hover:bg-cyan-500', 'enabled:shadow-[0_0_15px_rgba(6,182,212,0.4)]');
        btnIcon.className = "fa-brands fa-stripe text-xl";
        btnText.innerText = "Pagar Seguro con Tarjeta";
    };

    inputPromo.addEventListener('input', (e) => {
        if (e.target.value.trim() === "") {
            msgPromo.className = "text-[10px] mt-1 hidden";
            revertirStripe();
            validarFormulario();
        }
    });

    btnAplicar.addEventListener('click', async () => {
        const codigo = inputPromo.value.trim().toUpperCase();
        if(!codigo) {
            msgPromo.innerHTML = '⚠️ Escribe un código primero';
            msgPromo.className = "text-[10px] mt-2 text-red-400 font-bold block";
            revertirStripe();
            validarFormulario();
            return;
        }
        
        msgPromo.innerHTML = '⏳ Validando...';
        msgPromo.className = "text-[10px] mt-2 text-cyan-400 animate-pulse font-bold block";

        try {
            const { data, error } = await _supabase.from('cupones_descuento')
                .select('*')
                .eq('codigo', codigo)
                .eq('estatus', 'Activo')
                .single();
                
            if (error || !data) throw new Error("Cupón inválido");

            msgPromo.innerHTML = `✅ ¡Cupón de ${data.descuento_porcentaje}% aplicado!`;
            msgPromo.className = "text-[10px] mt-2 text-green-400 font-bold block";
            
            const precioEcoemsBase = 499;
            const precioUniBase = 599;
            const factorDescuento = (100 - data.descuento_porcentaje) / 100;

            document.getElementById('precio-ecoems-old').classList.remove('hidden');
            document.getElementById('precio-ecoems').innerText = "$" + Math.round(precioEcoemsBase * factorDescuento);
            document.getElementById('precio-uni-old').classList.remove('hidden');
            document.getElementById('precio-uni').innerText = "$" + Math.round(precioUniBase * factorDescuento);

            metodoPago = "TRANSFERENCIA";
            document.getElementById('area-transferencia').classList.remove('hidden');
            document.getElementById('area-archivo').classList.remove('hidden');
            
            comprobanteFile.required = true;
            document.getElementById('aviso-transferencia').classList.remove('hidden');
            checkTransferencia.required = true;

            btnSubmit.classList.remove('enabled:bg-blue-600', 'enabled:hover:bg-blue-500', 'enabled:shadow-[0_0_15px_rgba(37,99,235,0.4)]');
            btnSubmit.classList.add('enabled:bg-cyan-600', 'enabled:hover:bg-cyan-500', 'enabled:shadow-[0_0_15px_rgba(6,182,212,0.4)]');
            btnIcon.className = "fa-solid fa-cloud-arrow-up text-xl";
            btnText.innerText = "Enviar Comprobante";

        } catch (err) {
            msgPromo.innerHTML = '❌ Cupón inválido o expirado';
            msgPromo.className = "text-[10px] mt-2 text-red-400 font-bold block";
            revertirStripe(); 
        }
        validarFormulario(); 
    });

    // ==========================================
    // ENVÍO DE FORMULARIO A BD Y STRIPE
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
        const correo = document.getElementById('correo').value.trim();

        try {
            const { data: planExistente } = await _supabase.from('usuarios_membresias')
                .select('id')
                .eq('email', correo)
                .eq('token_hex', tokenSeleccionado);
            
            if (planExistente && planExistente.length > 0) {
                throw new Error("Este correo ya tiene registrado este examen exacto. Por favor inicia sesión o elige un plan diferente.");
            }

            const archivo = comprobanteFile.files[0];
            let urlArchivo = "PAGO_STRIPE_PENDIENTE";

            if (metodoPago === "TRANSFERENCIA" && archivo) {
                if (archivo.size > 5 * 1024 * 1024) throw new Error("El archivo excede los 5MB.");
                const fileExt = archivo.name.split('.').pop();
                const fileName = `${referenciaUnica}-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await _supabase.storage.from('comprobantes').upload(fileName, archivo);
                if (uploadError) throw uploadError;
                const { data: publicUrlData } = _supabase.storage.from('comprobantes').getPublicUrl(fileName);
                urlArchivo = publicUrlData.publicUrl;
            }

            // Siempre registramos el intento de pago para tener el historial
            const { error: dbPagosError } = await _supabase.from('registro_pagos').insert({
                nombre_tutor: document.getElementById('nombreTutor').value,
                nombre_alumno: document.getElementById('nombreAlumno').value,
                correo: correo,
                password_hijo: inputPass.value,
                telefono: document.getElementById('telefono').value,
                tipo_examen: nombreExamenFinanzas, 
                referencia_pago: referenciaUnica,
                comprobante_url: urlArchivo,
                terminos_aceptados: document.getElementById('checkLegal').checked,
                estatus: metodoPago === "STRIPE" ? "Pendiente Stripe" : "Pendiente Transferencia"
            });
            if (dbPagosError) throw dbPagosError;

            // ...código anterior...
            if(metodoPago === 'STRIPE') {
                btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando con banco...';
                try {
                    const selectExamen = document.getElementById('tipoExamen');
                    const nombreExamenFinanzas = selectExamen.options[selectExamen.selectedIndex].dataset.nombreExamen;
                    
                    // =========================================================
                    // ✂️ TRUCO DEL SPLIT (Funciona hoy para ECOEMS y mañana para las Universidades)
                    // Toma "ECOEMS - CENEVAL" y se queda solo con "ECOEMS"
                    // =========================================================
                    const institucionLimpia = nombreExamenFinanzas.split(' - ')[0];
            
                    const { data: stripeData, error: stripeError } = await _supabase.functions.invoke('stripe-checkout', {
                        body: {
                            nombre_alumno: document.getElementById('nombreAlumno').value,
                            correo: correo,
                            tipo_examen: institucionLimpia, // 👈 Enviamos la palabra limpia
                            referencia_pago: referenciaUnica,
                            precio: 499 // Stripe ignorará esto y usará el precio de tu catálogo
                        }
                    });
            
                    if (stripeError) throw stripeError;
                    if (stripeData?.url) {
                        window.location.href = stripeData.url; 
                    } else {
                        throw new Error("No se generó URL de pago");
                    }
                } catch(err) {
                    console.error("Error Stripe:", err);
                    alert("Hubo un problema al iniciar el pago seguro. Intenta de nuevo.");
                    btnSubmit.innerHTML = '<i class="fa-brands fa-stripe"></i> Pagar Seguro';
                    btnSubmit.disabled = false;
                }
            }
            // ...resto del código... 
            else {
                // SI ES TRANSFERENCIA, CREAMOS LA MEMBRESÍA DE CORTESÍA AHORA MISMO
                const { error: dbMembresiaError } = await _supabase.from('usuarios_membresias').insert({
                    nombre_tutor: document.getElementById('nombreTutor').value,
                    nombre_alumno: document.getElementById('nombreAlumno').value,
                    email: correo,
                    password_hijo: inputPass.value, 
                    token_hex: tokenSeleccionado, 
                    intentos_simulacro_restantes: 200 
                });
                if (dbMembresiaError) throw dbMembresiaError;

                // MANDAMOS CORREO AL ALUMNO Y ALERTA AL ADMIN
                notificarPorCorreo(
                    document.getElementById('nombreAlumno').value, 
                    correo, 
                    inputPass.value, 
                    "TRANSFERENCIA", 
                    referenciaUnica
                );
                
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

// Funciones Auxiliares
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
    const rules = { mayus: /[A-Z]/.test(password), minus: /[a-z]/.test(password), num: /[0-9]/.test(password), especial: /[@#$!%*?&]/.test(password), length: password.length >= 8 };
    actualizarRuleUI('rule-mayus', rules.mayus); actualizarRuleUI('rule-minus', rules.minus); actualizarRuleUI('rule-num', rules.num); actualizarRuleUI('rule-especial', rules.especial); actualizarRuleUI('rule-length', rules.length);
    return Object.values(rules).every(Boolean);
}

function actualizarRuleUI(elementId, cumplido) {
    const element = document.getElementById(elementId);
    if (cumplido) {
        element.classList.remove('text-gray-500'); element.classList.add('text-green-400'); element.querySelector('i').classList.replace('fa-circle', 'fa-check-circle');
    } else {
        element.classList.remove('text-green-400'); element.classList.add('text-gray-500'); element.querySelector('i').classList.replace('fa-check-circle', 'fa-circle');
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

async function cargarExamenesBD() {
    const select = document.getElementById('tipoExamen');
    try {
        const { data, error } = await _supabase.from('config_examenes').select('token_hex, institucion, descripcion').eq('plan', 'PRO').order('institucion', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) { select.innerHTML = '<option value="" disabled selected class="text-gray-400">No hay exámenes disponibles en BD</option>'; return; }

        // =========================================================
        // 🔒 CANDADO DE FASE 1 (SOLO ECOEMS)
        // =========================================================
        // El día que quieras lanzar los exámenes de la Universidad:
        // 1. Ponle doble diagonal // al inicio de la LÍNEA A para apagarla.
        // 2. Quítale la doble diagonal // a la LÍNEA B para encenderla.
        
        //const examenesHabilitados = data.filter(ex => ex.institucion.includes('ECOEMS')); // <-- LÍNEA A (Activada hoy)
         const examenesHabilitados = data; // <-- LÍNEA B (Activada en el futuro)
        // =========================================================

        const grupos = {};
        examenesHabilitados.forEach(ex => { if (!grupos[ex.institucion]) grupos[ex.institucion] = []; grupos[ex.institucion].push(ex); });

        select.innerHTML = '<option value="" disabled selected class="text-gray-400">Selecciona tu examen...</option>';
        for (const inst in grupos) {
            const optgroup = document.createElement('optgroup'); optgroup.label = `--- ${inst} ---`;
            grupos[inst].forEach(ex => {
                const option = document.createElement('option'); option.value = ex.token_hex; option.text = ex.descripcion; option.dataset.nombreExamen = `${inst} - ${ex.descripcion}`; optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        }
    } catch (err) {
        console.error("Error conectando a Supabase:", err);
        select.innerHTML = '<option value="" disabled selected class="text-red-400">Error de red. Recarga la página.</option>';
    }
}

// Función silenciosa para enviar correos
async function notificarPorCorreo(nombre, correo, pass, metodo, ref) {
    try {
        await _supabase.functions.invoke('notificaciones-email', {
            body: { alumno_nombre: nombre, alumno_email: correo, password: pass, metodo_pago: metodo, referencia: ref }
        });
    } catch(e) { console.log("Notificación en segundo plano:", e); }
}
