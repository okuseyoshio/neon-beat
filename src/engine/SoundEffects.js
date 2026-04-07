import { getAudioEngine } from './AudioEngine.js';

const SE_FILES = {
  perfect: '/se/hit_perfect.wav',
  great: '/se/hit_great.wav',
  good: '/se/hit_good.wav',
  miss: '/se/miss.wav',
  combo: '/se/combo_milestone.wav',
  flash: '/se/flash.wav',
};

class SoundEffectsManager {
  constructor() {
    this.buffers = {};
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;
    const engine = getAudioEngine();
    const ctx = engine.getContext();
    const entries = Object.entries(SE_FILES);
    await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error('not found');
          const arr = await res.arrayBuffer();
          this.buffers[key] = await ctx.decodeAudioData(arr);
        } catch {
          // missing or undecodable - leave undefined; fallback oscillator will be used
          this.buffers[key] = null;
        }
      })
    );
    this.loaded = true;
  }

  _playBuffer(key) {
    const engine = getAudioEngine();
    const ctx = engine.getContext();
    const buf = this.buffers[key];
    if (!buf) {
      this._fallback(key);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(engine.getSeGain());
    src.start(0);
  }

  _fallback(key) {
    const engine = getAudioEngine();
    const ctx = engine.getContext();
    const seGain = engine.getSeGain();
    const now = ctx.currentTime;

    // Fallback oscillator gains are intentionally quiet so the "ピコ" hit
    // sounds don't drown out the BGM. Adjust SE VOLUME in settings if needed.
    const beep = (freq, durMs, type = 'sine', startGain = 0.08) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(startGain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000);
      osc.connect(gain);
      gain.connect(seGain);
      osc.start(now);
      osc.stop(now + durMs / 1000 + 0.02);
    };

    switch (key) {
      case 'perfect':
        beep(880, 30, 'triangle', 0.09);
        break;
      case 'great':
        beep(660, 30, 'triangle', 0.08);
        break;
      case 'good':
        beep(440, 30, 'triangle', 0.07);
        break;
      case 'miss':
        beep(200, 50, 'sawtooth', 0.07);
        break;
      case 'combo': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(gain);
        gain.connect(seGain);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      }
      case 'flash': {
        // "ピカーン!" - a bright sweeping shimmer for the screen-flash transition.
        // Layer 1: rising sine sweep 200Hz → 2400Hz over 0.6s with a sparkle decay
        const osc1 = ctx.createOscillator();
        const g1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(220, now);
        osc1.frequency.exponentialRampToValueAtTime(2400, now + 0.55);
        g1.gain.setValueAtTime(0.0001, now);
        g1.gain.exponentialRampToValueAtTime(0.45, now + 0.05);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        osc1.connect(g1);
        g1.connect(seGain);
        osc1.start(now);
        osc1.stop(now + 1.5);

        // Layer 2: detuned sine an octave up for shimmer
        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(440, now);
        osc2.frequency.exponentialRampToValueAtTime(4800, now + 0.55);
        g2.gain.setValueAtTime(0.0001, now);
        g2.gain.exponentialRampToValueAtTime(0.22, now + 0.06);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
        osc2.connect(g2);
        g2.connect(seGain);
        osc2.start(now);
        osc2.stop(now + 1.5);

        // Layer 3: short noise burst for the initial "pi-" attack via sawtooth
        const osc3 = ctx.createOscillator();
        const g3 = ctx.createGain();
        osc3.type = 'sawtooth';
        osc3.frequency.setValueAtTime(1800, now);
        osc3.frequency.exponentialRampToValueAtTime(120, now + 0.25);
        g3.gain.setValueAtTime(0.0001, now);
        g3.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
        g3.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        osc3.connect(g3);
        g3.connect(seGain);
        osc3.start(now);
        osc3.stop(now + 0.45);
        break;
      }
      default:
        beep(440, 30);
    }
  }

  playPerfect() {
    this._playBuffer('perfect');
  }
  playGreat() {
    this._playBuffer('great');
  }
  playGood() {
    this._playBuffer('good');
  }
  playMiss() {
    this._playBuffer('miss');
  }
  playComboMilestone() {
    this._playBuffer('combo');
  }
  playFlash() {
    this._playBuffer('flash');
  }

  playJudgment(judgment) {
    switch (judgment) {
      case 'perfect':
        this.playPerfect();
        break;
      case 'great':
        this.playGreat();
        break;
      case 'good':
        this.playGood();
        break;
      case 'miss':
        this.playMiss();
        break;
      default:
        break;
    }
  }
}

let instance = null;
export function getSoundEffects() {
  if (!instance) instance = new SoundEffectsManager();
  return instance;
}
