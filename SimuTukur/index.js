// ==========================================
// MOTOR DE LA PÁGINA PRINCIPAL (DEMO)
// ==========================================

// Reloj del Banner Flotante
const fechaGranSimulacro = new Date('2026-05-23T10:00:00').getTime();

setInterval(() => {
    const ahora = new Date().getTime();
    const distancia = fechaGranSimulacro - ahora;

    if (distancia > 0) {
        document.getElementById("dias_banner").innerText = Math.floor(distancia / (1000 * 60 * 60 * 24)).toString().padStart(2, '0');
        document.getElementById("horas_banner").innerText = Math.floor((distancia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
        document.getElementById("minutos_banner").innerText = Math.floor((distancia % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        document.getElementById("segundos_banner").innerText = Math.floor((distancia % (1000 * 60)) / 1000).toString().padStart(2, '0');
    }
}, 1000);

document.addEventListener('DOMContentLoaded', async () => {
    const examDropdown = document.getElementById('exam-dropdown');
    const startDemoBtn = document.getElementById('start-demo-btn');

    async function cargarExamenesPro() {
        try {
            // 🛡️ FILTRO OPERATIVO: Solo PRO, solo UNAM y ECOEMS
            const { data, error } = await _supabase
                .from('config_examenes') 
                .select('*')
                .eq('plan', 'PRO')
                .in('institucion', ['UNAM', 'ECOEMS', 'IPN']) // 🔒 Bloquea UAM automáticamente
                .order('institucion', { ascending: true })
                .order('descripcion', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                // FILTRO SECUNDARIO: Solo GENERAL para ECOEMS y A1/A2/A3/A4 para UNAM e IPN
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
                    optgroup.className = "bg-gray-900 text-cyan-400 font-bold";
                    
                    grupos[inst].forEach(ex => {
                        const option = document.createElement('option'); 
                        option.value = ex.token_hex; 
                        option.text = ex.area; // Muestra "A1", "A2", "GENERAL"
                        option.className = "bg-black text-white";
                        optgroup.appendChild(option);
                    });
                    examDropdown.appendChild(optgroup);
                }
            }
        } catch (err) {
            console.error("Error:", err);
            examDropdown.innerHTML = '<option value="" disabled selected>Error de carga</option>';
        }
    }

    await cargarExamenesPro();

    startDemoBtn.addEventListener('click', () => {
        const token = examDropdown.value;
        if (!token) return alert('Selecciona un examen para comenzar el Demo');
        // Redirección al HTML de Demo
        window.location.href = `instrucciones-demo.html?v=${token}`;
    });
});

window.addEventListener('load', () => {
    // Usamos un pequeño retraso de 100ms para asegurar que el navegador ya calculó la altura de todo
    setTimeout(() => {
        const seccionDemo = document.getElementById('zona-demo');
        if (seccionDemo) {
            seccionDemo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
});
