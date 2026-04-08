import { useEffect, useRef, useState } from 'react';
import { SETTINGS_RANGE } from '../../utils/constants.js';
import { getSoundEffects } from '../../engine/SoundEffects.js';
import { getAudioEngine } from '../../engine/AudioEngine.js';

const BEAT_INTERVAL_SEC = 0.6; // 100 BPM
const FLASH_DURATION_MS = 110;

function NudgeButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 11,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 3,
        border: '1px solid #00e5ff80',
        background: '#00e5ff15',
        color: '#00e5ff',
        cursor: 'pointer',
        minWidth: 32,
      }}
    >
      {label}
    </button>
  );
}

export default function AudioCalibrationModal({
  initialOffset,
  onApply,
  onClose,
  inputHandler,
}) {
  const [offset, setOffset] = useState(initialOffset || 0);
  const [flashOn, setFlashOn] = useState(false);
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const clamp = (v) =>
    Math.max(SETTINGS_RANGE.audioOffset.min, Math.min(SETTINGS_RANGE.audioOffset.max, v));
  const nudge = (delta) => setOffset((o) => clamp(o + delta));

  // ESC closes, arrows nudge the offset
  useEffect(() => {
    if (!inputHandler) return;
    inputHandler.setShortcut('Escape', () => onClose());
    inputHandler.setShortcut('ArrowLeft', (e) => {
      e.preventDefault?.();
      nudge(e.shiftKey ? -10 : -1);
    });
    inputHandler.setShortcut('ArrowRight', (e) => {
      e.preventDefault?.();
      nudge(e.shiftKey ? 10 : 1);
    });
    inputHandler.setShortcut('ArrowDown', (e) => {
      e.preventDefault?.();
      nudge(e.shiftKey ? -10 : -1);
    });
    inputHandler.setShortcut('ArrowUp', (e) => {
      e.preventDefault?.();
      nudge(e.shiftKey ? 10 : 1);
    });
    return () => {
      inputHandler.clearShortcut('Escape');
      inputHandler.clearShortcut('ArrowLeft');
      inputHandler.clearShortcut('ArrowRight');
      inputHandler.clearShortcut('ArrowDown');
      inputHandler.clearShortcut('ArrowUp');
    };
  }, [inputHandler, onClose]);

  // Metronome loop — schedule audio precisely via WebAudio, drive flash via setTimeout
  useEffect(() => {
    const se = getSoundEffects();
    const ctx = getAudioEngine().getContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    let cancelled = false;
    let beatIndex = 0;
    const startCtxTime = ctx.currentTime + 0.2;
    const startWallTime = performance.now() + 200;

    const flashTimers = [];
    const stopTimers = [];
    const scheduledOscs = []; // WebAudio nodes already scheduled — must be stopped on cleanup

    const scheduleNextChunk = () => {
      if (cancelled) return;
      // Schedule a small chunk ahead. Smaller = less leak risk on close,
      // bigger = more glitch tolerance. 6 beats ≈ 3.6s feels safe.
      const lookahead = 6;
      for (let i = 0; i < lookahead; i++) {
        const beatNum = beatIndex + i;
        const eventCtxTime = startCtxTime + beatNum * BEAT_INTERVAL_SEC;
        const eventWallMs = startWallTime + beatNum * BEAT_INTERVAL_SEC * 1000;
        // Audio plays at eventCtxTime - offset (positive offset → audio earlier)
        const audioCtxTime = eventCtxTime - offsetRef.current / 1000;
        const audioOffsetSec = audioCtxTime - ctx.currentTime;
        if (audioCtxTime > ctx.currentTime) {
          const osc = se.playMetronomeClick(audioOffsetSec);
          if (osc) scheduledOscs.push(osc);
        }
        // Flash fires at the visual reference time (eventWallMs)
        const visualDelay = eventWallMs - performance.now();
        if (visualDelay >= 0) {
          flashTimers.push(
            setTimeout(() => {
              if (cancelled) return;
              setFlashOn(true);
              stopTimers.push(
                setTimeout(() => {
                  if (cancelled) return;
                  setFlashOn(false);
                }, FLASH_DURATION_MS)
              );
            }, visualDelay)
          );
        }
      }
      beatIndex += lookahead;
    };

    scheduleNextChunk();
    // Refill before the current chunk runs out
    const reschedule = setInterval(
      scheduleNextChunk,
      Math.floor(BEAT_INTERVAL_SEC * 1000 * 4)
    );

    return () => {
      cancelled = true;
      clearInterval(reschedule);
      for (const id of flashTimers) clearTimeout(id);
      for (const id of stopTimers) clearTimeout(id);
      // Cancel any oscillators that were scheduled but haven't started yet
      for (const osc of scheduledOscs) {
        try { osc.stop(0); } catch { /* already stopped */ }
        try { osc.disconnect(); } catch { /* ignore */ }
      }
    };
  }, []);

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
          width: 'min(480px, 94vw)',
          boxShadow: '0 0 36px #00e5ff60, inset 0 0 24px #00e5ff20',
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 22,
            color: '#fff',
            textShadow: '0 0 12px #00e5ff',
            marginBottom: 12,
            letterSpacing: '0.15em',
            textAlign: 'center',
          }}
        >
          AUDIO SYNC
        </div>
        <div
          style={{
            color: '#ffffffc0',
            fontSize: 12,
            lineHeight: 1.6,
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          光と音が同時になるよう、スライダーで調整してください。
          <br />
          <span style={{ color: '#ffffff70' }}>
            音が早く聞こえる → 値を下げる / 音が遅い → 値を上げる
          </span>
        </div>

        {/* Pulsing visual */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            margin: '20px 0',
          }}
        >
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: flashOn
                ? 'radial-gradient(circle, #ffffff 0%, #00e5ff 60%, #00e5ff20 100%)'
                : 'radial-gradient(circle, #00e5ff20 0%, #00e5ff10 60%, transparent 100%)',
              border: `3px solid ${flashOn ? '#ffffff' : '#00e5ff60'}`,
              boxShadow: flashOn
                ? '0 0 48px #00e5ff, 0 0 96px #00e5ff80, inset 0 0 32px #ffffff80'
                : '0 0 12px #00e5ff40, inset 0 0 12px #00e5ff20',
              transition: 'background 0.05s linear, box-shadow 0.05s linear, border-color 0.05s linear',
            }}
          />
        </div>

        {/* Slider */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 6,
              color: '#fff',
              fontWeight: 600,
              letterSpacing: '0.1em',
              fontSize: 13,
              alignItems: 'center',
            }}
          >
            <span>AUDIO OFFSET</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <NudgeButton label="−10" onClick={() => nudge(-10)} />
              <NudgeButton label="−1" onClick={() => nudge(-1)} />
              <span
                style={{
                  color: '#00e5ff',
                  fontFamily: 'Orbitron, sans-serif',
                  minWidth: 64,
                  textAlign: 'center',
                  fontSize: 14,
                }}
              >
                {offset > 0 ? '+' : ''}
                {offset} ms
              </span>
              <NudgeButton label="+1" onClick={() => nudge(1)} />
              <NudgeButton label="+10" onClick={() => nudge(10)} />
            </span>
          </div>
          <input
            type="range"
            min={SETTINGS_RANGE.audioOffset.min}
            max={SETTINGS_RANGE.audioOffset.max}
            step={SETTINGS_RANGE.audioOffset.step}
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
            style={{ accentColor: '#00e5ff' }}
          />
          <div
            style={{
              fontSize: 10,
              color: '#ffffff60',
              textAlign: 'center',
              marginTop: 4,
              letterSpacing: '0.05em',
            }}
          >
            ← → 矢印キーで 1ms 単位 / Shift+矢印で 10ms 単位
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button
            className="neon-button"
            style={{ color: '#00e5ff' }}
            onClick={() => {
              onApply(offset);
              onClose();
            }}
          >
            APPLY
          </button>
          <button
            className="neon-button"
            style={{ color: '#ff2d95' }}
            onClick={onClose}
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
