import FixedWidthNumber from './FixedWidthNumber.jsx';

export default function ScoreDisplay({ score }) {
  // Fixed width so the surrounding HUD doesn't shift as the score grows
  // from 3 → 9 digits. 260px fits 9-digit Orbitron 700 at 28px using the
  // 0.78em digit slots from FixedWidthNumber.
  return (
    <div
      style={{
        width: 260,
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
