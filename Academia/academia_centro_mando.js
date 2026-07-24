// ==========================================
// 0. MOTOR DE AUTENTICACIÓN Y SEGURIDAD
// ==========================================

// Validar si ya hay una sesión activa al recargar la página
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        desbloquearERP(session.user.email);
    }
});

// Botón de Ingresar (El Muro de Seguridad)
document.getElementById('btnIngresar').addEventListener('click', async () => {
    const correo = document.getElementById('loginCorreo').value;
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('btnIngresar');

    if(!correo || !password) return alert("Ingresa tus credenciales");

    btn.innerText = "Verificando...";
    btn.disabled = true;

    // Llamamos a la Bóveda de Supabase
    const { data, error } = await _supabase.auth.signInWithPassword({
        email: correo,
        password: password,
    });

    if (error) {
        alert("Acceso Denegado: Credenciales incorrectas");
        btn.innerText = "Ingresar al Sistema";
        btn.disabled = false;
    } else {
        desbloquearERP(data.user.email);
    }
});

// Botón de Cerrar Sesión
document.getElementById('btnCerrarSesion').addEventListener('click', async () => {
    await _supabase.auth.signOut();
    location.reload(); // Recarga la página para levantar el muro
});

// Función maestra que abre el sistema y busca tus datos
async function desbloquearERP(emailUsuario) {
    document.getElementById('muro-seguridad').style.display = 'none';
    document.getElementById('erp-app').style.display = 'flex';
    
    // Buscar los datos de la persona que se acaba de loguear
    const { data: perfil, error } = await _supabase
        .from('credenciales_trabajadores')
        .select('nombre, primer_apellido, rol')
        .eq('correo', emailUsuario)
        .single();

    if (perfil) {
        document.getElementById('perfilNombre').innerText = `${perfil.nombre} ${perfil.primer_apellido}`;
        document.getElementById('perfilRol').innerText = perfil.rol;
    } else {
        document.getElementById('perfilNombre').innerText = emailUsuario;
        document.getElementById('perfilRol').innerText = "Autorizado";
    }
    
    // Cargar la información de los módulos
    cargarInvitaciones();
    cargarExpedientes();
}

// ==========================================
// NAVEGACIÓN DEL ERP
// ==========================================
function cambiarModulo(idModulo, boton) {
    document.querySelectorAll('.modulo-contenido').forEach(mod => mod.style.display = 'none');
    document.getElementById(idModulo).style.display = 'block';
    
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    boton.classList.add('active');
}

