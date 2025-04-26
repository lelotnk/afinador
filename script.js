const TOLERANCE_PERFECT = 3;
const TOLERANCE_VERY_GOOD = 6;
const TOLERANCE_OK = 10;
const TOLERANCE_ALMOST_THERE = 15;

const instruments = {
    guitar: {
        notes: "E A D G B E",
        frequencies: {
            "E2": 82.41,
            "A2": 110.00,
            "D3": 146.83,
            "G3": 196.00,
            "B3": 246.94,
            "E4": 329.63
        }
    },
    ukulele: {
        notes: "G C E A",
        frequencies: {
            "G4": 392.00,
            "C4": 261.63,
            "E4": 329.63,
            "A4": 440.00
        }
    }
};

let guitarNotes = instruments.guitar.frequencies;

document.getElementById('instrument').addEventListener('change', (event) => {
    const selectedInstrument = event.target.value;
    guitarNotes = instruments[selectedInstrument].frequencies;
    document.getElementById('notes-info').textContent = `Notas padrão: ${instruments[selectedInstrument].notes}`;
});

async function startTuner() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);

    const bandpassFilter = audioContext.createBiquadFilter();
    bandpassFilter.type = "bandpass";
    bandpassFilter.frequency.value = 220;
    bandpassFilter.Q = 1;

    source.connect(bandpassFilter);

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    bandpassFilter.connect(analyser);

    const bufferLength = analyser.fftSize;
    const buffer = new Float32Array(bufferLength);

    let lastUpdateTime = 0;
    const UPDATE_DELAY = 200; // Delay em milissegundos

    let lastValidFrequency = null;
    let lastValidNote = null;
    let lastValidDetune = null;
    let lastValidTime = 0;
    const PERSISTENCE_DELAY = 1000; // Tempo em milissegundos para manter os valores

    function update() {
        analyser.getFloatTimeDomainData(buffer);
        const frequency = autoCorrelate(buffer, audioContext.sampleRate);

        const currentTime = performance.now();

        if (frequency !== -1) {
            // Atualiza os valores válidos
            lastValidFrequency = frequency;
            const noteData = getClosestGuitarNoteNaturalScale(frequency);
            lastValidNote = noteData.note;
            lastValidDetune = noteData.detune;
            lastValidTime = currentTime;

            // Atualiza a interface com os valores atuais
            document.getElementById('frequency').textContent = `Frequência: ${frequency.toFixed(2)} Hz`;
            document.getElementById('note').textContent = `Nota: ${noteData.note}`;
            updateNeedle(noteData.detune);
        } else if (currentTime - lastValidTime < PERSISTENCE_DELAY) {
            // Mantém os últimos valores válidos por um tempo
            document.getElementById('frequency').textContent = `Frequência: ${lastValidFrequency.toFixed(2)} Hz`;
            document.getElementById('note').textContent = `Nota: ${lastValidNote}`;
            updateNeedle(lastValidDetune);
        } else {
            // Limpa os valores após o tempo de persistência
            document.getElementById('frequency').textContent = 'Frequência: -- Hz';
            document.getElementById('note').textContent = 'Nota: --';
            document.getElementById('detune').textContent = 'Detune: --';
            updateNeedle(null);
        }

        requestAnimationFrame(update);
    }

    update();
}

function autoCorrelate(buffer, sampleRate) {
    let SIZE = buffer.length;
    let rms = 0;
    for (let i = 0; i < SIZE; i++) {
        let val = buffer[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);

    if (rms < 0.01) return -1;

    let r1 = 0, r2 = SIZE - 1, threshold = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
        if (Math.abs(buffer[i]) < threshold) {
            r1 = i;
            break;
        }
    }
    for (let i = 1; i < SIZE / 2; i++) {
        if (Math.abs(buffer[SIZE - i]) < threshold) {
            r2 = SIZE - i;
            break;
        }
    }

    buffer = buffer.slice(r1, r2);
    SIZE = buffer.length;

    const c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE - i; j++) {
            c[i] = c[i] + buffer[j] * buffer[j + i];
        }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }

    let T0 = maxpos;
    return sampleRate / T0;
}

