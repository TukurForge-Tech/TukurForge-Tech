// supabase-client.js
// Configuración centralizada de la base de datos de SimuTukur

const supabaseUrl = 'https://pcuopqvmucmhtcdeswxh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdW9wcXZtdWNtaHRjZGVzd3hoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg1OTQ1OCwiZXhwIjoyMDg5NDM1NDU4fQ.K5p2k2z8i2mLQhlxsP2voILlos2hELhKbAVPNH2_p30';

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
