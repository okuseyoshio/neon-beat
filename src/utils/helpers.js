import {
  DEFAULT_SETTINGS,
  DISCO_LEVEL_THRESHOLDS,
  SETTINGS_STORAGE_KEY,
  SONG_STATS_STORAGE_KEY,
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

export function loadSongStats() {
  try {
    const raw = localStorage.getItem(SONG_STATS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSongStats(stats) {
  try {
    localStorage.setItem(SONG_STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // ignore quota
  }
}

/**
 * Record a finished play for a song. Updates lastPlayed/playCount, and if a
 * scoreEntry is provided, appends it to the per-song score list and keeps
 * the top MAX_SCORES_PER_SONG by score (descending).
 *
 * scoreEntry shape (all optional except score):
 *   {
 *     score: number,
 *     difficulty: 'easy'|'normal'|'hard'|'expert',
 *     accuracy: number,        // 0..100
 *     maxCombo: number,
 *     autoPlay: boolean,
 *     timestamp: number        // ms epoch (auto-set if omitted)
 *   }
 */
export const MAX_SCORES_PER_SONG = 10;

export function recordSongPlay(songId, scoreEntry = null) {
  if (!songId) return;
  const stats = loadSongStats();
  const cur = stats[songId] || { lastPlayed: 0, playCount: 0, scores: [] };
  const next = {
    lastPlayed: Date.now(),
    playCount: (cur.playCount || 0) + 1,
    scores: Array.isArray(cur.scores) ? cur.scores.slice() : [],
  };
  if (scoreEntry && typeof scoreEntry.score === 'number') {
    next.scores.push({
      score: scoreEntry.score,
      difficulty: scoreEntry.difficulty || null,
      accuracy: typeof scoreEntry.accuracy === 'number' ? scoreEntry.accuracy : null,
      maxCombo: typeof scoreEntry.maxCombo === 'number' ? scoreEntry.maxCombo : null,
      autoPlay: !!scoreEntry.autoPlay,
      timestamp: scoreEntry.timestamp || Date.now(),
    });
    // Sort by score desc, keep top N
    next.scores.sort((a, b) => b.score - a.score);
    if (next.scores.length > MAX_SCORES_PER_SONG) {
      next.scores.length = MAX_SCORES_PER_SONG;
    }
  }
  stats[songId] = next;
  saveSongStats(stats);
}

export function getSongScores(songId) {
  if (!songId) return [];
  const stats = loadSongStats();
  const entry = stats[songId];
  return Array.isArray(entry?.scores) ? entry.scores : [];
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
