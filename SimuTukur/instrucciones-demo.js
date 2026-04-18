// instrucciones-demo.js - Captura de prospectos y preparación del entorno

function arrancarDemo() {
    const emailInput = document.getElementById('email-demo').value.trim();
    const errorMsg = document.getElementById('msg-error');
    const btnComenzar = document.getElementById('btn-comenzar');
    
    // Validación básica de correo
    if (!emailInput || !emailInput.includes('@') || !emailInput.includes('.')) {
        errorMsg.classList.remove('hidden');
        return;
    }

    // Efecto visual de carga en el botón
    errorMsg.classList.add('hidden');
    btnComenzar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Preparando...';
    btnComenzar.disabled = true;
    btnComenzar.classList.add('opacity-70', 'cursor-not-allowed');

    // 1. Guardamos el "Lead" en la memoria local
    localStorage.setItem('demo_email_capturado', emailInput);
    
    // 2. Le inyectamos los 2 tokens promocionales para que los tenga listos en el dash
    localStorage.setItem('simu_creditos', 2);
    
    // 3. Limpiamos cualquier basura de exámenes pasados para que el demo sea limpio
    localStorage.removeItem('simu_fallas');
    localStorage.removeItem('simu_aciertos');
    localStorage.removeItem('simu_inc_audio');
    localStorage.removeItem('simu_inc_video');
    localStorage.removeItem('simu_terminado');
    
    // 4. Salto automático al motor de examen en medio segundo
    setTimeout(() => {
        window.location.href = 'examen-demo.html';
    }, 500);
}

// Extra UX: Permitir que arranquen presionando 'Enter' en el teclado
document.addEventListener("DOMContentLoaded", () => {
    const emailInput = document.getElementById('email-demo');
    if (emailInput) {
        emailInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                arrancarDemo();
            }
        });
    }
});
