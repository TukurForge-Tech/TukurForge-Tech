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
                .in('institucion', ['UNAM', 'ECOEMS']) // 🔒 Bloquea IPN/UAM automáticamente
                .order('institucion', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                // FILTRO SECUNDARIO: Solo GENERAL para ECOEMS y A1/A2 para UNAM
                // Esto es por si en la base de datos ya tienes A3 o A4 pero aún no quieres mostrarlas
                const examenesValidos = data.filter(ex => {
                    if (ex.institucion === 'ECOEMS' && ex.area === 'GENERAL') return true;
                    if (ex.institucion === 'UNAM' && (ex.area === 'A1' || ex.area === 'A2' || ex.area === 'A3' || ex.area === 'A4')) return true;
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
                    
                    grupos[inst].forEach(ex => {
                        const option = document.createElement('option'); 
                        option.value = ex.token_hex; 
                        option.text = ex.area; // Muestra "A1", "A2", "GENERAL"
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
        window.location.href = `examen-demo.html?area=${token}`;
    });
});
