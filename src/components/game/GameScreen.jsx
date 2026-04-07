import { useEffect, useRef, useState } from 'react';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  JUDGE_LINE_OFFSET,
  LANES,
  LANE_COLORS,
  MAX_PARTICLES,
  PARTICLES_PER_HIT,
} from '../../utils/constants.js';
import { getDiscoLevel } from '../../utils/helpers.js';
import { getAudioEngine } from '../../engine/AudioEngine.js';
import { getSoundEffects } from '../../engine/SoundEffects.js';
import { GameEngine } from '../../engine/GameEngine.js';
import { loadChart, getAudioUrl } from '../../engine/ChartLoader.js';
import Lane from './Lane.jsx';
import Note from './Note.jsx';
import HitEffect from './HitEffect.jsx';
import JudgmentDisplay from './JudgmentDisplay.jsx';
import PauseMenu from './PauseMenu.jsx';
import ProgressBar from './ProgressBar.jsx';
import IntroOverlay from './IntroOverlay.jsx';
import FinishRankOverlay from './FinishRankOverlay.jsx';
import ScoreDisplay from '../hud/ScoreDisplay.jsx';
import ComboDisplay from '../hud/ComboDisplay.jsx';
import DiscoLevelIndicator from '../hud/DiscoLevelIndicator.jsx';

const LANE_WIDTH = FIELD_WIDTH / LANES;
const JUDGE_LINE_Y = FIELD_HEIGHT - JUDGE_LINE_OFFSET;

let particleId = 0;
function spawnParticles(x, y, color, count = PARTICLES_PER_HIT) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    arr.push({
      id: particleId++,
      x,
      y,
      color,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      life: 1,
      decay: 0.025 + Math.random() * 0.03,
      size: 2 + Math.random() * 4,
    });
  }
  return arr;
}

