import { useEffect, useRef } from 'react';
import { LANE_COLORS, SPECTRUM_BANDS } from '../../utils/constants.js';
import { barHue, getDiscoLevel } from '../../utils/helpers.js';

/**
 * CanvasBackground - draws all background effects (disco lights, lasers, particles,
 * edge glow, block equalizer, perspective grid) into a single canvas with its own rAF loop.
 *
 * It reads live game state from `stateRef.current` (provided by parent), so it never
 * re-renders when combo/spectrum updates — only when window resizes.
 *
 * stateRef.current shape:
 *   { spectrum: Float32Array(40), combo: number, beatPulse: boolean, globalTime: number }
 */
export default function CanvasBackground({ stateRef }) {
  const canvasRef = useRef(null);
  const sizeRef = useRef({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let mounted = true;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      sizeRef.current = { w, h };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const startTime = performance.now();

    const draw = () => {
      if (!mounted) return;
      const { w: width, h: height } = sizeRef.current;
      const state = stateRef.current || {};
      const localT = (performance.now() - startTime) / 1000;
      const isIdle =
        state.idle === true ||
        !state.spectrum ||
        state.spectrum.length !== SPECTRUM_BANDS;

      // Build the spectrum: real audio data when playing, synthetic moving
      // bars when on menus / song select / etc.
      let spectrum;
      if (isIdle) {
        spectrum = new Float32Array(SPECTRUM_BANDS);
        for (let i = 0; i < SPECTRUM_BANDS; i++) {
          // Layered sines + a slow "kick" pulse so the bars dance gently.
          const kick =
            Math.max(0, Math.sin(localT * 2.4)) *
            Math.exp(-((i - 4) * (i - 4)) / 40) *
            0.35;
          const wave1 = Math.max(0, Math.sin(localT * 2.0 + i * 0.32)) * 0.28;
          const wave2 = Math.max(0, Math.sin(localT * 4.7 + i * 0.71)) * 0.22;
          const wave3 = Math.max(0, Math.sin(localT * 7.3 + i * 1.13)) * 0.18;
          const treble = (i / SPECTRUM_BANDS) * 0.08;
          spectrum[i] = Math.min(
            1,
            0.18 + kick + wave1 + wave2 + wave3 - treble
          );
        }
      } else {
        spectrum = state.spectrum;
      }

      const combo = state.combo != null ? state.combo : 10;
      // When idle, generate a synthetic beat pulse so disco lights/lasers also breathe
      const beatPulse = isIdle
        ? Math.sin(localT * 2.4) > 0.85
        : !!state.beatPulse;
      const t = state.globalTime != null ? state.globalTime : localT;
      const level = getDiscoLevel(combo);

      ctx.clearRect(0, 0, width, height);

      // ---- BG WASH ----
      const bgLight = 8 + level * 3;
      ctx.fillStyle = `hsl(240, 40%, ${bgLight}%)`;
      ctx.fillRect(0, 0, width, height);

      // ---- DISCO BALL LIGHTS ----
      const spotCount = 4 + level * 4;
      const baseAlpha = 0.03 + level * 0.03;
      const pulseAlpha = beatPulse ? 0.05 : 0;
      for (let i = 0; i < spotCount; i++) {
        const speed = 0.25 + (i % 5) * 0.12;
        const phase = (i / spotCount) * Math.PI * 2;
        const x = width * 0.5 + Math.sin(t * speed + phase) * width * 0.38;
        const y = height * 0.3 + Math.cos(t * speed * 0.6 + phase) * height * 0.28;
        const hue = (i * 55 + t * 25) % 360;
        const size = 100 + (beatPulse ? 50 : 0) + level * 20;
        const alpha = baseAlpha + pulseAlpha;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
        grad.addColorStop(0, `hsla(${hue}, 100%, 65%, ${alpha})`);
        grad.addColorStop(1, `hsla(${hue}, 100%, 65%, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x - size, y - size, size * 2, size * 2);
      }

      // ---- LASER BEAMS ----
      if (level >= 2) {
        const beamCount = level >= 4 ? 6 : level >= 3 ? 4 : 2;
        const laserAlpha = beatPulse ? 0.22 : 0.08;
        ctx.lineWidth = beatPulse ? 2.5 : 1.2;
        for (let i = 0; i < beamCount; i++) {
          const angle = Math.sin(t * (0.4 + i * 0.18) + i * 1.3) * width * 0.4;
          const ci = i % 4;
          const colorHex = LANE_COLORS[ci];
          const alphaHex = Math.round(laserAlpha * 255)
            .toString(16)
            .padStart(2, '0');
          ctx.strokeStyle = colorHex + alphaHex;
          ctx.beginPath();
          ctx.moveTo(width / 2, 0);
          ctx.lineTo(width / 2 + angle, height);
          ctx.stroke();
        }
      }

      // ---- PERSPECTIVE GRID ----
      const gridOpacity = 0.03 + (beatPulse ? 0.04 : 0) + level * 0.015;
      const gridColor = level >= 3 ? '#ffe600' : '#00e5ff';
      ctx.strokeStyle = gridColor;
      ctx.globalAlpha = gridOpacity;
      for (let i = 0; i < 15; i++) {
        const y = height * (0.45 + i * 0.04);
        ctx.lineWidth = 1 - i * 0.05;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const x = width * 0.5 + (i - 5.5) * width * 0.07;
        const bx = width * 0.5 + (i - 5.5) * width * 0.14;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, height * 0.45);
        ctx.lineTo(bx, height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ---- FLOATING PARTICLES ----
      const pCount = 6 + level * 6;
      for (let i = 0; i < pCount; i++) {
        const s1 = Math.sin(i * 127.1) * 0.5 + 0.5;
        const s2 = Math.sin(i * 311.7) * 0.5 + 0.5;
        const s3 = Math.sin(i * 74.3) * 0.5 + 0.5;
        const px = s1 * width;
        const spd = 0.4 + s2 * 1.2;
        const py = height - ((s3 * 100 + t * spd * 12) % (height + 30)) + 15;
        const sz = 2 + s2 * 3 + (beatPulse ? 1.5 : 0);
        const hue = (s1 * 360 + t * 25) % 360;
        const alpha = 0.2 + level * 0.12 + (beatPulse ? 0.15 : 0);
        ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- EDGE GLOW ----
      const edgeAlpha = 0.04 + level * 0.05 + (beatPulse ? 0.08 : 0);
      const edgeSize = 50 + level * 25 + (beatPulse ? 20 : 0);
      const edgeColors = ['#ff2d95', '#00e5ff', '#ffe600', '#b388ff'];
      const alphaHex = Math.round(edgeAlpha * 255)
        .toString(16)
        .padStart(2, '0');

      // Left
      let g = ctx.createLinearGradient(0, 0, edgeSize, 0);
      g.addColorStop(0, edgeColors[0] + alphaHex);
      g.addColorStop(1, edgeColors[0] + '00');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, edgeSize, height);
      // Right
      g = ctx.createLinearGradient(width, 0, width - edgeSize, 0);
      g.addColorStop(0, edgeColors[1] + alphaHex);
      g.addColorStop(1, edgeColors[1] + '00');
      ctx.fillStyle = g;
      ctx.fillRect(width - edgeSize, 0, edgeSize, height);
      // Top
      g = ctx.createLinearGradient(0, 0, 0, edgeSize);
      g.addColorStop(0, edgeColors[2] + alphaHex);
      g.addColorStop(1, edgeColors[2] + '00');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, edgeSize);
      // Bottom
      g = ctx.createLinearGradient(0, height, 0, height - edgeSize);
      g.addColorStop(0, edgeColors[3] + alphaHex);
      g.addColorStop(1, edgeColors[3] + '00');
      ctx.fillStyle = g;
      ctx.fillRect(0, height - edgeSize, width, edgeSize);

      // ---- BLOCK EQUALIZER (bottom) ----
      // The equalizer scales BOTH dimensions with the viewport so it stays
      // visually dominant on huge monitors:
      //   - Total height = 60% of viewport
      //   - maxBlocks grows with height (more, finer rungs on tall windows)
      //   - Block width grows with width (40 bars stretched across)
      const barCount = SPECTRUM_BANDS;
      const blockW = Math.max(2, Math.floor((width - 20) / barCount) - 2);
      const blockGap = 2;
      // 24 rungs on a 600px window → 44 rungs on a 1440px window
      const maxBlocks = Math.max(24, Math.min(44, Math.floor(height / 32)));
      const targetTotalHeight = height * 0.6;
      const cellH = Math.max(12, Math.floor(targetTotalHeight / maxBlocks));
      const blockVGap = Math.max(2, Math.floor(cellH * 0.22));
      const blockH = cellH - blockVGap;
      const eqStartX = 10;
      const eqBottomY = height - 15;

      for (let i = 0; i < barCount; i++) {
        const val = spectrum[i];
        const filledBlocks = Math.max(1, Math.round(val * maxBlocks));
        const hue = barHue(i, barCount);
        const x = eqStartX + i * (blockW + blockGap);

        for (let j = 0; j < filledBlocks; j++) {
          const y = eqBottomY - j * (blockH + blockVGap);
          const brightness = 40 + (j / maxBlocks) * 50 + (beatPulse ? 10 : 0);
          const alpha = 0.6 + (j / maxBlocks) * 0.4;
          ctx.fillStyle = `hsla(${hue}, 100%, ${brightness}%, ${alpha})`;
          ctx.fillRect(x, y, blockW, blockH);

          // Top block glow
          if (j === filledBlocks - 1 && level >= 1) {
            ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
            ctx.shadowBlur = 8 + level * 4 + (beatPulse ? 6 : 0);
            ctx.fillStyle = `hsla(${hue}, 100%, ${60 + (beatPulse ? 15 : 0)}%, 0.9)`;
            ctx.fillRect(x, y, blockW, blockH);
            ctx.shadowBlur = 0;
          }
        }

        // Reflection
        const topBlockY = eqBottomY - (filledBlocks - 1) * (blockH + blockVGap);
        const reflH = Math.min(30, eqBottomY - topBlockY) * 0.3;
        if (reflH > 2) {
          const reflGrad = ctx.createLinearGradient(0, eqBottomY + 5, 0, eqBottomY + 5 + reflH);
          reflGrad.addColorStop(0, `hsla(${hue}, 80%, 50%, 0.15)`);
          reflGrad.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);
          ctx.fillStyle = reflGrad;
          ctx.fillRect(x, eqBottomY + 5, blockW, reflH);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [stateRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
