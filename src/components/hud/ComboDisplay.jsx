import FixedWidthNumber from './FixedWidthNumber.jsx';

export default function ComboDisplay({ combo }) {
  // Always reserve a fixed-width slot so the surrounding HUD doesn't shift
  // when the digit count grows from 2 → 3 → 4 digits. 160px easily fits a
  // 4-digit Orbitron 900 number at 36px with FixedWidthNumber's 0.78em slots.
  return (
    <div
      style={{
        width: 160,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        visibility: combo < 2 ? 'hidden' : 'visible',
      }}
    >
      <div
        style={{
          fontSize: 36,
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 900,
          color: '#ffe600',
          textShadow: '0 0 14px #ffe600, 0 0 28px #ff2d95',
          lineHeight: 1,
        }}
      >
        <FixedWidthNumber value={combo} />
      </div>
      <div
        style={{
          fontSize: 10,
          color: '#ffe600',
          letterSpacing: '0.2em',
          fontFamily: 'Orbitron, sans-serif',
        }}
      >
        COMBO
      </div>
    </div>
  );
}
