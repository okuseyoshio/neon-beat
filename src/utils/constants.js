// ===== Lane / Color =====
export const LANES = 4;
export const LANE_KEYS = ['D', 'F', 'J', 'K'];
export const LANE_KEY_CODES = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
export const LANE_COLORS = ['#ff2d95', '#00e5ff', '#ffe600', '#b388ff'];
export const LANE_GLOW = ['#ff2d9580', '#00e5ff80', '#ffe60080', '#b388ff80'];

// ===== Judgment =====
export const JUDGMENTS = {
  perfect: { text: 'PERFECT', color: '#ffe600', score: 100, window: 0.05 },
  great: { text: 'GREAT', color: '#00e5ff', score: 75, window: 0.1 },
  good: { text: 'GOOD', color: '#b388ff', score: 50, window: 0.15 },
  miss: { text: 'MISS', color: '#ff2d95', score: 0, window: Infinity },
};

export const JUDGMENT_KEYS = ['perfect', 'great', 'good', 'miss'];

// ===== Screens =====
export const SCREENS = {
  TITLE: 'title',
  SONG_SELECT: 'songSelect',
  DIFFICULTY_SELECT: 'difficultySelect',
  GAME: 'game',
  RESULT: 'result',
};

// ===== Difficulty =====
export const DIFFICULTIES = ['easy', 'normal', 'hard', 'expert'];
export const DIFFICULTY_LABELS = {
  easy: 'EASY',
  normal: 'NORMAL',
  hard: 'HARD',
  expert: 'EXPERT',
};
export const DIFFICULTY_COLORS = {
  easy: '#5cffa6',
  normal: '#00e5ff',
  hard: '#ff2d95',
  expert: '#b388ff',
};

// ===== Disco Level =====
export const DISCO_LEVEL_THRESHOLDS = [0, 5, 15, 25, 40];

// ===== Settings =====
export const DEFAULT_SETTINGS = {
  noteSpeed: 400, // px/sec
  judgeOffset: 0, // ms
  bgmVolume: 1.0,
  seVolume: 0.35,
  autoPlay: false,
};

export const SETTINGS_RANGE = {
  noteSpeed: { min: 200, max: 800, step: 10 },
  judgeOffset: { min: -100, max: 100, step: 1 },
  bgmVolume: { min: 0, max: 1, step: 0.01 },
  seVolume: { min: 0, max: 1, step: 0.01 },
};

export const SETTINGS_STORAGE_KEY = 'neonbeat.settings.v2';

// ===== Audio / Visual =====
export const SPECTRUM_BANDS = 40;
export const FFT_SIZE = 2048;
export const ANALYSER_SMOOTHING = 0.8;

// ===== Game Field =====
export const FIELD_WIDTH = 480;
export const FIELD_HEIGHT = 640;
export const JUDGE_LINE_OFFSET = 80; // px from bottom of field

// ===== Particles =====
export const MAX_PARTICLES = 60;
export const PARTICLES_PER_HIT = 8;

// ===== Combo Milestones =====
export const COMBO_MILESTONES = [25, 50, 100, 200, 300, 500];