function getClosestGuitarNote(frequency) {
    let closestNote = '';
    let minDiff = Infinity;
    let targetFreq = 0;
    for (let note in guitarNotes) {
        const diff = Math.abs(frequency - guitarNotes[note]);
        if (diff < minDiff) {
            minDiff = diff;
            closestNote = note;
            targetFreq = guitarNotes[note];
        }
    }
    const detune = 1200 * Math.log2(frequency / targetFreq);

    return { note: closestNote, detune: Math.floor(detune) };
}

function getClosestGuitarNoteNaturalScale(frequency) {
    const naturalScale = [
        { note: "A", freq: 27.5 },
        { note: "A#", freq: 29.14 },
        { note: "B", freq: 30.87 },
        { note: "C", freq: 32.7 },
        { note: "C#", freq: 34.65 },
        { note: "D", freq: 36.71 },
        { note: "D#", freq: 38.89 },
        { note: "E", freq: 41.2 },
        { note: "F", freq: 43.65 },
        { note: "F#", freq: 46.25 },
        { note: "G", freq: 49.0 },
        { note: "G#", freq: 51.91 }
    ];

    let closestNote = '';
    let minDiff = Infinity;
    let targetFreq = 0;

    // Expand the scale to cover multiple octaves
    const expandedScale = [];
    for (let octave = 0; octave <= 8; octave++) {
        naturalScale.forEach(({ note, freq }) => {
            const scaledFreq = freq * Math.pow(2, octave);
            if (scaledFreq >= 20 && scaledFreq <= 20000) { // Human hearing range
                expandedScale.push({ note, freq: scaledFreq });
            }
        });
    }

    // Find the closest note
    expandedScale.forEach(({ note, freq }) => {
        const diff = Math.abs(frequency - freq);
        if (diff < minDiff) {
            minDiff = diff;
            closestNote = note;
            targetFreq = freq;
        }
    });

    const detune = 1200 * Math.log2(frequency / targetFreq);

    return { note: closestNote, detune: Math.floor(detune) };
}

function updateNeedle(detune) {
    const needle = document.getElementById('needle');
    const detuneDisplay = document.getElementById('detune');
    const noteElement = document.getElementById('note');
    const needleContainer = document.getElementById('needle-container');

    if (detune === null) {
        needle.style.transform = `rotate(0deg)`;
        detuneDisplay.textContent = 'Detune: --';
        noteElement.style.color = '';
        needleContainer.style.borderColor = '';
        detuneDisplay.style.color = '';
        return;
    }

    const angle = Math.max(-45, Math.min(45, detune / 2));
    needle.style.transform = `rotate(${angle}deg)`;

    if (Math.abs(detune) <= TOLERANCE_PERFECT) {
        detuneDisplay.textContent = 'Afinação perfeita!';
        noteElement.style.color = '#228B22';
        needleContainer.style.borderColor = '#228B22';
        detuneDisplay.style.color = '#228B22';
    } else if (Math.abs(detune) <= TOLERANCE_VERY_GOOD) {
        detuneDisplay.textContent = 'Muito bom!';
        noteElement.style.color = '#228B22';
        needleContainer.style.borderColor = '#228B22';
        detuneDisplay.style.color = '#228B22';
    } else if (Math.abs(detune) <= TOLERANCE_OK) {
        detuneDisplay.textContent = 'Está OK.';
        noteElement.style.color = '#228B22';
        needleContainer.style.borderColor = '#228B22';
        detuneDisplay.style.color = '#228B22';
    } else if (Math.abs(detune) <= TOLERANCE_ALMOST_THERE) {
        detuneDisplay.textContent = 'Quase lá!';
        noteElement.style.color = '#FF4500';
        needleContainer.style.borderColor = '#FF4500';
        detuneDisplay.style.color = '#FF4500';
    } else if (detune > TOLERANCE_ALMOST_THERE) {
        detuneDisplay.textContent = 'Muito acima!';
        noteElement.style.color = '#FF4500';
        needleContainer.style.borderColor = '#FF4500';
        detuneDisplay.style.color = '#FF4500';
    } else if (detune < -TOLERANCE_ALMOST_THERE) {
        detuneDisplay.textContent = 'Muito abaixo!';
        noteElement.style.color = '#FF4500';
        needleContainer.style.borderColor = '#FF4500';
        detuneDisplay.style.color = '#FF4500';
    }
}

startTuner();