export default function GameScreen({
  song,
  difficulty,
  settings,
  bgState,
  inputHandler,
  onFinish,
  onQuit,
  retryToken,
  introEnabled = true,
}) {
  const engineRef = useRef(null); // GameEngine
  const audioRef = useRef(null); // AudioEngine
  const seRef = useRef(null);
  const rafRef = useRef(0);
  const startedRef = useRef(false);
  const particlesRef = useRef([]);
  const laneFlashRef = useRef([0, 0, 0, 0]);
  const lastAutoSeRef = useRef(0); // throttle SE during AUTO play
  const gameFinishedAtRef = useRef(0); // wall-clock when game.finished detected (fallback)

  const [hudScore, setHudScore] = useState(0);
  const [hudCombo, setHudCombo] = useState(0);
  const [hudJudgment, setHudJudgment] = useState(null);
  const [hudParticles, setHudParticles] = useState([]);
  const [hudLaneFlash, setHudLaneFlash] = useState([false, false, false, false]);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  // 'loading' → 'intro' (5s flashy countdown) → 'playing'
  const [phase, setPhase] = useState('loading');
  // Snapshot of the result for FinishRankOverlay; null until song ends
  const [finishSnapshot, setFinishSnapshot] = useState(null);

  // Setup: load chart + audio, start game
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setHudScore(0);
    setHudCombo(0);
    setHudJudgment(null);
    setHudParticles([]);
    setProgress(0);
    setCurrentTime(0);
    setPaused(false);
    setPhase('loading');
    setFinishSnapshot(null);
    particlesRef.current = [];
    startedRef.current = false;
    gameFinishedAtRef.current = 0;

    const audio = getAudioEngine();
    const se = getSoundEffects();
    const game = new GameEngine();
    audioRef.current = audio;
    seRef.current = se;
    engineRef.current = game;

    audio.setBgmVolume(settings.bgmVolume);
    audio.setSeVolume(settings.seVolume);

    (async () => {
      try {
        const chart = await loadChart(song.id);
        if (cancelled) return;
        await audio.load(getAudioUrl(song.id));
        if (cancelled) return;
        await se.load();
        if (cancelled) return;

        game.load(chart, difficulty, {
          judgeOffsetMs: settings.judgeOffset,
          autoPlay: settings.autoPlay,
        });
        game.onJudgment = (type, lane) => {
          // In AUTO mode we throttle SE so rapid bursts don't pile up audio nodes
          if (game.autoPlay) {
            const now = performance.now();
            if (now - lastAutoSeRef.current > 40) {
              se.playJudgment(type);
              lastAutoSeRef.current = now;
            }
          } else {
            se.playJudgment(type);
          }
          // Particles + lane flash
          if (type !== 'miss') {
            const x = lane * LANE_WIDTH + LANE_WIDTH / 2;
            const y = JUDGE_LINE_Y;
            // Fewer particles in AUTO mode to avoid React DOM thrash
            const count = game.autoPlay ? 2 : PARTICLES_PER_HIT;
            const newParts = spawnParticles(x, y, LANE_COLORS[lane], count);
            const merged = particlesRef.current.concat(newParts);
            if (merged.length > MAX_PARTICLES) {
              merged.splice(0, merged.length - MAX_PARTICLES);
            }
            particlesRef.current = merged;
          }
          laneFlashRef.current[lane] = performance.now();
        };
        game.onComboMilestone = () => {
          se.playComboMilestone();
        };

        // Don't start audio yet - move to intro phase first.
        if (cancelled) return;
        setLoading(false);
        setPhase('intro');
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e.message || 'Failed to start');
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) audioRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?.id, difficulty, retryToken]);

  // Intro phase: hold for 5s with flashy overlay, then start audio + game loop.
  // Waits until introEnabled becomes true (parent fade-in finished).
  useEffect(() => {
    if (phase !== 'intro' || !introEnabled) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const audio = audioRef.current;
      if (!audio) return;
      try {
        await audio.play();
        if (cancelled) return;
        startedRef.current = true;
        setPhase('playing');
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to start audio');
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, introEnabled]);

  // React to settings volume changes mid-play
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.setBgmVolume(settings.bgmVolume);
      audioRef.current.setSeVolume(settings.seVolume);
    }
    if (engineRef.current) {
      engineRef.current.setJudgeOffset(settings.judgeOffset);
      engineRef.current.setAutoPlay(settings.autoPlay);
    }
  }, [settings.bgmVolume, settings.seVolume, settings.judgeOffset, settings.autoPlay]);

  // Game loop - only runs once we're in 'playing' phase
  useEffect(() => {
    if (phase !== 'playing' || error) return;
    let lastJudgmentTime = 0;

    const beatInterval = 60 / (song.bpm || 120);

    const tick = () => {
      const audio = audioRef.current;
      const game = engineRef.current;
      if (!audio || !game) return;

      if (!paused && startedRef.current) {
        const audioTime = audio.getCurrentTime();
        game.tick(audioTime);

        // Beat pulse
        const phase = ((audioTime % beatInterval) / beatInterval) * Math.PI;
        const beatPulse = Math.sin(phase) > 0.85;

        // Update bg state ref (read by CanvasBackground)
        if (bgState && bgState.current) {
          bgState.current.spectrum = audio.getSpectrum();
          bgState.current.combo = game.combo;
          bgState.current.beatPulse = beatPulse;
          bgState.current.globalTime = performance.now() / 1000;
        }

        // Particles update (mutates in place; we only build a new array
        // when something actually died so React reconciliation has work to do)
        const cur = particlesRef.current;
        let alive = 0;
        for (let pi = 0; pi < cur.length; pi++) {
          const p = cur[pi];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.06;
          p.life -= p.decay;
          if (p.life > 0) {
            if (alive !== pi) cur[alive] = p;
            alive++;
          }
        }
        if (alive !== cur.length) {
          cur.length = alive;
        }
        // Always pass the same ref slice so React updates positions, but
        // skip the React update entirely when there is nothing to draw.
        if (cur.length > 0 || hudParticles.length > 0) {
          setHudParticles(cur.slice());
        }

        // Lane flash
        const now = performance.now();
        const lf = laneFlashRef.current.map((t) => now - t < 120);
        setHudLaneFlash(lf);

        // HUD
        setHudScore(game.score);
        setHudCombo(game.combo);
        if (game.lastJudgment && game.lastJudgment.time !== lastJudgmentTime) {
          lastJudgmentTime = game.lastJudgment.time;
          setHudJudgment({ type: game.lastJudgment.type, key: game.lastJudgment.time });
        }

        // Time + progress (setCurrentTime alone re-renders the component
        // and updates note positions — no separate renderTick needed)
        setCurrentTime(audioTime);
        setProgress(audio.duration > 0 ? audioTime / audio.duration : 0);

        // Finish: wait until the audio has fully played out plus a silent
        // afterglow so the BGM doesn't cut off abruptly. The afterglow is also
        // when the FinishRankOverlay reveals the rank — 4.5s gives enough time
        // for the slam-in animation (~1.5s) plus a calm hold (~3s).
        // game.finished alone is NOT enough — for many songs the last note is
        // well before the natural song end, and we still want to enjoy the outro.
        const TAIL_SECONDS = 4.5;

        // Trigger the rank reveal exactly when audio reaches its natural end
        if (
          !finishSnapshot &&
          audio.duration > 0 &&
          audioTime >= audio.duration
        ) {
          setFinishSnapshot(game.getResult());
        }

        if (audio.duration > 0 && audioTime >= audio.duration + TAIL_SECONDS) {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          onFinish(game.getResult());
          return;
        }
        // Fallback: if duration is unknown for some reason, wait 3 seconds
        // after the engine reports game.finished before transitioning.
        if (audio.duration <= 0 && game.finished) {
          if (!gameFinishedAtRef.current) {
            gameFinishedAtRef.current = performance.now();
          } else if (
            performance.now() - gameFinishedAtRef.current >=
            TAIL_SECONDS * 1000
          ) {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            onFinish(game.getResult());
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, error, paused, song?.bpm, bgState, onFinish, finishSnapshot]);

  // Lane key/touch input
  useEffect(() => {
    if (!inputHandler) return;
    const handleLane = (laneIdx) => {
      const audio = audioRef.current;
      const game = engineRef.current;
      if (!audio || !game || paused || !startedRef.current) return;
      game.handleInput(laneIdx, audio.getCurrentTime());
    };
    inputHandler.setLaneCallback(handleLane);

    // Esc toggles pause
    inputHandler.setShortcut('Escape', () => {
      setPaused((p) => !p);
    });
    // A toggles AUTO PLAY mid-play
    inputHandler.setShortcut('KeyA', () => {
      const game = engineRef.current;
      if (game) {
        game.setAutoPlay(!game.autoPlay);
      }
    });

    return () => {
      inputHandler.clearLaneCallback();
      inputHandler.clearShortcut('Escape');
      inputHandler.clearShortcut('KeyA');
    };
  }, [inputHandler, paused]);

  // Pause/resume audio when `paused` toggles
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !startedRef.current) return;
    if (paused) {
      audio.pause();
    } else {
      audio.resume();
    }
  }, [paused]);

  const handleRetry = () => {
    if (audioRef.current) audioRef.current.stop();
    onQuit({ retry: true });
  };

  const discoLevel = getDiscoLevel(hudCombo);

  return (
    <div
      className="screen"
      style={{
        pointerEvents: 'auto',
        justifyContent: 'flex-start',
        paddingTop: 20,
      }}
    >
      {/* HUD top bar */}
      <div
        style={{
          width: FIELD_WIDTH,
          maxWidth: '92vw',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <ScoreDisplay score={hudScore} />
        <ComboDisplay combo={hudCombo} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <DiscoLevelIndicator level={discoLevel} />
          <div
            style={{
              fontSize: 11,
              color: '#ffffff80',
              maxWidth: 120,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              fontFamily: 'Orbitron, sans-serif',
            }}
            title={song?.title}
          >
            ♪ {song?.title}
          </div>
          <button
            onClick={() => setPaused(true)}
            style={{
              color: '#ffffff80',
              border: '1px solid #ffffff40',
              borderRadius: 4,
              width: 28,
              height: 28,
              fontSize: 16,
              background: 'transparent',
            }}
            aria-label="pause"
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ width: FIELD_WIDTH, maxWidth: '92vw', marginBottom: 8 }}>
        <ProgressBar progress={progress} />
      </div>

      {/* Game field */}
      <div
        style={{
          position: 'relative',
          width: FIELD_WIDTH,
          height: FIELD_HEIGHT,
          maxWidth: '92vw',
          background: '#0a0a18ee',
          backdropFilter: 'blur(6px)',
          border:
            discoLevel >= 3
              ? '1px solid #ffe60025'
              : '1px solid #ffffff15',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {/* Lanes */}
        {Array.from({ length: LANES }, (_, i) => (
          <Lane
            key={i}
            index={i}
            x={i * LANE_WIDTH}
            width={LANE_WIDTH}
            fieldHeight={FIELD_HEIGHT}
            judgeLineY={JUDGE_LINE_Y}
            flash={hudLaneFlash[i]}
            onTouchStart={(laneIdx) => {
              const audio = audioRef.current;
              const game = engineRef.current;
              if (!audio || !game || paused || !startedRef.current) return;
              game.handleInput(laneIdx, audio.getCurrentTime());
            }}
          />
        ))}

        {/* Judge line */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: JUDGE_LINE_Y,
            height: 2,
            background:
              'linear-gradient(90deg, transparent, #ffffffd0 20%, #ffffffd0 80%, transparent)',
            boxShadow: '0 0 12px #ffffffa0',
          }}
        />

        {/* Notes - only render those currently inside the visible window.
            Filtering here avoids creating React elements for the other 600+
            notes every frame, which is what was causing AUTO-play stutter. */}
        {(() => {
          const notes = engineRef.current?.notes;
          if (!notes) return null;
          // Time window where a note can be on-screen:
          //   judgeLineY - (t - now) * speed ∈ [-40, FIELD_HEIGHT + 40]
          //   → (t - now) ∈ [(judgeLineY - FIELD_HEIGHT - 40)/speed, (judgeLineY+40)/speed]
          const speed = settings.noteSpeed;
          const tMin =
            currentTime + (JUDGE_LINE_Y - FIELD_HEIGHT - 40) / speed;
          const tMax = currentTime + (JUDGE_LINE_Y + 40) / speed;
          const out = [];
          for (const note of notes) {
            if (note.hit || note.missed) continue;
            if (note.time < tMin) continue;
            if (note.time > tMax) break; // notes are sorted by time
            out.push(
              <Note
                key={note.id}
                note={note}
                currentTime={currentTime}
                noteSpeed={speed}
                fieldHeight={FIELD_HEIGHT}
                judgeLineY={JUDGE_LINE_Y}
                laneWidth={LANE_WIDTH}
                laneX={note.lane * LANE_WIDTH}
              />
            );
          }
          return out;
        })()}

        {/* Particles */}
        <HitEffect particles={hudParticles} />

        {/* Judgment display */}
        {hudJudgment && <JudgmentDisplay key={hudJudgment.key} judgment={hudJudgment} />}

        {/* Loading / error */}
        {phase === 'loading' && !error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00e5ff',
              fontFamily: 'Orbitron, sans-serif',
              letterSpacing: '0.2em',
            }}
          >
            LOADING…
          </div>
        )}

        {error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              color: '#ff2d95',
              padding: 24,
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 700 }}>ERROR</div>
            <div style={{ fontSize: 13, color: '#ffffffa0' }}>{error}</div>
            <button className="neon-button" style={{ color: '#ff2d95' }} onClick={() => onQuit()}>
              BACK
            </button>
          </div>
        )}
      </div>

      {/* Pause menu */}
      {paused && (
        <PauseMenu
          inputHandler={inputHandler}
          onResume={() => setPaused(false)}
          onRetry={handleRetry}
          onQuit={() => onQuit()}
        />
      )}

      {/* Full-viewport intro overlay - covers everything including HUD/background.
          Only shown after the parent's white fade-in completes. */}
      {phase === 'intro' && introEnabled && !error && (
        <IntroOverlay song={song} difficulty={difficulty} />
      )}

      {/* End-of-song rank reveal during the silent afterglow */}
      {finishSnapshot && <FinishRankOverlay result={finishSnapshot} />}

    </div>
  );
}
