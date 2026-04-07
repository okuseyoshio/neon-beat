import { useEffect } from 'react';

export default function PauseMenu({ onResume, onRetry, onQuit, inputHandler }) {
  useEffect(() => {
    if (!inputHandler) return;
    inputHandler.setShortcut('Escape', () => onResume());
    inputHandler.setShortcut('KeyR', () => onRetry());
    inputHandler.setShortcut('KeyQ', () => onQuit());
    return () => {
      inputHandler.clearShortcut('KeyR');
      inputHandler.clearShortcut('KeyQ');
      // Escape stays attached for game-screen toggling
    };
  }, [inputHandler, onResume, onRetry, onQuit]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        pointerEvents: 'auto',
      }}
    >
      <div
        className="font-display"
        style={{
          fontSize: 48,
          color: '#fff',
          textShadow: '0 0 16px #00e5ff',
          letterSpacing: '0.15em',
        }}
      >
        PAUSED
      </div>
      <div style={{ display: 'flex', gap: 18 }}>
        <PauseBtn color="#ffe600" label="RESUME" hint="ESC" onClick={onResume} />
        <PauseBtn color="#00e5ff" label="RETRY" hint="R" onClick={onRetry} />
        <PauseBtn color="#ff2d95" label="QUIT" hint="Q" onClick={onQuit} />
      </div>
    </div>
  );
}

function PauseBtn({ color, label, hint, onClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button className="neon-button" style={{ color }} onClick={onClick}>
        {label}
      </button>
      <div style={{ fontSize: 11, color: '#ffffff60', letterSpacing: '0.1em' }}>[{hint}]</div>
    </div>
  );
}
