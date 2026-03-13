// Helper to get synchronized time
window.getSyncTime = function() {
    return getNow() + (window.timeOffset || 0);
};

// Expose socket globally
const socket = io();
window.socket = socket;

let timeOffset = 0;
let syncCompleted = false;
let timerInterval = null;

const clockEl = document.getElementById('clock');
// const syncButton = document.getElementById('sync');

function getNow() {
    const n = Date.now();
    return Number.isFinite(n) ? n : new Date().getTime();
}

function setClock(msRemaining) {
    if (!clockEl) return;
    const seconds = Math.max(0, Math.ceil(msRemaining / 1000));
    clockEl.textContent = String(seconds);
    if (msRemaining <= 0) {
        document.getElementById('body').style.backgroundColor = "#000000";
    }
}

function clearTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function startCountdown(startAt, durationMs) {
    clearTimer();
    indexColor = 0;
    function tick() {
        const now = getNow() + timeOffset;
        const endAt = startAt + durationMs;
        if (!Number.isFinite(now) || !Number.isFinite(endAt)) {
            console.error('Timer values inválidos', { now, startAt, durationMs, timeOffset });
            return;
        }
        const remaining = endAt - now;
        color = colors[indexColor];
        setClock(remaining);
        indexedColor = indexColor + 1;
        if (indexedColor >= colors.length) {
            indexColor = 0;
        } else {
            indexColor = indexedColor;
        }
        if (remaining <= 0) {
            clearTimer();
        }
        console.log(`Remaining: ${remaining}ms`);
    }

    tick();
    timerInterval = setInterval(tick, 10);
}

// Sincronización NTP-like (muestras con mejor RTT)
function syncTime() {
    const samples = [];
    const numSamples = 20; // Increase samples for better accuracy

    function takeSample(index) {
        if (index >= numSamples) {
            if (samples.length === 0) {
                console.error('No se pudo sincronizar: sin muestras válidas');
                return;
            }
            // Sort by RTT and take the best 30% to average
            samples.sort((a, b) => a.rtt - b.rtt);
            const bestSamples = samples.slice(0, Math.max(1, Math.floor(samples.length * 0.3)));
            
            // Average offset of best RTT samples
            const avgOffset = bestSamples.reduce((sum, s) => sum + s.offset, 0) / bestSamples.length;
            
            // Use the best single RTT for reference logging
            const bestSample = samples[0];

            // Update global offset
            timeOffset = avgOffset;
            
            console.log(`✓ Sync completed. Offset: ${timeOffset.toFixed(2)}ms (Best RTT: ${bestSample.rtt.toFixed(2)}ms)`);
            
            // Expose sync status globally
            window.timeOffset = timeOffset;
            window.syncCompleted = true;
            // syncButton.disabled = false;
            
            // Dispatch event for components to react
            window.dispatchEvent(new CustomEvent('time-sync-update', { 
                detail: { offset: timeOffset, rtt: bestSample.rtt } 
            }));
            
            return;
        }

        const t0 = getNow();
        socket.emit('time-sync', t0);

        socket.once('time-sync-response', (data) => {
            const t3 = getNow();
            const rtt = t3 - t0;
            const serverTime = Number(data?.serverTime);
            if (!Number.isFinite(serverTime) || !Number.isFinite(rtt)) {
                setTimeout(() => takeSample(index + 1), 80);
                return;
            }
            const estimatedServerTime = serverTime + (rtt / 2);
            const offset = estimatedServerTime - t3;
            if (Number.isFinite(offset)) {
                samples.push({ offset, rtt });
            }
            setTimeout(() => takeSample(index + 1), 80);
        });
    }

    takeSample(0);
}

socket.on('connect', () => {
    syncTime();
    // Auto-sync every 30 seconds
    setInterval(syncTime, 30000);
});

// syncButton.addEventListener('click', () => {
//     if (!syncCompleted) return;
//     socket.emit('timer-start', { durationMs: 5000 });
// });

// socket.on('timer-start', (data) => {
//     const startAt = Number(data?.startAt);
//     const durationMs = Number(data?.durationMs);
//     if (!Number.isFinite(startAt) || !Number.isFinite(durationMs)) {
//         console.error('timer-start inválido', data);
//         return;
//     }
//     console.log(data)
//     startCountdown(startAt, durationMs);
// });

