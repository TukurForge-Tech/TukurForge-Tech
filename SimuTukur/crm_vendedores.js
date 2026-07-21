let correoEnProceso = "";
const FLUJO_VENTAS = ['Registrado', 'Comunicación', 'Con Cita', 'Presentación', 'Seguimiento', 'Firmado'];

window.onload = function() {
    const sesionActiva = localStorage.getItem('sesion_crm_token'); 
    if (sesionActiva) {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('perfil-nombre').innerText = localStorage.getItem('sesion_crm_nombre');
        document.getElementById('perfil-correo').innerText = localStorage.getItem('sesion_crm_correo');
        document.getElementById('app-container').classList.remove('hidden');
        cargarProspectos();
    }
};

function copiarCorreo() {
    const correo = document.getElementById('perfil-correo').innerText;
    navigator.clipboard.writeText(correo);
    alert("¡Correo copiado al portapapeles! Ya puedes pegarlo en Lark.");
}

// ==========================================
// LOGIN Y SEGURIDAD
// ==========================================
async function iniciarSesion() {
    const codigo_empleado = document.getElementById('codigoEmpleado').value.toUpperCase();
    const password = document.getElementById('userPass').value;
    if(!codigo_empleado || !password) return alert("Llena ambos campos");

    try {
        const respuesta = await fetch(`${supabaseUrl}/functions/v1/auth_crm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ accion: 'login', codigo_empleado, password })
        });
        const data = await respuesta.json();

        if (data.success) {
            document.getElementById('login-overlay').classList.add('hidden');
            if (data.requiereCambio) {
                correoEnProceso = data.correo;
                document.getElementById('change-password-overlay').classList.remove('hidden');
            } else {
                localStorage.setItem('sesion_crm_token', data.usuarioId);
                localStorage.setItem('sesion_crm_nombre', data.nombreCompleto);
                localStorage.setItem('sesion_crm_correo', data.correoCorporativo);
                
                document.getElementById('perfil-nombre').innerText = data.nombreCompleto;
                document.getElementById('perfil-correo').innerText = data.correoCorporativo;
                document.getElementById('app-container').classList.remove('hidden');
                cargarProspectos();
            }
        } else {
            alert(data.mensaje);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Hubo un error al conectar con el servidor.");
    }
}

async function guardarNuevaPassword() {
    const p1 = document.getElementById('newPass1').value;
    const p2 = document.getElementById('newPass2').value;
    if (p1 !== p2 || p1.length < 6) return alert("Contraseñas no coinciden o son muy cortas.");

    try {
        const respuesta = await fetch(`${supabaseUrl}/functions/v1/auth_crm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ accion: 'cambiar_password', correo: correoEnProceso, nuevaPassword: p1 })
        });
        const data = await respuesta.json();
        if (data.success) {
            alert("Contraseña actualizada. Inicia sesión de nuevo.");
            location.reload();
        }
    } catch (error) { console.error(error); }
}

