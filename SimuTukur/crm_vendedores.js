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
        const { data, error } = await _supabase
            .from('crm_prospectos')
            .select('*')
            .eq('vendedor_id', vendedorId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
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
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="4" style="color:red;">Error cargando pipeline</td></tr>';
    }
}

// REGLA DE NO RETROCESO Y PAUSA
function generarOpcionesEstatus(estatusActual) {
    let opciones = '';
    const indexActual = FLUJO_VENTAS.indexOf(estatusActual);

    // Si ya está en estatus administrativo oculto, solo mostramos ese para no romperlo
    if (!FLUJO_VENTAS.includes(estatusActual) && estatusActual !== 'En Pausa') {
        return `<option value="${estatusActual}" selected>${estatusActual}</option>`;
    }

    FLUJO_VENTAS.forEach((estatus, idx) => {
        let disabled = "";
        // Si el actual es "En Pausa", bloqueamos todos menos "Firmado" (indice 5)
        if (estatusActual === 'En Pausa' && estatus !== 'Firmado') disabled = "disabled";
        // Si está en el flujo normal, bloqueamos los pasos anteriores
        if (estatusActual !== 'En Pausa' && idx < indexActual) disabled = "disabled";
        
        opciones += `<option value="${estatus}" ${estatus === estatusActual ? 'selected' : ''} ${disabled}>${estatus}</option>`;
    });

    // Agregar la opción de "En Pausa" al final
    opciones += `<option value="En Pausa" ${estatusActual === 'En Pausa' ? 'selected' : ''}>En Pausa</option>`;
    
    return opciones;
}

async function actualizarEstatus(idProspecto, nuevoEstatus) {
    try {
        const { error } = await _supabase.from('crm_prospectos').update({ estatus: nuevoEstatus }).eq('id', idProspecto);
        if (error) throw error;
        // Recargar tabla para aplicar los nuevos bloqueos de select
        cargarProspectos(); 
    } catch (err) {
        alert("Error al actualizar estatus");
        console.error(err);
    }
}

async function guardarProspecto() {
    const nombre = document.getElementById('nombreEscuela').value;
    const nivel = document.getElementById('nivelEducativo').value;
    const fecha = document.getElementById('fechaContacto').value;

    if (!nombre || !nivel || !fecha) return alert("Completa todos los datos.");

    const payload = {
        vendedor_id: localStorage.getItem('sesion_crm_token'),
        nombre_escuela: nombre,
        nivel_educativo: nivel,
        fecha_proximo_contacto: fecha,
        estatus: 'Registrado'
    };

    try {
        const { error } = await _supabase.from('crm_prospectos').insert([payload]);
        if (error) throw error;
        
        alert("Prospecto registrado exitosamente.");
        document.getElementById('nombreEscuela').value = '';
        document.getElementById('fechaContacto').value = '';
        mostrarVista('pipeline', document.querySelectorAll('.menu-item')[0]);
        cargarProspectos();
    } catch(err) { alert("Error guardando prospecto"); console.error(err); }
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