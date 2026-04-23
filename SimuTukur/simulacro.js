// simulacro.js - Lógica de registro para el evento en vivo

document.addEventListener('DOMContentLoaded', () => {
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

            // ==========================================
            // ASIGNACIÓN DE ENLACES DE GOOGLE MEET
            // (Reemplaza estas URLs con las reales de tu calendario)
            // ==========================================
            let ligaOficialMeet = "";
            if (dia === "Sabado_10AM") {
                ligaOficialMeet = "https://meet.google.com/link-sabado-10am"; 
            } else if (dia === "Sabado_12PM") {
                ligaOficialMeet = "https://meet.google.com/link-sabado-12pm"; 
            } else if (dia === "Domingo_10AM") {
                ligaOficialMeet = "https://meet.google.com/link-domingo-10am"; 
            } else if (dia === "Domingo_12PM") {
                ligaOficialMeet = "https://meet.google.com/link-domingo-12pm"; 
            }

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
                        dia_elegido: dia 
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
                        horario_elegido: dia,
                        link_meet: ligaOficialMeet
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
                
                const linkElement = document.getElementById('linkMeet');
                linkElement.href = ligaOficialMeet;
                linkElement.innerText = ligaOficialMeet;
                
                document.getElementById('mensajeExito').classList.remove('hidden');

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