// ==========================================
// OPERACIONES DEL PIPELINE Y REGLAS DE ESTATUS
// ==========================================
async function cargarProspectos() {
    const vendedorId = localStorage.getItem('sesion_crm_token');
    const tbody = document.getElementById('tabla-prospectos');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Cargando...</td></tr>';

    try {
        const respuesta = await fetch(`${supabaseUrl}/functions/v1/control_prospectos_escuelas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ accion: 'listar_prospectos', vendedor_id: vendedorId })
        });
        const resData = await respuesta.json();
        if (!resData.success) throw new Error(resData.error);
        
        const data = resData.data;
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Aún no tienes prospectos registrados.</td></tr>';
            return;
        }

        data.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.nombre_escuela}</strong></td>
                <td>${p.nivel_educativo}</td>
                <td>${p.fecha_proximo_contacto || '-'}</td>
                <td>
                    <select onchange="actualizarEstatus('${p.id}', this.value)" 
                            style="width:100%; padding: 5px; font-size: 12px; border-radius: 4px; ${p.estatus === 'Firmado' ? 'background: #d1fae5; pointer-events: none;' : ''}">
                        ${generarOpcionesEstatus(p.estatus)}
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) { console.error(err); tbody.innerHTML = '<tr><td colspan="4" style="color:red;">Error cargando pipeline</td></tr>'; }
}

function generarOpcionesEstatus(estatusActual) {
    let opciones = '';
    const indexActual = FLUJO_VENTAS.indexOf(estatusActual);

    if (!FLUJO_VENTAS.includes(estatusActual) && estatusActual !== 'En Pausa') {
        return `<option value="${estatusActual}" selected>${estatusActual}</option>`;
    }

    FLUJO_VENTAS.forEach((estatus, idx) => {
        let disabled = "";
        if (estatusActual === 'En Pausa' && estatus !== 'Firmado') disabled = "disabled";
        if (estatusActual !== 'En Pausa' && idx < indexActual) disabled = "disabled";
        opciones += `<option value="${estatus}" ${estatus === estatusActual ? 'selected' : ''} ${disabled}>${estatus}</option>`;
    });

    opciones += `<option value="En Pausa" ${estatusActual === 'En Pausa' ? 'selected' : ''}>En Pausa</option>`;
    return opciones;
}

async function actualizarEstatus(idProspecto, nuevoEstatus) {
    try {
        const respuesta = await fetch(`${supabaseUrl}/functions/v1/control_prospectos_escuelas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ accion: 'actualizar_estatus', payload: { id_prospecto: idProspecto, nuevo_estatus: nuevoEstatus } })
        });
        const data = await respuesta.json();
        if (!data.success) throw new Error(data.error);
        cargarProspectos(); 
    } catch (err) { alert("Error al actualizar estatus"); console.error(err); }
}

// ==========================================
// FUSIÓN: LÓGICA DE ALTA Y MATRÍCULA DINÁMICA
// ==========================================
function manejarNivelEducativo() {
    const nivel = document.getElementById('nivelEducativo').value;
    const contenedor = document.getElementById('contenedor-matricula');
    contenedor.innerHTML = '';
    contenedor.classList.remove('hidden');

    if (nivel === 'Secundaria' || nivel === 'Preparatoria') {
        contenedor.innerHTML = `
            <label>Matrícula Estimada de Alumnos</label>
            <input type="number" id="matUnica" placeholder="Ej. 300">
        `;
    } else if (nivel === 'Ambas') {
        contenedor.innerHTML = `
            <div style="display: flex; gap: 10px;">
                <div style="flex: 1;">
                    <label>Alumnos Secundaria</label>
                    <input type="number" id="matSecundaria" placeholder="Ej. 150">
                </div>
                <div style="flex: 1;">
                    <label>Alumnos Prepa</label>
                    <input type="number" id="matPrepa" placeholder="Ej. 200">
                </div>
            </div>
        `;
    } else {
        contenedor.classList.add('hidden');
    }
}

