import { useEffect, useState } from 'react';
import { accuracyPercent } from '../../utils/helpers.js';

/**
 * Picks a clamp() font size for the rank label based on its character count.
 * Longer labels like "ALL PERFECT" / "EXCELLENT" / "TRY AGAIN" need a smaller
 * vw factor so they don't overflow the viewport at 0.08em letter-spacing.
 */
function rankLabelFontSize(label) {
  const n = (label || '').length;
  if (n <= 5) return 'clamp(80px, 18vw, 220px)';   // GREAT / GOOD / NICE / OK
  if (n <= 7) return 'clamp(70px, 14vw, 180px)';   // AMAZING
  if (n <= 9) return 'clamp(60px, 11vw, 150px)';   // EXCELLENT / TRY AGAIN
  return 'clamp(48px, 9vw, 120px)';                // ALL PERFECT / FULL COMBO
}

/**
 * Returns the rank label/color/subtitle for a given run.
 * Tiers are tuned so that EXPERT runs feel rewarding without being unreachable.
 */
export function getRank(perfects, greats, goods, misses, totalNotes) {
  const acc = accuracyPercent(perfects, greats, goods, totalNotes);
  if (totalNotes > 0 && misses === 0 && perfects === totalNotes) {
    return { label: 'ALL PERFECT', color: '#ffe600', subtitle: 'FLAWLESS!', acc };
  }
  if (totalNotes > 0 && misses === 0) {
    return { label: 'FULL COMBO', color: '#ffe600', subtitle: 'NO MISS!', acc };
  }
  if (acc >= 95) return { label: 'AMAZING', color: '#ffe600', subtitle: 'BRILLIANT', acc };
  if (acc >= 90) return { label: 'EXCELLENT', color: '#00e5ff', subtitle: 'WELL DONE', acc };
  if (acc >= 80) return { label: 'GREAT', color: '#00e5ff', subtitle: 'NICE PLAY', acc };
  if (acc >= 70) return { label: 'GOOD', color: '#b388ff', subtitle: 'KEEP IT UP', acc };
  if (acc >= 60) return { label: 'NICE', color: '#b388ff', subtitle: 'NOT BAD', acc };
  if (acc >= 50) return { label: 'OK', color: '#ff2d95', subtitle: 'TRY HARDER', acc };
  return { label: 'TRY AGAIN', color: '#ff2d95', subtitle: 'PRACTICE!', acc };
}

/**
 * FinishRankOverlay - shown during the 3-second silent afterglow at the end
 * of a song. A big neon rank label slams onto the screen with pulsing glow.
 */
export default function FinishRankOverlay({ result }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      setTick(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const rank = getRank(
    result.perfects,
    result.greats,
    result.goods,
    result.misses,
    result.totalNotes
  );

  // Big slam-in for the rank label (0..0.5s)
  const slamProgress = Math.min(1, tick / 0.5);
  const ease = 1 - Math.pow(1 - slamProgress, 3);
  const labelScale = 3.0 - ease * 2.0; // 3.0 → 1.0
  const labelOpacity = ease;

  // Subtitle slides up after the slam (0.5..1.0s)
  const subProgress = Math.max(0, Math.min(1, (tick - 0.5) / 0.5));
  const subY = (1 - subProgress) * 30;

  // Accuracy reveal (1.0..1.5s)
  const accProgress = Math.max(0, Math.min(1, (tick - 1.0) / 0.5));

  // Pulsing glow
  const pulse = 0.7 + Math.sin(tick * 6) * 0.3;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 800,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, ${rank.color}25, rgba(0,0,0,0.55) 70%)`,
      }}
    >
      {/* Rank label - shrinks for longer labels so "ALL PERFECT" fits the
          viewport width without clipping. Short labels (e.g. "GREAT") still
          slam in at the full chunky size. */}
      <div
        className="font-display"
        style={{
          fontSize: rankLabelFontSize(rank.label),
          fontWeight: 900,
          color: '#fff',
          textShadow: `0 0 24px ${rank.color}, 0 0 48px ${rank.color}, 0 0 96px ${rank.color}`,
          letterSpacing: '0.08em',
          transform: `scale(${labelScale})`,
          opacity: labelOpacity,
          filter: `drop-shadow(0 0 ${20 + pulse * 16}px ${rank.color})`,
          lineHeight: 1,
          padding: '0 24px',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          maxWidth: '94vw',
        }}
      >
        {rank.label}
      </div>

      {/* Subtitle */}
      <div
        className="font-display"
        style={{
          marginTop: 16,
          fontSize: 'clamp(18px, 2.6vw, 32px)',
          color: rank.color,
          letterSpacing: '0.3em',
          textShadow: `0 0 12px ${rank.color}`,
          transform: `translateY(${subY}px)`,
          opacity: subProgress,
        }}
      >
        {rank.subtitle}
      </div>

      {/* Accuracy */}
      <div
        className="font-display"
        style={{
          marginTop: 28,
          fontSize: 'clamp(16px, 2vw, 24px)',
          color: '#fff',
          letterSpacing: '0.15em',
          opacity: accProgress,
          fontVariantNumeric: 'tabular-nums',
          fontFeatureSettings: '"tnum" 1',
        }}
      >
        ACCURACY {rank.acc.toFixed(2)}%
      </div>
    </div>
  );
}
