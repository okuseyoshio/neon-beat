import { useEffect, useState } from 'react';
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from '../../utils/constants.js';

/**
 * IntroOverlay - flashy 5-second pre-game animation.
 *
 * Timeline:
 *   0.0s  initial flash + song title appears
 *   0.5s  difficulty card slams in
 *   2.0s  countdown begins (3 → 2 → 1)
 *   5.0s  GO! (parent transitions to 'playing')
 */
export default function IntroOverlay({ song, difficulty }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      const t = (performance.now() - start) / 1000;
      setTick(t);
      if (t < 5.2) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const diffColor = DIFFICULTY_COLORS[difficulty] || '#00e5ff';
  const diffLabel = DIFFICULTY_LABELS[difficulty] || difficulty?.toUpperCase();

  // White flash removed - the App-level transition already fades from white,
  // so a second flash here just feels redundant.
  const flashAlpha = 0;

  // Title slides in 0..0.5s
  const titleProgress = Math.min(1, tick / 0.5);
  const titleY = (1 - titleProgress) * -30;

  // Difficulty card slides in 0.4..0.9s
  const cardProgress = Math.max(0, Math.min(1, (tick - 0.4) / 0.5));
  const cardScale = 0.6 + cardProgress * 0.4;
  const cardOpacity = cardProgress;

  // Countdown digit (3, 2, 1) starting at 2.0s
  let countdownDigit = null;
  let digitAge = 0;
  if (tick >= 2 && tick < 5) {
    const idx = Math.floor(tick - 2); // 0,1,2
    countdownDigit = 3 - idx; // 3,2,1
    digitAge = (tick - 2) - idx; // 0..1 within current digit
  }
  const digitScale = countdownDigit ? 2 - digitAge * 1.0 : 1;
  const digitAlpha = countdownDigit ? 1 - digitAge * 0.85 : 0;

  // Pulsing background glow
  const pulse = 0.5 + Math.sin(tick * 12) * 0.5;
  const glowColor = ['#ff2d95', '#00e5ff', '#ffe600', '#b388ff'][
    Math.floor(tick * 3) % 4
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, ${glowColor}25, rgba(0,0,0,0.92) 70%)`,
      }}
    >
      {/* Blinding white flash that covers the ENTIRE viewport */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#ffffff',
          opacity: flashAlpha,
          boxShadow: '0 0 200px 100px #ffffff',
        }}
      />

      {/* Concentric pulse rings */}
      {[0, 1, 2].map((i) => {
        const ringT = (tick * 0.8 + i * 0.33) % 1;
        const ringSize = ringT * 1200;
        const ringAlpha = (1 - ringT) * 0.4;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: ringSize,
              height: ringSize,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `2px solid ${glowColor}`,
              opacity: ringAlpha,
              boxShadow: `0 0 24px ${glowColor}`,
            }}
          />
        );
      })}

      {/* Sweeping light bars */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (tick * 60 + i * 90) % 360;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 4,
              height: '180vmax',
              background: `linear-gradient(180deg, transparent, ${glowColor}90, transparent)`,
              transformOrigin: 'top center',
              transform: `translate(-50%, 0) rotate(${angle}deg)`,
              opacity: 0.3 + pulse * 0.2,
              filter: `blur(2px)`,
            }}
          />
        );
      })}

      {/* Content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
        }}
      >
        {/* READY label */}
        <div
          className="font-display"
          style={{
            fontSize: 14,
            color: '#ffffff90',
            letterSpacing: '0.4em',
            opacity: titleProgress,
          }}
        >
          GET READY
        </div>

        {/* Song title */}
        <div
          className="font-display"
          style={{
            fontSize: 'clamp(28px, 5vw, 56px)',
            fontWeight: 900,
            color: '#fff',
            textShadow: `0 0 18px ${glowColor}, 0 0 36px ${glowColor}, 0 0 72px #ff2d95`,
            letterSpacing: '0.08em',
            transform: `translateY(${titleY}px)`,
            opacity: titleProgress,
            textAlign: 'center',
            padding: '0 16px',
          }}
        >
          {song?.title || 'UNKNOWN'}
        </div>

        {/* Difficulty badge */}
        <div
          className="font-display"
          style={{
            padding: '8px 28px',
            border: `3px solid ${diffColor}`,
            borderRadius: 6,
            color: diffColor,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.2em',
            textShadow: `0 0 12px ${diffColor}`,
            boxShadow: `0 0 24px ${diffColor}80, inset 0 0 18px ${diffColor}40`,
            background: 'rgba(0,0,0,0.5)',
            transform: `scale(${cardScale})`,
            opacity: cardOpacity,
          }}
        >
          {diffLabel}
        </div>

        {/* Countdown */}
        <div
          style={{
            height: 140,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 16,
          }}
        >
          {countdownDigit !== null && (
            <div
              className="font-display"
              style={{
                fontSize: 160,
                fontWeight: 900,
                color: '#fff',
                textShadow: `0 0 24px ${glowColor}, 0 0 48px ${glowColor}, 0 0 96px #ff2d95`,
                transform: `scale(${digitScale})`,
                opacity: digitAlpha,
                lineHeight: 1,
              }}
            >
              {countdownDigit}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
