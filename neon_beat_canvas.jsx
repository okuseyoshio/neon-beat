import { useState, useEffect, useRef, useCallback } from "react";

const LANES = 4;
const LANE_KEYS = ["D", "F", "J", "K"];
const LANE_COLORS = ["#ff2d95", "#00e5ff", "#ffe600", "#b388ff"];
const LANE_GLOW = ["#ff2d9580", "#00e5ff80", "#ffe60080", "#b388ff80"];

const JUDGMENTS = {
  perfect: { text: "PERFECT", color: "#ffe600", score: 100 },
  great: { text: "GREAT", color: "#00e5ff", score: 75 },
  good: { text: "GOOD", color: "#b388ff", score: 50 },
  miss: { text: "MISS", color: "#ff2d95", score: 0 },
};

function generateDemoNotes() {
  const notes = [];
  const bpm = 128;
  const beatInterval = 60 / bpm;
  for (let i = 0; i < 80; i++) {
    const time = 2 + i * beatInterval * 0.5;
    const lane = Math.floor(Math.random() * LANES);
    notes.push({ id: i, time, lane, hit: false, missed: false });
  }
  return notes;
}

function generateSpectrum(time, combo, beatPulse) {
  const bars = 40;
  const spectrum = [];
  for (let i = 0; i < bars; i++) {
    const freq = i / bars;
    const bass = Math.max(0, Math.sin(time * 6.28 + i * 0.25) * 0.5 + 0.5) * (1 - freq * 0.4);
    const mid = Math.max(0, Math.sin(time * 4.1 + i * 0.9) * 0.4 + 0.35);
    const high = Math.max(0, Math.sin(time * 8.5 + i * 1.6) * 0.35) * freq;
    const beat = beatPulse ? 0.5 * Math.exp(-freq * 1.2) : 0;
    const base = 0.18;
    const comboBoost = Math.min(combo / 10, 1) * 0.35;
    const v = base + bass * 0.35 + mid * 0.3 + high * 0.3 + beat + comboBoost;
    spectrum.push(Math.max(0.1, Math.min(1, v)));
  }
  return spectrum;
}

function getDiscoLevel(combo) {
  if (combo >= 40) return 4;
  if (combo >= 25) return 3;
  if (combo >= 15) return 2;
  if (combo >= 5) return 1;
  return 0;
}

// Rainbow hue for bar index
function barHue(i, total) {
  return (i / total) * 300 + 180;
}

