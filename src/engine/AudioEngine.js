import {
  ANALYSER_SMOOTHING,
  FFT_SIZE,
  SPECTRUM_BANDS,
} from '../utils/constants.js';

/**
 * AudioEngine - Web Audio API wrapper for BGM playback + spectrum analysis.
 *
 * Routing:
 *   sourceNode -> bgmGain -> destination
 *   sourceNode -> analyser
 *
 * Time tracking:
 *   getCurrentTime() returns elapsed seconds since play() began,
 *   accounting for pauses. Add the user judgeOffset (ms) externally.
 */
export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.bgmGain = null;
    this.seGain = null;
    this.analyser = null;
    this.freqData = null;
    this.audioBuffer = null;
    this.sourceNode = null;

    this.startCtxTime = 0; // audioCtx.currentTime when playback started
    this.pausedAt = 0; // accumulated playback time when paused
    this.isPlaying = false;
    this.isPaused = false;
    this.duration = 0;

    this._spectrum = new Float32Array(SPECTRUM_BANDS);
    this._bandRanges = null;

    this._bgmVolume = 0.8;
    this._seVolume = 0.8;
  }

  ensureContext() {
    if (this.audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new Ctx();
    this.bgmGain = this.audioCtx.createGain();
    this.bgmGain.gain.value = this._bgmVolume;
    this.seGain = this.audioCtx.createGain();
    this.seGain.gain.value = this._seVolume;
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.bgmGain.connect(this.audioCtx.destination);
    this.seGain.connect(this.audioCtx.destination);

    // Pre-compute log-scaled band ranges
    this._computeBandRanges();
  }

  _computeBandRanges() {
    const bins = this.analyser.frequencyBinCount;
    const ranges = [];
    // Logarithmic distribution from bin 1 to bins (skip DC)
    const minBin = 1;
    const maxBin = bins;
    const logMin = Math.log(minBin);
    const logMax = Math.log(maxBin);
    for (let i = 0; i < SPECTRUM_BANDS; i++) {
      const lo = Math.floor(Math.exp(logMin + ((logMax - logMin) * i) / SPECTRUM_BANDS));
      const hi = Math.floor(
        Math.exp(logMin + ((logMax - logMin) * (i + 1)) / SPECTRUM_BANDS)
      );
      ranges.push([Math.max(minBin, lo), Math.max(lo + 1, hi)]);
    }
    this._bandRanges = ranges;
  }

  async load(url) {
    this.ensureContext();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch audio: ${url}`);
    const arr = await res.arrayBuffer();
    this.audioBuffer = await this.audioCtx.decodeAudioData(arr);
    this.duration = this.audioBuffer.duration;
    return this.duration;
  }

  async play() {
    this.ensureContext();
    if (!this.audioBuffer) throw new Error('No audio loaded');
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    this._startSourceFrom(0);
    this.startCtxTime = this.audioCtx.currentTime;
    this.pausedAt = 0;
    this.isPlaying = true;
    this.isPaused = false;
  }

  _startSourceFrom(offsetSec) {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {
        // ignore
      }
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }
    const src = this.audioCtx.createBufferSource();
    src.buffer = this.audioBuffer;
    src.connect(this.bgmGain);
    src.connect(this.analyser);
    src.start(0, offsetSec);
    src.onended = () => {
      // natural end - leave isPlaying as-is so consumer detects via getCurrentTime
    };
    this.sourceNode = src;
  }

  async pause() {
    if (!this.isPlaying || this.isPaused) return;
    this.pausedAt = this.getCurrentTime();
    if (this.audioCtx.state === 'running') {
      await this.audioCtx.suspend();
    }
    this.isPaused = true;
  }

  async resume() {
    if (!this.isPlaying || !this.isPaused) return;
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    this.isPaused = false;
  }

  stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {
        // ignore
      }
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAt = 0;
    this.startCtxTime = 0;
  }

  /** Returns elapsed playback seconds (audio clock). */
  getCurrentTime() {
    if (!this.isPlaying || !this.audioCtx) return 0;
    if (this.isPaused) return this.pausedAt;
    return this.audioCtx.currentTime - this.startCtxTime;
  }

  /** Returns 40-band log-scaled normalized spectrum (0..1). */
  getSpectrum() {
    if (!this.analyser) {
      // idle / not playing - return mild flat spectrum
      for (let i = 0; i < SPECTRUM_BANDS; i++) this._spectrum[i] = 0.18;
      return this._spectrum;
    }
    this.analyser.getByteFrequencyData(this.freqData);
    const ranges = this._bandRanges;
    for (let i = 0; i < SPECTRUM_BANDS; i++) {
      const [lo, hi] = ranges[i];
      let sum = 0;
      let count = 0;
      for (let j = lo; j < hi && j < this.freqData.length; j++) {
        sum += this.freqData[j];
        count++;
      }
      const avg = count > 0 ? sum / count / 255 : 0;
      // Mild low-end bias for visual punch + floor
      this._spectrum[i] = Math.max(0.1, Math.min(1, avg * 1.1));
    }
    return this._spectrum;
  }

  setBgmVolume(v) {
    this._bgmVolume = v;
    if (this.bgmGain) this.bgmGain.gain.value = v;
  }

  setSeVolume(v) {
    this._seVolume = v;
    if (this.seGain) this.seGain.gain.value = v;
  }

  getSeGain() {
    this.ensureContext();
    return this.seGain;
  }

  getContext() {
    this.ensureContext();
    return this.audioCtx;
  }
}

// Singleton — only one AudioContext per page.
let instance = null;
export function getAudioEngine() {
  if (!instance) instance = new AudioEngine();
  return instance;
}
