const socket = io();


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
