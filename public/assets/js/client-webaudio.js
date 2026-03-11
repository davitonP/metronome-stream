// import { time } from "node:console";

const socket = io();
let timeOffset = 0;
let syncCompleted = false;
let selectedSong = null;

// Web Audio API setup
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
let currentSource = null;
let audioBuffer = null;

// Cargar canciones
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
            li.addEventListener('click', () => socket.emit('song-selected', song));
            songsList.appendChild(li);
        });

        console.log(`${songs.length} canciones cargadas`);
    } catch (error) {
        console.error('Error cargando canciones:', error);
    }
}

function showTime(time) {
    const timeDiv = document.getElementById("time");
    timeDiv.textContent = time;
}

loadSongs();

// Sincronización NTP mejorada
function syncTime() {
    const samples = [];
    const numSamples = 10; // Más muestras para mejor precisión

    function takeSample(index) {
        if (index >= numSamples) {
            // Usar el mejor RTT
            const bestSample = samples.reduce((a, b) => (a.rtt < b.rtt ? a : b));
            timeOffset = bestSample.offset;
            
            console.log(`✓ Sync completado: ${timeOffset.toFixed(2)}ms (RTT: ${bestSample.rtt.toFixed(2)}ms)`);
            syncCompleted = true;
            document.getElementById('start').disabled = false;
            return;
        }

        const t0 = performance.now();
        socket.emit('time-sync', Date.now());

        socket.once('time-sync-response', (data) => {
            const t3 = performance.now();
            const roundTripTime = t3 - t0;
            const serverTime = data.serverTime;
            const estimatedServerTime = serverTime + (roundTripTime / 2);
            const offset = estimatedServerTime - Date.now();

            samples.push({ offset, rtt: roundTripTime });
            setTimeout(() => takeSample(index + 1), 50);
        });
    }

    takeSample(0);
}

socket.on('connect', () => {
    console.log('🔗 Conectado, sincronizando...');
    // Reanudar AudioContext si está suspendido
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    syncTime();
});



// Botón start
document.getElementById('start').addEventListener('click', () => {
    if (!syncCompleted) {
        console.log('⏳ Esperando sincronización...');
        return;
    }
    if (!selectedSong) {
        alert('Selecciona una canción primero');
        return;
    }
    if (!audioBuffer) {
        alert('El audio aún no está cargado');
        return;
    }
    
    console.log(`▶ Iniciando: ${selectedSong}`);
    socket.emit('start', { song: selectedSong });
});

// Botón pause
document.getElementById('pause').addEventListener('click', () => {
    if (!syncCompleted) return;
    console.log('⏸ Pausando...');
    socket.emit('pause');
});

// Reproducir con Web Audio API (PRECISIÓN DE MICROSEGUNDOS)
socket.on('start', async (data) => {
    console.log(`▶ Comenzando: ${data.song}`);
    let times = "";
    

    // Asegurar que tenemos el audio cargado
    if (!audioBuffer || selectedSong !== data.song) {
        console.log('⚠ Audio no coincide, recargando...');
        await loadAudioBuffer(data.song);
    }

    // Detener cualquier reproducción anterior
    if (currentSource) {
        currentSource.stop();
        currentSource = null;
    }

    // Calcular momento exacto de inicio
    const now = Date.now();
    times += `Comenzar a las: ${data.startTime}ms\n`;
    times += `Mi ahora: ${now}\n`;
    times += `Offset: ${timeOffset.toFixed(2)}ms\n`;
    const adjustedServerTime = data.startTime - timeOffset;
    const delay = (adjustedServerTime - now) / 1000; // convertir a segundos
    times += `Delay: ${(delay * 1000).toFixed(2)}ms\n`;
    console.log(`  Offset: ${timeOffset.toFixed(2)}ms`);
    console.log(`  Delay: ${(delay * 1000).toFixed(2)}ms`);
    
    // Crear nueva fuente
    currentSource = audioContext.createBufferSource();
    currentSource.buffer = audioBuffer;
    currentSource.connect(audioContext.destination);
    
    showTime(times);
    if (delay > 0) {
        // Programar inicio EXACTO usando AudioContext.currentTime
        const startTime = audioContext.currentTime + delay;
        currentSource.start(startTime);
        // showTime(startTime.toFixed(6));
        console.log(`✓ Programado para: ${startTime.toFixed(6)}s (ctx time)`);
    } else {
        // Compensar tiempo perdido ajustando offset
        const offset = Math.abs(delay);
        currentSource.start(0, offset);
        console.log(`⚠ Tarde por ${(offset * 1500).toFixed(2)}ms, compensando...`);
    }
});

// Pausar
socket.on('pause', (startTimeMs) => {
    console.log('⏸ Pausando...');
    
    if (currentSource) {
        const now = Date.now();
        const adjustedServerTime = startTimeMs - timeOffset;
        const delay = (adjustedServerTime - now) / 1000;

        if (delay > 0) {
            const stopTime = audioContext.currentTime + delay;
            currentSource.stop(stopTime);
            console.log(`✓ Pausará en: ${stopTime.toFixed(6)}s`);
        } else {
            currentSource.stop();
            console.log('✓ Pausado inmediatamente');
        }
        
        currentSource = null;
    }
});

// Selección de canción
socket.on('song-selected', async (song) => {
    console.log(`🎵 Canción seleccionada: ${song}`);

    document.querySelectorAll('#songs-list li').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.filename === song) {
            item.classList.add('selected');
        }
    });

    selectedSong = song;

    // PRECARGAR inmediatamente con Web Audio API
    try {
        await loadAudioBuffer(song);
    } catch (error) {
        console.error('Error precargando:', error);
    }
});
