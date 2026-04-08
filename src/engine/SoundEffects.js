import { getAudioEngine } from './AudioEngine.js';

const SE_FILES = {
  perfect: '/se/hit_perfect.wav',
  great: '/se/hit_great.wav',
  good: '/se/hit_good.wav',
  miss: '/se/miss.wav',
  combo: '/se/combo_milestone.wav',
  flash: '/se/flash.wav',
  countdown: '/se/countdown.wav',
};

class SoundEffectsManager {
  constructor() {
    this.buffers = {};
    this.loaded = false;
    this._noiseBuffer = null; // cached white-noise buffer for crowd cheer
    this._ambience = null; // sustained crowd-cheer state (loop + whoops)
    // Master kill-switch for in-game SE. When false, every play* method
    // becomes a no-op (and any running ambience is stopped). The countdown
    // SE in IntroOverlay calls playCountdown directly and is NOT gated by
    // this flag — the countdown is part of the pre-game sequence.
    this._gameSeEnabled = true;
  }

  setGameSeEnabled(enabled) {
    this._gameSeEnabled = !!enabled;
    if (!this._gameSeEnabled) {
      this.stopCrowdAmbience();
    }
  }

  _getNoiseBuffer() {
    if (this._noiseBuffer) return this._noiseBuffer;
    const ctx = getAudioEngine().getContext();
    // 2 seconds of stereo PINK noise — softer than white, much more natural
    // for crowd / breath / wind textures. Generated via Voss-McCartney approx.
    const length = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        data[i] = pink * 0.11; // normalize
      }
    }
    this._noiseBuffer = buf;
    return buf;
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
      case 'countdown': {
        // Generic countdown beep - used by playCountdown(digit) when no
        // pre-rendered wav is shipped. The digit-specific pitch is applied
        // in playCountdown directly via _countdownBeep below.
        beep(660, 120, 'square', 0.12);
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
    if (!this._gameSeEnabled) return;
    this._playBuffer('perfect');
  }
  playGreat() {
    if (!this._gameSeEnabled) return;
    this._playBuffer('great');
  }
  playGood() {
    if (!this._gameSeEnabled) return;
    this._playBuffer('good');
  }
  playMiss() {
    if (!this._gameSeEnabled) return;
    this._playBuffer('miss');
  }
  playComboMilestone() {
    if (!this._gameSeEnabled) return;
    this._playBuffer('combo');
  }

  /**
   * Synthesized audience cheer that scales with combo count.
   * Tier mapping (from COMBO_MILESTONES = [25,50,100,200,300,500]):
   *   combo  25 → tier 1 (light applause)
   *   combo  50 → tier 2 (warm cheer)
   *   combo 100 → tier 3 (excited crowd)
   *   combo 200 → tier 4 (loud roar)
   *   combo 300 → tier 5 (stadium-level)
   *   combo 500 → tier 5 (clamped, with extra layers)
   *
   * The cheer is layered:
   *   - Band-passed white noise = the "shhh" wash of voices
   *   - Multiple short pitch sweeps = individual whoops/screams
   *   - Filtered noise bursts at random times = claps (higher tiers only)
   */
  playCrowdCheer(combo) {
    if (!this._gameSeEnabled) return;
    const engine = getAudioEngine();
    const ctx = engine.getContext();
    const seGain = engine.getSeGain();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Map combo → tier 1..5
    let tier;
    if (combo >= 300) tier = 5;
    else if (combo >= 200) tier = 4;
    else if (combo >= 100) tier = 3;
    else if (combo >= 50) tier = 2;
    else tier = 1;

    const presets = {
      1: { dur: 1.2, noiseGain: 0.40, sweeps: 3, claps: 0,  centerFreq: 1100 },
      2: { dur: 1.6, noiseGain: 0.55, sweeps: 5, claps: 3,  centerFreq: 1300 },
      3: { dur: 2.2, noiseGain: 0.75, sweeps: 8, claps: 6,  centerFreq: 1500 },
      4: { dur: 2.8, noiseGain: 0.95, sweeps: 12, claps: 10, centerFreq: 1700 },
      5: { dur: 3.5, noiseGain: 1.20, sweeps: 18, claps: 16, centerFreq: 1900 },
    };
    const p = presets[tier];
    const now = ctx.currentTime;

    // ---- Layer 1: filtered noise wash ("shhh" of the crowd) ----
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this._getNoiseBuffer();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(p.centerFreq, now);
    noiseFilter.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    // Envelope: fast attack, slow swell, slow decay (the crowd "wave")
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(p.noiseGain * 0.6, now + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(p.noiseGain, now + p.dur * 0.35);
    noiseGain.gain.exponentialRampToValueAtTime(p.noiseGain * 0.7, now + p.dur * 0.65);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(seGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + p.dur + 0.05);

    // ---- Layer 2: random pitch-swept "whoops" (individual voices) ----
    for (let i = 0; i < p.sweeps; i++) {
      const startOffset = Math.random() * p.dur * 0.7;
      const sweepDur = 0.25 + Math.random() * 0.4;
      const startFreq = 350 + Math.random() * 400;
      const peakFreq = startFreq + 200 + Math.random() * 350;
      const t0 = now + startOffset;

      const osc = ctx.createOscillator();
      osc.type = Math.random() < 0.5 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(startFreq, t0);
      osc.frequency.exponentialRampToValueAtTime(peakFreq, t0 + sweepDur * 0.4);
      osc.frequency.exponentialRampToValueAtTime(startFreq * 0.7, t0 + sweepDur);

      // Soft formant-ish filter so it doesn't sound like a synth
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 800 + Math.random() * 600;
      filt.Q.value = 1.5;

      const g = ctx.createGain();
      const peakGain = (0.10 + Math.random() * 0.08) * (0.8 + tier * 0.18);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + sweepDur);

      osc.connect(filt);
      filt.connect(g);
      g.connect(seGain);
      osc.start(t0);
      osc.stop(t0 + sweepDur + 0.02);
    }

    // ---- Layer 3: clap bursts (filtered short noise) for higher tiers ----
    for (let i = 0; i < p.claps; i++) {
      const t0 = now + 0.1 + Math.random() * (p.dur - 0.3);
      const clapSrc = ctx.createBufferSource();
      clapSrc.buffer = this._getNoiseBuffer();
      const clapFilt = ctx.createBiquadFilter();
      clapFilt.type = 'bandpass';
      clapFilt.frequency.value = 1800 + Math.random() * 1200;
      clapFilt.Q.value = 1.0;
      const clapGain = ctx.createGain();
      clapGain.gain.setValueAtTime(0.0001, t0);
      clapGain.gain.exponentialRampToValueAtTime(0.40 + tier * 0.06, t0 + 0.005);
      clapGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      clapSrc.connect(clapFilt);
      clapFilt.connect(clapGain);
      clapGain.connect(seGain);
      clapSrc.start(t0);
      clapSrc.stop(t0 + 0.12);
    }
  }
  playFlash() {
    this._playBuffer('flash');
  }

  /**
   * Short metronome click for calibration. The `scheduledOffsetSec` parameter
   * lets the caller schedule the click to fire ahead of (negative) or behind
   * (positive) the current audio time, so the visual flash and the audio can
   * be deliberately offset to match the user's setup.
   *
   * NOT gated by gameSeEnabled — this is a calibration tool, not in-game SE.
   */
  playMetronomeClick(scheduledOffsetSec = 0) {
    const engine = getAudioEngine();
    const ctx = engine.getContext();
    const seGain = engine.getSeGain();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    // Cannot schedule into the past — clamp to "now".
    const t0 = Math.max(ctx.currentTime, ctx.currentTime + scheduledOffsetSec);
    const dur = 0.05;

    // Sharp tick: short sine burst at 1500 Hz
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(seGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    // Return the oscillator so callers can stop scheduled-but-not-yet-played
    // ticks early (e.g. when the calibration modal closes).
    return osc;
  }

  // Countdown SE for the pre-game "3 / 2 / 1" digits. If a pre-rendered
  // /se/countdown.wav exists, play it as-is for every digit. Otherwise use
  // an oscillator beep whose pitch ramps up as the digit gets smaller so
  // "1" feels punchier than "3".
  playCountdown(digit) {
    if (this.buffers.countdown) {
      this._playBuffer('countdown');
      return;
    }
    const engine = getAudioEngine();
    const ctx = engine.getContext();
    const seGain = engine.getSeGain();
    // Make sure the AudioContext isn't suspended (can happen if the OS or
    // browser threw the page into background between difficulty select and
    // the countdown). Without this, the oscillators schedule but never play.
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    // Same pitch for every digit so 3 / 2 / 1 feel like a uniform metronome.
    // E5 = 659Hz sits well above typical BGM mids without being shrill.
    void digit;
    const freq = 659;
    const dur = 0.32;

    // Layer 1: square body — loud, attention-grabbing
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.55, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(seGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);

    // Layer 2: sine an octave up for a bright "ピッ" topping
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);
    g2.gain.setValueAtTime(0.0001, now);
    g2.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc2.connect(g2);
    g2.connect(seGain);
    osc2.start(now);
    osc2.stop(now + dur + 0.02);

    // Layer 3: sub triangle for body
    const osc3 = ctx.createOscillator();
    const g3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(freq * 0.5, now);
    g3.gain.setValueAtTime(0.0001, now);
    g3.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
    g3.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc3.connect(g3);
    g3.connect(seGain);
    osc3.start(now);
    osc3.stop(now + dur + 0.02);
  }

  /**
   * Sustained, looping crowd ambience for high combos. Call every time
   * combo changes; the manager internally starts/stops/ramps as needed.
   *
   * Tier mapping:
   *   combo <  50 → off
   *   combo >= 50 → tier 1 (steady applause)
   *   combo >= 100 → tier 2 (louder roar)
   *   combo >= 200 → tier 3 (max stadium)
   */
  updateCrowdAmbience(combo) {
    if (!this._gameSeEnabled) {
      this.stopCrowdAmbience();
      return;
    }
    let tier;
    if (combo >= 200) tier = 3;
    else if (combo >= 100) tier = 2;
    else if (combo >= 50) tier = 1;
    else tier = 0;

    if (tier === 0) {
      this.stopCrowdAmbience();
      return;
    }

    if (!this._ambience) {
      this._startAmbience();
    }
    if (!this._ambience) return;

    const ctx = getAudioEngine().getContext();
    const now = ctx.currentTime;
    // Loud target gains so the cheer is clearly audible over BGM.
    const targetGain = { 1: 0.55, 2: 0.85, 3: 1.2 }[tier];
    const noise = this._ambience.noiseGain.gain;
    noise.cancelScheduledValues(now);
    noise.setValueAtTime(noise.value, now);
    noise.linearRampToValueAtTime(targetGain, now + 0.5);
    this._ambience.tier = tier;
  }

  stopCrowdAmbience() {
    if (!this._ambience) return;
    const ctx = getAudioEngine().getContext();
    const now = ctx.currentTime;
    const { noiseSrc, noiseGain, whoopInterval, lfo } = this._ambience;
    clearInterval(whoopInterval);
    noiseGain.gain.cancelScheduledValues(now);
    noiseGain.gain.setValueAtTime(noiseGain.gain.value, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    setTimeout(() => {
      try { noiseSrc.stop(); } catch { /* ignore */ }
      try { noiseSrc.disconnect(); } catch { /* ignore */ }
      try { lfo.stop(); } catch { /* ignore */ }
      try { lfo.disconnect(); } catch { /* ignore */ }
    }, 500);
    this._ambience = null;
  }

  _startAmbience() {
    const engine = getAudioEngine();
    const ctx = engine.getContext();
    const seGain = engine.getSeGain();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Pink-noise loop = the breath of the crowd
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this._getNoiseBuffer();
    noiseSrc.loop = true;

    // Tame the very high end first — crowds don't have crisp 8kHz hiss
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3500;
    lowpass.Q.value = 0.7;

    // Three parallel formant peaks — these are the resonant cavities of
    // the open vowel "ahh", which is what a roaring crowd actually sounds
    // like. Q is moderate so it stays smooth, not whistly.
    const makeFormant = (freq, q, gain) => {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      f.connect(g);
      return { filter: f, gain: g };
    };
    const f1 = makeFormant(720, 1.4, 1.0);   // F1 of "ahh"
    const f2 = makeFormant(1180, 1.6, 0.7);  // F2 of "ahh"
    const f3 = makeFormant(2400, 2.0, 0.35); // brilliance / "presence"

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.0001;

    // Routing: noise → lowpass → 3 parallel formants → master gain
    noiseSrc.connect(lowpass);
    lowpass.connect(f1.filter);
    lowpass.connect(f2.filter);
    lowpass.connect(f3.filter);
    f1.gain.connect(noiseGain);
    f2.gain.connect(noiseGain);
    f3.gain.connect(noiseGain);
    noiseGain.connect(seGain);

    // Slow LFO on F1 frequency for a subtle "breathing crowd" wave (~0.4 Hz)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 60; // ±60Hz wobble around 720
    lfo.connect(lfoGain);
    lfoGain.connect(f1.filter.frequency);
    lfo.start(0);

    noiseSrc.start(0);

    // Random whoop sweeps so individual voices punch through
    const whoopInterval = setInterval(() => {
      if (!this._ambience) return;
      this._spawnAmbientWhoop(this._ambience.tier);
    }, 320);

    this._ambience = {
      noiseSrc,
      noiseGain,
      whoopInterval,
      lfo,
      tier: 1,
    };
  }

  _spawnAmbientWhoop(tier) {
    const engine = getAudioEngine();
    const ctx = engine.getContext();
    const seGain = engine.getSeGain();
    const now = ctx.currentTime;
    const sweepDur = 0.4 + Math.random() * 0.5;
    // Vocal range — not synthy: 200..380 Hz fundamental
    const startFreq = 200 + Math.random() * 180;
    const peakFreq = startFreq * (1.15 + Math.random() * 0.25);

    // Triangle only (sawtooth was too buzzy / synth-y)
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(peakFreq, now + sweepDur * 0.45);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.85, now + sweepDur);

    // Two parallel formants on the same voice → "ahh" vowel character
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.value = 700 + Math.random() * 200;
    f1.Q.value = 3;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 1100 + Math.random() * 300;
    f2.Q.value = 4;

    const merge = ctx.createGain();
    merge.gain.value = 0.6;

    const g = ctx.createGain();
    const peakGain = (0.09 + Math.random() * 0.06) * (0.7 + tier * 0.35);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peakGain, now + 0.06);
    g.gain.exponentialRampToValueAtTime(peakGain * 0.6, now + sweepDur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, now + sweepDur);

    osc.connect(f1);
    osc.connect(f2);
    f1.connect(merge);
    f2.connect(merge);
    merge.connect(g);
    g.connect(seGain);
    osc.start(now);
    osc.stop(now + sweepDur + 0.02);
  }

  /**
   * Synthesized disappointed crowd sigh / "ああ…" — fired when a sizeable
   * combo breaks. Intensity scales with how big the broken combo was.
   *
   * The voice is built from descending pitch sweeps over a low-passed
   * noise wash, mimicking a stadium-wide groan.
   */
  playCrowdGroan(lostCombo) {
    if (!this._gameSeEnabled) return;
    const engine = getAudioEngine();
    const ctx = engine.getContext();
    const seGain = engine.getSeGain();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Tier 1..4 by how big the lost combo was
    let tier;
    if (lostCombo >= 200) tier = 4;
    else if (lostCombo >= 100) tier = 3;
    else if (lostCombo >= 50) tier = 2;
    else tier = 1;

    const presets = {
      1: { dur: 1.0, noiseGain: 0.32, voices: 3, centerFreq: 700 },
      2: { dur: 1.4, noiseGain: 0.45, voices: 5, centerFreq: 650 },
      3: { dur: 1.8, noiseGain: 0.62, voices: 8, centerFreq: 600 },
      4: { dur: 2.4, noiseGain: 0.85, voices: 12, centerFreq: 550 },
    };
    const p = presets[tier];
    const now = ctx.currentTime;

    // ---- Layer 1: low-passed noise wash (the breath of the crowd) ----
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this._getNoiseBuffer();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(p.centerFreq, now);
    noiseFilter.Q.value = 0.5;
    const noiseGain = ctx.createGain();
    // Slow swell, slow decay — feels like a long sigh
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(p.noiseGain, now + p.dur * 0.25);
    noiseGain.gain.exponentialRampToValueAtTime(p.noiseGain * 0.5, now + p.dur * 0.7);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(seGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + p.dur + 0.05);

    // ---- Layer 2: descending "ahh" voices ----
    for (let i = 0; i < p.voices; i++) {
      // Stagger start times so it sounds like a wave of disappointment
      const startOffset = Math.random() * p.dur * 0.4;
      const voiceDur = 0.6 + Math.random() * 0.5;
      // Vocal-range starting pitch (220–360 Hz ≈ A3–F#4) sliding down
      const startFreq = 220 + Math.random() * 140;
      const endFreq = startFreq * (0.55 + Math.random() * 0.15);
      const t0 = now + startOffset;

      const osc = ctx.createOscillator();
      osc.type = Math.random() < 0.5 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(startFreq, t0);
      osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + voiceDur);

      // Vocal-formant-ish bandpass (around 700–900 Hz like an "ah" vowel)
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 700 + Math.random() * 200;
      filt.Q.value = 2.5;

      const g = ctx.createGain();
      const peakGain = (0.085 + Math.random() * 0.06) * (0.8 + tier * 0.18);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(peakGain * 0.7, t0 + voiceDur * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + voiceDur);

      osc.connect(filt);
      filt.connect(g);
      g.connect(seGain);
      osc.start(t0);
      osc.stop(t0 + voiceDur + 0.02);
    }
  }

  /**
   * Synthesized crowd boo / "ブーーー！" — fired when the player misses
   * several notes in a row. Intensity scales with the miss streak length.
   *
   * Built from sustained low-mid sawtooth voices on a "oo" formant
   * (around 300–500 Hz), plus a noise wash. Slightly detuned voices
   * give it a hostile rumble.
   */
  playCrowdBoo(missStreak) {
    if (!this._gameSeEnabled) return;
    const engine = getAudioEngine();
    const ctx = engine.getContext();
    const seGain = engine.getSeGain();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    let tier;
    if (missStreak >= 14) tier = 4;
    else if (missStreak >= 11) tier = 3;
    else if (missStreak >= 8) tier = 2;
    else tier = 1;

    const presets = {
      1: { dur: 1.2, noiseGain: 0.36, voices: 4 },
      2: { dur: 1.6, noiseGain: 0.50, voices: 7 },
      3: { dur: 2.0, noiseGain: 0.68, voices: 10 },
      4: { dur: 2.6, noiseGain: 0.90, voices: 14 },
    };
    const p = presets[tier];
    const now = ctx.currentTime;

    // ---- Layer 1: low rumbling noise wash ----
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this._getNoiseBuffer();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(450, now);
    noiseFilter.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(p.noiseGain, now + 0.12);
    noiseGain.gain.exponentialRampToValueAtTime(p.noiseGain * 0.85, now + p.dur * 0.7);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(seGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + p.dur + 0.05);

    // ---- Layer 2: sustained "boo" voices ----
    for (let i = 0; i < p.voices; i++) {
      const startOffset = Math.random() * 0.15;
      const voiceDur = 0.7 + Math.random() * (p.dur - 0.8);
      // "oo" vowel range — low/mid 140–230 Hz, slightly detuned per voice
      const baseFreq = 140 + Math.random() * 90;
      const t0 = now + startOffset;

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, t0);
      // Slight downward droop at the end for that aggressive tail
      osc.frequency.linearRampToValueAtTime(baseFreq * 0.92, t0 + voiceDur);

      // "oo" formant ≈ 300 Hz + 800 Hz — emulate with a bandpass around 350
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 320 + Math.random() * 120;
      filt.Q.value = 3;

      const g = ctx.createGain();
      const peakGain = (0.11 + Math.random() * 0.07) * (0.8 + tier * 0.20);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.1);
      g.gain.exponentialRampToValueAtTime(peakGain * 0.85, t0 + voiceDur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + voiceDur);

      osc.connect(filt);
      filt.connect(g);
      g.connect(seGain);
      osc.start(t0);
      osc.stop(t0 + voiceDur + 0.02);
    }
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
