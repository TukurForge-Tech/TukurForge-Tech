// index.js - Lógica Dinámica para Selección de Examen
document.addEventListener('DOMContentLoaded', async () => {
    const examDropdown = document.getElementById('exam-dropdown');
    const startDemoBtn = document.getElementById('start-demo-btn');

    // 1. Cargar exámenes desde la tabla config_examenes
    async function cargarExamenesPro() {
        try {
            // Filtramos estrictamente por plan PRO
            const { data, error } = await _supabase
                .from('config_examenes') 
                .select('*')
                .eq('plan', 'PRO')
                .order('institucion', { ascending: true })
                .order('area', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                examDropdown.innerHTML = '<option value="" disabled selected>Selecciona tu examen...</option>';
                
                // Agrupamos por Institución para mostrar en bloques
                const grupos = {};
                data.forEach(ex => { 
                    if (!grupos[ex.institucion]) grupos[ex.institucion] = []; 
                    grupos[ex.institucion].push(ex); 
                });

                // Construimos el menú con optgroups
                for (const inst in grupos) {
                    const optgroup = document.createElement('optgroup'); 
                    optgroup.label = `--- ${inst} ---`;
                    optgroup.className = "text-cyan-500 bg-gray-900 font-bold";
                    
                    grupos[inst].forEach(ex => {
                        const option = document.createElement('option'); 
                        // Usamos token_hex como valor único para identificar el examen
                        option.value = ex.token_hex; 
                        // Mostramos el área (A1, A2, etc.)
                        option.text = ex.area; 
                        option.className = "text-white bg-black";
                        optgroup.appendChild(option);
                    });
                    examDropdown.appendChild(optgroup);
                }
            } else {
                examDropdown.innerHTML = '<option value="" disabled selected>No hay exámenes PRO disponibles.</option>';
            }
        } catch (err) {
            console.error("Error al conectar con la base de datos:", err);
            examDropdown.innerHTML = '<option value="" disabled selected>Error de conexión.</option>';
        }
    }

    await cargarExamenesPro();

    // 2. Manejo del botón para ir al Demo
    startDemoBtn.addEventListener('click', () => {
        const selectedToken = examDropdown.value;
        
        if (!selectedToken) {
            alert('Por favor, selecciona un examen de la lista.');
            return;
        }

        // 🔥 CORRECCIÓN: Redirección al archivo de demo específico
        window.location.href = `examen-demo.html?area=${encodeURIComponent(selectedToken)}`;
    });
});
