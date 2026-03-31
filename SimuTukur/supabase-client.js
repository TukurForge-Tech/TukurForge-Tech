// supabase-client.js
// Configuración centralizada de la base de datos de SimuTukur

const supabaseUrl = 'https://pcuopqvmucmhtcdeswxh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdW9wcXZtdWNtaHRjZGVzd3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTk0NTgsImV4cCI6MjA4OTQzNTQ1OH0.g1xfdTtbz4aNW_QF_JcwoM7DCmgRLDxF2Ik48I7fq2M';
                    
// Exportamos el cliente para que cualquier HTML lo pueda usar
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Función global para verificar sesión (opcional pero recomendada)
function verificarSesion() {
    const token = localStorage.getItem('token_hex');
    if (!token || token === "null") {
        window.location.href = 'index.html';
    }
    return token;
}
// ESTADO GLOBAL DE LA APP (Ajustado exactamente a tus variables reales)
const AppState = {
    usuario: {
        email: localStorage.getItem('session_email') || null,
        nombre: localStorage.getItem('nombre_alumno') || 'Aspirante',
        token_hex: localStorage.getItem('token_hex'), // Solo tu token principal
        creditos_ia: parseInt(localStorage.getItem('simu_creditos')) || 50 // Vive solo en el navegador
    },
    ultimoReporte: null,
    bloqueoRepaso: false
};
