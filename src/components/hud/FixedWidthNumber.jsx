/**
 * FixedWidthNumber - renders each digit/separator inside its own
 * fixed-width slot, so the number's overall width never shifts based on
 * which specific digits are shown. This works around fonts (like Orbitron)
 * that don't ship a proper OpenType `tnum` table — `font-variant-numeric:
 * tabular-nums` is silently ignored when the font has no such feature.
 *
 * Slot widths are expressed in em so they scale with the parent fontSize.
 * Tuned for Orbitron 700:
 *   - digit slot: 0.62em (the widest digits "0/8" sit comfortably)
 *   - comma:      0.28em (commas are narrow)
 *
 * Usage:
 *   <FixedWidthNumber value={1234567} />
 */
export default function FixedWidthNumber({ value }) {
  const str = value.toLocaleString();
  return (
    <span style={{ display: 'inline-flex', whiteSpace: 'nowrap' }}>
      {str.split('').map((ch, i) => {
        const isComma = ch === ',' || ch === '.';
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: isComma ? '0.28em' : '0.62em',
              textAlign: 'center',
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}
