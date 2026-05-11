// ==========================================
// MOTOR DE LA CORTINA PROMOCIONAL
// ==========================================
const fechaGranSimulacro = new Date('2026-05-16T10:00:00').getTime();

function iniciarRelojCortina() {
    const cortina = document.getElementById('cortinaSimulacro');
    if (!cortina) return; // Si no hay cortina, no hacemos nada

    setInterval(() => {
        const ahora = new Date().getTime();
        const distancia = fechaGranSimulacro - ahora;

        if (distancia > 0) {
            const dias = Math.floor(distancia / (1000 * 60 * 60 * 24));
            const horas = Math.floor((distancia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutos = Math.floor((distancia % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((distancia % (1000 * 60)) / 1000);

            if (document.getElementById("dias_cortina")) document.getElementById("dias_cortina").innerText = dias.toString().padStart(2, '0');
            if (document.getElementById("horas_cortina")) document.getElementById("horas_cortina").innerText = horas.toString().padStart(2, '0');
            if (document.getElementById("minutos_cortina")) document.getElementById("minutos_cortina").innerText = minutos.toString().padStart(2, '0');
            if (document.getElementById("segundos_cortina")) document.getElementById("segundos_cortina").innerText = segundos.toString().padStart(2, '0');
        } else {
            // Llegó la hora, mostramos ceros
            if (document.getElementById("dias_cortina")) document.getElementById("dias_cortina").innerText = "00";
            if (document.getElementById("horas_cortina")) document.getElementById("horas_cortina").innerText = "00";
            if (document.getElementById("minutos_cortina")) document.getElementById("minutos_cortina").innerText = "00";
            if (document.getElementById("segundos_cortina")) document.getElementById("segundos_cortina").innerText = "00";
        }
    }, 1000);
}

// Función global para ocultar la cortina con una transición suave
window.cerrarCortina = function() {
    const cortina = document.getElementById('cortinaSimulacro');
    if (cortina) {
        cortina.classList.add('opacity-0');
        setTimeout(() => {
            cortina.classList.add('hidden');
        }, 500); // Espera a que termine la animación de Tailwind
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    iniciarRelojCortina();
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
                // FILTRO SECUNDARIO: Solo GENERAL para ECOEMS y A1/A2 para UNAM
                // Esto es por si en la base de datos ya tienes A3 o A4 pero aún no quieres mostrarlas
                const examenesValidos = data.filter(ex => {
                    if (ex.institucion === 'ECOEMS' && ex.area === 'GENERAL') return true;
                    if (ex.institucion === 'UNAM' && (ex.area === 'A1' || ex.area === 'A2' || ex.area === 'A3' || ex.area === 'A4')) return true;
                    if (ex.institucion === 'IPN' && (ex.area === 'IyCFM' || ex.area === 'CMB' || ex.area === 'CSyA')) return true; // 🔓 Áreas IPN
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
        if (!token) return alert('Selecciona un examen');
        // Redirección al HTML de Demo que ya tienes
        window.location.href = `instrucciones-demo.html?v=${token}`;
    });
});
