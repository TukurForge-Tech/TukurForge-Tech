// supabase-client.js
// Configuración centralizada de credenciales (Base de datos e IA)

// ==========================================
// 1. CREDENCIALES DE SUPABASE
// ==========================================
const supabaseUrl = 'https://pcuopqvmucmhtcdeswxh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdW9wcXZtdWNtaHRjZGVzd3hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTk0NTgsImV4cCI6MjA4OTQzNTQ1OH0.g1xfdTtbz4aNW_QF_JcwoM7DCmgRLDxF2Ik48I7fq2M';
                    
// Exportamos el cliente para que cualquier HTML lo pueda usar
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. FUNCIONES GLOBALES DE SEGURIDAD
// ==========================================
// Función global para verificar sesión
function verificarSesion() {
    const token = localStorage.getItem('token_hex');

    // Si no hay token, los botamos al Login
    if (!token || token === "null") {
        window.location.href = 'login.html';
        return null;
    }
    return token;
}
