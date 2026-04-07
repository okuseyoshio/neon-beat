import { JUDGMENTS } from '../../utils/constants.js';

export default function JudgmentDisplay({ judgment }) {
  if (!judgment) return null;
  const j = JUDGMENTS[judgment.type];
  if (!j) return null;
  // Re-mount on each judgment via key in parent so this animation re-fires
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '38%',
        transform: 'translate(-50%, -50%)',
        fontFamily: 'Orbitron, sans-serif',
        fontWeight: 900,
        fontSize: 48,
        color: j.color,
        textShadow: `0 0 16px ${j.color}, 0 0 32px ${j.color}80`,
        letterSpacing: '0.1em',
        pointerEvents: 'none',
        animation: 'judgmentPop 0.4s ease-out forwards',
      }}
    >
      {j.text}
      <style>{`
        @keyframes judgmentPop {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
          70%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -60%) scale(1); }
        }
      `}</style>
    </div>
  );
}
