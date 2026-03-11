// ===================================
// Audio Utility Functions
// ===================================

/**
 * Gets or creates a shared AudioContext instance.
 * Reuses existing context to avoid browser limits.
 * @returns {AudioContext}
 */
function getAudioContext() {
    // Check for existing global contexts
    if (window.metronomeAudioContext) return window.metronomeAudioContext;
    if (window.globalAudioContext) return window.globalAudioContext;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
        throw new Error("Web Audio API not supported in this browser");
    }

    // Create and expose
    window.globalAudioContext = new AudioContextClass();
    return window.globalAudioContext;
}

/**
 * Loads an audio file and decodes it into an AudioBuffer.
 * Handles fetch errors and context decoding asynchronously.
 * 
 * @param {string} url - Path to the audio file
 * @param {AudioContext} [context] - Optional context to decode with. Defaults to shared context.
 * @returns {Promise<AudioBuffer>}
 */
async function loadAudioBuffer(url, context) {
    const ctx = context || getAudioContext();

    // Ensure context is running (sometimes needed after user interaction)
    if (ctx.state === 'suspended') {
        try {
            await ctx.resume();
        } catch (e) {
            console.warn('Could not resume AudioContext automatically:', e);
        }
    }

    try {
        console.log(`📥 Fetching audio: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        
        // Use promise-based decodeAudioData if available, or wrap callback style
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        
        console.log(`✓ Audio decoded: ${url} (${audioBuffer.duration.toFixed(2)}s)`);
        return audioBuffer;

    } catch (error) {
        console.error(`❌ Error loading audio (${url}):`, error);
        throw error;
    }
}

// Expose helpers globally for inline scripts
window.getAudioContext = getAudioContext;
window.loadAudioBuffer = loadAudioBuffer;
