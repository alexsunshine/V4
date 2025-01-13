import './style.css';
import * as Tone from 'tone';

class AudioVisualizer {
  constructor() {
    this.isRecording = false;
    this.timeline = [];
    this.setupUI();
    this.setupAudioAnalysis();
  }

  setupUI() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="min-h-screen bg-gray-900 p-8">
        <div class="max-w-4xl mx-auto">
          <h1 class="text-4xl font-bold text-white mb-8">Visualizador de Sonido a Color</h1>
          
          <div class="mb-8">
            <button id="startBtn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded mr-4">
              Iniciar Micrófono
            </button>
            <button id="recordBtn" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded" disabled>
              Grabar
            </button>
            <input type="file" id="audioFileInput" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded ml-4" accept="audio/*" />
            <button id="playAudioBtn" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded ml-4" disabled>
              Reproducir
            </button>
          </div>

          <div class="bg-white rounded-lg p-8 mb-8">
            <div id="currentColor" class="w-full h-64 rounded-lg border-4 border-gray-200 transition-all duration-200"></div>
          </div>

          <div id="timeline" class="h-32 bg-gray-800 rounded-lg overflow-x-auto whitespace-nowrap p-4"></div>
        </div>
      </div>
    `;

    this.startBtn = document.getElementById('startBtn');
    this.recordBtn = document.getElementById('recordBtn');
    this.audioFileInput = document.getElementById('audioFileInput');
    this.playAudioBtn = document.getElementById('playAudioBtn');
    this.currentColor = document.getElementById('currentColor');
    this.timelineEl = document.getElementById('timeline');

    this.startBtn.addEventListener('click', () => this.startAudio());
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
    this.audioFileInput.addEventListener('change', (event) => this.handleAudioFile(event));
    this.playAudioBtn.addEventListener('click', () => this.playAudio());
  }

  async setupAudioAnalysis() {
    this.analyzer = new Tone.Analyser('fft', 2048);
    this.meter = new Tone.Meter();
  }

  async startAudio() {
    try {
      await Tone.start();
      const mic = new Tone.UserMedia();
      await mic.open();
      
      mic.connect(this.analyzer);
      mic.connect(this.meter);

      this.startBtn.disabled = true;
      this.recordBtn.disabled = false;
      this.startAnalysis();
    } catch (error) {
      console.error('Error al acceder al micrófono:', error);
      alert('No se pudo acceder al micrófono. Por favor, permite el acceso al micrófono y recarga la página.');
    }
  }

  handleAudioFile(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.audioBuffer = e.target.result;
        this.playAudioBtn.disabled = false;
      };
      reader.readAsArrayBuffer(file);
    }
  }

  async playAudio() {
    if (this.audioBuffer) {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(this.audioBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = audioCtx.createGain();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;

      source.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      source.start();

      this.analyzeAudio(analyser);
    }
  }

  analyzeAudio(analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const analyzeFrame = () => {
      analyser.getByteFrequencyData(dataArray);

      const nyquist = Tone.context.sampleRate / 2;
      const threshold = -60;
      let totalEnergy = 0;
      let weightedColor = {r: 0, g: 0, b: 0};

      for (let i = 0; i < dataArray.length; i++) {
        const amplitude = dataArray[i];
        if (amplitude > threshold) {
          const frequency = (i * nyquist) / dataArray.length;
          const weight = Math.pow(10, amplitude / 20);
          totalEnergy += weight;
          
          const color = this.frequencyToColor(frequency, amplitude);
          weightedColor.r += color.r * weight;
          weightedColor.g += color.g * weight;
          weightedColor.b += color.b * weight;
        }
      }

      if (totalEnergy > 0) {
        weightedColor.r = Math.round(weightedColor.r / totalEnergy);
        weightedColor.g = Math.round(weightedColor.g / totalEnergy);
        weightedColor.b = Math.round(weightedColor.b / totalEnergy);
      }

      const finalColor = `rgb(${weightedColor.r}, ${weightedColor.g}, ${weightedColor.b})`;
      this.currentColor.style.backgroundColor = finalColor;

      if (this.isRecording) {
        this.timeline.push({
          color: finalColor,
          timestamp: Date.now()
        });
        this.updateTimeline();
      }

      requestAnimationFrame(analyzeFrame);
    };

    analyzeFrame();
  }

  frequencyToWavelength(frequency) {
    const speedOfSound = 343;
    return speedOfSound / frequency;
  }

  soundToLightWavelength(soundWavelength) {
    const minSoundWL = this.frequencyToWavelength(20000);
    const maxSoundWL = this.frequencyToWavelength(20);
    
    const minLightWL = 380;
    const maxLightWL = 750;
    
    const logSoundWL = Math.log(soundWavelength);
    const logMinSoundWL = Math.log(minSoundWL);
    const logMaxSoundWL = Math.log(maxSoundWL);
    
    const normalizedPosition = (logSoundWL - logMinSoundWL) / (logMaxSoundWL - logMinSoundWL);
    return minLightWL + (maxLightWL - minLightWL) * (1 - normalizedPosition);
  }

  wavelengthToRGB(wavelength) {
    let r, g, b;
    
    if (wavelength >= 380 && wavelength < 440) {
      r = -(wavelength - 440) / (440 - 380);
      g = 0;
      b = 1;
    } else if (wavelength >= 440 && wavelength < 490) {
      r = 0;
      g = (wavelength - 440) / (490 - 440);
      b = 1;
    } else if (wavelength >= 490 && wavelength < 510) {
      r = 0;
      g = 1;
      b = -(wavelength - 510) / (510 - 490);
    } else if (wavelength >= 510 && wavelength < 580) {
      r = (w[_{{{CITATION{{{_1{](https://github.com/bluuweb/bootstrap-5-udemy/tree/6e8204823765693074d6c9c7f99d8de3955417ec/10-parcel%2FREADME.md)[_{{{CITATION{{{_2{](https://github.com/la9una/web/tree/ba1073ae044ebb7b538a3b13f0f9598f7c410bb6/docs%2Fbootstrap%2Falignci.md)[_{{{CITATION{{{_3{](https://github.com/CLONATORE/markdowns/tree/82cfb03683ceb807a7091de48045e6a7485acd72/webpack.md)[_{{{CITATION{{{_4{](https://github.com/citxx/rainbow-explained/tree/2392bdaa8b91333aeaaf202b3c065f565e45cd3b/js%2Fphysics.js)