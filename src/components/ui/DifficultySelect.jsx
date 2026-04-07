import { useEffect, useMemo, useState } from 'react';
import {
  DIFFICULTIES,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
} from '../../utils/constants.js';

export default function DifficultySelect({
  song,
  onSelect,
  onBack,
  inputHandler,
}) {
  const availableIdxs = useMemo(
    () => DIFFICULTIES.map((d, i) => (song?.difficulties?.[d] ? i : -1)).filter((i) => i >= 0),
    [song]
  );
  const [cursor, setCursor] = useState(availableIdxs[0] ?? 0);

  useEffect(() => {
    if (!inputHandler) return;
    const moveLeft = () => {
      const idx = availableIdxs.indexOf(cursor);
      if (idx > 0) setCursor(availableIdxs[idx - 1]);
    };
    const moveRight = () => {
      const idx = availableIdxs.indexOf(cursor);
      if (idx >= 0 && idx < availableIdxs.length - 1) setCursor(availableIdxs[idx + 1]);
    };
    inputHandler.setShortcut('ArrowLeft', moveLeft);
    inputHandler.setShortcut('ArrowRight', moveRight);
    inputHandler.setShortcut('Enter', () => {
      const d = DIFFICULTIES[cursor];
      if (song?.difficulties?.[d]) onSelect(d);
    });
    inputHandler.setShortcut('Escape', () => onBack());
    return () => {
      inputHandler.clearShortcut('ArrowLeft');
      inputHandler.clearShortcut('ArrowRight');
      inputHandler.clearShortcut('Enter');
      inputHandler.clearShortcut('Escape');
    };
  }, [inputHandler, cursor, availableIdxs, onSelect, onBack, song]);

  if (!song) return null;

  return (
    <div className="screen" style={{ pointerEvents: 'auto' }}>
      <div
        className="font-display"
        style={{
          fontSize: 22,
          color: '#ffffffa0',
          letterSpacing: '0.1em',
          marginBottom: 8,
        }}
      >
        {song.title}
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 36,
          color: '#fff',
          textShadow: '0 0 16px #b388ff',
          marginBottom: 32,
          letterSpacing: '0.1em',
        }}
      >
        SELECT DIFFICULTY
      </div>

      <div
        style={{
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
          justifyContent: 'center',
          padding: '0 16px',
        }}
      >
        {DIFFICULTIES.map((d, i) => {
          const diff = song.difficulties?.[d];
          const enabled = !!diff;
          const color = DIFFICULTY_COLORS[d];
          const selected = i === cursor;
          return (
            <button
              key={d}
              disabled={!enabled}
              onClick={() => {
                setCursor(i);
                if (enabled) onSelect(d);
              }}
              className="font-display"
              style={{
                width: 140,
                height: 180,
                border: `2px solid ${enabled ? color : '#ffffff20'}`,
                borderRadius: 8,
                background: 'rgba(10,10,24,0.7)',
                color: enabled ? color : '#ffffff30',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: enabled ? 'pointer' : 'not-allowed',
                boxShadow: selected && enabled
                  ? `0 0 28px ${color}, inset 0 0 18px ${color}40`
                  : enabled
                  ? `0 0 8px ${color}80`
                  : 'none',
                transform: selected ? 'translateY(-4px) scale(1.04)' : 'none',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                textShadow: enabled ? `0 0 8px ${color}` : 'none',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.1em' }}>
                {DIFFICULTY_LABELS[d]}
              </div>
              <div style={{ fontSize: 48, fontWeight: 900 }}>
                {diff ? diff.level : '—'}
              </div>
              <div style={{ fontSize: 12, color: enabled ? '#ffffffa0' : '#ffffff20' }}>
                {diff ? `${diff.noteCount} NOTES` : 'N/A'}
              </div>
            </button>
          );
        })}
      </div>

      <button
        className="neon-button"
        style={{ color: '#ff2d95', marginTop: 32 }}
        onClick={onBack}
      >
        BACK
      </button>
    </div>
  );
}
