let referenciaUnica = "";
let metodoPago = "STRIPE"; // Por defecto

function generarReferencia() {
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let codigo = "ST-";
    for (let i = 0; i < 5; i++) codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    referenciaUnica = codigo;
    const refDisplay = document.getElementById('ref-display');
    if (refDisplay) refDisplay.innerText = referenciaUnica;
}

document.addEventListener("DOMContentLoaded", () => {
    generarReferencia();

    const form = document.getElementById('registroForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const btnAplicar = document.getElementById('btnAplicar');
    const inputPromo = document.getElementById('codigoPromo');

    // LÓGICA DE CUPONES
    btnAplicar.addEventListener('click', () => {
        const codigo = inputPromo.value.trim().toUpperCase();
        const msg = document.getElementById('msgPromo');
        
        if(codigo === 'VOCALES2026' || codigo === 'SCOUT20' || codigo === 'LANZAMIENTO10') {
            msg.innerText = "¡Cupón aplicado! Se ha activado el pago sin comisiones.";
            msg.classList.remove('hidden', 'text-red-400');
            msg.classList.add('text-green-400');
            
            // Cambiar Precios (Ejemplo visual del 20%)
            document.getElementById('precio-ecoems-old').classList.remove('hidden');
            document.getElementById('precio-ecoems').innerText = "$399";
            document.getElementById('precio-uni-old').classList.remove('hidden');
            document.getElementById('precio-uni').innerText = "$479";

            // Activar Modo Transferencia
            metodoPago = "TRANSFERENCIA";
            document.getElementById('area-transferencia').classList.remove('hidden');
            document.getElementById('area-archivo').classList.remove('hidden');
            document.getElementById('comprobanteFile').required = true;

            // Cambiar Botón
            btnSubmit.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Enviar Comprobante';
            btnSubmit.className = "w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 px-4 rounded-xl transition-all text-sm uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
        } else {
            msg.innerText = "Cupón inválido o expirado.";
            msg.classList.remove('hidden', 'text-green-400');
            msg.classList.add('text-red-400');
        }
        validarFormulario();
    });

    // Validación en tiempo real
    const validarFormulario = () => {
        btnSubmit.disabled = !form.checkValidity(); 
    };

    form.addEventListener('input', validarFormulario);
    form.addEventListener('change', validarFormulario);

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 
        await procesarRegistro();
    });
});

async function procesarRegistro() {
    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

    const tutor = document.getElementById('nombreTutor').value;
    const alumno = document.getElementById('nombreAlumno').value;
    const correo = document.getElementById('correo').value;
    const password = document.getElementById('password').value; // ¡NUEVO!
    const examen = document.getElementById('tipoExamen').value;
    const terminos = document.getElementById('checkLegal').checked;
    
    let urlArchivo = "PAGO_STRIPE";

    try {
        // SI ES TRANSFERENCIA: SUBIR FOTO
        if (metodoPago === "TRANSFERENCIA") {
            const archivo = document.getElementById('comprobanteFile').files[0];
            
            // LÍMITE DE 5MB
            if (archivo.size > 5 * 1024 * 1024) {
                alert("El archivo es muy pesado. Máximo 5MB.");
                throw new Error("Archivo muy grande");
            }

            const fileExt = archivo.name.split('.').pop();
            const fileName = `${referenciaUnica}-${Date.now()}.${fileExt}`;

            const { data, error: uploadError } = await _supabase.storage.from('comprobantes').upload(fileName, archivo);
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = _supabase.storage.from('comprobantes').getPublicUrl(fileName);
            urlArchivo = publicUrlData.publicUrl;
        }

        // 1. GUARDAR EN LA SALA DE ESPERA (registro_pagos)
        const { error: dbError } = await _supabase.from('registro_pagos').insert({
            nombre_tutor: tutor,
            nombre_alumno: alumno,
            correo: correo,
            tipo_examen: examen,
            referencia_pago: referenciaUnica,
            comprobante_url: urlArchivo,
            terminos_aceptados: terminos,
            estatus: metodoPago === "STRIPE" ? "Pendiente Stripe" : "Pendiente Transferencia"
        });

        if (dbError) throw dbError;

        // 2. DAR ACCESO INMEDIATO (Guardarlo en usuarios_membresias)
        // Le asignamos temporalmente tu token_hex de ECOEMS o UNAM
        let tokenAsignado = examen === "ECOEMS" ? "9c3e7f1b" : "e7b1f9d4"; // Cambia por tus tokens reales

        const { error: memberError } = await _supabase.from('usuarios_membresias').insert({
            nombre_tutor: tutor,
            nombre_alumno: alumno,
            email: correo,
            password_hijo: password, // Guarda su contraseña elegida
            token_hex: tokenAsignado,
            intentos_simulacro_restantes: 200
        });

        if (memberError) throw memberError;

        // 3. RUTEO FINAL
        if (metodoPago === "STRIPE") {
            // AQUÍ PONES TU LINK REAL DE STRIPE
            // Ejemplo: window.location.href = "https://buy.stripe.com/tu_link_secreto";
            alert("En esta fase, serías redirigido a Stripe para ingresar tu tarjeta.");
            mostrarExito(correo); // Por ahora simulamos que volvió de Stripe
        } else {
            mostrarExito(correo);
        }

    } catch (error) {
        console.error("Fallo:", error);
        btn.disabled = false;
        btn.innerHTML = metodoPago === "STRIPE" ? 'Pagar Seguro con Tarjeta' : 'Enviar Comprobante';
    }
}

function mostrarExito(correo) {
    document.getElementById('contenedor-formulario').classList.add('hidden');
    document.getElementById('area-transferencia').classList.add('hidden');
    document.getElementById('res-email').innerText = correo;
    document.getElementById('pantalla-exito').classList.remove('hidden');
}
