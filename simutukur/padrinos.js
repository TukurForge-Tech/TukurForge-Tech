document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. LÓGICA DEL CANDADO DE ACCESO ---
    const accessCodeInput = document.getElementById('access-code');
    const unlockBtn = document.getElementById('unlock-btn');
    const errorMsg = document.getElementById('error-msg');
    const lockScreen = document.getElementById('lock-screen');
    const mainContent = document.getElementById('main-content');
    const bodyContainer = document.getElementById('body-container');

    const VALID_CODE = 'ALIANZA-STK';

    function checkCode() {
        const enteredCode = accessCodeInput.value.trim().toUpperCase();
        if (enteredCode === VALID_CODE) {
            // Desbloqueo Exitoso
            lockScreen.style.opacity = '0';
            setTimeout(() => {
                lockScreen.classList.add('hidden');
                mainContent.classList.remove('opacity-0', 'pointer-events-none');
                bodyContainer.classList.remove('overflow-hidden'); // Permite el scroll
            }, 500);
        } else {
            // Error
            errorMsg.classList.remove('opacity-0');
            accessCodeInput.classList.add('border-red-500', 'focus:ring-red-500');
            setTimeout(() => {
                errorMsg.classList.add('opacity-0');
                accessCodeInput.classList.remove('border-red-500', 'focus:ring-red-500');
            }, 3000);
        }
    }

    unlockBtn.addEventListener('click', checkCode);
    accessCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkCode();
    });


    // --- 2. LÓGICA DEL CIERRE DUAL (UX) ---
    const btnReady = document.getElementById('btn-ready');
    const btnDoubt = document.getElementById('btn-doubt');
    const formSection = document.getElementById('onboarding-form');
    const calendarSection = document.getElementById('calendar-section');
    const decisionButtons = document.getElementById('decision-buttons');
    const btnSubmitForm = document.getElementById('btn-submit-form');
    const bankDetails = document.getElementById('bank-details');

    btnReady.addEventListener('click', () => {
        formSection.classList.remove('hidden');
        calendarSection.classList.add('hidden');
        // Desplazamiento suave hacia el formulario
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    btnDoubt.addEventListener('click', () => {
        calendarSection.classList.remove('hidden');
        formSection.classList.add('hidden');
        bankDetails.classList.add('hidden');
        calendarSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Simulador del envío de formulario
    btnSubmitForm.addEventListener('click', () => {
        const btnText = btnSubmitForm.innerHTML;
        btnSubmitForm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando expediente...';
        
        setTimeout(() => {
            formSection.classList.add('hidden');
            decisionButtons.classList.add('hidden'); // Oculta botones iniciales
            bankDetails.classList.remove('hidden');
            bankDetails.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 1500);
    });


    // --- 3. LÓGICA DEL DEMO (Supabase) ---
    const examDropdown = document.getElementById('exam-dropdown');
    const startDemoBtn = document.getElementById('start-demo-btn');

    async function cargarExamenesDemo() {
        try {
            const { data, error } = await _supabase
                .from('config_examenes') 
                .select('*')
                .eq('plan', 'PRO')
                .in('institucion', ['UNAM', 'ECOEMS', 'IPN'])
                .order('institucion', { ascending: true })
                .order('descripcion', { ascending: true });

            if (error) throw error;

            if (data && data.length > 0) {
                const examenesValidos = data.filter(ex => {
                    if (ex.institucion === 'ECOEMS' && ex.area === 'GENERAL') return true;
                    if (ex.institucion === 'UNAM' && ['A1', 'A2', 'A3', 'A4'].includes(ex.area)) return true;
                    if (ex.institucion === 'IPN' && ['IyCFM', 'CMB', 'CSyA'].includes(ex.area)) return true; 
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
                        option.text = ex.area; 
                        optgroup.appendChild(option);
                    });
                    examDropdown.appendChild(optgroup);
                }
            } else {
                examDropdown.innerHTML = '<option value="" disabled selected>No hay exámenes disponibles</option>';
            }
        } catch (err) {
            console.error("Error al cargar los exámenes:", err);
            examDropdown.innerHTML = '<option value="" disabled selected>Error de conexión</option>';
        }
    }

    await cargarExamenesDemo();

    startDemoBtn.addEventListener('click', () => {
        const token = examDropdown.value;
        if (!token) {
            alert('Por favor, selecciona un examen de la lista para comenzar la prueba diagnóstica.');
            return;
        }
        window.location.href = `instrucciones-demo.html?v=${token}`;
    });
});