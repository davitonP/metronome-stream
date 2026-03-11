const socket = io();
let timeOffset = 0; // Diferencia entre tiempo del servidor y cliente
let syncCompleted = false;
let selectedSong = null;
let audioPlayer = document.getElementById('audio-player');

// Cargar lista de canciones
async function loadSongs() {
    try {
        const response = await fetch('/songs');
        const songs = await response.json();
        const songsList = document.getElementById('songs-list');

        songsList.innerHTML = '';

        songs.forEach(song => {
            const li = document.createElement('li');
            li.textContent = song;
            li.dataset.filename = song;

            li.addEventListener('click', function () {
                // Emitir evento para que todos seleccionen esta canción
                socket.emit('song-selected', song);
            });

            songsList.appendChild(li);
        });

        console.log(`${songs.length} canciones cargadas`);
    } catch (error) {
        console.error('Error cargando canciones:', error);
    }
}

// Cargar canciones al iniciar
loadSongs();

// Función para sincronizar tiempo con el servidor (NTP-like)
function syncTime() {
    const samples = [];
    const numSamples = 5; // Hacemos 5 mediciones para mayor precisión

    function takeSample(index) {
        if (index >= numSamples) {
            // Usar el sample con MEJOR RTT (más rápido = más preciso)
            const bestSample = samples.reduce((a, b) => (a.rtt < b.rtt ? a : b));
            timeOffset = bestSample.offset;
            
            console.log(`✓ Sincronización completada. Offset: ${timeOffset.toFixed(2)}ms`);
            console.log(`  Mejor RTT: ${bestSample.rtt.toFixed(2)}ms`);
            console.log(`  Todas las muestras:`, samples);
            syncCompleted = true;

            // Habilitar botón de inicio
            document.getElementById('start').disabled = false;
            return;
        }

        const t0 = Date.now();
        socket.emit('time-sync', t0);

        socket.once('time-sync-response', (data) => {
            const t3 = Date.now();
            const roundTripTime = t3 - t0;
            const serverTime = data.serverTime;

            // Estimamos que el servidor procesó en el punto medio del viaje
            const estimatedServerTime = serverTime + (roundTripTime / 2);
            const offset = estimatedServerTime - t3;

            samples.push({
                offset: offset,
                rtt: roundTripTime
            });

            // Esperar un poco antes de la siguiente muestra
            setTimeout(() => takeSample(index + 1), 100);
        });
    }

    takeSample(0);
    // const best = samples.reduce((a, b) => (a.rtt < b.rtt ? a : b));
    // timeOffset = best.offset;

}

// Iniciar sincronización cuando se conecta
socket.on('connect', () => {
    console.log('Conectado, sincronizando tiempo...');
    syncTime();
});

const button = document.getElementById('start');
button.addEventListener('click', function () {
    if (!syncCompleted) {
        console.log('Esperando sincronización de tiempo...');
        return;
    }
    if (!selectedSong) {
        alert('Por favor selecciona una canción primero');
        return;
    }
    console.log(`Comenzando secuencia con: ${selectedSong}`);
    socket.emit('start', {
        song: selectedSong
    });
});

const pauseButton = document.getElementById('pause');
pauseButton.addEventListener('click', function () {
    if (!syncCompleted) {
        console.log('Esperando sincronización de tiempo...');
        return;
    }
    console.log("Pausando secuencia");
    socket.emit('pause');
});


socket.on('start', function (data) {
    console.log("▶ Comenzando secuencia");
    console.log(`  Canción: ${data.song}`);

    audioPlayer = document.getElementById('audio-player');
    const expectedSrc = `/audio/${encodeURIComponent(data.song)}`;

    // Asegurar que el audio esté cargado
    if (!audioPlayer.src.endsWith(expectedSrc)) {
        audioPlayer.src = expectedSrc;
    }
    
    // IMPORTANTE: Esperar a que esté listo antes de calcular timing
    audioPlayer.load();
    audioPlayer.currentTime = 0;

    // Calcular el momento exacto de reproducción
    const now = Date.now();
    const adjustedServerTime = data.startTime - timeOffset;
    let delay = adjustedServerTime - now;

    console.log(`  Offset servidor: ${timeOffset.toFixed(2)}ms`);
    console.log(`  Delay calculado: ${delay.toFixed(2)}ms`);

    // Si el delay es muy corto, agregar buffer de seguridad
    if (delay < 50 && delay > 0) {
        console.warn(`  ⚠ Delay muy corto (${delay.toFixed(2)}ms), puede haber desincronización`);
    }

    if (delay > 0) {
        // Usar setTimeout con compensación de precisión
        const targetTime = performance.now() + delay;
        
        setTimeout(() => {
            // Verificar que no hayamos perdido tiempo
            const drift = performance.now() - targetTime;
            if (Math.abs(drift) > 10) {
                console.warn(`  ⚠ Drift detectado: ${drift.toFixed(2)}ms`);
            }
            
            audioPlayer.play().catch(err => {
                console.error('❌ Error reproduciendo audio:', err);
            });
            console.log(`✓ Audio reproduciendo (drift: ${drift.toFixed(2)}ms)`);
        }, delay);
    } else {
        // Tiempo ya pasó, intentar compensar con currentTime
        const missedTime = Math.abs(delay) / 1000; // convertir a segundos
        console.warn(`⚠ Tarde por ${missedTime.toFixed(3)}s, ajustando...`);
        
        audioPlayer.currentTime = missedTime;
        audioPlayer.play().catch(err => {
            console.error('❌ Error reproduciendo audio:', err);
        });
    }
});

socket.on('pause', function (startTimeMs) {
    console.log("Pausando secuencia");

    // Ajustar el tiempo de inicio con el offset calculado
    const now = Date.now();
    const adjustedServerTime = startTimeMs - timeOffset;
    const delay = adjustedServerTime - now;

    console.log(`Offset de tiempo: ${timeOffset.toFixed(2)}ms`);
    console.log(`Audio pausará en ${delay.toFixed(2)}ms`);
    console.log(`Hora actual (cliente): ${new Date(now)}`);
    console.log(`Hora de inicio (servidor ajustado): ${new Date(adjustedServerTime)}`);

    const audioPlayer = document.getElementById('audio-player');

    if (delay > 0) {
        setTimeout(() => {
            audioPlayer.pause();
            console.log('Audio pausado');
        }, delay);
    } else {
        console.log('Tiempo de inicio ya pasó, pausando inmediatamente');
        audioPlayer.pause();
    }
});

// Recibir evento cuando alguien selecciona una canción
socket.on('song-selected', function (song) {
    console.log(`🎵 Canción seleccionada: ${song}`);

    // Remover selección anterior
    document.querySelectorAll('#songs-list li').forEach(item => {
        item.classList.remove('selected');
    });

    // Seleccionar esta canción en la lista
    const songItems = document.querySelectorAll('#songs-list li');
    songItems.forEach(item => {
        if (item.dataset.filename === song) {
            item.classList.add('selected');
        }
    });

    selectedSong = song;

    // PRECARGAR el audio inmediatamente para reducir delay
    audioPlayer = document.getElementById('audio-player');
    audioPlayer.src = `/audio/${encodeURIComponent(song)}`;
    
    // Precargar metadata y parte del archivo
    audioPlayer.preload = 'auto';
    audioPlayer.load();
    
    // Esperar a que esté listo
    audioPlayer.addEventListener('canplaythrough', function onReady() {
        console.log(`  ✓ Audio precargado y listo`);
        audioPlayer.removeEventListener('canplaythrough', onReady);
    }, { once: true });
    
    console.log(`  Precargando...`);
});