// ===== CANVAS BACKGROUND (all effects in one canvas) =====
function CanvasBackground({ width, height, spectrum, combo, beatPulse, globalTime }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef({ spectrum, combo, beatPulse, globalTime });

  useEffect(() => {
    stateRef.current = { spectrum, combo, beatPulse, globalTime };
  }, [spectrum, combo, beatPulse, globalTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      const { spectrum: spec, combo: c, beatPulse: bp, globalTime: t } = stateRef.current;
      const level = getDiscoLevel(c);
      ctx.clearRect(0, 0, width, height);

      // ---- DISCO BALL LIGHTS ----
      const spotCount = 4 + level * 4;
      const baseAlpha = 0.03 + level * 0.03;
      const pulseAlpha = bp ? 0.05 : 0;
      for (let i = 0; i < spotCount; i++) {
        const speed = 0.25 + (i % 5) * 0.12;
        const phase = (i / spotCount) * Math.PI * 2;
        const x = width * 0.5 + Math.sin(t * speed + phase) * width * 0.38;
        const y = height * 0.3 + Math.cos(t * speed * 0.6 + phase) * height * 0.28;
        const hue = (i * 55 + t * 25) % 360;
        const size = 100 + (bp ? 50 : 0) + level * 20;
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
        const laserAlpha = bp ? 0.2 : 0.08;
        ctx.lineWidth = bp ? 2.5 : 1.2;
        for (let i = 0; i < beamCount; i++) {
          const angle = Math.sin(t * (0.4 + i * 0.18) + i * 1.3) * width * 0.4;
          const ci = i % 4;
          ctx.strokeStyle = LANE_COLORS[ci] + (Math.round(laserAlpha * 255)).toString(16).padStart(2, "0");
          ctx.beginPath();
          ctx.moveTo(width / 2, 0);
          ctx.lineTo(width / 2 + angle, height);
          ctx.stroke();
        }
      }

      // ---- FLOATING PARTICLES ----
      const pCount = 6 + level * 6;
      for (let i = 0; i < pCount; i++) {
        const s1 = Math.sin(i * 127.1) * 0.5 + 0.5;
        const s2 = Math.sin(i * 311.7) * 0.5 + 0.5;
        const s3 = Math.sin(i * 74.3) * 0.5 + 0.5;
        const px = s1 * width;
        const spd = 0.4 + s2 * 1.2;
        const py = height - ((s3 * 100 + t * spd * 12) % (height + 30)) + 15;
        const sz = 2 + s2 * 3 + (bp ? 1.5 : 0);
        const hue = (s1 * 360 + t * 25) % 360;
        const alpha = 0.2 + level * 0.12 + (bp ? 0.15 : 0);
        ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- EDGE GLOW ----
      const edgeAlpha = 0.04 + level * 0.05 + (bp ? 0.08 : 0);
      const edgeSize = 50 + level * 25 + (bp ? 20 : 0);
      const edgeColors = ["#ff2d95", "#00e5ff", "#ffe600", "#b388ff"];
      const edgeSides = [
        { x1: 0, y1: 0, x2: edgeSize, y2: 0, w: edgeSize, h: height, dir: "right" },
        { x1: width, y1: 0, x2: width - edgeSize, y2: 0, w: edgeSize, h: height, dir: "left" },
      ];
      edgeSides.forEach((side, idx) => {
        const grad = ctx.createLinearGradient(
          side.dir === "right" ? 0 : width,
          0,
          side.dir === "right" ? edgeSize : width - edgeSize,
          0
        );
        const c = edgeColors[idx];
        grad.addColorStop(0, c + (Math.round(edgeAlpha * 255)).toString(16).padStart(2, "0"));
        grad.addColorStop(1, c + "00");
        ctx.fillStyle = grad;
        ctx.fillRect(
          side.dir === "right" ? 0 : width - edgeSize,
          0, edgeSize, height
        );
      });
      // Top/bottom
      const topGrad = ctx.createLinearGradient(0, 0, 0, edgeSize);
      topGrad.addColorStop(0, edgeColors[2] + (Math.round(edgeAlpha * 255)).toString(16).padStart(2, "0"));
      topGrad.addColorStop(1, edgeColors[2] + "00");
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, width, edgeSize);

      const botGrad = ctx.createLinearGradient(0, height, 0, height - edgeSize);
      botGrad.addColorStop(0, edgeColors[3] + (Math.round(edgeAlpha * 255)).toString(16).padStart(2, "0"));
      botGrad.addColorStop(1, edgeColors[3] + "00");
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, height - edgeSize, width, edgeSize);

      // ---- BLOCK EQUALIZER BARS (bottom) ----
      const barCount = spec.length;
      const blockW = Math.floor((width - 20) / barCount) - 2;
      const blockGap = 2;
      const blockH = 10;
      const blockVGap = 3;
      const maxBlocks = 20;
      const eqStartX = 10;
      const eqBottomY = height - 15;

      for (let i = 0; i < barCount; i++) {
        const val = spec[i];
        const filledBlocks = Math.max(1, Math.round(val * maxBlocks));
        const hue = barHue(i, barCount);
        const x = eqStartX + i * (blockW + blockGap);

        for (let j = 0; j < filledBlocks; j++) {
          const y = eqBottomY - j * (blockH + blockVGap);
          const brightness = 40 + (j / maxBlocks) * 50 + (bp ? 10 : 0);
          const saturation = 100;
          const alpha = 0.6 + (j / maxBlocks) * 0.4;

          ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${brightness}%, ${alpha})`;
          ctx.fillRect(x, y, blockW, blockH);

          // Glow on top blocks
          if (j === filledBlocks - 1 && level >= 1) {
            ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
            ctx.shadowBlur = 8 + level * 4 + (bp ? 6 : 0);
            ctx.fillStyle = `hsla(${hue}, 100%, ${60 + (bp ? 15 : 0)}%, 0.9)`;
            ctx.fillRect(x, y, blockW, blockH);
            ctx.shadowBlur = 0;
          }
        }

        // Reflection
        const topBlockY = eqBottomY - (Math.max(1, Math.round(spec[i] * maxBlocks)) - 1) * (blockH + blockVGap);
        const reflH = Math.min(30, eqBottomY - topBlockY) * 0.3;
        if (reflH > 2) {
          const reflGrad = ctx.createLinearGradient(0, eqBottomY + 5, 0, eqBottomY + 5 + reflH);
          reflGrad.addColorStop(0, `hsla(${hue}, 80%, 50%, 0.15)`);
          reflGrad.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);
          ctx.fillStyle = reflGrad;
          ctx.fillRect(x, eqBottomY + 5, blockW, reflH);
        }
      }

      // ---- PERSPECTIVE GRID ----
      const gridOpacity = 0.03 + (bp ? 0.04 : 0) + level * 0.015;
      const gridColor = level >= 3 ? "#ffe600" : "#00e5ff";
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

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", top: 0, left: 0,
        width, height,
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}

// ===== Hit particles (small DOM count) =====
function createParticle(x, y, color) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 1.5 + Math.random() * 4;
  return {
    x, y, color,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 3,
    life: 1,
    decay: 0.025 + Math.random() * 0.03,
    size: 2 + Math.random() * 4,
  };
}

// ===== MAIN GAME =====
export default function NeonRhythmGame() {
  const [gameState, setGameState] = useState("menu");
  const [notes, setNotes] = useState([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [judgment, setJudgment] = useState(null);
  const [laneFlash, setLaneFlash] = useState([false, false, false, false]);
  const [currentTime, setCurrentTime] = useState(0);
  const [beatPulse, setBeatPulse] = useState(false);
  const [spectrum, setSpectrum] = useState(new Array(40).fill(0.18));
  const [particles, setParticles] = useState([]);
  const [autoPlay, setAutoPlay] = useState(false);
  const [globalTime, setGlobalTime] = useState(0);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 700 });
  const containerRef = useRef(null);
  const animRef = useRef(null);
  const startTimeRef = useRef(0);
  const judgmentTimer = useRef(null);
  const notesRef = useRef([]);
  const comboRef = useRef(0);
  const particlesRef = useRef([]);
  const autoPlayRef = useRef(false);

  const SPEED = 400;
  const HIT_Y = 520;
  const WINDOW_PERFECT = 0.05;
  const WINDOW_GREAT = 0.1;
  const WINDOW_GOOD = 0.15;

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect();
        setContainerSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Background spectrum always running
  useEffect(() => {
    let raf;
    const animate = () => {
      const t = performance.now() / 1000;
      setGlobalTime(t);
      const c = comboRef.current;
      const bpm = 128;
      const beatInterval = 60 / bpm;
      const bp = Math.sin((t / beatInterval) * Math.PI) > 0.85;
      if (gameState !== "playing") setBeatPulse(bp);
      setSpectrum(generateSpectrum(t, gameState === "playing" ? c : 10, bp));
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [gameState]);

  const toggleAutoPlay = useCallback(() => {
    setAutoPlay(prev => { const n = !prev; autoPlayRef.current = n; return n; });
  }, []);

  const showJudgment = useCallback((type) => {
    setJudgment(type);
    if (judgmentTimer.current) clearTimeout(judgmentTimer.current);
    judgmentTimer.current = setTimeout(() => setJudgment(null), 400);
  }, []);

  const spawnHitParticles = useCallback((lane) => {
    const laneWidth = 80;
    const x = 20 + lane * (laneWidth + 8) + laneWidth / 2;
    const y = HIT_Y;
    const color = LANE_COLORS[lane];
    const newP = Array.from({ length: 8 }, () => createParticle(x, y, color));
    particlesRef.current = [...particlesRef.current, ...newP].slice(-60);
  }, []);

  const doHit = useCallback((lane, jType) => {
    setLaneFlash(prev => { const n = [...prev]; n[lane] = true; return n; });
    setTimeout(() => { setLaneFlash(prev => { const n = [...prev]; n[lane] = false; return n; }); }, 120);
    const cc = comboRef.current;
    setScore(s => s + JUDGMENTS[jType].score * (1 + cc * 0.1));
    const nc = cc + 1;
    setCombo(nc); comboRef.current = nc;
    setMaxCombo(m => Math.max(m, nc));
    showJudgment(jType);
    spawnHitParticles(lane);
  }, [showJudgment, spawnHitParticles]);

  const startGame = useCallback(() => {
    const newNotes = generateDemoNotes();
    setNotes(newNotes); notesRef.current = newNotes;
    setScore(0); setCombo(0); comboRef.current = 0; setMaxCombo(0);
    setJudgment(null); setParticles([]); particlesRef.current = [];
    setGameState("playing");
    startTimeRef.current = performance.now() / 1000;

    const loop = () => {
      const now = performance.now() / 1000 - startTimeRef.current;
      setCurrentTime(now);
      const bpm = 128;
      const bp = Math.sin((now / (60 / bpm)) * Math.PI) > 0.85;
      setBeatPulse(bp);

      particlesRef.current = particlesRef.current
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.06, life: p.life - p.decay }))
        .filter(p => p.life > 0);
      setParticles([...particlesRef.current]);

      if (autoPlayRef.current) {
        notesRef.current.forEach(n => {
          if (!n.hit && !n.missed && Math.abs(n.time - now) < 0.018) {
            n.hit = true; doHit(n.lane, "perfect");
          }
        });
      }

      const updated = notesRef.current.map(n => {
        if (!n.hit && !n.missed && now > n.time + WINDOW_GOOD) return { ...n, missed: true };
        return n;
      });
      const hadMiss = updated.some((n, i) => n.missed && !notesRef.current[i].missed);
      if (hadMiss) { setCombo(0); comboRef.current = 0; showJudgment("miss"); }
      notesRef.current = updated; setNotes([...updated]);

      if (updated.every(n => n.hit || n.missed) && now > 5) { setGameState("result"); return; }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  }, [doHit, showJudgment]);

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  const hitLane = useCallback((lane) => {
    if (gameState !== "playing" || autoPlayRef.current) return;
    setLaneFlash(prev => { const n = [...prev]; n[lane] = true; return n; });
    setTimeout(() => { setLaneFlash(prev => { const n = [...prev]; n[lane] = false; return n; }); }, 120);

    const now = performance.now() / 1000 - startTimeRef.current;
    let closest = null, closestDist = Infinity;
    for (const note of notesRef.current) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const dist = Math.abs(note.time - now);
      if (dist < closestDist) { closestDist = dist; closest = note; }
    }
    if (!closest) return;
    let jType = null;
    if (closestDist <= WINDOW_PERFECT) jType = "perfect";
    else if (closestDist <= WINDOW_GREAT) jType = "great";
    else if (closestDist <= WINDOW_GOOD) jType = "good";
    if (jType) {
      notesRef.current = notesRef.current.map(n => n.id === closest.id ? { ...n, hit: true } : n);
      setNotes([...notesRef.current]); doHit(lane, jType);
    }
  }, [gameState, doHit]);

  useEffect(() => {
    const handler = (e) => {
      const key = e.key.toUpperCase();
      const idx = LANE_KEYS.indexOf(key);
      if (idx >= 0) { e.preventDefault(); hitLane(idx); }
      if (key === " " && gameState === "menu") startGame();
      if (key === "R" && gameState === "result") startGame();
      if (key === "A") toggleAutoPlay();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hitLane, gameState, startGame, toggleAutoPlay]);

  const laneWidth = 80;
  const totalWidth = laneWidth * LANES + (LANES - 1) * 8;
  const gameHeight = 600;
  const discoCombo = gameState === "playing" ? combo : 10;
  const level = getDiscoLevel(discoCombo);
  const bgBrightness = 8 + level * 3;

  return (
    <div ref={containerRef} style={{
      background: `hsl(240, 40%, ${bgBrightness}%)`,
      minHeight: "100vh",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Orbitron', 'Rajdhani', monospace",
      overflow: "hidden", position: "relative", padding: "1rem",
      transition: "background 0.5s",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* ALL background effects in ONE canvas */}
      <CanvasBackground
        width={containerSize.w}
        height={containerSize.h}
        spectrum={spectrum}
        combo={discoCombo}
        beatPulse={beatPulse}
        globalTime={globalTime}
      />

      {/* Scanlines */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #00000008 2px, #00000008 4px)",
        pointerEvents: "none", zIndex: 10,
      }} />

      {/* AUTO PLAY badge */}
      {autoPlay && gameState === "playing" && (
        <div style={{
          position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
          background: "#ffe60020", border: "1px solid #ffe60060", borderRadius: 8,
          padding: "6px 20px", zIndex: 20,
          color: "#ffe600", fontSize: 13, fontFamily: "Orbitron", fontWeight: 700,
          letterSpacing: "0.15em", boxShadow: "0 0 20px #ffe60030",
          animation: "autoPulse 1.5s ease-in-out infinite",
        }}>AUTO PLAY</div>
      )}

      {/* Disco level indicator */}
      {gameState === "playing" && level > 0 && (
        <div style={{
          position: "absolute", top: 16, right: 20, zIndex: 20,
          display: "flex", gap: 4, alignItems: "flex-end",
        }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              width: 8, height: 14 + i * 6, borderRadius: 3,
              background: i < level ? LANE_COLORS[i] : "#ffffff15",
              boxShadow: i < level ? `0 0 8px ${LANE_COLORS[i]}60` : "none",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
      )}

      {/* ===== MENU ===== */}
      {gameState === "menu" && (
        <div style={{ textAlign: "center", zIndex: 5 }}>
          <h1 style={{
            fontSize: "clamp(2rem, 6vw, 3.5rem)", fontWeight: 900, color: "#fff",
            textShadow: "0 0 20px #ff2d95, 0 0 40px #ff2d9580, 0 0 80px #ff2d9540",
            letterSpacing: "0.15em", margin: "0 0 0.25rem", fontFamily: "Orbitron",
          }}>NEON BEAT</h1>
          <p style={{
            color: "#00e5ff", fontSize: "clamp(0.7rem, 2vw, 1rem)",
            textShadow: "0 0 10px #00e5ff80", letterSpacing: "0.3em",
            fontFamily: "Rajdhani", fontWeight: 600, margin: "0 0 3rem",
          }}>DISCO RHYTHM</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: "2.5rem" }}>
            {LANE_KEYS.map((k, i) => (
              <div key={k} style={{
                width: 56, height: 56, borderRadius: 12,
                border: `2px solid ${LANE_COLORS[i]}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: LANE_COLORS[i], fontSize: 22, fontWeight: 700, fontFamily: "Orbitron",
                boxShadow: `0 0 15px ${LANE_GLOW[i]}, inset 0 0 15px ${LANE_GLOW[i]}`,
              }}>{k}</div>
            ))}
          </div>
          <button onClick={startGame} onTouchEnd={(e) => { e.preventDefault(); startGame(); }}
            style={{
              background: "transparent", border: "2px solid #ffe600", color: "#ffe600",
              padding: "14px 48px", fontSize: "clamp(1rem, 3vw, 1.3rem)", fontFamily: "Orbitron",
              fontWeight: 700, letterSpacing: "0.2em", cursor: "pointer", borderRadius: 8,
              boxShadow: "0 0 20px #ffe60050, inset 0 0 20px #ffe60020",
            }}>START</button>
          <div style={{ marginTop: 24 }}>
            <button onClick={toggleAutoPlay} onTouchEnd={(e) => { e.preventDefault(); toggleAutoPlay(); }}
              style={{
                background: autoPlay ? "#ffe60015" : "transparent",
                border: `1px solid ${autoPlay ? "#ffe600" : "#ffffff30"}`,
                color: autoPlay ? "#ffe600" : "#ffffff60",
                padding: "8px 24px", fontSize: 12, fontFamily: "Orbitron",
                fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", borderRadius: 6,
                boxShadow: autoPlay ? "0 0 10px #ffe60030" : "none", transition: "all 0.2s",
              }}>AUTO PLAY: {autoPlay ? "ON" : "OFF"}</button>
          </div>
          <p style={{ color: "#ffffff50", fontSize: 13, marginTop: 20, fontFamily: "Rajdhani" }}>PC: SPACE to start / D F J K to play</p>
          <p style={{ color: "#ffffff40", fontSize: 12, marginTop: 4, fontFamily: "Rajdhani" }}>A key to toggle auto play</p>
        </div>
      )}

      {/* ===== PLAYING ===== */}
      {gameState === "playing" && (
        <div style={{ zIndex: 5, width: "100%", maxWidth: 500 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 4px" }}>
            <div>
              <div style={{ color: "#ffffff60", fontSize: 11, fontFamily: "Rajdhani", letterSpacing: "0.15em" }}>SCORE</div>
              <div style={{ color: "#fff", fontSize: "clamp(1.2rem, 4vw, 1.8rem)", fontFamily: "Orbitron", fontWeight: 700, textShadow: "0 0 10px #ffe60060" }}>{Math.floor(score).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: "center", minWidth: 120 }}>
              {judgment && (
                <div style={{
                  color: JUDGMENTS[judgment].color,
                  fontSize: "clamp(1rem, 4vw, 1.5rem)", fontFamily: "Orbitron", fontWeight: 900,
                  textShadow: `0 0 20px ${JUDGMENTS[judgment].color}80`,
                  animation: "judgPop 0.3s ease-out",
                }}>{JUDGMENTS[judgment].text}</div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#ffffff60", fontSize: 11, fontFamily: "Rajdhani", letterSpacing: "0.15em" }}>COMBO</div>
              <div style={{
                color: combo > 20 ? "#ffe600" : combo > 10 ? "#00e5ff" : "#fff",
                fontSize: "clamp(1.2rem, 4vw, 1.8rem)", fontFamily: "Orbitron", fontWeight: 700,
                textShadow: combo > 20 ? "0 0 15px #ffe60080" : combo > 10 ? "0 0 15px #00e5ff80" : "none",
              }}>{combo}</div>
            </div>
          </div>

          <div style={{
            position: "relative", width: "100%", maxWidth: totalWidth + 40,
            height: gameHeight, margin: "0 auto", background: "#0a0a1890",
            borderRadius: 16, overflow: "hidden",
            border: `1px solid ${level >= 3 ? "#ffe60025" : "#ffffff15"}`,
            boxShadow: beatPulse
              ? `0 0 40px ${level >= 3 ? "#ffe60012" : "#ff2d9512"}, inset 0 0 40px #00000060`
              : "inset 0 0 30px #00000080",
          }}>
            {Array.from({ length: LANES }).map((_, i) => (
              <div key={i} style={{
                position: "absolute", left: 20 + i * (laneWidth + 8), top: 0,
                width: laneWidth, height: "100%",
                background: laneFlash[i]
                  ? `linear-gradient(to bottom, ${LANE_COLORS[i]}10, ${LANE_COLORS[i]}30)`
                  : `linear-gradient(to bottom, ${LANE_COLORS[i]}04, ${LANE_COLORS[i]}0a)`,
                borderLeft: `1px solid ${LANE_COLORS[i]}20`,
                borderRight: `1px solid ${LANE_COLORS[i]}20`,
              }} />
            ))}

            {Array.from({ length: 10 }).map((_, i) => {
              const y = ((currentTime * 100 + i * 65) % (gameHeight + 60)) - 30;
              return <div key={i} style={{
                position: "absolute", left: 20, width: totalWidth, top: y, height: 1,
                background: "linear-gradient(90deg, transparent, #ffffff06, transparent)",
                pointerEvents: "none",
              }} />
            })}

            {notes.map(note => {
              if (note.hit || note.missed) return null;
              const y = HIT_Y - (note.time - currentTime) * SPEED;
              if (y < -60 || y > gameHeight + 20) return null;
              return (
                <div key={note.id} style={{
                  position: "absolute",
                  left: 20 + note.lane * (laneWidth + 8) + 8,
                  top: y - 12, width: laneWidth - 16, height: 24, borderRadius: 6,
                  background: `linear-gradient(135deg, ${LANE_COLORS[note.lane]}, ${LANE_COLORS[note.lane]}cc)`,
                  boxShadow: `0 0 12px ${LANE_GLOW[note.lane]}, 0 0 24px ${LANE_GLOW[note.lane]}`,
                  border: `1px solid ${LANE_COLORS[note.lane]}`,
                  pointerEvents: "none",
                }} />
              );
            })}

            {particles.map((p, i) => (
              <div key={i} style={{
                position: "absolute", left: p.x - p.size / 2, top: p.y - p.size / 2,
                width: p.size, height: p.size, borderRadius: "50%",
                background: p.color, opacity: p.life,
                boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
                pointerEvents: "none",
              }} />
            ))}

            <div style={{
              position: "absolute", left: 12, right: 12, top: HIT_Y, height: 3,
              background: "linear-gradient(90deg, transparent, #ffffff90, transparent)",
              boxShadow: beatPulse ? "0 0 15px #ffffff30" : "0 0 8px #ffffff15",
              pointerEvents: "none",
            }} />

            {Array.from({ length: LANES }).map((_, i) => (
              <div key={i} onClick={() => hitLane(i)}
                onTouchStart={(e) => { e.preventDefault(); hitLane(i); }}
                style={{
                  position: "absolute", left: 20 + i * (laneWidth + 8),
                  top: HIT_Y - 30, width: laneWidth, height: 60,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", zIndex: 20,
                }}>
                <div style={{
                  width: laneWidth - 12, height: 44, borderRadius: 10,
                  border: `2px solid ${laneFlash[i] ? LANE_COLORS[i] : LANE_COLORS[i] + "60"}`,
                  background: laneFlash[i] ? `${LANE_COLORS[i]}30` : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: laneFlash[i] ? LANE_COLORS[i] : LANE_COLORS[i] + "80",
                  fontSize: 16, fontFamily: "Orbitron", fontWeight: 700,
                  boxShadow: laneFlash[i]
                    ? `0 0 25px ${LANE_GLOW[i]}, inset 0 0 12px ${LANE_GLOW[i]}`
                    : `0 0 5px ${LANE_GLOW[i]}`,
                }}>{LANE_KEYS[i]}</div>
              </div>
            ))}

            {laneFlash.map((flash, i) =>
              flash && (
                <div key={`f${i}`} style={{
                  position: "absolute", left: 20 + i * (laneWidth + 8),
                  top: HIT_Y - 50, width: laneWidth, height: 100,
                  background: `radial-gradient(ellipse, ${LANE_COLORS[i]}50, transparent)`,
                  pointerEvents: "none",
                }} />
              )
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: 12 }}>
            <button onClick={toggleAutoPlay} style={{
              background: "transparent", border: "none",
              color: autoPlay ? "#ffe60090" : "#ffffff30",
              fontSize: 11, fontFamily: "Rajdhani", cursor: "pointer", letterSpacing: "0.1em",
            }}>[A] AUTO: {autoPlay ? "ON" : "OFF"}</button>
          </div>
        </div>
      )}

      {/* ===== RESULT ===== */}
      {gameState === "result" && (
        <div style={{ textAlign: "center", zIndex: 5 }}>
          <h2 style={{
            fontSize: "clamp(1.5rem, 5vw, 2.5rem)", fontWeight: 900, fontFamily: "Orbitron",
            color: "#ffe600", textShadow: "0 0 30px #ffe60060",
            margin: "0 0 2rem", letterSpacing: "0.1em",
          }}>RESULT</h2>
          <div style={{
            background: "#ffffff0a", borderRadius: 16, padding: "2rem 3rem",
            border: "1px solid #ffffff15", display: "inline-block", minWidth: 280,
          }}>
            {autoPlay && <div style={{ color: "#ffe60080", fontSize: 11, fontFamily: "Orbitron", letterSpacing: "0.15em", marginBottom: 12 }}>AUTO PLAY</div>}
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: "#ffffff50", fontSize: 12, fontFamily: "Rajdhani", letterSpacing: "0.2em" }}>SCORE</div>
              <div style={{ color: "#fff", fontSize: "clamp(2rem, 6vw, 3rem)", fontFamily: "Orbitron", fontWeight: 900, textShadow: "0 0 20px #00e5ff60" }}>{Math.floor(score).toLocaleString()}</div>
            </div>
            <div style={{ display: "flex", gap: 32, justifyContent: "center" }}>
              <div>
                <div style={{ color: "#ffffff50", fontSize: 11, fontFamily: "Rajdhani", letterSpacing: "0.2em" }}>MAX COMBO</div>
                <div style={{ color: "#b388ff", fontSize: 28, fontFamily: "Orbitron", fontWeight: 700 }}>{maxCombo}</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 32 }}>
            <button onClick={startGame} onTouchEnd={(e) => { e.preventDefault(); startGame(); }}
              style={{
                background: "transparent", border: "2px solid #00e5ff", color: "#00e5ff",
                padding: "12px 40px", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", fontFamily: "Orbitron",
                fontWeight: 700, letterSpacing: "0.15em", cursor: "pointer", borderRadius: 8,
                boxShadow: "0 0 15px #00e5ff40, inset 0 0 15px #00e5ff15",
              }}>RETRY</button>
          </div>
          <p style={{ color: "#ffffff40", fontSize: 12, marginTop: 12, fontFamily: "Rajdhani" }}>Press R to retry</p>
        </div>
      )}

      <style>{`
        @keyframes judgPop {
          0% { transform: scale(1.8); opacity: 0.3; }
          50% { transform: scale(0.95); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes autoPulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; overflow: hidden; }
      `}</style>
    </div>
  );
}
