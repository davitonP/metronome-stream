const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const guitarStrings = [
  { name: 'E (grave)', frequency: 82.41, noteNumber: 40 },
  { name: 'A', frequency: 110.00, noteNumber: 45 },
  { name: 'D', frequency: 146.83, noteNumber: 50 },
  { name: 'G', frequency: 196.00, noteNumber: 55 },
  { name: 'B', frequency: 246.94, noteNumber: 59 },
  { name: 'E (aguda)', frequency: 329.63, noteNumber: 64 },
];

const dom = {
  startButton: document.getElementById('tuner-start'),
  statusLabel: document.getElementById('tuner-status'),
  noteDisplay: document.getElementById('tuner-note'),
  octaveDisplay: document.getElementById('tuner-octave'),
  frequencyDisplay: document.getElementById('tuner-frequency'),
  centsDisplay: document.getElementById('tuner-cents'),
  meterNeedle: document.getElementById('tuner-needle'),
  modeButtons: document.querySelectorAll('[data-mode]'),
  tuningList: document.getElementById('tuning-list'),
  modeLabel: document.getElementById('tuner-mode'),
  modeAlt: document.getElementById('tuner-mode-alt'),
};

const bassStrings = [
  { name: 'E', frequency: 41.20, noteNumber: 28 },
  { name: 'A', frequency: 55.00, noteNumber: 33 },
  { name: 'D', frequency: 73.42, noteNumber: 38 },
  { name: 'G', frequency: 98.00, noteNumber: 43 },
];

let audioContext = null;
let analyser = null;
let sourceNode = null;
let mediaStream = null;
let updateIntervalId = null;
let currentMode = 'guitar';
let lastDetectedString = null;

function formatFrequency(freq) {
  return freq ? `${freq.toFixed(1)} Hz` : '—';
}

function getNoteFromFrequency(frequency) {
  if (!frequency || frequency <= 0) return null;

  const noteNumber = 12 * (Math.log(frequency / 440) / Math.log(2)) + 69;
  const roundedNote = Math.round(noteNumber);
  const cents = Math.floor((noteNumber - roundedNote) * 100);
  const noteName = noteNames[(roundedNote + 120) % 12];
  const octave = Math.floor(roundedNote / 12) - 1;

  return {
    noteName,
    octave,
    cents,
    frequency,
    noteNumber: roundedNote,
  };
}

function detectGuitarString(frequency) {
  if (!frequency || frequency <= 0) return null;
  
  let closestString = null;
  let minDiff = Infinity;
  
  guitarStrings.forEach((string) => {
    const diff = Math.abs(frequency - string.frequency);
    // Aumentar tolerancia a ±60 Hz (fue 40)
    if (diff < minDiff && diff < 60) {
      minDiff = diff;
      closestString = string;
    }
  });
  
  return closestString;
}

function detectBassString(frequency) {
  if (!frequency || frequency <= 0) return null;
  
  let closestString = null;
  let minDiff = Infinity;
  
  bassStrings.forEach((string) => {
    const diff = Math.abs(frequency - string.frequency);
    // Tolerancia similar a guitarra
    if (diff < minDiff && diff < 30) {
      minDiff = diff;
      closestString = string;
    }
  });
  
  return closestString;
}

