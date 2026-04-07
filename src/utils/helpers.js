import {
  DEFAULT_SETTINGS,
  DISCO_LEVEL_THRESHOLDS,
  SETTINGS_STORAGE_KEY,
} from './constants.js';

export function getDiscoLevel(combo) {
  let level = 0;
  for (let i = DISCO_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (combo >= DISCO_LEVEL_THRESHOLDS[i]) {
      level = i;
      break;
    }
  }
  return level;
}

export function barHue(i, total) {
  return (i / total) * 300 + 180;
}

export function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota
  }
}

export function titleFromId(id) {
  return id.replace(/_/g, ' ');
}

export function hexWithAlpha(hex, alpha) {
  const a = Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + a;
}

export function accuracyPercent(perfects, greats, goods, totalNotes) {
  if (!totalNotes) return 0;
  return ((perfects * 100 + greats * 75 + goods * 50) / (totalNotes * 100)) * 100;
}
