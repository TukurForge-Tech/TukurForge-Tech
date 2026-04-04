// registro.js - Lógica de inscripción y pagos

let referenciaUnica = "";

// Función para generar clave aleatoria ST-XXXXX
function generarReferencia() {
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let codigo = "";
    for (let i = 0; i < 5; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    referenciaUnica = "ST-" + codigo;
    const refDisplay = document.getElementById('ref-display');
    if (refDisplay) refDisplay.innerText = referenciaUnica;
}

// Interceptar el envío del formulario
document.addEventListener("DOMContentLoaded", () => {
    generarReferencia();

    const form = document.getElementById('registroForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); // Evitar que la página recargue
            await procesarRegistro();
        });
    }
});

async function procesarRegistro() {
    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo archivo...';

    // Leer valores
    const tutor = document.getElementById('nombreTutor').value;
    const alumno = document.getElementById('nombreAlumno').value;
    const correo = document.getElementById('correo').value;
    const telefono = document.getElementById('telefono').value;
    const examen = document.getElementById('tipoExamen').value;
    const archivo = document.getElementById('comprobanteFile').files[0];

    if (!archivo) {
        alert("Por favor selecciona un archivo.");
        restaurarBoton(btn);
        return;
    }

    try {
        // 1. Crear nombre único para el archivo
        const fileExt = archivo.name.split('.').pop();
        const fileName = `${referenciaUnica}-${Date.now()}.${fileExt}`;

        // 2. Subir al Storage
        const { data: uploadData, error: uploadError } = await _supabase.storage
            .from('comprobantes')
            .upload(fileName, archivo);

        if (uploadError) throw new Error("Error al subir imagen. " + uploadError.message);

        // 3. Obtener URL pública
        const { data: publicUrlData } = _supabase.storage
            .from('comprobantes')
            .getPublicUrl(fileName);
        
        const urlArchivo = publicUrlData.publicUrl;

        // 4. Guardar en Base de Datos (Incluyendo Teléfono)
        const { error: dbError } = await _supabase.from('registro_pagos').insert({
            nombre_tutor: tutor,
            nombre_alumno: alumno,
            correo: correo,
            telefono: telefono,
            tipo_examen: examen,
            referencia_pago: referenciaUnica,
            comprobante_url: urlArchivo,
            terminos_aceptados: document.getElementById('checkLegal').checked
        });

        if (dbError) throw new Error("Error al guardar datos. " + dbError.message);

        // 5. Ocultar form y mostrar éxito
        document.getElementById('contenedor-formulario').classList.add('hidden');
        document.getElementById('ref-exito').innerText = referenciaUnica;
        document.getElementById('pantalla-exito').classList.remove('hidden');

    } catch (error) {
        console.error("Fallo de registro:", error);
        alert("Ocurrió un error al procesar el envío. Revisa tu conexión a internet o intenta subir una imagen menos pesada.");
        restaurarBoton(btn);
    }
}

function restaurarBoton(btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Enviar Comprobante';
}