function autoCorrelate(buffer, sampleRate) {
  let size = buffer.length;
  let rms = 0;
  
  // Calcular RMS para detectar silencio
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return -1;

  // Limitar buffer a la región con señal
  let r1 = 0, r2 = size - 1;
  const threshold = rms * 0.1;
  
  for (let i = 0; i < size; i++) {
    if (Math.abs(buffer[i]) > threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = size - 1; i >= 0; i--) {
    if (Math.abs(buffer[i]) > threshold) {
      r2 = i;
      break;
    }
  }

  buffer = buffer.slice(r1, r2);
  size = buffer.length;
  if (size < 100) return -1;

  // Autocorrelación
  const c = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] += buffer[j] * buffer[j + i];
    }
  }

  // Encontrar el primer valle (dip) para evitar picos espurios
  let d = 0;
  for (let i = Math.floor(size / 32); i < Math.floor(size / 8); i++) {
    if (c[i] < c[i - 1] && c[i] < c[i + 1]) {
      d = i;
      break;
    }
  }

  // Si no se encuentra dip, comenzar desde un punto razonable
  if (d === 0) d = Math.floor(size / 16);

  // Buscar el máximo después del dip
  let maxVal = -1, maxPos = d;
  for (let i = d; i < size; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  // Validación
  if (maxPos <= 1 || maxPos >= size - 1 || maxVal <= 0) return -1;

  // Interpolación parabólica para mayor precisión
  const a = (c[maxPos + 1] + c[maxPos - 1] - 2 * c[maxPos]) / 2;
  const b = (c[maxPos + 1] - c[maxPos - 1]) / 2;
  
  let T0 = maxPos;
  if (Math.abs(a) > 0.00001) {
    T0 = maxPos - b / (2 * a);
  }

  // Rango válido de pitch para guitarra/voz: 40Hz - 1000Hz
  const freq = sampleRate / T0;
  if (freq < 40 || freq > 1000) return -1;

  return freq;
}

function updateModeVisuals() {
  dom.modeButtons.forEach((button) => {
    if (button.dataset.mode === currentMode) {
      button.classList.add('bg-emerald-400', 'text-slate-950');
      button.classList.remove('bg-slate-800', 'text-slate-300');
    } else {
      button.classList.add('bg-slate-800', 'text-slate-300');
      button.classList.remove('bg-emerald-400', 'text-slate-950');
    }
  });

  dom.modeLabel.textContent = currentMode === 'guitar' ? 'Afinador de guitarra' : 'Afinador de bajo';
  dom.modeAlt.textContent = currentMode === 'guitar' ? 'Guitarra' : 'Bajo';
  lastDetectedString = null;
  renderTuningList();
}

function renderTuningList() {
  dom.tuningList.innerHTML = '';
  const data = currentMode === 'guitar' ? guitarStrings : bassStrings;
  data.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 text-sm text-slate-300 transition-all duration-150';
    li.innerHTML = `<div class="flex items-center justify-between"><span class="font-semibold text-white">${item.name}</span><span class="text-slate-400 text-xs">${item.frequency.toFixed(2)} Hz</span></div>`;
    dom.tuningList.appendChild(li);
  });
}

function setStatus(message, tone = 'normal') {
  dom.statusLabel.textContent = message;
  dom.statusLabel.className = `inline-flex rounded-full px-4 py-2 text-sm font-semibold ${tone === 'warn' ? 'bg-orange-500/10 text-orange-300 ring-1 ring-orange-500/20' : tone === 'error' ? 'bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20' : 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20'}`;
}

function updateTuner(noteData) {
  if (!noteData) {
    dom.noteDisplay.textContent = '—';
    dom.octaveDisplay.textContent = '—';
    dom.frequencyDisplay.textContent = '— Hz';
    dom.centsDisplay.textContent = '—';
    dom.meterNeedle.style.transform = `translateX(-50%)`;
    dom.meterNeedle.classList.remove('bg-emerald-400', 'bg-yellow-400', 'bg-red-400', 'shadow-[0_0_20px_rgba(16,185,129,0.35)]', 'shadow-[0_0_20px_rgba(251,191,36,0.35)]', 'shadow-[0_0_20px_rgba(239,68,68,0.35)]');
    dom.meterNeedle.classList.add('bg-emerald-400', 'shadow-[0_0_20px_rgba(16,185,129,0.35)]');
    lastDetectedString = null;
    return;
  }

  dom.noteDisplay.textContent = noteData.noteName;
  dom.octaveDisplay.textContent = `Octava ${noteData.octave}`;
  dom.frequencyDisplay.textContent = formatFrequency(noteData.frequency);
  dom.centsDisplay.textContent = `${noteData.cents > 0 ? '+' : ''}${noteData.cents}¢`;
  
  // Mover la barra horizontalmente: -50% (izquierda) a +50% (derecha)
  const clamped = Math.max(-50, Math.min(50, noteData.cents));
  const translateX = (clamped / 50) * 50; // ±50% del ancho
  dom.meterNeedle.style.transform = `translateX(${translateX - 50}%)`;
  
  // Cambiar color según desviación
  dom.meterNeedle.classList.remove('bg-emerald-400', 'bg-yellow-400', 'bg-red-400', 'shadow-[0_0_20px_rgba(16,185,129,0.35)]', 'shadow-[0_0_20px_rgba(251,191,36,0.35)]', 'shadow-[0_0_20px_rgba(239,68,68,0.35)]');
  if (Math.abs(clamped) <= 10) {
    // Verde: bien afinada
    dom.meterNeedle.classList.add('bg-emerald-400', 'shadow-[0_0_20px_rgba(16,185,129,0.35)]');
  } else if (Math.abs(clamped) <= 30) {
    // Amarillo: necesita ajuste
    dom.meterNeedle.classList.add('bg-yellow-400', 'shadow-[0_0_20px_rgba(251,191,36,0.35)]');
  } else {
    // Rojo: muy desviada
    dom.meterNeedle.classList.add('bg-red-400', 'shadow-[0_0_20px_rgba(239,68,68,0.35)]');
  }

  // Detección de cuerda
  if (currentMode === 'guitar') {
    const detectedString = detectGuitarString(noteData.frequency);
    if (detectedString && detectedString !== lastDetectedString) {
      lastDetectedString = detectedString;
      highlightTuningString(detectedString, guitarStrings);
    }
  } else if (currentMode === 'bass') {
    const detectedString = detectBassString(noteData.frequency);
    if (detectedString && detectedString !== lastDetectedString) {
      lastDetectedString = detectedString;
      highlightTuningString(detectedString, bassStrings);
    }
  }
}