async function guardarProspecto() {
    const nombre = document.getElementById('nombreEscuela').value;
    const nivel = document.getElementById('nivelEducativo').value;
    const fecha = document.getElementById('fechaContacto').value;
    
    if (!nombre || !nivel || !fecha) return alert("Completa los datos básicos.");

    let matSec = 0, matPrep = 0;
    if (nivel === 'Secundaria') matSec = parseInt(document.getElementById('matUnica').value) || 0;
    if (nivel === 'Preparatoria') matPrep = parseInt(document.getElementById('matUnica').value) || 0;
    if (nivel === 'Ambas') {
        matSec = parseInt(document.getElementById('matSecundaria').value) || 0;
        matPrep = parseInt(document.getElementById('matPrepa').value) || 0;
    }

    const payload = {
        vendedor_id: localStorage.getItem('sesion_crm_token'),
        nombre_escuela: nombre,
        nivel_educativo: nivel,
        fecha_proximo_contacto: fecha,
        matricula_secundaria: matSec,
        matricula_preparatoria: matPrep,
        estatus: 'Registrado'
    };

    try {
        const respuesta = await fetch(`${supabaseUrl}/functions/v1/control_prospectos_escuelas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ accion: 'guardar_prospecto', payload: payload })
        });
        const data = await respuesta.json();
        if (!data.success) throw new Error(data.error);
        
        alert("Prospecto registrado en tu Pipeline.");
        document.getElementById('modal-alta').classList.add('hidden');
        document.getElementById('nombreEscuela').value = '';
        document.getElementById('fechaContacto').value = '';
        document.getElementById('contenedor-matricula').classList.add('hidden');
        cargarProspectos(); 
    } catch(err) { alert("Error al guardar."); console.error(err); }
}

// ==========================================
// MÓDULO: EXPEDIENTE DE RECURSOS HUMANOS
// ==========================================
const documentosRH = [
    { id: 'ine', nombre: 'INE (Frente y Vuelta)', colUrl: 'ine_url', colEstatus: 'estatus_ine', colMotivo: 'motivo_ine' },
    { id: 'csf', nombre: 'Constancia Situación Fiscal', colUrl: 'csf_url', colEstatus: 'estatus_csf', colMotivo: 'motivo_csf' },
    { id: 'domicilio', nombre: 'Comprobante de Domicilio', colUrl: 'domicilio_url', colEstatus: 'estatus_domicilio', colMotivo: 'motivo_domicilio' },
    { id: 'banco', nombre: 'Estado de Cuenta (CLABE)', colUrl: 'banco_url', colEstatus: 'estatus_banco', colMotivo: 'motivo_banco' },
    { id: 'estudios', nombre: 'Comprobante de Estudios', colUrl: 'estudios_url', colEstatus: 'estatus_estudios', colMotivo: 'motivo_estudios' },
    { id: 'rec_laboral', nombre: 'Recomendación Laboral', colUrl: 'recomendacion_laboral_url', colEstatus: 'estatus_recomendacion_laboral', colMotivo: 'motivo_recomendacion_laboral' },
    { id: 'rec_personal', nombre: 'Recomendación Personal', colUrl: 'recomendacion_personal_url', colEstatus: 'estatus_recomendacion_personal', colMotivo: 'motivo_recomendacion_personal' }
];

// ==========================================
// MÓDULO: EXPEDIENTE DE RECURSOS HUMANOS (Actualizado a API)
// ==========================================
async function cargarExpediente() {
    const trabajadorId = localStorage.getItem('sesion_crm_token');
    const contenedor = document.getElementById('contenedor-documentos');
    contenedor.innerHTML = '<p>Analizando archivo maestro...</p>';

    try {
        const respuesta = await fetch(`${supabaseUrl}/functions/v1/control_prospectos_escuelas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ accion: 'cargar_expediente', vendedor_id: trabajadorId })
        });
        
        const resData = await respuesta.json();
        if (!resData.success) throw new Error(resData.error);
        
        const data = resData.data;
        contenedor.innerHTML = '';
        
        documentosRH.forEach(doc => {
            const estatus = data[doc.colEstatus] || 'Faltante';
            const motivo = data[doc.colMotivo] ? `<p class="motivo-rechazo">⚠️ ${data[doc.colMotivo]}</p>` : '';
            const url = data[doc.colUrl];
            
            let badgeClass = 'badge-faltante';
            if(estatus === 'Aprobado') badgeClass = 'badge-aprobado';
            if(estatus === 'Rechazado') badgeClass = 'badge-rechazado';
            if(estatus === 'En Revisión') badgeClass = 'badge-revision';

            let controles = '';
            if (estatus === 'Aprobado' || estatus === 'En Revisión') {
                controles = `<button class="btn" style="background:#0891b2; width:100%; font-size:12px; padding:6px;" onclick="window.open('https://pcuopqvmucmhtcdeswxh.supabase.co/storage/v1/object/public/expedientes/${url}', '_blank')">👀 Ver Archivo Entregado</button>`;
            } else {
                controles = `
                    <input type="file" id="file_${doc.id}" accept=".pdf, .jpg, .png" style="font-size: 11px; color: white; width: 100%; margin-bottom: 8px;">
                    <button class="btn btn-success" style="font-size: 12px; width: 100%; padding: 6px;" onclick="subirDocumento(this, '${doc.id}', '${doc.colUrl}', '${doc.colEstatus}')">⬆️ Subir Documento</button>
                `;
            }

            const tarjeta = document.createElement('div');
            tarjeta.className = 'doc-card';
            tarjeta.innerHTML = `
                <div style="display:flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <strong style="font-size: 13px; max-width: 65%;">${doc.nombre}</strong>
                    <span class="${badgeClass}">${estatus}</span>
                </div>
                ${motivo}
                <div style="margin-top: 15px;">${controles}</div>
            `;
            contenedor.appendChild(tarjeta);
        });

    } catch (err) { console.error(err); contenedor.innerHTML = '<p style="color:red;">Error de conexión con RH.</p>'; }
}

