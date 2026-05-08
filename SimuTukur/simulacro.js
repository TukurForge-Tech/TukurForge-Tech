// simulacro.js - Lógica de registro para el evento en vivo

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 🛡️ GUARDIA DE SEGURIDAD (CIERRE DE PUERTAS)
    // ==========================================
    // Fecha y hora de corte (Ej: Sábado 16 de Mayo a las 10:15 AM)
    const fechaCorte = new Date('May 16, 2026 10:15:00').getTime();
    const ahora = new Date().getTime();

    if (ahora > fechaCorte) {
        // Ocultamos el formulario y cualquier panel de pago si estaban visibles
        if(document.getElementById('formSimulacro')) document.getElementById('formSimulacro').classList.add('hidden');
        if(document.getElementById('panelPago58')) document.getElementById('panelPago58').classList.add('hidden');
        
        // Mostramos el letrero rojo de cerrado
        document.getElementById('mensajeCerrado').classList.remove('hidden');
        
        // Detenemos la ejecución del resto del código para que no cargue exámenes ni nada
        return; 
    }

    // ==========================================
    // 🛬 ATERRIZAJE DESDE STRIPE (PAGO EXITOSO)
    // ==========================================
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pago_simulacro') === 'exito') {
        const refPago = urlParams.get('ref');
        const datosStr = sessionStorage.getItem('datosRegistroPendiente');

        if (datosStr && refPago) {
            // 1. Ocultamos el formulario inmediatamente para que no lo vean
            if(document.getElementById('formSimulacro')) document.getElementById('formSimulacro').classList.add('hidden');
            if(document.getElementById('panelPago58')) document.getElementById('panelPago58').classList.add('hidden');
            
            // 2. Procesamos el guardado de forma asíncrona
            (async () => {
                const datos = JSON.parse(datosStr);
                try {
                    // Guardamos al prospecto (codigo_padrino va vacío)
                    await _supabase.from('prospectos_simulacro').insert([{
                        nombre_tutor: datos.tutor, nombre_alumno: datos.alumno, correo: datos.correo,
                        telefono: datos.telefono, examen: datos.examen, token_hex: datos.token_hex,
                        dia_elegido: datos.dia_elegido, codigo_padrino: '', 
                        toma_curso: datos.toma_curso, tipo_curso: datos.tipo_curso, 
                        nombre_escuela: datos.nombre_escuela, objetivo_principal: datos.objetivo_principal
                    }]);

                    // Guardamos el recibo financiero en la tabla satélite
                    await _supabase.from('pagos_simulacro').insert([{
                        correo_alumno: datos.correo, referencia_pago: refPago, monto: 58.00
                    }]);

                    // Disparamos su correo
                    await _supabase.functions.invoke('correo-simulacro', {
                        body: { tutor_nombre: datos.tutor, alumno_nombre: datos.alumno, correo_destino: datos.correo, examen_elegido: datos.examen, horario_elegido: datos.dia_elegido }
                    });

                    // Limpiamos la memoria
                    sessionStorage.removeItem('datosRegistroPendiente');
                    
                    // Mostramos el éxito y encendemos el reloj
                    document.getElementById('mensajeExito').classList.remove('hidden');
                    iniciarCuentaRegresiva();

                    // Limpiamos la URL para que no se vea fea y si recargan no se duplique
                    window.history.replaceState({}, document.title, window.location.pathname);

                } catch(err) {
                    console.error("Error guardando tu pago:", err);
                    alert("Tu pago se procesó, pero hubo un error de conexión al guardar tu lugar. Toma captura de tu recibo de Stripe y contáctanos al WhatsApp de soporte.");
                }
            })();
            
            // Cortamos aquí la ejecución para que no intente cargar nada más del formulario
            return; 
        }
    }

    // Mostrar/Ocultar detalles del curso
    const tomaCursoSelect = document.getElementById('tomaCurso');
    const detallesCursoDiv = document.getElementById('detallesCurso');

    if (tomaCursoSelect) {
        tomaCursoSelect.addEventListener('change', (e) => {
            if (e.target.value === 'si') {
                detallesCursoDiv.classList.remove('hidden');
                detallesCursoDiv.classList.add('grid');
            } else {
                detallesCursoDiv.classList.add('hidden');
                detallesCursoDiv.classList.remove('grid');
                document.getElementById('tipoCurso').value = "";
                document.getElementById('nombreEscuela').value = "";
            }
        });
    }

    // 1. Cargamos los exámenes desde la BD al abrir la página
    cargarExamenesBD();

    const form = document.getElementById('formSimulacro');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btnRegistro');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Procesando...';
            btn.disabled = true;

            // Recolección de datos
            const tutor = document.getElementById('nombreTutor').value.trim();
            const alumno = document.getElementById('nombreAlumno').value.trim();
            const correo = document.getElementById('correoTutor').value.trim();
            const telefono = document.getElementById('telefonoTutor').value.trim();
            const selectExamen = document.getElementById('examenElegido');
            const tokenSeleccionado = selectExamen.value; 
            const nombreExamenFiltro = selectExamen.options[selectExamen.selectedIndex].dataset.nombreExamen;
            const dia = document.getElementById('diaElegido').value;
            
            const codigoPadrinoInput = document.getElementById('codigoPadrino').value.trim().toUpperCase();
            const tomaCurso = document.getElementById('tomaCurso').value;
            const tipoCurso = document.getElementById('tipoCurso').value;
            const nombreEscuela = document.getElementById('nombreEscuela').value.trim();
            const objetivo = document.getElementById('objetivoSimulacro').value;

            // 🔍 VALIDACIÓN ANTI-DUPLICADOS
            const { data: yaExiste } = await _supabase
                .from('prospectos_simulacro')
                .select('correo')
                .eq('correo', correo)
                .maybeSingle();

            if (yaExiste) {
                alert("Este correo ya está registrado para el simulacro.");
                btn.innerHTML = '<i class="fa-solid fa-video mr-2"></i> RESERVAR MI LUGAR';
                btn.disabled = false;
                return; // Detiene el registro
            }

            try {
                let esRegistroPagado = false;

                // ==========================================
                // 1. VALIDACIÓN DEL CÓDIGO DEL DIPUTADO
                // ==========================================
                if (codigoPadrinoInput !== "") {
                    // Buscamos el código en la BD
                    const { data: codigoBD, error: errorCodigo } = await _supabase
                        .from('codigos_padrinos')
                        .select('*')
                        .eq('codigo', codigoPadrinoInput)
                        .single();

                    // Si no existe o no está activo
                    if (errorCodigo || !codigoBD || !codigoBD.activo) {
                        alert("❌ El código de beca ingresado no es válido o ya expiró.");
                        btn.innerHTML = '<i class="fa-solid fa-video mr-2"></i> RESERVAR MI LUGAR';
                        btn.disabled = false;
                        return; // Detenemos el registro
                    }

                    // Si ya se acabaron los lugares de ese diputado
                    if (codigoBD.usos_actuales >= codigoBD.limite_usos) {
                        alert("⚠️ Los lugares gratuitos para este código se han agotado. Puedes registrarte sin código cubriendo la cuota de recuperación.");
                        btn.innerHTML = '<i class="fa-solid fa-video mr-2"></i> RESERVAR MI LUGAR';
                        btn.disabled = false;
                        return; // Detenemos el registro
                    }

                    // Si todo está bien, actualizamos el contador de usos sumando 1
                    await _supabase.from('codigos_padrinos')
                        .update({ usos_actuales: codigoBD.usos_actuales + 1 })
                        .eq('id', codigoBD.id);

                } else {
                    // ==========================================
                    // 2. FLUJO SIN CÓDIGO (COBRO DE $58 PESOS)
                    // ==========================================
                    esRegistroPagado = true;
                    
                    // Aquí detenemos el flujo para mostrar las opciones de pago
                    document.getElementById('formSimulacro').classList.add('hidden');
                    document.getElementById('panelPago58').classList.remove('hidden');
                    
                    // Guardamos temporalmente los datos en el navegador para cuando regresen de Stripe
                    sessionStorage.setItem('datosRegistroPendiente', JSON.stringify({
                        tutor, alumno, correo, telefono, examen: nombreExamenFiltro, 
                        token_hex: tokenSeleccionado, dia_elegido: dia, 
                        toma_curso: tomaCurso, tipo_curso: tipoCurso, 
                        nombre_escuela: nombreEscuela, objetivo_principal: objetivo
                    }));

                    // Cortamos la ejecución aquí, no guardamos en la BD hasta que paguen
                    return; 
                }

                // ==========================================
                // 3. GUARDADO DIRECTO (SÓLO SI TIENEN CÓDIGO VÁLIDO)
                // ==========================================
                const { error: insertError } = await _supabase.from('prospectos_simulacro').insert([{ 
                    nombre_tutor: tutor, nombre_alumno: alumno, correo: correo, telefono: telefono,
                    examen: nombreExamenFiltro, token_hex: tokenSeleccionado, dia_elegido: dia,
                    codigo_padrino: codigoPadrinoInput, toma_curso: tomaCurso, tipo_curso: tipoCurso,
                    nombre_escuela: nombreEscuela, objetivo_principal: objetivo
                }]);

                if (insertError) throw insertError;

                // DISPARADOR DE CORREO Y PANTALLA DE ÉXITO
                await _supabase.functions.invoke('correo-simulacro', {
                    body: { tutor_nombre: tutor, alumno_nombre: alumno, correo_destino: correo, examen_elegido: nombreExamenFiltro, horario_elegido: dia }
                });

                document.getElementById('formSimulacro').classList.add('hidden');
                document.getElementById('mensajeExito').classList.remove('hidden');
                iniciarCuentaRegresiva();

            } catch (err) {
                console.error("Error en el registro:", err);
                alert("Hubo un error al registrarte. Verifica tu conexión.");
                btn.innerHTML = '<i class="fa-solid fa-video mr-2"></i> RESERVAR MI LUGAR';
                btn.disabled = false;
            }
        });
    }
});

