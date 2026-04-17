// index.js - Lógica Dinámica de la Landing Page
document.addEventListener('DOMContentLoaded', async () => {
    const examDropdown = document.getElementById('exam-dropdown');
    const startDemoBtn = document.getElementById('start-demo-btn');

    // 1. Cargar áreas dinámicas desde Supabase (Agrupado por Institución)
    async function cargarAreasDisponibles() {
        try {
            // Jalamos TODOS los exámenes activos de la tabla 'areas'
            // Asegúrate de que la tabla se llama 'areas' en tu Supabase.
            const { data, error } = await _supabase
                .from('areas') 
                .select('*')
                .order('institucion', { ascending: true })
                .order('nombre', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                examDropdown.innerHTML = '<option value="" disabled selected class="text-gray-400">Selecciona tu examen...</option>';
                
                // Agrupamos por Institución (UNAM, IPN, UAM) igual que en registro.js
                const grupos = {};
                data.forEach(ex => { 
                    if (!grupos[ex.institucion]) grupos[ex.institucion] = []; 
                    grupos[ex.institucion].push(ex); 
                });

                // Construimos el dropdown con <optgroup> para que se vea profesional
                for (const inst in grupos) {
                    const optgroup = document.createElement('optgroup'); 
                    optgroup.label = `--- ${inst} ---`;
                    
                    grupos[inst].forEach(ex => {
                        const option = document.createElement('option'); 
                        option.value = ex.id_area; // O el campo ID que utilices en tu BD (ej. A1, A2)
                        option.text = ex.nombre; 
                        optgroup.appendChild(option);
                    });
                    examDropdown.appendChild(optgroup);
                }
            } else {
                examDropdown.innerHTML = '<option value="" disabled selected>No hay exámenes disponibles hoy.</option>';
            }
        } catch (err) {
            console.error("Error cargando áreas desde Supabase:", err);
            examDropdown.innerHTML = '<option value="" disabled selected class="text-red-400">Error de red.</option>';
        }
    }

    await cargarAreasDisponibles();

    // 2. Acción del botón "Hacer Examen Demo"
    startDemoBtn.addEventListener('click', () => {
        const selectedArea = examDropdown.value;
        
        if (!selectedArea) {
            alert('Por favor, selecciona un área de la lista para iniciar tu prueba gratuita.');
            return;
        }

        // Redirigimos al simulador real pasándole el ID del área y la bandera de Demo
        window.location.href = `examen2.html?area=${encodeURIComponent(selectedArea)}&modo=demo`;
    });
});
