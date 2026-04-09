// Fragmento clave para simulacro_motor.js

async function cargarReactivosPiloto() {
    const materias = [
        { nombre: 'Habilidad Matemática', cant: 8 },
        { nombre: 'Español', cant: 6 },
        { nombre: 'Matemáticas', cant: 6 },
        { nombre: 'Física', cant: 6 },
        { nombre: 'Historia', cant: 6 },
        { nombre: 'Biología', cant: 5 },
        { nombre: 'Química', cant: 5 },
        { nombre: 'Geografía', cant: 5 },
        { nombre: 'Cívica y Ética', cant: 5 }
    ];

    let poolFinal = [];

    for (const m of materias) {
        const { data, error } = await _supabase
            .from('reactivos')
            .select('*')
            .eq('tipo_examen', 'ECOEMS')
            .eq('materia', m.nombre)
            .in('complejidad', [2, 3]) // EL FILTRO ROMPECRÁNEOS
            .limit(m.cant);
        
        if (data) poolFinal.push(...data);
    }

    // Habilidad Verbal (Manejo de JSON de Lectura)
    const { data: lecturas } = await _supabase
        .from('reactivos')
        .select('*')
        .eq('materia', 'Habilidad Verbal')
        .limit(2); // Traemos 2 bloques de lectura
    
    if (lecturas) poolFinal.push(...lecturas);

    return poolFinal.sort(() => Math.random() - 0.5); // Mezclar para que no todos tengan el mismo orden
}

// Modificar el final del examen para el Meeting
async function finalizarExamenPiloto() {
    // ... lógica de guardado de resultados ...
    
    document.body.innerHTML = `
        <div class="fixed inset-0 bg-[#050a14] flex flex-col justify-center items-center text-center p-10">
            <h2 class="text-4xl font-black text-cyan-400 mb-6 uppercase">¡SIMULACRO COMPLETADO!</h2>
            <p class="text-xl text-white mb-8">La Inteligencia Artificial está analizando tus incidencias de audio y video.</p>
            <div class="bg-white/5 p-8 rounded-3xl border border-cyan-500/30 mb-10">
                <p class="text-sm uppercase tracking-widest text-gray-400 mb-4">Próximo paso obligatorio:</p>
                <a href="LINK_DE_TU_MEET_RESULTADOS" target="_blank" class="bg-cyan-600 hover:bg-cyan-400 text-white font-black py-4 px-10 rounded-2xl text-2xl animate-bounce inline-block">
                    ENTRAR AL MEET DE RESULTADOS
                </a>
            </div>
            <p class="text-gray-500 italic text-sm italic">Tu calificación será liberada en vivo por el Director.</p>
        </div>
    `;
}
