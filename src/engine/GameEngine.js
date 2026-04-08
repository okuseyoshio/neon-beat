import { COMBO_MILESTONES, JUDGMENTS } from '../utils/constants.js';

/**
 * GameEngine - judgment, scoring, combo, auto-play, miss detection.
 *
 * Holds mutable state in plain fields (not React state) to avoid re-renders
 * during the 60Hz game loop. The GameScreen reads via getSnapshot()
 * once per frame and updates only what it needs to display.
 */
export class GameEngine {
  constructor() {
    this.notes = []; // [{ id, time, lane, type, hit, missed, judgment }]
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfects = 0;
    this.greats = 0;
    this.goods = 0;
    this.misses = 0;
    this.totalNotes = 0;
    this.lastJudgment = null; // { type, lane, time }
    this.judgeOffsetSec = 0;
    this.autoPlay = false;
    this.finished = false;
    this.onJudgment = null; // (judgment, lane) => void
    this.onComboMilestone = null; // (combo) => void
    this.onComboBreak = null; // (lostCombo) => void — fires when a non-trivial combo breaks
    this.onMissStreak = null; // (streakCount) => void — fires at miss-streak thresholds
    this.missStreak = 0;
  }

  load(chart, difficulty, options = {}) {
    const diff = chart.difficulties[difficulty];
    if (!diff) throw new Error(`Difficulty ${difficulty} not in chart`);
    // Sort defensively so the active-window cursor logic is safe
    const sortedNotes = [...diff.notes].sort((a, b) => a.time - b.time);
    this.notes = sortedNotes.map((n, i) => ({
      id: i,
      time: n.time,
      lane: n.lane,
      type: n.type || 'normal',
      hit: false,
      missed: false,
      judgment: null,
    }));
    this.totalNotes = this.notes.length;
    // Cursor: index of the first note that may still be active (not yet hit/missed
    // and within or before the current time window). Monotonically advances.
    this.activeStart = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfects = 0;
    this.greats = 0;
    this.goods = 0;
    this.misses = 0;
    this.missStreak = 0;
    this.lastJudgment = null;
    this.finished = false;
    this.judgeOffsetSec = (options.judgeOffsetMs || 0) / 1000;
    this.autoPlay = !!options.autoPlay;
  }

  setAutoPlay(v) {
    this.autoPlay = v;
  }

  setJudgeOffset(ms) {
    this.judgeOffsetSec = (ms || 0) / 1000;
  }

  /**
   * Called every frame.
   * @param {number} audioTime current audio time in seconds (raw, no offset)
   */
  tick(audioTime) {
    const t = audioTime + this.judgeOffsetSec;
    const missThreshold = JUDGMENTS.good.window;
    const lookaheadEnd = t + 0.2; // we only care about notes up to ~200ms in future

    // Advance the active-window cursor past notes that are fully done
    while (
      this.activeStart < this.notes.length &&
      (this.notes[this.activeStart].hit || this.notes[this.activeStart].missed)
    ) {
      this.activeStart++;
    }

    // Iterate only the small slice of notes near the current time.
    // Auto-play hits, miss-detection, and finish-check all live in one loop.
    let i = this.activeStart;
    while (i < this.notes.length) {
      const note = this.notes[i];
      if (note.time > lookaheadEnd) break; // sorted → safe to stop
      if (!note.hit && !note.missed) {
        if (this.autoPlay && note.time <= audioTime) {
          this._applyJudgment(note, 'perfect');
        } else if (t - note.time > missThreshold) {
          note.missed = true;
          note.judgment = 'miss';
          this.misses++;
          const lostCombo = this.combo;
          this.combo = 0;
          this.lastJudgment = {
            type: 'miss',
            lane: note.lane,
            time: performance.now(),
          };
          if (this.onJudgment) this.onJudgment('miss', note.lane);
          if (lostCombo > 0 && this.onComboBreak) this.onComboBreak(lostCombo);
          this.missStreak++;
          // Fire boo at 5, then every additional 3 misses (5, 8, 11, ...)
          if (
            this.onMissStreak &&
            (this.missStreak === 5 || (this.missStreak > 5 && (this.missStreak - 5) % 3 === 0))
          ) {
            this.onMissStreak(this.missStreak);
          }
        }
      }
      i++;
    }

    // Finish detection: cursor reached the end and no notes left to process
    if (!this.finished && this.activeStart >= this.notes.length && this.notes.length > 0) {
      this.finished = true;
    }
  }

  /**
   * User pressed a lane key/touch at the given audio time.
   */
  handleInput(lane, audioTime) {
    if (this.autoPlay) return; // ignore manual input in auto mode
    const t = audioTime + this.judgeOffsetSec;
    const goodWindow = JUDGMENTS.good.window;
    // Search only notes within ±goodWindow of t, starting from activeStart.
    let best = null;
    let bestDelta = Infinity;
    for (let i = this.activeStart; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (note.time - t > goodWindow) break;
      if (note.hit || note.missed) continue;
      if (note.lane !== lane) continue;
      const delta = Math.abs(note.time - t);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = note;
      }
    }
    if (!best) return null;
    if (bestDelta <= JUDGMENTS.perfect.window) {
      return this._applyJudgment(best, 'perfect');
    }
    if (bestDelta <= JUDGMENTS.great.window) {
      return this._applyJudgment(best, 'great');
    }
    if (bestDelta <= JUDGMENTS.good.window) {
      return this._applyJudgment(best, 'good');
    }
    return null; // outside window — ignore (empty press)
  }

  _applyJudgment(note, type) {
    note.hit = true;
    note.judgment = type;
    const j = JUDGMENTS[type];
    const points = Math.round(j.score * (1 + this.combo * 0.1));
    this.score += points;
    this.combo += 1;
    this.missStreak = 0;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (type === 'perfect') this.perfects++;
    else if (type === 'great') this.greats++;
    else if (type === 'good') this.goods++;
    this.lastJudgment = { type, lane: note.lane, time: performance.now() };
    if (this.onJudgment) this.onJudgment(type, note.lane);
    if (COMBO_MILESTONES.includes(this.combo) && this.onComboMilestone) {
      this.onComboMilestone(this.combo);
    }
    return type;
  }

  getResult() {
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      perfects: this.perfects,
      greats: this.greats,
      goods: this.goods,
      misses: this.misses,
      totalNotes: this.totalNotes,
      autoPlay: this.autoPlay,
    };
  }
}
