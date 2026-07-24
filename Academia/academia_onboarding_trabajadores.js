// ==========================================
// CONFIGURACIÓN DE SUPABASE Y APIS
// ==========================================

// Variables globales para guardar la sesión
let trabajadorGlobalId = null;
let trabajadorGlobalNombre = null;
let trabajadorGlobalEmail = null;

// ==========================================
// 1. LÓGICA DE LOGIN (API 1)
// ==========================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    const errorDiv = document.getElementById('loginError');
    const correo = document.getElementById('correo').value;
    const password = document.getElementById('password').value;

    btn.disabled = true;
    btn.textContent = "Verificando...";
    errorDiv.textContent = "";

    try {
        const respuesta = await fetch(`${supabaseUrl}/functions/v1/login-trabajadores`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}` 
            },
            body: JSON.stringify({ correo, password })
        });

        const data = await respuesta.json();

        if (!respuesta.ok) throw new Error(data.error || "Credenciales incorrectas");

        // Login exitoso: Guardamos sus datos y mostramos el formulario
        trabajadorGlobalId = data.id;
        trabajadorGlobalEmail = correo;
        
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('expedienteSection').style.display = 'block';

    } catch (error) {
        errorDiv.textContent = error.message;
        btn.disabled = false;
        btn.textContent = "Ingresar al Portal";
    }
});

// ==========================================
// 2. VALIDACIÓN DE ARCHIVOS
// ==========================================
document.getElementById('onboardingForm').addEventListener('input', function() {
    const btn = document.getElementById('btnSubmit');
    btn.disabled = !this.checkValidity();
});

function validarArchivo(archivo) {
    if (!archivo) return false;
    const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB
    const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

    if (archivo.size > TAMANO_MAXIMO) throw new Error(`El archivo ${archivo.name} pesa más de 5MB.`);
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) throw new Error(`El formato de ${archivo.name} no es válido.`);
    
    return true;
}

// ==========================================
// 3. LÓGICA DE SUBIDA DE EXPEDIENTE
// ==========================================
document.getElementById('onboardingForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('btnSubmit');
    const loadingStatus = document.getElementById('loadingStatus');
    
    btn.style.display = 'none';
    loadingStatus.style.display = 'block';

    const valNombre = document.getElementById('nombre').value;
    const valSegundosNombres = document.getElementById('segundos_nombres').value;
    const valPrimerApellido = document.getElementById('primer_apellido').value;
    const valSegundoApellido = document.getElementById('segundo_apellido').value;

    trabajadorGlobalNombre = `${valNombre} ${valPrimerApellido}`;

    try {
        const fileId = document.getElementById('fileId').files[0];
        const fileTax = document.getElementById('fileTax').files[0];
        const fileAddress = document.getElementById('fileAddress').files[0];
        const fileBank = document.getElementById('fileBank').files[0];
        const fileEstudios = document.getElementById('fileEstudios').files[0];
        const fileRecLaboral = document.getElementById('fileRecLaboral').files[0];
        const fileRecPersonal = document.getElementById('fileRecPersonal').files[0];

        validarArchivo(fileId);
        validarArchivo(fileTax);
        validarArchivo(fileAddress);
        validarArchivo(fileBank);
        validarArchivo(fileEstudios);
        validarArchivo(fileRecLaboral);
        validarArchivo(fileRecPersonal);

        const subirArchivo = async (archivo, nombreEstandar) => {
            const extension = archivo.name.split('.').pop();
            const rutaFinal = `${trabajadorGlobalId}/${nombreEstandar}.${extension}`;

            const { data, error } = await _supabase.storage
                .from('expedientes')
                .upload(rutaFinal, archivo, { upsert: true });

            if (error) throw new Error(`Error al subir ${nombreEstandar}: ` + error.message);
            
            const { data: urlData } = _supabase.storage.from('expedientes').getPublicUrl(rutaFinal);
            return urlData.publicUrl;
        };

        loadingStatus.innerHTML = "<p>Subiendo documentos seguros...</p>";
        const [link_id, link_csf, link_dom, link_ban, link_est, link_rec_lab, link_rec_per] = await Promise.all([
            subirArchivo(fileId, 'identificacion_oficial'),
            subirArchivo(fileTax, 'csf'),
            subirArchivo(fileAddress, 'domicilio'),
            subirArchivo(fileBank, 'caratula_bancaria'),
            subirArchivo(fileEstudios, 'comprobante_estudios'),
            subirArchivo(fileRecLaboral, 'recomendacion_laboral'),
            subirArchivo(fileRecPersonal, 'recomendacion_personal')
        ]);

        loadingStatus.innerHTML = "<p>Registrando expediente en el sistema...</p>";

        const bancoSeleccionado = document.getElementById('banco_nombre').value.trim().toUpperCase();
        const regimenSeleccionado = document.getElementById('regimen_contratacion').value;
        
        const resGuardar = await fetch(`${supabaseUrl}/functions/v1/guardar-expediente`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({
                trabajador_id: trabajadorGlobalId,
                nombre: valNombre,                          
                segundos_nombres: valSegundosNombres,       
                primer_apellido: valPrimerApellido,         
                segundo_apellido: valSegundoApellido,
                direccion: document.getElementById('address').value,
                rfc: document.getElementById('rfc').value,
                clabe: document.getElementById('clabe').value,
                banco_nombre: bancoSeleccionado,           
                regimen_contratacion: regimenSeleccionado,
                urls: {
                    ine_url: link_id, 
                    csf_url: link_csf,
                    domicilio_url: link_dom,
                    banco_url: link_ban,
                    estudios_url: link_est,
                    recomendacion_laboral_url: link_rec_lab,
                    recomendacion_personal_url: link_rec_per
                },
                aviso_privacidad: document.getElementById('privacy').checked
            })
        });

        if (!resGuardar.ok) throw new Error("Ocurrió un error al guardar los datos en el servidor.");

        loadingStatus.innerHTML = "<p>Enviando correos de confirmación...</p>";

        await fetch(`${supabaseUrl}/functions/v1/notificar-onboarding`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}` 
            },
            body: JSON.stringify({
                trabajador_nombre: trabajadorGlobalNombre,
                trabajador_email: trabajadorGlobalEmail
            })
        });

        document.getElementById('onboardingForm').style.display = 'none';
        loadingStatus.style.display = 'none';
        document.getElementById('successStatus').style.display = 'block';

    } catch (error) {
        alert("Ocurrió un problema: " + error.message);
        btn.style.display = 'block';
        loadingStatus.style.display = 'none';
    }
});