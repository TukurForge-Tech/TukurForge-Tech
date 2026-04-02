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
// 2. CREDENCIALES DE INTELIGENCIA ARTIFICIAL
// ==========================================
// Colocamos la llave aquí para mantener la seguridad en un solo archivo
const GEMINI_API_KEY = 'AIzaSyCSyNTLQ2uJw96Srl2UVabQU090iIT9cbs'; 

// ==========================================
// 3. FUNCIONES GLOBALES DE SEGURIDAD
// ==========================================
// Función global para verificar sesión
function verificarSesion() {
    const token = localStorage.getItem('token_hex');
    if (!token || token === "null") {
        window.location.href = 'index.html';
    }
    return token;
}
