import { useEffect } from 'react';

export default function MenuScreen({ onStart, onOpenSettings, inputHandler }) {
  useEffect(() => {
    if (!inputHandler) return;
    inputHandler.setShortcut('Space', () => onStart());
    inputHandler.setShortcut('Enter', () => onStart());
    return () => {
      inputHandler.clearShortcut('Space');
      inputHandler.clearShortcut('Enter');
    };
  }, [inputHandler, onStart]);

  return (
    <div className="screen" style={{ pointerEvents: 'auto' }}>
      <div
        className="font-display"
        style={{
          fontSize: 'clamp(48px, 10vw, 128px)',
          fontWeight: 900,
          color: '#fff',
          textShadow:
            '0 0 16px #ff2d95, 0 0 32px #ff2d95, 0 0 64px #00e5ff, 0 0 96px #b388ff',
          letterSpacing: '0.1em',
        }}
      >
        NEON BEAT
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 'clamp(16px, 2.4vw, 28px)',
          color: '#00e5ff',
          letterSpacing: '0.4em',
          marginTop: 4,
          textShadow: '0 0 12px #00e5ff',
        }}
      >
        DISCO RHYTHM
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 64 }}>
        <button
          className="neon-button"
          style={{ color: '#ffe600' }}
          onClick={onStart}
        >
          START
        </button>
        <button
          className="neon-button"
          style={{ color: '#b388ff' }}
          onClick={onOpenSettings}
        >
          SETTINGS
        </button>
      </div>

      <div
        style={{
          marginTop: 48,
          fontSize: 13,
          color: '#ffffff80',
          letterSpacing: '0.15em',
        }}
      >
        PRESS [SPACE] TO START
      </div>
    </div>
  );
}
