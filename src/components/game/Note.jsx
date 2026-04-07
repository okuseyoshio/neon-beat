import { LANE_COLORS, LANE_GLOW } from '../../utils/constants.js';

const NOTE_HEIGHT = 18;

export default function Note({ note, currentTime, noteSpeed, fieldHeight, judgeLineY, laneWidth, laneX }) {
  // y at judge line when note.time === currentTime
  // moves down: y = judgeLineY - (note.time - currentTime) * noteSpeed
  const y = judgeLineY - (note.time - currentTime) * noteSpeed;
  if (y < -40 || y > fieldHeight + 40) return null;
  if (note.hit || note.missed) return null;

  const color = LANE_COLORS[note.lane];
  const glow = LANE_GLOW[note.lane];

  return (
    <div
      style={{
        position: 'absolute',
        left: laneX + 4,
        top: y - NOTE_HEIGHT / 2,
        width: laneWidth - 8,
        height: NOTE_HEIGHT,
        background: `linear-gradient(180deg, ${color}, ${color}c0)`,
        borderRadius: 4,
        boxShadow: `0 0 12px ${glow}, 0 0 24px ${glow}, inset 0 0 8px #ffffff60`,
        border: `1px solid ${color}`,
      }}
    />
  );
}