async function subirDocumento(btnElement, docId, colUrl, colEstatus) {
    const inputElement = document.getElementById(`file_${docId}`);
    const file = inputElement.files[0];
    if (!file) return alert("Selecciona un archivo primero.");

    const trabajadorId = localStorage.getItem('sesion_crm_token');
    const fileExt = file.name.split('.').pop();
    const fileName = `${trabajadorId}/${docId}_${Date.now()}.${fileExt}`;

    btnElement.innerText = "Subiendo...";
    btnElement.disabled = true;

    try {
        // 1. Inyectar directo a tu bucket 'expedientes' (Esto usa el cliente normal de storage que sí está permitido)
        const { data: uploadData, error: uploadError } = await _supabase.storage.from('expedientes').upload(fileName, file);
        if (uploadError) throw uploadError;

        // 2. Registrar en base de datos mediante la API segura
        const payloadDoc = {
            col_url: colUrl,
            url_path: uploadData.path,
            col_estatus: colEstatus
        };

        const respuesta = await fetch(`${supabaseUrl}/functions/v1/control_prospectos_escuelas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ accion: 'actualizar_documento_rh', vendedor_id: trabajadorId, payload: payloadDoc })
        });
        
        const data = await respuesta.json();
        if (!data.success) throw new Error(data.error);

        alert("¡Documento enviado exitosamente a Recursos Humanos!");
        cargarExpediente(); 
    } catch (err) {
        console.error(err);
        alert("Error al subir el archivo.");
        btnElement.innerText = "⬆️ Subir Documento";
        btnElement.disabled = false;
    }
}

// ==========================================
// SIMUTUKUR API
// ==========================================
async function cargarExamenesPro() {
    const examDropdown = document.getElementById('exam-dropdown');
    try {
        const { data, error } = await _supabase.from('config_examenes').select('*').eq('plan', 'PRO').in('institucion', ['UNAM', 'ECOEMS', 'IPN']).order('institucion', { ascending: true });
        if (error) throw error;

        if (data && data.length > 0) {
            const examenesValidos = data.filter(ex => {
                if (ex.institucion === 'ECOEMS' && ex.area === 'GENERAL') return true;
                if (ex.institucion === 'UNAM' && (ex.area === 'A1' || ex.area === 'A2' || ex.area === 'A3' || ex.area === 'A4')) return true;
                if (ex.institucion === 'IPN' && (ex.area === 'IyCFM' || ex.area === 'CMB' || ex.area === 'CSyA')) return true; 
                return false;
            });
            examDropdown.innerHTML = '<option value="" disabled selected>Elige tu examen...</option>';
            const grupos = {};
            examenesValidos.forEach(ex => { 
                if (!grupos[ex.institucion]) grupos[ex.institucion] = []; 
                grupos[ex.institucion].push(ex); 
            });
            for (const inst in grupos) {
                const optgroup = document.createElement('optgroup'); 
                optgroup.label = `--- ${inst} ---`;
                optgroup.style.color = "#06b6d4";
                grupos[inst].forEach(ex => {
                    const option = document.createElement('option'); 
                    option.value = ex.token_hex; option.text = ex.area; option.style.color = "white";
                    optgroup.appendChild(option);
                });
                examDropdown.appendChild(optgroup);
            }
        }
    } catch (err) { console.error(err); }
}

document.getElementById('start-demo-btn').addEventListener('click', () => {
    const token = document.getElementById('exam-dropdown').value;
    if (!token) return alert('Selecciona un examen.');
    window.open(`instrucciones-demo.html?v=${token}`, '_blank');
});

// INTERFAZ
function mostrarVista(vistaId, elementoMenu) {
    document.querySelectorAll('.main-content > div').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.getElementById('vista-' + vistaId).classList.remove('hidden');
    elementoMenu.classList.add('active');
}
function toggleSubmenu(id) { document.getElementById(id).classList.toggle('hidden'); }