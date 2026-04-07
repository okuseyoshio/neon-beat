import FixedWidthNumber from './FixedWidthNumber.jsx';

export default function ScoreDisplay({ score }) {
  // Fixed width so the surrounding HUD doesn't shift as the score grows
  // from 3 → 9 digits. 220px easily fits 9-digit Orbitron at 28px with the
  // FixedWidthNumber slot system.
  return (
    <div
      style={{
        width: 220,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: '#ffffffa0',
          letterSpacing: '0.15em',
          fontFamily: 'Orbitron, sans-serif',
        }}
      >
        SCORE
      </div>
      <div
        style={{
          fontSize: 28,
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 700,
          color: '#fff',
          textShadow: '0 0 10px #00e5ff',
        }}
      >
        <FixedWidthNumber value={score} />
      </div>
    </div>
  );
}
