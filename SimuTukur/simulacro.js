// simulacro.js - Lógica de registro para el evento en vivo

document.addEventListener('DOMContentLoaded', () => {

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
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Asegurando lugar...';
            btn.disabled = true;

            const tutor = document.getElementById('nombreTutor').value.trim();
            const alumno = document.getElementById('nombreAlumno').value.trim();
            const correo = document.getElementById('correoTutor').value.trim();
            const telefono = document.getElementById('telefonoTutor').value.trim();
            
            // Extraemos el Token y el Nombre del Examen del select dinámico
            const selectExamen = document.getElementById('examenElegido');
            const tokenSeleccionado = selectExamen.value; 
            const nombreExamenFiltro = selectExamen.options[selectExamen.selectedIndex].dataset.nombreExamen;

            const dia = document.getElementById('diaElegido').value;

            const codigoPadrino = document.getElementById('codigoPadrino').value.trim().toUpperCase();
            const tomaCurso = document.getElementById('tomaCurso').value;
            const tipoCurso = document.getElementById('tipoCurso').value;
            const nombreEscuela = document.getElementById('nombreEscuela').value.trim();
            const objetivo = document.getElementById('objetivoSimulacro').value;

            try {
                // ==========================================
                // 1. GUARDADO EN SUPABASE
                // ==========================================
                const { error } = await _supabase.from('prospectos_simulacro').insert([
                    { 
                        nombre_tutor: tutor, 
                        nombre_alumno: alumno,
                        correo: correo, 
                        telefono: telefono,
                        examen: nombreExamenFiltro,
                        token_hex: tokenSeleccionado, // Guardamos el token exacto
                        dia_elegido: dia,
                        codigo_padrino: codigoPadrino,
                        toma_curso: tomaCurso,
                        tipo_curso: tipoCurso,
                        nombre_escuela: nombreEscuela,
                        objetivo_principal: objetivo 
                    }
                ]);

                if (error) throw error;

                // ==========================================
                // 2. DISPARADOR DE CORREO DE INSTRUCCIONES
                // ==========================================
                const { data: respuestaCorreo, error: errorCorreo } = await _supabase.functions.invoke('correo-simulacro', {
                    body: { 
                        tutor_nombre: tutor,
                        alumno_nombre: alumno, 
                        correo_destino: correo, 
                        examen_elegido: nombreExamenFiltro,
                        horario_elegido: dia
                    }
                });

                // Si choca, nos escupe el error en la cara
                if (errorCorreo) {
                    alert("⚠️ Falló el correo. El sistema dice: " + JSON.stringify(errorCorreo));
                    console.error("Error completo de correo:", errorCorreo);
                }

                // ==========================================
                // 3. ACTUALIZAR INTERFAZ AL ÉXITO (¡Esto faltaba!)
                // ==========================================
                document.getElementById('formSimulacro').classList.add('hidden');
                document.getElementById('mensajeExito').classList.remove('hidden');

                // ENCENDEMOS EL RELOJ
                iniciarCuentaRegresiva();

            } catch (err) {
                // ¡También faltaba cerrar el error principal de Supabase!
                console.error("Error en el registro:", err);
                alert("Hubo un error al registrarte. Verifica tus datos o intenta con otro correo.");
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
        btn.href = "tu_pagina_de_login.html"; 
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
