import { useEffect, useMemo, useRef, useState } from 'react';
import { SCREENS, SPECTRUM_BANDS } from './utils/constants.js';
import {
  loadSettings,
  saveSettings,
  recordSongPlay,
  accuracyPercent,
} from './utils/helpers.js';
import { createInputHandler } from './engine/InputHandler.js';
import { getSoundEffects } from './engine/SoundEffects.js';
import { getMenuBgm } from './engine/MenuBgmPlayer.js';
import { getAudioEngine } from './engine/AudioEngine.js';
import CanvasBackground from './components/background/CanvasBackground.jsx';
import MenuScreen from './components/ui/MenuScreen.jsx';
import SongSelect from './components/ui/SongSelect.jsx';
import DifficultySelect from './components/ui/DifficultySelect.jsx';
import ResultScreen from './components/ui/ResultScreen.jsx';
import SettingsPanel from './components/ui/SettingsPanel.jsx';
import GameScreen from './components/game/GameScreen.jsx';
import WhiteFadeOverlay from './components/ui/WhiteFadeOverlay.jsx';

const FADE_OUT_MS = 2000;
const FADE_IN_MS = 2000;

export default function App() {
  const [screen, setScreen] = useState(SCREENS.TITLE);
  const [settings, setSettings] = useState(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [retryToken, setRetryToken] = useState(0);
  // 'none' | 'fadeOut' (current screen → white) | 'fadeIn' (white → next screen)
  const [transition, setTransition] = useState({ phase: 'none', startedAt: 0 });
  const transitionTimers = useRef([]);

  const inputHandler = useMemo(() => createInputHandler(), []);
  // Tracks whether the menu BGM has been kicked off at least once. Browsers
  // block AudioContext.resume() before any user gesture, so we wait for the
  // first START click before calling getMenuBgm().fadeIn().
  const menuBgmStartedRef = useRef(false);
  const bgStateRef = useRef({
    spectrum: new Float32Array(SPECTRUM_BANDS).fill(0.2),
    combo: 10, // idle disco level
    beatPulse: false,
    globalTime: 0,
    idle: true, // when true, CanvasBackground generates a synthetic moving spectrum
  });

  // Attach global key handler
  useEffect(() => {
    inputHandler.attach();
    return () => {
      inputHandler.detach();
    };
  }, [inputHandler]);

  // Persist settings
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Preload the menu BGM file once. Failure (404) is silently ignored so the
  // game still works without a BGM file present.
  useEffect(() => {
    getMenuBgm().load('/bgm/menu.wav');
  }, []);

  // Mirror bgmVolume into the menu BGM player so the SETTINGS slider also
  // controls the menu music live.
  useEffect(() => {
    getMenuBgm().setVolume(settings.bgmVolume);
  }, [settings.bgmVolume]);

  // Drive the menu BGM based on the current screen + transition state.
  // Plays on TITLE/SONG_SELECT/DIFFICULTY_SELECT/RESULT, fades out during
  // transitions and gameplay. Skips the very first TITLE render until START
  // is clicked, since AudioContext can't start without a user gesture.
  useEffect(() => {
    const bgm = getMenuBgm();
    const isMenuScreen =
      screen === SCREENS.TITLE ||
      screen === SCREENS.SONG_SELECT ||
      screen === SCREENS.DIFFICULTY_SELECT ||
      screen === SCREENS.RESULT;
    const isTransitioning = transition.phase !== 'none';
    if (isMenuScreen && !isTransitioning && menuBgmStartedRef.current) {
      bgm.fadeIn(800);
    } else {
      bgm.fadeOut(1500);
    }
  }, [screen, transition.phase]);

  // Global AUTO PLAY toggle (A key) — works on every screen except game (game manages its own)
  useEffect(() => {
    if (screen === SCREENS.GAME) return;
    const handler = () => {
      setSettings((s) => ({ ...s, autoPlay: !s.autoPlay }));
    };
    inputHandler.setShortcut('KeyA', handler);
    return () => {
      inputHandler.clearShortcut('KeyA');
    };
  }, [inputHandler, screen]);

  // Reset bg state to idle when not in game
  useEffect(() => {
    if (screen !== SCREENS.GAME) {
      bgStateRef.current.combo = 10;
      bgStateRef.current.beatPulse = false;
      bgStateRef.current.idle = true;
    } else {
      bgStateRef.current.idle = false;
    }
  }, [screen]);

  const handleStart = () => {
    // First user gesture: kick the AudioContext into 'running' so the menu
    // BGM can begin. Subsequent visits to TITLE skip this branch.
    if (!menuBgmStartedRef.current) {
      const ctx = getAudioEngine().getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      menuBgmStartedRef.current = true;
      // Trigger the first fadeIn immediately - the screen-driven effect
      // below will also fire on SONG_SELECT entry but starting here makes
      // the music swell during the transition out of TITLE.
      getMenuBgm().fadeIn(800);
    }
    setScreen(SCREENS.SONG_SELECT);
  };
  const handleSongSelect = (song) => {
    setSelectedSong(song);
    setScreen(SCREENS.DIFFICULTY_SELECT);
  };

  const clearTransitionTimers = () => {
    transitionTimers.current.forEach((id) => clearTimeout(id));
    transitionTimers.current = [];
  };

  const startGameTransition = (diff) => {
    clearTransitionTimers();
    setSelectedDifficulty(diff);
    setRetryToken((t) => t + 1);
    setTransition({ phase: 'fadeOut', startedAt: performance.now() });
    // Pre-warm SE manager and play "ピカーン" SE in sync with the flash
    const se = getSoundEffects();
    se.load().then(() => se.playFlash());
    // Fade the menu BGM out alongside the white flash
    getMenuBgm().fadeOut(1500);
    // After fade-out completes, swap to GAME screen and start fade-in
    transitionTimers.current.push(
      setTimeout(() => {
        setScreen(SCREENS.GAME);
        setTransition({ phase: 'fadeIn', startedAt: performance.now() });
      }, FADE_OUT_MS)
    );
    // After fade-in completes, transition is done
    transitionTimers.current.push(
      setTimeout(() => {
        setTransition({ phase: 'none', startedAt: 0 });
      }, FADE_OUT_MS + FADE_IN_MS)
    );
  };

  const handleDifficultySelect = (diff) => {
    startGameTransition(diff);
  };

  useEffect(() => () => clearTransitionTimers(), []);
  const handleGameFinish = (result) => {
    if (selectedSong) {
      // AUTO PLAY runs don't qualify for the leaderboard.
      const scoreEntry = result.autoPlay
        ? null
        : {
            score: result.score,
            difficulty: selectedDifficulty,
            accuracy: accuracyPercent(
              result.perfects,
              result.greats,
              result.goods,
              result.totalNotes
            ),
            maxCombo: result.maxCombo,
            autoPlay: false,
            timestamp: Date.now(),
          };
      recordSongPlay(selectedSong.id, scoreEntry);
    }
    setGameResult(result);
    setScreen(SCREENS.RESULT);
  };
  const handleGameQuit = (opts) => {
    if (opts && opts.retry) {
      // Re-run the fancy transition for retry too
      startGameTransition(selectedDifficulty);
      return;
    }
    setScreen(SCREENS.SONG_SELECT);
  };
  const handleRetry = () => {
    startGameTransition(selectedDifficulty);
  };
  const handleBackToSelect = () => setScreen(SCREENS.SONG_SELECT);
  const handleBackToTitle = () => setScreen(SCREENS.TITLE);

  return (
    <div className="app-root">
      <CanvasBackground stateRef={bgStateRef} />
      <div className="scanlines" />

      {/* When SettingsPanel is open we pass null as inputHandler so screens
          unbind their shortcuts; on close, the prop becomes non-null again,
          re-running their effects and re-binding Escape/Enter/etc. */}
      {screen === SCREENS.TITLE && (
        <MenuScreen
          inputHandler={settingsOpen ? null : inputHandler}
          onStart={handleStart}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {screen === SCREENS.SONG_SELECT && (
        <SongSelect
          inputHandler={settingsOpen ? null : inputHandler}
          onSelect={handleSongSelect}
          onBack={handleBackToTitle}
          onOpenSettings={() => setSettingsOpen(true)}
          settings={settings}
          onChangeSettings={setSettings}
        />
      )}

      {screen === SCREENS.DIFFICULTY_SELECT && (
        <DifficultySelect
          inputHandler={settingsOpen ? null : inputHandler}
          song={selectedSong}
          onSelect={handleDifficultySelect}
          onBack={() => setScreen(SCREENS.SONG_SELECT)}
        />
      )}

      {screen === SCREENS.GAME && selectedSong && selectedDifficulty && (
        <GameScreen
          inputHandler={settingsOpen ? null : inputHandler}
          song={selectedSong}
          difficulty={selectedDifficulty}
          settings={settings}
          bgState={bgStateRef}
          onFinish={handleGameFinish}
          onQuit={handleGameQuit}
          retryToken={retryToken}
          introEnabled={transition.phase === 'none'}
        />
      )}

      {screen === SCREENS.RESULT && gameResult && (
        <ResultScreen
          inputHandler={settingsOpen ? null : inputHandler}
          song={selectedSong}
          difficulty={selectedDifficulty}
          result={gameResult}
          onRetry={handleRetry}
          onSelect={handleBackToSelect}
          onTitle={handleBackToTitle}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          inputHandler={inputHandler}
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <WhiteFadeOverlay
        phase={transition.phase}
        startedAt={transition.startedAt}
        fadeOutMs={FADE_OUT_MS}
        fadeInMs={FADE_IN_MS}
      />
    </div>
  );
}