function highlightTuningString(string, stringsArray) {
  const items = dom.tuningList.querySelectorAll('li');
  items.forEach((item) => {
    item.classList.remove('ring-2', 'ring-emerald-400', 'bg-slate-900/50');
  });

  // Encontrar y destacar la cuerda
  const index = stringsArray.indexOf(string);
  if (index >= 0 && items[index]) {
    items[index].classList.add('ring-2', 'ring-emerald-400', 'bg-slate-900/50');
  }
}

async function startTuner() {
  try {
    if (audioContext && audioContext.state === 'suspended') await audioContext.resume();

    if (!audioContext) {
      audioContext = window.getAudioContext();
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('No se encontró acceso a micrófono en este navegador.');
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    sourceNode = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    sourceNode.connect(analyser);

    console.log('✓ Tuner started - Sample rate:', audioContext.sampleRate, 'Hz');
    dom.startButton.textContent = 'Detener afinador';
    setStatus('Micrófono activo, canta o toca una cuerda.', 'normal');

    updateIntervalId = setInterval(monitorPitch, 200);
  } catch (error) {
    console.error('❌ Tuner error:', error);
    setStatus('No se pudo activar el micrófono', 'error');
  }
}

function stopTuner() {
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (analyser) {
    analyser.disconnect();
    analyser = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }

  dom.startButton.textContent = 'Iniciar micrófono';
  setStatus('Afinador detenido. Presiona para volver a iniciar.', 'warn');
  updateTuner(null);
}

function monitorPitch() {
  if (!analyser) return;
  
  const buffer = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buffer);
  const frequency = autoCorrelate(buffer, audioContext.sampleRate);
  
  if (frequency <= 0) {
    updateTuner(null);
    return;
  }
  
  const noteData = getNoteFromFrequency(frequency);
  
  if (!noteData) {
    updateTuner(null);
    return;
  }
  
  // En modo guitarra, recalcular cents relativos a la cuerda detectada
  if (currentMode === 'guitar') {
    const detectedString = detectGuitarString(frequency);
    if (detectedString) {
      // Calcular cents relativos a la cuerda
      const centsFromString = 1200 * Math.log2(frequency / detectedString.frequency);
      noteData.cents = Math.round(centsFromString);
    }
  }
  
  updateTuner(noteData);
}

dom.modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    currentMode = button.dataset.mode;
    updateModeVisuals();
  });
});

dom.startButton.addEventListener('click', () => {
  if (sourceNode) {
    stopTuner();
  } else {
    startTuner();
  }
});

updateModeVisuals();
renderTuningList();
setStatus('Listo para afinar guitarra o voz.', 'normal');