// Función para jalar los exámenes de la BD dinámicamente
async function cargarExamenesBD() {
    const select = document.getElementById('examenElegido');
    try {
        const { data, error } = await _supabase
            .from('config_examenes')
            .select('token_hex, institucion, descripcion')
            .eq('plan', 'PRO')
            .order('institucion', { ascending: true })
            .order('descripcion', { ascending: true });
            
        if (error) throw error;
        
        if (!data || data.length === 0) { 
            select.innerHTML = '<option value="" disabled selected class="text-gray-400">No hay exámenes disponibles</option>'; 
            return; 
        }

        // Filtramos para jalar ECOEMS, UNAM e IPN
        const examenesHabilitados = data.filter(ex => ['ECOEMS', 'UNAM', 'IPN'].includes(ex.institucion));

        const grupos = {};
        examenesHabilitados.forEach(ex => { 
            if (!grupos[ex.institucion]) grupos[ex.institucion] = []; 
            grupos[ex.institucion].push(ex); 
        });

        select.innerHTML = '<option value="" disabled selected class="text-gray-400">Selecciona tu examen...</option>';
        
        for (const inst in grupos) {
            const optgroup = document.createElement('optgroup'); 
            optgroup.label = `--- ${inst} ---`;

            grupos[inst].forEach(ex => {
                const option = document.createElement('option'); 
                option.value = ex.token_hex; // El value real es el código Hex
                
                let descripcionCorta = ex.descripcion;
                if(inst === 'UNAM' && ex.descripcion.includes('-')) {
                    descripcionCorta = ex.descripcion.split('-')[0].trim();
                } else if(inst === 'ECOEMS') {
                    descripcionCorta = "GENERAL";
                }

                option.text = descripcionCorta; 
                option.className = "text-white bg-black";
                option.dataset.nombreExamen = `${inst} - ${ex.descripcion}`; // Guardamos el nombre legible
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        }
    } catch (err) {
        console.error("Error conectando a Supabase:", err);
        select.innerHTML = '<option value="" disabled selected class="text-red-400">Error de red. Recarga la página.</option>';
    }
}

// ==========================================
// MOTOR DE CUENTA REGRESIVA PARA EL EXAMEN
// ==========================================

function iniciarCuentaRegresiva() {
    // 🎯 FECHA EXACTA DEL EVENTO (Sábado 16 de Mayo de 2026 a las 10:00:00 AM)
    const fechaExamen = new Date('May 16, 2026 10:00:00').getTime();

    const intervalo = setInterval(() => {
        const ahora = new Date().getTime();
        const distancia = fechaExamen - ahora;

        // Cálculos matemáticos de tiempo
        const dias = Math.floor(distancia / (1000 * 60 * 60 * 24));
        const horas = Math.floor((distancia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((distancia % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((distancia % (1000 * 60)) / 1000);

        const contadorEl = document.getElementById('contadorTimer');
        
        // Si aún falta tiempo, pintamos el reloj
        if (distancia > 0) {
            if(contadorEl) {
                // Le damos formato 00d 00h 00m 00s
                contadorEl.innerHTML = `${dias}d ${horas}h ${minutos}m ${segundos}s`;
            }
        } else {
            // ¡EL TIEMPO LLEGÓ A CERO! Desbloqueamos todo y detenemos el reloj
            clearInterval(intervalo);
            desbloquearBotonExamen();
        }
    }, 1000); // Se actualiza cada segundo
}

function desbloquearBotonExamen() {
    const btn = document.getElementById('btnExamen');
    const badge = document.getElementById('badgeEstado');
    const icono = document.getElementById('iconoExamen');
    const textoAdv = document.getElementById('textoAdvertencia');
    const contador = document.getElementById('contadorTimer');

    if(btn) {
        // Le quitamos lo gris y bloqueado, y le ponemos el diseño activo
        btn.classList.remove('bg-gray-800', 'text-gray-500', 'cursor-not-allowed', 'border-gray-700', 'pointer-events-none');
        btn.classList.add('bg-cyan-600', 'text-white', 'cursor-pointer', 'border-cyan-400', 'hover:bg-cyan-500', 'shadow-[0_0_15px_rgba(6,182,212,0.6)]');
        
        // 🔗 AQUÍ PONES LA LIGA REAL DE TU EXAMEN
        btn.href = "https://simutukur.tukurforge.com/acceso_piloto"; 
        btn.target = "_blank";
    }

    if(badge) {
        badge.classList.remove('bg-gray-700', 'text-gray-400');
        badge.classList.add('bg-green-500', 'text-white', 'animate-pulse');
        badge.innerText = "¡ABIERTO!";
    }

    if(icono) {
        icono.classList.add('animate-bounce', 'text-green-300');
    }

    if(textoAdv) {
        textoAdv.classList.remove('text-yellow-500');
        textoAdv.classList.add('text-green-400');
        textoAdv.innerHTML = '<i class="fa-solid fa-door-open mr-1"></i> ¡Las puertas están abiertas! Ya puedes ingresar al simulador.';
    }

    if(contador) {
        contador.style.display = 'none'; // Escondemos el reloj porque ya empezó
    }
}

// ==========================================
// CONEXIÓN SEGURA CON STRIPE (EDGE FUNCTION)
// ==========================================
async function llamarApiStripe() {
    const btn = document.getElementById('btnStripePago');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-3"></i> Encriptando sesión...';
    btn.disabled = true;

    // Recuperamos los datos del alumno que dejamos en pausa
    const datosStr = sessionStorage.getItem('datosRegistroPendiente');
    if (!datosStr) {
        alert("Sesión expirada. Por favor, llena el formulario nuevamente.");
        window.location.reload();
        return;
    }
    const datos = JSON.parse(datosStr);

    try {
        // Disparamos tu API blindada
        const { data, error } = await _supabase.functions.invoke('stripe-checkout', {
            body: { 
                tipo_examen: 'SIMULACRO_VIVO', // El nombre que pusimos en el TypeScript
                correo: datos.correo,
                nombre_alumno: datos.alumno,
                referencia_pago: `SIMU-${Date.now()}`, // Folio único para rastearlo
                es_recarga: false,
                tutor: datos.tutor,
                telefono: datos.telefono,
                dia_elegido: datos.dia_elegido,
                toma_curso: datos.toma_curso,
                tipo_curso: datos.tipo_curso,
                nombre_escuela: datos.nombre_escuela,
                objetivo: datos.objetivo_principal
            }
        });

        if (error) throw error;
        
        // Si la API nos devuelve la URL encriptada, lo mandamos a la caja de cobro
        if (data?.url) {
            window.location.href = data.url; 
        } else {
            throw new Error("No se generó la URL de pago");
        }

    } catch (err) {
        console.error("Error conectando con la bóveda de Stripe:", err);
        alert("Tuvimos un problema al conectar con el banco. Intenta en un momento.");
        btn.innerHTML = '<i class="fa-brands fa-stripe text-3xl mr-3"></i> Pagar $58 MXN de forma segura';
        btn.disabled = false;
    }
}
