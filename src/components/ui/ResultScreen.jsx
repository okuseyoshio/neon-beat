import { useEffect } from 'react';
import { DIFFICULTY_LABELS } from '../../utils/constants.js';
import { accuracyPercent } from '../../utils/helpers.js';
import FixedWidthNumber from '../hud/FixedWidthNumber.jsx';

export default function ResultScreen({
  song,
  difficulty,
  result,
  onRetry,
  onSelect,
  onTitle,
  inputHandler,
}) {
  useEffect(() => {
    if (!inputHandler) return;
    inputHandler.setShortcut('KeyR', () => onRetry());
    inputHandler.setShortcut('KeyS', () => onSelect());
    inputHandler.setShortcut('KeyT', () => onTitle());
    return () => {
      inputHandler.clearShortcut('KeyR');
      inputHandler.clearShortcut('KeyS');
      inputHandler.clearShortcut('KeyT');
    };
  }, [inputHandler, onRetry, onSelect, onTitle]);

  const acc = accuracyPercent(
    result.perfects,
    result.greats,
    result.goods,
    result.totalNotes
  );

  return (
    <div className="screen" style={{ pointerEvents: 'auto' }}>
      <div
        className="font-display"
        style={{ fontSize: 18, color: '#ffffffa0', letterSpacing: '0.1em' }}
      >
        {song?.title} · {DIFFICULTY_LABELS[difficulty]}
        {result.autoPlay && (
          <span
            style={{
              marginLeft: 12,
              padding: '2px 8px',
              borderRadius: 3,
              border: '1px solid #ffe600',
              color: '#ffe600',
              fontSize: 11,
            }}
          >
            AUTO PLAY
          </span>
        )}
      </div>

      <div
        className="font-display"
        style={{
          fontSize: 'clamp(64px, 12vw, 144px)',
          fontWeight: 900,
          color: '#fff',
          textShadow: '0 0 24px #00e5ff, 0 0 48px #ff2d95',
          margin: '12px 0 6px',
        }}
      >
        <FixedWidthNumber value={result.score} />
      </div>

      <div
        className="font-display"
        style={{ fontSize: 18, color: '#ffe600', textShadow: '0 0 10px #ffe600' }}
      >
        MAX COMBO {result.maxCombo}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 24,
          marginTop: 28,
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 16,
        }}
      >
        <Stat label="PERFECT" value={result.perfects} color="#ffe600" />
        <Stat label="GREAT" value={result.greats} color="#00e5ff" />
        <Stat label="GOOD" value={result.goods} color="#b388ff" />
        <Stat label="MISS" value={result.misses} color="#ff2d95" />
      </div>

      <div
        className="font-display"
        style={{
          marginTop: 20,
          fontSize: 22,
          color: '#fff',
          letterSpacing: '0.1em',
          textShadow: '0 0 12px #00e5ff',
        }}
      >
        ACCURACY {acc.toFixed(2)}%
      </div>

      <div style={{ display: 'flex', gap: 18, marginTop: 36 }}>
        <ResultButton color="#00e5ff" label="RETRY" hint="R" onClick={onRetry} />
        <ResultButton color="#b388ff" label="SELECT" hint="S" onClick={onSelect} />
        <ResultButton color="#ff2d95" label="TITLE" hint="T" onClick={onTitle} />
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 76 }}>
      <div style={{ color, fontSize: 12, letterSpacing: '0.1em' }}>{label}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color,
          textShadow: `0 0 10px ${color}`,
        }}
      >
        <FixedWidthNumber value={value} />
      </div>
    </div>
  );
}

function ResultButton({ color, label, hint, onClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button className="neon-button" style={{ color }} onClick={onClick}>
        {label}
      </button>
      <div style={{ fontSize: 11, color: '#ffffff60', letterSpacing: '0.1em' }}>[{hint}]</div>
    </div>
  );
}
