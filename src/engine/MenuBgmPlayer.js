import { getAudioEngine } from './AudioEngine.js';

/**
 * MenuBgmPlayer - looped background music for the title / song-select /
 * difficulty / result screens. Shares the same AudioContext as the main
 * AudioEngine but uses an independent gain node so it can be cross-faded
 * with the in-game BGM without interfering.
 *
 * Failure-tolerant: if `/bgm/menu.wav` doesn't exist, every method becomes
 * a no-op and the rest of the app keeps working.
 */
class MenuBgmPlayer {
  constructor() {
    this.buffer = null;
    this.source = null;
    this.gain = null;
    this.baseVolume = 0.8; // mirrors settings.bgmVolume
    this.isPlaying = false;
    this.loaded = false;
    this.loadFailed = false;
    this.fadeOutStopId = 0;
  }

  _ensureGain() {
    if (this.gain) return;
    const ctx = getAudioEngine().getContext();
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(ctx.destination);
  }

  async load(url) {
    if (this.loaded || this.loadFailed) return;
    try {
      const ctx = getAudioEngine().getContext();
      const res = await fetch(url);
      if (!res.ok) throw new Error('not found');
      const arr = await res.arrayBuffer();
      this.buffer = await ctx.decodeAudioData(arr);
      this.loaded = true;
    } catch {
      this.loadFailed = true;
      this.buffer = null;
    }
  }

  /**
   * Start the looping source if not already playing.
   * Caller is responsible for ensuring AudioContext is running (post-gesture).
   */
  play() {
    if (!this.loaded || !this.buffer) return;
    if (this.isPlaying) return;
    const ctx = getAudioEngine().getContext();
    this._ensureGain();
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    src.connect(this.gain);
    src.start(0);
    this.source = src;
    this.isPlaying = true;
  }

  fadeIn(durationMs = 800) {
    if (!this.loaded) return;
    this.play();
    if (!this.gain) return;
    const ctx = getAudioEngine().getContext();
    const now = ctx.currentTime;
    // Cancel any pending fade-out stop
    this.fadeOutStopId++;
    this.gain.gain.cancelScheduledValues(now);
    // Start from current value (might be partway through a previous fade)
    const current = this.gain.gain.value;
    this.gain.gain.setValueAtTime(current, now);
    this.gain.gain.linearRampToValueAtTime(this.baseVolume, now + durationMs / 1000);
  }

  fadeOut(durationMs = 800) {
    if (!this.gain || !this.isPlaying) return;
    const ctx = getAudioEngine().getContext();
    const now = ctx.currentTime;
    const current = this.gain.gain.value;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(current, now);
    this.gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);
    // Stop the source after the fade so we don't waste CPU
    const stopId = ++this.fadeOutStopId;
    setTimeout(() => {
      // Only stop if no fadeIn happened in the meantime
      if (stopId === this.fadeOutStopId) {
        this.stop();
      }
    }, durationMs + 50);
  }

  stop() {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        // ignore
      }
      try {
        this.source.disconnect();
      } catch {
        // ignore
      }
      this.source = null;
    }
    if (this.gain) {
      this.gain.gain.value = 0;
    }
    this.isPlaying = false;
  }

  setVolume(v) {
    this.baseVolume = Math.max(0, Math.min(1, v));
    // If we are currently playing AND not in the middle of a fade, snap to it.
    // (Fades will use baseVolume as their target on the next call.)
    if (this.gain && this.isPlaying) {
      const ctx = getAudioEngine().getContext();
      const now = ctx.currentTime;
      // Quick 50ms ramp so volume slider feels live without clicks
      this.gain.gain.cancelScheduledValues(now);
      const current = this.gain.gain.value;
      this.gain.gain.setValueAtTime(current, now);
      this.gain.gain.linearRampToValueAtTime(this.baseVolume, now + 0.05);
    }
  }
}

let instance = null;
export function getMenuBgm() {
  if (!instance) instance = new MenuBgmPlayer();
  return instance;
}
