export default function HitEffect({ particles }) {
  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x - p.size / 2,
            top: p.y - p.size / 2,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: '50%',
            opacity: Math.max(0, p.life),
            boxShadow: `0 0 ${6 + p.size}px ${p.color}`,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  );
}
