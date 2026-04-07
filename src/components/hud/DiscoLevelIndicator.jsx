import { LANE_COLORS } from '../../utils/constants.js';

export default function DiscoLevelIndicator({ level }) {
  // 4 bars (level 1..4); level 0 = all dim
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 4,
        height: 36,
      }}
    >
      {[0, 1, 2, 3].map((i) => {
        const lit = level >= i + 1;
        const color = LANE_COLORS[i];
        return (
          <div
            key={i}
            style={{
              width: 6,
              height: 12 + i * 8,
              borderRadius: 2,
              background: lit ? color : '#ffffff15',
              boxShadow: lit ? `0 0 8px ${color}` : 'none',
              transition: 'background 0.15s ease, box-shadow 0.15s ease',
            }}
          />
        );
      })}
    </div>
  );
}
