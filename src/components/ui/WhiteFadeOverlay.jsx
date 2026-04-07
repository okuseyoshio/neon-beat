import { useEffect, useRef, useState } from 'react';

/**
 * WhiteFadeOverlay - viewport-wide white panel that fades in/out for screen
 * transitions. Uses its own rAF loop instead of React state changes per frame
 * so it doesn't compete with the game loop for renders.
 *
 * Props:
 *   phase: 'none' | 'fadeOut' | 'fadeIn'
 *   startedAt: performance.now() when the current phase began
 *   fadeOutMs / fadeInMs: durations
 */
export default function WhiteFadeOverlay({ phase, startedAt, fadeOutMs, fadeInMs }) {
  const divRef = useRef(null);
  const [visible, setVisible] = useState(phase !== 'none');

  useEffect(() => {
    if (phase === 'none') {
      setVisible(false);
      if (divRef.current) divRef.current.style.opacity = '0';
      return;
    }
    setVisible(true);
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      let alpha;
      if (phase === 'fadeOut') {
        alpha = Math.min(1, elapsed / fadeOutMs);
      } else {
        // fadeIn = white fading away
        alpha = Math.max(0, 1 - elapsed / fadeInMs);
      }
      if (divRef.current) {
        divRef.current.style.opacity = String(alpha);
      }
      const done =
        (phase === 'fadeOut' && elapsed >= fadeOutMs) ||
        (phase === 'fadeIn' && elapsed >= fadeInMs);
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, startedAt, fadeOutMs, fadeInMs]);

  if (!visible) return null;
  return (
    <div
      ref={divRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#ffffff',
        opacity: phase === 'fadeIn' ? 1 : 0,
        zIndex: 99999,
        pointerEvents: 'none',
        boxShadow: '0 0 200px 100px #ffffff',
      }}
    />
  );
}