// ==========================================
// MÓDULO 1: INVITACIONES (ONBOARDING)
// ==========================================
document.getElementById('btnEnviarInvitacion').addEventListener('click', async () => {
    const correoInput = document.getElementById('nuevoCorreo').value;
    if (!correoInput) return alert("Ingresa un correo válido");

    const btn = document.getElementById('btnEnviarInvitacion');
    btn.disabled = true;
    btn.innerText = "Enviando...";

    const passwordTemp = Math.random().toString(36).slice(-8);
    const linkDinamico = window.location.origin + '/seguridad/AOT004';

    try {
        // ¡ELIMINAMOS TODO EL BLOQUE QUE HACÍA .insert() AQUÍ!
        
        // 2. Solo disparamos la Edge Function
        const response = await fetch(`${supabaseUrl}/functions/v1/invitar-candidato`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ 
                correo_personal: correoInput, 
                password_temporal: passwordTemp,
                link_portal: linkDinamico
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Error al invitar");

        alert("¡Invitación enviada en 2 correos de forma segura!");
        document.getElementById('nuevoCorreo').value = '';
        cargarInvitaciones();

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Enviar Accesos (2 Correos)";
    }
});

async function cargarInvitaciones() {
    const tbody = document.getElementById('tablaInvitaciones');
    // Busca los que están como 'Invitado' (Los nuevos que generes aparecerán aquí)
    const { data } = await _supabase.from('credenciales_trabajadores').select('*').eq('estatus', 'Invitado');
    
    tbody.innerHTML = '';
    data.forEach(inv => {
        tbody.innerHTML += `
            <tr>
                <!-- CORRECCIÓN: Usamos inv.correo -->
                <td>${inv.correo}</td>
                <td>${inv.password_hash}</td>
                <td><span class="badge">Pendiente de subir Docs</span></td>
                <td><button class="btn-danger" onclick="borrarInvitacion('${inv.id}')">Eliminar</button></td>
            </tr>
        `;
    });
}

async function borrarInvitacion(id) {
    if(!confirm("¿Deseas cancelar esta invitación?")) return;
    await _supabase.from('credenciales_trabajadores').delete().eq('id', id);
    cargarInvitaciones();
}

// ==========================================
// MÓDULO 2: MESA DE CONTROL (VALIDACIÓN)
// ==========================================
let empleadoSeleccionado = null;

async function cargarExpedientes() {
    const lista = document.getElementById('listaPendientes');
    // Ahora buscamos en la tabla maestra los que el candidato acaba de subir ('Por Validar')
    const { data } = await _supabase
        .from('credenciales_trabajadores')
        .select('*, onboarding_trabajadores(*)') 
        .eq('estatus', 'Por Validar'); // <--- ¡Ajuste maestro aplicado!
    
    lista.innerHTML = '';
    if (!data || data.length === 0) {
        lista.innerHTML = '<li class="user-item">No hay expedientes pendientes por validar.</li>';
        return;
    }

    data.forEach(exp => {
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `<h4>${exp.nombre} ${exp.primer_apellido}</h4>`;
        li.onclick = () => mostrarDetalle(exp, li);
        lista.appendChild(li);
    });
}

// ==========================================
// MESA DE CONTROL Y AUDITORÍA
// ==========================================
//let empleadoSeleccionado = null;
let urlsDocumentosActuales = {};

// Catálogo de los 7 documentos para generarlos visualmente en bucle
const catalogoDocumentos = [
    { id: 'ine', nombre: 'Identificación Oficial (INE)', url_key: 'ine_url' },
    { id: 'csf', nombre: 'Constancia de Situación Fiscal', url_key: 'csf_url' },
    { id: 'domicilio', nombre: 'Comprobante de Domicilio', url_key: 'domicilio_url' },
    { id: 'banco', nombre: 'Carátula Bancaria', url_key: 'banco_url' },
    { id: 'estudios', nombre: 'Comprobante de Estudios', url_key: 'estudios_url' },
    { id: 'recomendacion_laboral', nombre: 'Carta de Rec. Laboral', url_key: 'recomendacion_laboral_url' },
    { id: 'recomendacion_personal', nombre: 'Carta de Rec. Personal', url_key: 'recomendacion_personal_url' }
];

async function mostrarDetalle(expediente, elementoLi) {
    empleadoSeleccionado = expediente;
    const detalles = expediente.onboarding_trabajadores[0]; 

    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    elementoLi.classList.add('active');
    document.getElementById('vistaVacia').style.display = 'none';
    
    // Cambiamos a flex para que respete las proporciones 30-50
    document.getElementById('detalleExpediente').style.display = 'flex';

    // 1. Cargar Datos Generales
    document.getElementById('detNombre').value = detalles.nombre_completo.toUpperCase();
    document.getElementById('detRFC').value = detalles.rfc.toUpperCase();
    document.getElementById('detBanco').value = detalles.banco_nombre.toUpperCase();
    document.getElementById('detDireccion').value = detalles.direccion.toUpperCase();
    document.getElementById('detClabe').value = detalles.clabe;
    document.getElementById('detRegimen').value = detalles.regimen_contratacion;

    // 3. Limpiar visor y construir interfaz de documentos más limpia
    document.getElementById('visorContenedor').innerHTML = '<p style="color: #666;">Selecciona un documento para visualizar</p>';
    const contenedorDocs = document.getElementById('listaDocumentosUI');
    contenedorDocs.innerHTML = ''; 

    catalogoDocumentos.forEach(doc => {
        const url = detalles[doc.url_key]; 
        urlsDocumentosActuales[doc.id] = url; 

        // Interfaz de botones limpia y compacta
        const filaHTML = `
            <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 5px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; gap: 10px;">
                    <div style="flex: 1; font-size: 0.85em; font-weight: bold; line-height: 1.1; color: var(--text-main);">${doc.nombre}</div>
                    <button class="btn-primary" style="padding: 4px 12px; font-size: 0.85em; min-width: 60px;" onclick="verEnVisor('${doc.id}')">
                        👁️ Ver
                    </button>
                    <select id="estatus_${doc.id}" class="erp-input" style="width: 110px; padding: 4px; margin-bottom: 0; font-size: 0.85em;" onchange="manejarEstatus('${doc.id}')">
                        <option value="Subido">Subido</option>
                        <option value="Validado">✅ Validado</option>
                        <option value="Rechazado">❌ Rechazado</option>
                    </select>
                </div>
                <input type="text" id="motivo_${doc.id}" class="erp-input" placeholder="Motivo del rechazo..." style="display: none; margin-top: 5px; border-color: #ef4444; font-size: 0.85em; padding: 5px;">
            </div>
        `;
        contenedorDocs.innerHTML += filaHTML;
    });
}

// ==========================================
// FUNCIONES AUXILIARES DEL VISOR
// ==========================================

// Enviar archivo al Iframe de la derecha
window.verEnVisor = function(docId) {
    const url = urlsDocumentosActuales[docId];
    const contenedor = document.getElementById('visorContenedor');
    
    if (url) {
        // Obtenemos la ruta para verificar extensión
        const urlObj = new URL(url);
        const path = urlObj.pathname.toLowerCase();

        // Si es PDF inyecta iframe, si es imagen inyecta img de ancho completo
        if (path.endsWith('.pdf')) {
            contenedor.innerHTML = `<iframe src="${url}" style="width: 100%; height: 100%; min-height: 600px; border: none;"></iframe>`;
        } else {
            contenedor.innerHTML = `<img src="${url}" style="width: 100%; height: auto; display: block; margin: 0 auto;">`;
        }
    } else {
        alert("El trabajador no subió este documento.");
    }
}

// Mostrar/Ocultar caja de texto si se rechaza un doc
window.manejarEstatus = function(docId) {
    const selector = document.getElementById(`estatus_${docId}`);
    const cajaMotivo = document.getElementById(`motivo_${docId}`);
    
    if (selector.value === 'Rechazado') {
        cajaMotivo.style.display = 'block';
    } else {
        cajaMotivo.style.display = 'none';
        cajaMotivo.value = ''; // Limpiamos el texto si cambia de opinión
    }
}

// ==========================================
// BOTÓN MAESTRO: DICTAMINAR Y AUDITAR
// ==========================================
document.getElementById('btnDictaminar').addEventListener('click', async () => {
    if (!empleadoSeleccionado) return alert("Selecciona un trabajador primero.");

    // El ID del trabajador (viene de la tabla credenciales_trabajadores)
    const id_trabajador = empleadoSeleccionado.id; 
    const estatus_docs = {};
    let tieneRechazos = false;
    let faltaRevisar = false;

    // 1. BARRIDO DE SEGURIDAD (Validar los 7 documentos)
    for (const doc of catalogoDocumentos) {
        const selectVal = document.getElementById(`estatus_${doc.id}`).value;
        const cajaMotivo = document.getElementById(`motivo_${doc.id}`);
        const motivoVal = cajaMotivo.value.trim();

        // Regla A: No puedes avanzar si algo sigue como "Subido"
        if (selectVal === 'Subido') {
            faltaRevisar = true;
            break;
        }

        // Regla B: Si rechazas, debes explicar por qué
        if (selectVal === 'Rechazado') {
            tieneRechazos = true;
            if (motivoVal === '') {
                cajaMotivo.style.border = "2px solid red"; // Resaltar en rojo
                alert(`Debes escribir el motivo de rechazo para: ${doc.nombre}`);
                return; // Detenemos el proceso
            }
        }

        // Empaquetamos los datos exactos para la Base de Datos
        estatus_docs[`estatus_${doc.id}`] = selectVal;
        estatus_docs[`motivo_${doc.id}`] = selectVal === 'Rechazado' ? motivoVal : null;
    }

    if (faltaRevisar) {
        return alert("⚠️ ALTO: No puedes dictaminar todavía. Debes darle un estatus de 'Validado' o 'Rechazado' a los 7 documentos.");
    }

    // 2. DECISIÓN DE DIRECCIÓN GENERAL
    // Usamos un Confirm nativo para darte la opción de Aceptar o Rechazar el expediente global.
    const confirmarAprobacion = confirm("¿Deseas ACEPTAR este expediente para continuar el proceso operativo?\n\n- Dale a 'Aceptar' para aprobarlo (con o sin correcciones pendientes).\n- Dale a 'Cancelar' si quieres rechazarlo definitivamente.");
    
    let decision_general = '';
    
    if (confirmarAprobacion) {
        // Todo lo que aceptes, pasa a Aprobado (y su estatus maestro será 'Por Firmar')
        decision_general = 'Aprobado';
    } else {
        // Seguro de seguridad si le diste a cancelar por error
        const confirmarRechazo = confirm("🚨 ¿Estás seguro de RECHAZAR DEFINITIVAMENTE este expediente? El candidato quedará fuera del proceso.");
        if (!confirmarRechazo) return; // Se arrepiente y cancela
        decision_general = 'Rechazado_Definitivo';
    }

    // 3. ENVÍO AL SERVIDOR (A nuestra nueva Edge Function)
    const btn = document.getElementById('btnDictaminar');
    const textoOriginal = btn.innerText;
    btn.innerText = "Guardando Dictamen...";
    btn.disabled = true;

    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/auditar-expediente`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${supabaseKey}` 
            },
            body: JSON.stringify({ 
                trabajador_id: id_trabajador,
                decision_general: decision_general,
                estatus_docs: estatus_docs
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Error al conectar con la bóveda.");

        alert(`✅ Dictamen registrado con éxito.\nEstatus Final: ${decision_general}`);
        
        if (decision_general === 'Aprobado') {
            alert("🪄 Todo Validado. Generando los documentos en PDF...");

            // 1. Extraemos los datos del trabajador
            const detalles = empleadoSeleccionado.onboarding_trabajadores[0];
            const nombreCompleto = document.getElementById('detNombre').value.toUpperCase();
            const rfc = document.getElementById('detRFC').value.toUpperCase();
            const direccion = document.getElementById('detDireccion').value.toUpperCase();
            const banco = document.getElementById('detBanco').value.toUpperCase();
            const clabe = document.getElementById('detClabe').value;
            const regimen = document.getElementById('detRegimen').value;

            // 2. Calculamos la fecha dinámica
            const fecha = new Date();
            const dia = fecha.getDate();
            const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            const mes = meses[fecha.getMonth()];
            const anio = fecha.getFullYear();

            // 3. Opciones base para todos los PDFs
            const opcionesGenerales = {
                margin:       10,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'mm', format: 'letter', orientation: 'portrait' }
            };

            // ==========================================
            // DOCUMENTO 1: CONTRATO PRINCIPAL (Alineado a la Izquierda)
            // ==========================================
            const htmlContrato = `
                <div style="padding: 40px; font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff;">
                    <h3 style="text-align: center; font-size: 14px;">CONTRATO DE PRESTACIÓN DE SERVICIOS COMERCIALES INDEPENDIENTES Y COMISIONES</h3>
                    
                    <p style="text-align: left; line-height: 1.5;">Este Contrato de Prestación de Servicios (el "Contrato") se celebra en la Ciudad de México, a los <strong>${dia}</strong> días del mes de <strong>${mes}</strong> del <strong>${anio}</strong>.</p>
                    
                    <p style="text-align: center; font-weight: bold;">ENTRE</p>
                    
                    <p style="text-align: left; line-height: 1.5;"><strong>H LEVARE GROUP</strong>, con Registro Federal de Contribuyentes (RFC) HLG260320JN3, representada en este acto por Homar Rodríguez Zarco, actuando en su carácter de Representante Legal. De aquí en adelante será referenciado como la "Empresa".</p>
                    
                    <p style="text-align: center; font-weight: bold;">-Y-</p>
                    
                    <p style="text-align: left; line-height: 1.5;"><strong>${nombreCompleto}</strong>, con Registro Federal de Contribuyentes (RFC) <strong>${rfc}</strong>, con domicilio en <strong>${direccion}</strong>. De aquí en adelante será referenciado como el "Prestador" o "Comisionista".</p>
                    
                    <p style="text-align: left; line-height: 1.5;">Estos serán considerados individualmente como la "Parte" y conjuntamente como las "Partes", quienes se sujetan a las siguientes:</p>
                    
                    <h4 style="text-align: center; margin-bottom: 5px;">DECLARACIONES</h4>
                    <p style="margin: 0 0 5px 0; text-align: left;"><strong>De la Empresa:</strong></p>
                    <ol type="a" style="margin-top: 0; text-align: left; line-height: 1.5;">
                        <li>Que es una persona moral legalmente constituida bajo las leyes mexicanas.</li>
                        <li>Que para efectos estrictamente comerciales, de marketing y de prospección en el mercado, los servicios de software objeto de este contrato operan frente al público bajo el ecosistema educativo "Academia Tukur" (el cual integra las herramientas SenseiTukur, PoligloTukur y SimuTukur).</li>
                        <li>Que su domicilio para oír y recibir notificaciones es el ubicado en la Alcaldía Tlalpan, Ciudad de México C.P. 14248</li>
                    </ol>

                    <p style="margin: 0 0 5px 0; text-align: left;"><strong>Del Prestador:</strong></p>
                    <ol type="a" style="margin-top: 0; text-align: left; line-height: 1.5;">
                        <li>Que es una persona física que cuenta con los conocimientos, experiencia, herramientas propias y capacidad técnica para ejecutar los servicios de prospección y cierre de ventas corporativas (B2B).</li>
                        <li>Que es su libre voluntad prestar sus servicios a la Empresa de manera estrictamente mercantil, asumiendo el riesgo de su propia actividad y reconociendo que sus ingresos dependerán 100% de los resultados obtenidos.</li>
                    </ol>

                    <h4 style="text-align: center; margin-bottom: 5px;">CLÁUSULAS</h4>
                    
                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;"><strong>PRIMERA. OBJETO DEL CONTRATO</strong> La Empresa contrata al Prestador para que, de manera independiente, realice servicios de prospección, negociación y cierre de ventas B2B para la comercialización de licencias del ecosistema de software educativo "Academia Tukur" (el cual integra las herramientas SenseiTukur, PoligloTukur y SimuTukur) dirigidas a colegios, escuelas secundarias y preparatorias privadas en el territorio mexicano, con base en los precios estipulados en el Anexo A.</p>
                    
                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;"><strong>SEGUNDA. INDEPENDENCIA Y NATURALEZA DEL CONTRATO</strong> Las Partes reconocen expresamente que la relación que los une es de naturaleza estrictamente mercantil. Este Contrato no crea relación laboral alguna, subordinación, ni dependencia bajo la Ley Federal del Trabajo.</p>
                    
                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;"><strong>TERCERA. CONDICIONES ECONÓMICAS Y COMISIONES (ESQUEMA DIRECTO)</strong> Como única contraprestación, el Prestador recibirá comisiones calculadas de la siguiente manera, sujetas a la Condición de Volumen Mínimo:</p>
                    <ol type="a" style="margin-top: 0; text-align: left; line-height: 1.5; margin-bottom: 8px;">
                        <li><strong>Comisión por Setup (Cierre Inicial):</strong> El Prestador cobrará el 50% (cincuenta por ciento) del Costo de Instalación cobrado al colegio. Este pago se liberará en las mismas proporciones y tiempos en que pague la escuela.</li>
                        <li><strong>Ingreso Residual Mensual:</strong> El Prestador cobrará el 10% (diez por ciento) sobre la facturación mensual recurrente de cada colegio que haya cerrado directamente, pagadero los días 5 de cada mes, mientras la escuela mantenga su suscripción activa.</li>
                        <li><strong>Condición de Volumen Mínimo (Obligatorio):</strong> Para devengar las comisiones, el contrato cerrado con la Institución Educativa deberá amparar un volumen igual o superior a 50 licencias activas. Cuentas menores a este volumen no generarán comisiones salvo autorización expresa y por escrito de la Dirección.</li>
                    </ol>

                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;"><strong>CUARTA. BONO DE ARRANQUE RÁPIDO (FAST START)</strong> La Empresa otorgará al Prestador un bono único de productividad por la cantidad de $5,000.00 MXN (Cinco mil pesos 00/100 M.N.), el cual será pagadero única y exclusivamente si el Prestador logra el cierre exitoso y el cobro del Setup de 5 (cinco) escuelas distintas dentro de los primeros 60 (sesenta) días naturales a partir de la firma del presente Contrato.</p>

                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;"><strong>QUINTA. MODELO DE AGENCIA, ZONAS Y COMISIONES DE RED</strong></p>
                    <ol type="a" style="margin-top: 0; text-align: left; line-height: 1.5; margin-bottom: 8px;">
                        <li><strong>Zona Comercial:</strong> Al alcanzar y mantener una cartera activa de 25 (veinticinco) escuelas cerradas que en su conjunto sumen un volumen mínimo comprobable de 2,500 (dos mil quinientas) licencias o alumnos activos, el Prestador tendrá derecho a solicitar la asignación de una zona geográfica para el desarrollo de su propia agencia. La delimitación de dicha zona será determinada exclusivamente por la Empresa mediante un análisis de densidad de mercado y número de escuelas privadas registradas, garantizando equidad territorial. Todo territorio no asignado por escrito seguirá siendo de libre competencia comercial.</li>
                        <li><strong>Desarrollo de Fuerza de Ventas:</strong> El Prestador podrá reclutar a sus propios sub-vendedores dentro de su zona asignada. La Empresa le pagará regalías sobre las ventas cerradas por su red, topadas a 4 generaciones (5% total): 1ra Generación (Directos): 2%; 2da Generación: 1%; 3ra Generación: 1%; 4ta Generación: 1% sobre la facturación.</li>
                    </ol>

                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;"><strong>SEXTA. USO DE HERRAMIENTAS Y POLÍTICA DE INACTIVIDAD</strong> El Prestador está obligado a utilizar el CRM proporcionado por la Empresa para el registro y seguimiento de embudo de ventas. Si el Prestador acumula 30 (treinta) días naturales consecutivos sin registrar actividad real de prospección o movimiento comercial en el CRM, la Empresa tendrá la facultad unilateral de revocar sus accesos, darlo de baja del sistema y rescindir el presente Contrato de forma automática por abandono, sin responsabilidad alguna para la Empresa.</p>
                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;"><strong>Gestión Comercial vs. Soporte Técnico:</strong> El Prestador fungirá exclusivamente como enlace y gestor comercial para asegurar la satisfacción y renovación de los contratos. Queda entendido que la configuración, adecuación de accesos, mantenimiento de servidores y resolución de incidencias tecnológicas serán responsabilidad única y exclusiva del equipo interno de soporte técnico de la Empresa.</p>

                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;"><strong>SÉPTIMA. RÉGIMEN FISCAL, VALIDACIÓN Y PLAZOS DE PAGO</strong> Para la liberación de cualquier comisión (ya sea por Setup o Ingreso Residual), el Prestador asume la responsabilidad de gestionar que los pagos de su cartera de clientes se realicen en tiempo y forma (a más tardar los días 5 de cada mes para pagos residuales).</p>
                    <ol type="a" style="margin-top: 0; text-align: left; line-height: 1.5; margin-bottom: 8px;">
                        <li><strong>Proceso de Validación en CRM:</strong> El pago de cualquier comisión se detonará exclusivamente cuando el depósito del cliente (Institución Educativa) sea confirmado en las cuentas de la Empresa y su estatus en el CRM cambie de "En Validar" a "Cobrado". La Empresa se compromete a realizar esta validación en un plazo máximo de 24 horas hábiles tras la carga del comprobante. Todo pago escolar realizado y comprobado el último día del mes será contabilizado para las metas y volúmenes de dicho mes.</li>
                        <li><strong>Esquemas de Pago:</strong> Una vez que el estatus marque "Cobrado", el pago se realizará bajo el régimen elegido:
                            <ol type="1" style="margin-top: 4px; margin-bottom: 0; padding-left: 20px; text-align: left;">
                                <li style="margin-bottom: 4px;"><em>Régimen de Honorarios Profesionales / RESICO / PFAE:</em> El Prestador deberá emitir y cargar en el sistema el CFDI correspondiente. La Empresa realizará el pago en 24 horas hábiles posteriores a la validación fiscal.</li>
                                <li><em>Régimen de Asimilados a Salarios:</em> La Empresa procesará el pago en 24 horas hábiles tras el estatus "Cobrado". El Prestador autoriza la retención de ISR aplicable (Anexo B). El cálculo se realizará de forma acumulativa mensual, emitiendo un CFDI de nómina consolidado al término del mes.</li>
                            </ol>
                        </li>
                    </ol>

                    <div style="page-break-before: always;"></div>

                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;"><strong>OCTAVA. FORMA Y LUGAR DE PAGO</strong> Las partes acuerdan que el pago de las contraprestaciones será cubierto mediante transferencia electrónica (SPEI) a la siguiente cuenta:</p>
                    <ol type="a" style="margin-top: 0; text-align: left; line-height: 1.5; margin-bottom: 8px;">
                        <li><strong>Institución Bancaria:</strong> ${banco}</li>
                        <li><strong>Cuenta CLABE:</strong> ${clabe}</li>
                    </ol>
                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;">El Prestador asume la responsabilidad absoluta de la veracidad de los datos. Para actualizar la cuenta, deberá notificar por escrito con 15 días de anticipación firmando un anexo modificatorio.</p>

                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;"><strong>NOVENA. PRÁCTICAS PROHIBIDAS (CAUSALES DE RESCISIÓN INMEDIATA)</strong></p>
                    <ol type="a" style="margin-top: 0; text-align: left; line-height: 1.5; margin-bottom: 8px;">
                        <li><strong>Protección Corporativa:</strong> Queda estrictamente prohibido utilizar o exponer el nombre "H Levare Group" en discursos de venta o publicidad.</li>
                        <li><strong>Prohibición de Cobro:</strong> El Prestador no podrá recibir pagos en efectivo o en cuentas personales.</li>
                        <li><strong>Prohibición de "Overselling":</strong> Queda estrictamente prohibido alterar costos estipulados en el Anexo A o prometer funciones que no existan en la plataforma operativa. El incumplimiento causará la rescisión inmediata y pérdida de comisiones.</li>
                    </ol>

                    <p style="text-align: left; line-height: 1.5; margin-bottom: 8px;"><strong>DÉCIMA. CONFIDENCIALIDAD</strong> Toda la información y software son propiedad única de la Empresa. El Prestador no podrá replicar, vender, ni distribuir dicho material.</p>
                    
                    <p style="text-align: left; line-height: 1.5; margin-bottom: 30px;"><strong>UNDÉCIMO. JURISDICCIÓN</strong> Las Partes se someten a las leyes y tribunales competentes de la Ciudad de México.</p>
                    
                    <p style="text-align: center; margin-bottom: 50px;">Leído el presente Contrato, lo firman de conformidad.</p>

                    <table style="width: 100%; text-align: center; border-collapse: collapse;">
                        <tr>
                            <td style="width: 50%; padding-bottom: 10px;">
                                <div style="width: 80%; margin: 0 auto; border-bottom: 1px solid black; padding-top: 40px;"></div>
                            </td>
                            <td style="width: 50%; padding-bottom: 10px;">
                                <div style="width: 80%; margin: 0 auto; border-bottom: 1px solid black; padding-top: 40px;"></div>
                            </td>
                        </tr>
                        <tr>
                            <td><strong>LA EMPRESA H LEVARE GROUP</strong><br>Homar Rodríguez Zarco<br>Representante Legal</td>
                            <td><strong>EL PRESTADOR (COMISIONISTA)</strong><br>${nombreCompleto}</td>
                        </tr>
                    </table>
                </div>
            `;
            const divContrato = document.createElement('div');
            divContrato.innerHTML = htmlContrato;

            // ==========================================
            // DOCUMENTO 2: ANEXO A (Alineación a la izquierda)
            // ==========================================
            const htmlAnexoA = `
                <div style="padding: 40px; font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff;">
                    <h3 style="text-align: center;">ANEXO A: PRECIOS Y PAQUETES AUTORIZADOS</h3>
                    
                    <p style="text-align: left; line-height: 1.5;"><strong>COSTO DE INSTALACIÓN (SETUP FEE)</strong> Cobro único inicial. Facturado con anticipo del 50% al arranque y 50% a la entrega del VoBo.</p>
                    <ol type="a" style="margin-top: 0; text-align: left; line-height: 1.5;">
                        <li>Infraestructura TukurForge (Subdominio): $10,000.00 MXN + IVA.</li>
                        <li>Integración Web Cliente (API en su página): $15,000.00 MXN + IVA.</li>
                    </ol>

                    <p style="text-align: left; line-height: 1.5;"><strong>LICENCIAMIENTO POR ALUMNO (ECOSISTEMA COMPLETO)</strong></p>
                    <ol type="a" style="margin-top: 0; text-align: left; line-height: 1.5;">
                        <li>Costo Mensual por Alumno: $299.00 MXN (IVA Incluido).</li>
                        <li>Plazo forzoso: Contrato a 10 meses. Pagos los días 5 de cada mes.</li>
                        <li>Condición Comercial: Volumen mínimo obligatorio de 50 alumnos para validación del contrato y pago de comisiones.</li>
                    </ol>
                </div>
            `;
            const divAnexoA = document.createElement('div');
            divAnexoA.innerHTML = htmlAnexoA;

            // ==========================================
            // DESCARGAS MÚLTIPLES 
            // ==========================================
            // 1. Descargamos Contrato
            await html2pdf().set({ ...opcionesGenerales, filename: `Contrato_${nombreCompleto.replace(/ /g, '_')}.pdf` }).from(divContrato).save();
            
            // 2. Descargamos Anexo A
            await html2pdf().set({ ...opcionesGenerales, filename: `Anexo_A_${nombreCompleto.replace(/ /g, '_')}.pdf` }).from(divAnexoA).save();

            // 3. Descargamos Anexo B (Solo si aplica y alineado a la izquierda)
            if (regimen.includes('Asimilados')) {
                const htmlAnexoB = `
                    <div style="padding: 40px; font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff;">
                        <h3 style="text-align: center;">ANEXO B: CARTA SOLICITUD DE ASIMILADOS A SALARIOS</h3>
                        <p style="text-align: right;">Fecha: Ciudad de México, a los ${dia} días del mes de ${mes} del ${anio}.</p>
                        <p style="text-align: left;"><strong>H LEVARE GROUP</strong><br>Presente.</p>
                        <p style="text-align: left; line-height: 1.5;">Yo, <strong>${nombreCompleto}</strong>, solicito formalmente que mis comisiones derivadas del Contrato de Prestación de Servicios Comerciales Independientes me sean pagadas bajo el régimen de Ingresos Asimilados a Salarios. Autorizo a H LEVARE GROUP a efectuar las retenciones de ISR correspondientes.</p>
                        <p style="text-align: left; line-height: 1.5;">Reconozco que presto mis servicios de manera independiente, sin subordinación ni horario, por lo que este esquema no genera derechos laborales de ninguna índole.</p>
                        <br><br><br>
                        <p style="text-align: center;">Atentamente,</p>
                        <div style="width: 250px; margin: 50px auto 10px auto; border-bottom: 1px solid black;"></div>
                        <p style="text-align: center; margin: 0;"><strong>FIRMA DEL PRESTADOR</strong></p>
                        <p style="text-align: center; margin: 0;">RFC: ${rfc}</p>
                    </div>
                `;
                const divAnexoB = document.createElement('div');
                divAnexoB.innerHTML = htmlAnexoB;
                
                await html2pdf().set({ ...opcionesGenerales, filename: `Anexo_B_${nombreCompleto.replace(/ /g, '_')}.pdf` }).from(divAnexoB).save();
            }
        }

        // Limpiamos la pantalla y recargamos la lista
        document.getElementById('detalleExpediente').style.display = 'none';
        cargarExpedientes();

    } catch (error) {
        alert("Error de Sistema: " + error.message);
    } finally {
        // Restauramos el botón
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
});

// ==========================================
// MÓDULO 3: ACTIVACIONES (Generación de Matrícula)
// ==========================================
let empleadoAActivar = null;

async function cargarActivaciones() {
    const lista = document.getElementById('listaPorActivar');
    if(!lista) return; // Por si aún no creas el HTML

    // Buscamos a los que tú ya aprobaste y tienen su contrato firmado ("Por Firmar")
    const { data } = await _supabase
        .from('credenciales_trabajadores')
        .select('*')
        .eq('estatus', 'Por Firmar');
    
    lista.innerHTML = '';
    if (!data || data.length === 0) {
        lista.innerHTML = '<li class="user-item">No hay firmas esperando activación.</li>';
        return;
    }

    data.forEach(exp => {
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `<h4>${exp.nombre} ${exp.primer_apellido}</h4><span class="badge">Por Activar</span>`;
        li.onclick = () => mostrarDetalleActivacion(exp, li);
        lista.appendChild(li);
    });
}

function mostrarDetalleActivacion(expediente, elementoLi) {
    empleadoAActivar = expediente;
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    elementoLi.classList.add('active');
    
    document.getElementById('vistaVaciaAct').style.display = 'none';
    document.getElementById('detalleActivacion').style.display = 'block';

    document.getElementById('actNombre').innerText = `${expediente.nombre} ${expediente.primer_apellido}`;
    document.getElementById('actCorreo').innerText = expediente.correo;
    document.getElementById('actRol').innerText = expediente.rol;

    // Proponer el correo corporativo automáticamente
    const nombres = expediente.nombre.toLowerCase().split(' ');
    const apellidos = expediente.primer_apellido.toLowerCase().split(' ');
    document.getElementById('actCorreoCorp').value = `${nombres[0]}.${apellidos[0]}@tukurforge.com`;
}

// Evento del botón de Activación (Botón Rojo)
document.getElementById('btnActivarTrabajador')?.addEventListener('click', async () => {
    if (!empleadoAActivar) return alert("Selecciona un trabajador primero.");
    
    const correoCorp = document.getElementById('actCorreoCorp').value.trim();
    if(!correoCorp) return alert("Debes asignarle un correo corporativo válido.");

    const confirmar = confirm(`¿Estás seguro de generar la matrícula oficial y ACTIVAR a ${empleadoAActivar.nombre}?\n\nAl confirmar, el sistema calculará su código único y no habrá vuelta atrás.`);
    if(!confirmar) return;

    const btn = document.getElementById('btnActivarTrabajador');
    const textoOriginal = btn.innerText;
    btn.innerText = "Calculando Matrícula...";
    btn.disabled = true;

        try {
        const response = await fetch(`${supabaseUrl}/functions/v1/activar-trabajador`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
            body: JSON.stringify({ 
                trabajador_id: empleadoAActivar.id,
                rol: empleadoAActivar.rol,
                correo_corporativo: correoCorp
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Error al conectar con la bóveda de activaciones.");

        // 1. Ocultar el formulario donde escribiste el correo
        document.getElementById('detalleActivacion').querySelector('div[style*="background: rgba(255,255,255,0.05)"]').style.display = 'none';
        document.getElementById('detalleActivacion').querySelector('div[style*="margin-bottom: 25px;"]').style.display = 'none';
        btn.style.display = 'none'; // Ocultar el botón rojo

        // 2. Mostrar la alerta de confirmación
        alert(`✅ ¡Trabajador Activado con Éxito!\n\nSe enviaron las credenciales de acceso al correo personal.`);
        
        // 3. Encender el Tarjetón de Éxito e inyectar los datos oficiales
        document.getElementById('pantallaExitoActivacion').style.display = 'block';
        document.getElementById('exitoNombre').innerText = `${empleadoAActivar.nombre} ${empleadoAActivar.primer_apellido}`;
        document.getElementById('exitoMatricula').innerText = result.matricula_asignada;
        document.getElementById('exitoCorreo').innerText = result.correo_oficial;

        // 4. Recargar la lista de la izquierda de forma invisible
        cargarActivaciones();

    } catch (error) {
        alert("Error de Sistema: " + error.message);
        btn.innerText = textoOriginal;
        btn.disabled = false;
    }
});

// Función para reiniciar el módulo cuando le das "Finalizar"
window.cerrarPantallaExito = function() {
    // Apagar tarjetón
    document.getElementById('pantallaExitoActivacion').style.display = 'none';
    document.getElementById('detalleActivacion').style.display = 'none';
    
    // Restaurar visibilidad del formulario original para el siguiente usuario
    document.getElementById('detalleActivacion').querySelector('div[style*="background: rgba(255,255,255,0.05)"]').style.display = 'block';
    document.getElementById('detalleActivacion').querySelector('div[style*="margin-bottom: 25px;"]').style.display = 'block';
    const btnRojo = document.getElementById('btnActivarTrabajador');
    btnRojo.style.display = 'block';
    btnRojo.innerText = "⚙️ Generar Matrícula TFMX y Activar Trabajador";
    btnRojo.disabled = false;

    // Mostrar mensaje de "Selecciona un trabajador"
    document.getElementById('vistaVaciaAct').style.display = 'flex'; 
}
