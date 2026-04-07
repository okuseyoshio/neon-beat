/**
 * FixedWidthNumber - renders each digit/separator inside its own
 * fixed-width slot, so the number's overall width never shifts based on
 * which specific digits are shown. This works around fonts (like Orbitron)
 * that don't ship a proper OpenType `tnum` table — `font-variant-numeric:
 * tabular-nums` is silently ignored when the font has no such feature.
 *
 * Slot widths are expressed in em so they scale with the parent fontSize.
 * Defaults are tuned for Orbitron 700 at HUD sizes; for the huge result-screen
 * score (Orbitron 900 at 144px) widen via the `digitWidth` / `commaWidth`
 * props because Orbitron's bold digits get noticeably more chunky as size grows.
 *
 * Usage:
 *   <FixedWidthNumber value={1234567} />
 *   <FixedWidthNumber value={result.score} digitWidth="0.92em" commaWidth="0.36em" />
 */
export default function FixedWidthNumber({
  value,
  digitWidth = '0.78em',
  commaWidth = '0.32em',
}) {
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
              width: isComma ? commaWidth : digitWidth,
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
