import { LANE_COLORS, LANE_KEYS } from '../../utils/constants.js';

export default function Lane({ index, x, width, fieldHeight, judgeLineY, flash, onTouchStart }) {
  const color = LANE_COLORS[index];

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        width,
        height: fieldHeight,
      }}
    >
      {/* Lane background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: flash
            ? `linear-gradient(180deg, transparent, ${color}30 60%, ${color}60)`
            : `linear-gradient(180deg, transparent, ${color}08 70%, ${color}18)`,
          borderLeft: `1px solid ${color}30`,
          borderRight: `1px solid ${color}30`,
          transition: 'background 0.12s ease',
        }}
      />
      {/* Hit zone */}
      <div
        onTouchStart={(e) => {
          e.preventDefault();
          if (onTouchStart) onTouchStart(index);
        }}
        style={{
          position: 'absolute',
          left: 0,
          width: '100%',
          top: judgeLineY - 30,
          height: 60,
          background: `linear-gradient(180deg, ${color}10, ${color}40)`,
          border: `1px solid ${color}80`,
          borderRadius: 4,
          touchAction: 'none',
        }}
      />
      {/* Key label */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 8,
          textAlign: 'center',
          color: '#fff',
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 700,
          fontSize: 18,
          textShadow: `0 0 8px ${color}`,
          pointerEvents: 'none',
        }}
      >
        {LANE_KEYS[index]}
      </div>
    </div>
  );
}
