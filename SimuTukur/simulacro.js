// simulacro.js - Lógica de registro para el evento en vivo

document.addEventListener('DOMContentLoaded', () => {
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
            const examen = document.getElementById('examenElegido').value;
            const dia = document.getElementById('diaElegido').value;

            // ==========================================
            // 1. ASIGNACIÓN DE ENLACES DE GOOGLE MEET
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
                // 2. GUARDADO EN SUPABASE
                // ==========================================
                // Importante: Tu tabla 'prospectos_simulacro' debe tener las columnas:
                // nombre_tutor, nombre_alumno, correo, telefono, examen, dia_elegido
                const { error } = await _supabase.from('prospectos_simulacro').insert([
                    { 
                        nombre_tutor: tutor, 
                        nombre_alumno: alumno,
                        correo: correo, 
                        telefono: telefono,
                        examen: examen,
                        dia_elegido: dia 
                    }
                ]);

                if (error) throw error;

                // ==========================================
                // 3. ACTUALIZAR INTERFAZ AL ÉXITO
                // ==========================================
                document.getElementById('formSimulacro').classList.add('hidden');
                
                const linkElement = document.getElementById('linkMeet');
                linkElement.href = ligaOficialMeet;
                linkElement.innerText = ligaOficialMeet;
                
                document.getElementById('mensajeExito').classList.remove('hidden');

            } catch (err) {
                console.error("Error en el registro:", err);
                alert("Hubo un error al registrarte. Verifica tus datos o intenta con otro correo.");
                btn.innerHTML = '<i class="fa-solid fa-video mr-2"></i> RESERVAR MI LUGAR';
                btn.disabled = false;
            }
        });
    }
});
