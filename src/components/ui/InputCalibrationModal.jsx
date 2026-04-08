import { useEffect, useRef, useState } from 'react';
import {
  FIELD_HEIGHT,
  JUDGE_LINE_OFFSET,
  LANE_COLORS,
  LANE_GLOW,
} from '../../utils/constants.js';

const FIELD_WIDTH = 200;
const NOTE_HEIGHT = 20;
const NOTE_SPEED = 400; // px/s — fixed reference speed (matches DEFAULT_SETTINGS.noteSpeed)
const JUDGE_LINE_Y = FIELD_HEIGHT - JUDGE_LINE_OFFSET;
const SAMPLE_COUNT = 10;
const SAMPLE_INTERVAL = 1.6; // seconds between bars
const COUNTDOWN_SECONDS = 3;
// Lead-in: time for a bar to fly from above the field to the judge line
const LEAD_IN_SEC = JUDGE_LINE_Y / NOTE_SPEED;
// Use lane index 1 (cyan) for the calibration bars
const CAL_LANE = 1;

// First bar fires this many seconds after start (countdown + lead-in)
const FIRST_BAR_AT = COUNTDOWN_SECONDS + LEAD_IN_SEC;
const LAST_BAR_AT = FIRST_BAR_AT + (SAMPLE_COUNT - 1) * SAMPLE_INTERVAL;
const FINISH_AT = LAST_BAR_AT + 1.5; // grace period after last bar

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function stddev(arr) {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance =
    arr.reduce((s, v) => s + (v - mean) * (v - mean), 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Compute calibration result from raw deltas (ms).
 * Removes 2 highest + 2 lowest as outliers (when 6+ samples) and returns
 * median + stddev of the trimmed set.
 *
 * Returns:
 *   { recommendedMs, stdMs, used, total, trimmed }
 */
function computeResult(samples) {
  const total = samples.length;
  if (total < 5) {
    return { recommendedMs: 0, stdMs: 0, used: 0, total, trimmed: [] };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  let trimmed;
  if (total >= 8) {
    // Drop 2 from each end
    trimmed = sorted.slice(2, total - 2);
  } else {
    // Drop 1 from each end
    trimmed = sorted.slice(1, total - 1);
  }
  const med = median(trimmed);
  const sd = stddev(trimmed);
  // The recommended judgeOffset is the NEGATIVE of the median delta:
  // delta > 0 means player pressed late → judgeOffset should be negative
  // (push the judgment window earlier so the player feels "on time").
  // Wait, actually re-think:
  //   In GameEngine.tick: t = audioTime + judgeOffsetSec
  //   judgement compares note.time vs t
  //   If player presses LATE, their pressTime - barTargetTime > 0
  //   To compensate so the player feels on-time, we want judgeOffsetSec > 0
  //   so that t (the "perceived audio time" used for judging) advances
  //   ahead of the real audioTime, making the late press land in the window.
  // Therefore recommendedMs = +median(delta).
  return {
    recommendedMs: Math.round(med),
    stdMs: Math.round(sd),
    used: trimmed.length,
    total,
    trimmed,
  };
}

export default function InputCalibrationModal({ onApply, onClose, inputHandler }) {
  // 'idle' → user can start, 'running' → measurement in progress, 'done' → results
  const [phase, setPhase] = useState('idle');
  const [tick, setTick] = useState(0); // seconds since 'running' began
  const [samples, setSamples] = useState([]); // ms deltas (one per registered press)
  const startRef = useRef(0);
  const rafRef = useRef(0);
  // Tracks which bar indices have already been "consumed" by a press so we
  // don't double-count or assign two presses to the same bar.
  const consumedRef = useRef(new Set());

  // ESC closes
  useEffect(() => {
    if (!inputHandler) return;
    inputHandler.setShortcut('Escape', () => onClose());
    return () => {
      inputHandler.clearShortcut('Escape');
    };
  }, [inputHandler, onClose]);

  // Run measurement loop while phase === 'running'
  useEffect(() => {
    if (phase !== 'running') return;
    startRef.current = performance.now();
    setTick(0);
    setSamples([]);
    consumedRef.current = new Set();

    const loop = () => {
      const t = (performance.now() - startRef.current) / 1000;
      setTick(t);
      if (t >= FINISH_AT) {
        setPhase('done');
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  // Lane key handler — capture press time and assign to nearest unconsumed bar
  useEffect(() => {
    if (!inputHandler || phase !== 'running') return;
    const handlePress = () => {
      const pressTime = (performance.now() - startRef.current) / 1000;
      // Find the closest bar (within ±0.4s) that hasn't been consumed
      let bestIdx = -1;
      let bestDist = 0.4; // max ±400ms tolerance
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        if (consumedRef.current.has(i)) continue;
        const target = FIRST_BAR_AT + i * SAMPLE_INTERVAL;
        const d = Math.abs(pressTime - target);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        consumedRef.current.add(bestIdx);
        const target = FIRST_BAR_AT + bestIdx * SAMPLE_INTERVAL;
        const deltaMs = (pressTime - target) * 1000;
        setSamples((s) => [...s, deltaMs]);
      }
    };
    inputHandler.setShortcut('Space', handlePress);
    // Also accept the lane key (F = lane 1)
    inputHandler.setLaneCallback((laneIdx) => {
      if (laneIdx === CAL_LANE) handlePress();
    });
    return () => {
      inputHandler.clearShortcut('Space');
      inputHandler.clearLaneCallback();
    };
  }, [inputHandler, phase]);

  const result = phase === 'done' ? computeResult(samples) : null;

  // Helper: countdown digit (3,2,1) during the first 3 seconds
  let countdownDigit = null;
  if (phase === 'running' && tick < COUNTDOWN_SECONDS) {
    countdownDigit = COUNTDOWN_SECONDS - Math.floor(tick);
  }

  // Render falling bars
  const renderBars = () => {
    if (phase !== 'running') return null;
    const bars = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      if (consumedRef.current.has(i)) continue;
      const target = FIRST_BAR_AT + i * SAMPLE_INTERVAL;
      const y = JUDGE_LINE_Y - (target - tick) * NOTE_SPEED;
      if (y < -40 || y > FIELD_HEIGHT + 40) continue;
      const color = LANE_COLORS[CAL_LANE];
      const glow = LANE_GLOW[CAL_LANE];
      bars.push(
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 8,
            top: y - NOTE_HEIGHT / 2,
            width: FIELD_WIDTH - 16,
            height: NOTE_HEIGHT,
            background: `linear-gradient(180deg, ${color}, ${color}c0)`,
            borderRadius: 4,
            boxShadow: `0 0 12px ${glow}, 0 0 24px ${glow}, inset 0 0 8px #ffffff60`,
            border: `1px solid ${color}`,
          }}
        />
      );
    }
    return bars;
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0d0d1a',
          border: '2px solid #00e5ff',
          borderRadius: 10,
          padding: '24px 32px',
          width: 'min(520px, 94vw)',
          boxShadow: '0 0 36px #00e5ff60, inset 0 0 24px #00e5ff20',
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 22,
            color: '#fff',
            textShadow: '0 0 12px #00e5ff',
            marginBottom: 8,
            letterSpacing: '0.15em',
            textAlign: 'center',
          }}
        >
          INPUT CALIBRATION
        </div>

        {phase === 'idle' && (
          <>
            <div
              style={{
                color: '#ffffffc0',
                fontSize: 13,
                lineHeight: 1.6,
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              バーが判定線に重なる瞬間に
              <br />
              <strong style={{ color: '#00e5ff' }}>SPACE</strong> または{' '}
              <strong style={{ color: '#00e5ff' }}>F</strong> キーを押してください。
              <br />
              {SAMPLE_COUNT} 本のバーが順に落ちてきます。
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button
                className="neon-button"
                style={{ color: '#00e5ff' }}
                onClick={() => setPhase('running')}
              >
                START
              </button>
              <button
                className="neon-button"
                style={{ color: '#ff2d95' }}
                onClick={onClose}
              >
                CANCEL
              </button>
            </div>
          </>
        )}

        {phase === 'running' && (
          <>
            <div
              style={{
                color: '#ffffff80',
                fontSize: 12,
                textAlign: 'center',
                marginBottom: 8,
                letterSpacing: '0.1em',
                fontFamily: 'Orbitron, sans-serif',
              }}
            >
              {samples.length} / {SAMPLE_COUNT} SAMPLES
            </div>
            <div
              style={{
                position: 'relative',
                width: FIELD_WIDTH,
                height: FIELD_HEIGHT,
                margin: '0 auto',
                background: '#06061080',
                border: '1px solid #ffffff20',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              {/* Lane background */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(180deg, transparent, ${LANE_COLORS[CAL_LANE]}08 70%, ${LANE_COLORS[CAL_LANE]}18)`,
                }}
              />
              {/* Judge line */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: JUDGE_LINE_Y,
                  height: 2,
                  background: '#ffffffd0',
                  boxShadow: '0 0 12px #ffffffa0',
                }}
              />
              {/* Hit zone */}
              <div
                style={{
                  position: 'absolute',
                  left: 4,
                  right: 4,
                  top: JUDGE_LINE_Y - 30,
                  height: 60,
                  border: `1px solid ${LANE_COLORS[CAL_LANE]}80`,
                  borderRadius: 4,
                  background: `linear-gradient(180deg, ${LANE_COLORS[CAL_LANE]}10, ${LANE_COLORS[CAL_LANE]}40)`,
                }}
              />
              {renderBars()}
              {countdownDigit !== null && (
                <div
                  className="font-display"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 96,
                    fontWeight: 900,
                    color: '#fff',
                    textShadow: '0 0 24px #00e5ff',
                  }}
                >
                  {countdownDigit}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <button
                className="neon-button"
                style={{ color: '#ff2d95' }}
                onClick={onClose}
              >
                CANCEL
              </button>
            </div>
          </>
        )}

        {phase === 'done' && result && (
          <>
            {result.used < 5 ? (
              <div
                style={{
                  color: '#ff2d95',
                  textAlign: 'center',
                  margin: '20px 0',
                  fontWeight: 700,
                }}
              >
                データ不足 ({result.total} samples)
                <br />
                <span style={{ color: '#ffffffa0', fontWeight: 400, fontSize: 12 }}>
                  もう一度試してください
                </span>
              </div>
            ) : (
              <div style={{ textAlign: 'center', margin: '12px 0 16px' }}>
                <div
                  className="font-display"
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color: '#00e5ff',
                    textShadow: '0 0 16px #00e5ff',
                  }}
                >
                  {result.recommendedMs > 0 ? '+' : ''}
                  {result.recommendedMs} ms
                </div>
                <div style={{ color: '#ffffffa0', fontSize: 12, marginTop: 4 }}>
                  Recommended JUDGE OFFSET
                </div>
                <div style={{ color: '#ffffff80', fontSize: 11, marginTop: 8 }}>
                  ± {result.stdMs} ms · used {result.used} of {result.total}
                </div>

                {/* Sample dot plot */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: 36,
                    marginTop: 16,
                    border: '1px solid #ffffff20',
                    borderRadius: 3,
                    background: '#06061080',
                  }}
                >
                  {/* Center line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: 0,
                      bottom: 0,
                      width: 1,
                      background: '#ffffff40',
                    }}
                  />
                  {samples.map((d, i) => {
                    // Map -200..+200ms → 0..100%
                    const clamped = Math.max(-200, Math.min(200, d));
                    const left = ((clamped + 200) / 400) * 100;
                    return (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          left: `${left}%`,
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#00e5ff',
                          boxShadow: '0 0 6px #00e5ff',
                        }}
                      />
                    );
                  })}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 9,
                    color: '#ffffff60',
                    marginTop: 2,
                  }}
                >
                  <span>-200ms (early)</span>
                  <span>0</span>
                  <span>+200ms (late)</span>
                </div>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 12,
                marginTop: 8,
              }}
            >
              <button
                className="neon-button"
                style={{ color: '#ffe600' }}
                onClick={() => setPhase('running')}
              >
                RETRY
              </button>
              {result.used >= 5 && (
                <button
                  className="neon-button"
                  style={{ color: '#00e5ff' }}
                  onClick={() => {
                    onApply(result.recommendedMs);
                    onClose();
                  }}
                >
                  APPLY
                </button>
              )}
              <button
                className="neon-button"
                style={{ color: '#ff2d95' }}
                onClick={onClose}
              >
                CANCEL
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
