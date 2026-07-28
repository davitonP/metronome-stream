// ===================================
// Utilidades de Audio (portadas de utils.js, sin dependencias de window)
// ===================================

let sharedContext = null

/**
 * Obtiene o crea una instancia compartida de AudioContext.
 * Reutiliza el contexto existente para evitar límites del navegador.
 * @returns {AudioContext}
 */
export function getAudioContext() {
  if (sharedContext) return sharedContext

  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    throw new Error('Web Audio API no soportada en este navegador')
  }

  sharedContext = new AudioContextClass()
  return sharedContext
}

/**
 * Carga un archivo de audio y lo decodifica en un AudioBuffer.
 *
 * @param {string} url - Ruta del archivo de audio
 * @param {AudioContext} [context] - Contexto opcional para decodificar. Por defecto el compartido.
 * @returns {Promise<AudioBuffer>}
 */
export async function loadAudioBuffer(url, context) {
  const ctx = context || getAudioContext()

  try {
    console.log(`📥 Cargando audio: ${url}`)
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

    console.log(`✓ Audio decodificado: ${url} (${audioBuffer.duration.toFixed(2)}s)`)
    return audioBuffer
  } catch (error) {
    console.error(`❌ Error cargando audio (${url}):`, error)
    throw error
  }
}
