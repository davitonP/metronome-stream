class Metronomo {
    constructor(bpm) {
        this.bpm = bpm;
        this.isPlaying = false;
        this.nextNoteTime = 0.0;
        this.timerID = null;
        this.audioContext = null;
        this.userLatency = 0; // ms
        
        // Metronome beats logic
        this.currentBeat = 0;
        this.beatsPerBar = 4; // Standard 4/4
        
        // Sync check logic
        this.startAtServerTime = 0;
        this.syncCheckInterval = null;
        this.driftHistory = [];
        
        // Listen for sync updates
        window.addEventListener('time-sync-update', (e) => {
            if (this.isPlaying) {
                this.checkSync(e.detail);
            }
        });
    }

    checkSync(detail) {
        if (!this.isPlaying || !this.audioContext || !this.startAtServerTime) return;
        
        // Current Sync Time (with new offset)
        const currentServerTime = window.getSyncTime();
        const secondsPerBeat = 60.0 / this.bpm;
        
        // Calculate theoretical next beat time based on Server Start Time
        // Beats elapsed since start (floating point)
        const timeSinceStart = currentServerTime - this.startAtServerTime;
        
        // We need to calculate the target for the VERY NEXT note we have scheduled
        // Where is this.nextNoteTime in server time?
        // Note: this.nextNoteTime is in AudioContext time
        
        // Let's reverse engineer: What beat number is this.nextNoteTime?
        // It's the one we are about to play.
        
        const audioTimeNow = this.audioContext.currentTime;
        const timeUntilNextNote = this.nextNoteTime - audioTimeNow; // seconds
        
        // Predict Server Time when next note plays
        const serverTimeAtNextNote = currentServerTime + (timeUntilNextNote * 1000) - this.userLatency;
        
        // On the perfect grid, serverTimeAtNextNote should be a multiple of beat duration + startAt
        const timeFromStartAtNextNote = serverTimeAtNextNote - this.startAtServerTime;
        const beatsFromStart = timeFromStartAtNextNote / 1000 / secondsPerBeat;
        
        // The nearest integer beat
        const nearestBeat = Math.round(beatsFromStart);
        const deviationBeats = beatsFromStart - nearestBeat;
        const driftSeconds = deviationBeats * secondsPerBeat;
        
        // driftSeconds positive means we are LATE (beatsFromStart > nearestBeat)
        // driftSeconds negative means we are EARLY
        // Actually: if beatsFromStart is 10.1, it means we are at 10.1 beats but we SHOULD be at 10.0 (if we are targeting beat 10)
        // So we are 0.1 beats LATE.
        
        // Wait, if nextNoteTime is scheduled for NOW + 1s.
        // And server says beat 10 is in NOW + 0.9s.
        // Then we are 0.1s LATE (our schedule is too far in future).
        // Server time matches "perfect grid".
        
        // Let's stick to comparing TIMES.
        // Target Server Time for beat N: startAt + N * dur
        // Our scheduled Server Time for beat N: (nextNoteTime - audioNow) + serverNow
        
        // Calculate N (beat index) for the next upcoming beat
        const nextBeatIndex = Math.ceil(timeSinceStart / 1000 / secondsPerBeat);
        const targetServerTime = this.startAtServerTime + (nextBeatIndex * secondsPerBeat * 1000);
        
        // Convert Target Server Time to Audio Time
        // targetAudioTime = audioNow + (targetServerTime - serverNow)/1000 + latencyCorrection
        // latencyCorrection: if userLatency is +50ms (delayed output), we need to trigger sound 50ms EARLIER?
        // No, userLatency usually means "add delay".
        // Let's stick to the previous formula which worked logically:
        // delayToTarget = (targetServerTime - currentServerTime + userLatency) / 1000
        
        const delayToTarget = (targetServerTime - currentServerTime + this.userLatency) / 1000;
        const targetAudioTime = this.audioContext.currentTime + delayToTarget;
        
        const drift = this.nextNoteTime - targetAudioTime;
        // if drift > 0: nextNoteTime is LATER than target -> we are SLOW/LATE
        // if drift < 0: nextNoteTime is EARLIER than target -> we are FAST/EARLY
        
        if (Math.abs(drift) > 0.005) { // Threshold: 5ms
             console.log(`⚠ Sync check: Drift ${(drift * 1000).toFixed(2)}ms. Correcting...`);
             
             if (Math.abs(drift) < 0.050) {
                 // Soft correction: Nudge by 50%
                 this.nextNoteTime -= drift * 0.5;
             } else {
                 // Hard correction
                 this.nextNoteTime = targetAudioTime;
                 this.currentBeat = nextBeatIndex % this.beatsPerBar;
             }
        }
    }
    

    setUserLatency(latencyMs) {
        this.userLatency = latencyMs;
        console.log(`🔧 User latency adjusted: ${this.userLatency}ms`);
    }

    start(startAtServerTime) {
        if (this.isPlaying) return;
        
        this.startAtServerTime = startAtServerTime;
        
        // Ensure AudioContext is ready
        this.audioContext = window.getAudioContext();
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlaying = true;
        this.currentBeat = 0; // Reset beat counter on start
        
        // Calculate when to start relative to AudioContext.currentTime
        const currentServerTime = window.getSyncTime ? window.getSyncTime() : Date.now();
        const currentAudioTime = this.audioContext.currentTime;
        
        // Time difference in seconds between "now" and "startAt"
        // Add user latency correction (negative latency means start earlier/processed earlier)
        const delaySeconds = (startAtServerTime - currentServerTime + this.userLatency) / 1000;
        
        // Align nextNoteTime to startAt
        this.nextNoteTime = currentAudioTime + delaySeconds;
        
        // If we are late (negative delay), catch up by fast-forwarding beats
        const secondsPerBeat = 60.0 / this.bpm;
        if (delaySeconds < 0) {
            const beatsMissed = Math.ceil(Math.abs(delaySeconds) / secondsPerBeat);
            this.nextNoteTime += beatsMissed * secondsPerBeat;
            console.warn(`⚠ Late start! Skipped ${beatsMissed} beats to catch up.`);
        }

        console.log(`⏱ Metronome scheduling start in ${delaySeconds.toFixed(3)}s`);
        this.scheduler();
    }

    scheduler() {
        if (!this.isPlaying) return;
        
        // Schedule notes for the next 0.1s lookahead
        // 0.1s is enough buffer for most devices
        while (this.nextNoteTime < this.audioContext.currentTime + 0.1) {
            this.scheduleNote(this.nextNoteTime);
            this.nextNote();
        }
        
        this.timerID = setTimeout(() => this.scheduler(), 25);
    }
    
    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += secondsPerBeat;
        this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
    }
    
    scheduleNote(time) {
        // Use different sound for downbeat (first beat of bar)
        const isDownbeat = this.currentBeat === 0;
        const buffer = isDownbeat ? window.metronomeDownbeatBuffer : window.metronomeAudioBuffer;
        
        if (!buffer) return;
        
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(time);
        this.displayBeat(this.currentBeat);
    }

    displayBeat(beat) {
        const beatEl = document.getElementById(`beat${beat}`);
        
        // Remove default state (inactive)
        beatEl.classList.remove('bg-gray-700');
        
        // Add active state (flash)
        // Using Tailwind classes for blue flash, scale up, and glow
        beatEl.classList.add('bg-blue-500', 'scale-125', 'shadow-[0_0_15px_rgba(59,130,246,0.8)]', 'ring-2', 'ring-blue-300');
        
        setTimeout(() => {
            // Revert to default state
            beatEl.classList.remove('bg-blue-500', 'scale-125', 'shadow-[0_0_15px_rgba(59,130,246,0.8)]', 'ring-2', 'ring-blue-300');
            beatEl.classList.add('bg-gray-700');
        }, 100);
    }
    
    stop() {
        this.isPlaying = false;
        if (this.timerID) clearTimeout(this.timerID);
    }
    
    setBPM(bpm) {
        this.bpm = bpm;
    }
}

function prepareAudioMetronome() {
    if (!window.metronomeAudioContext || !window.metronomeAudioBuffer) {
        console.error('AudioContext or AudioBuffer not initialized');
        return null;
    }
    
    const source = window.metronomeAudioContext.createBufferSource();
    source.buffer = window.metronomeAudioBuffer;
    source.connect(window.metronomeAudioContext.destination);
    return source;
}

// Initialize metronome asynchronously
async function initMetronome(bpm = 90) {
    try {
        if (!window.metronomeAudioContext) {
            window.metronomeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        window.metronomeAudioBuffer = await loadAudioBuffer("/assets/secuencias/metronome_sound/metronome2.mp3");
        window.metronomeDownbeatBuffer = await loadAudioBuffer("/assets/secuencias/metronome_sound/metronome1.mp3");
        console.log('Metronome audio buffers loaded successfully');

        const metronome = new Metronomo(bpm);
        return metronome;

    } catch (error) {
        console.error('Error initializing metronome:', error);
        return null;
    }
}

window.initMetronome = initMetronome;


