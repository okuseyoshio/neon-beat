export default function ScoreDisplay({ score }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
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
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        {score.toLocaleString()}
      </div>
    </div>
  );
}
