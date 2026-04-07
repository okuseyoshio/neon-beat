export default function ProgressBar({ progress }) {
  return (
    <div
      style={{
        width: '100%',
        height: 3,
        background: '#ffffff10',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #ff2d95, #00e5ff, #ffe600, #b388ff)',
          boxShadow: '0 0 8px #00e5ff80',
        }}
      />
    </div>
  );
}
