import { useEffect, useMemo, useRef, useState } from 'react';
import { SCREENS, SPECTRUM_BANDS } from './utils/constants.js';
import { loadSettings, saveSettings } from './utils/helpers.js';
import { createInputHandler } from './engine/InputHandler.js';
import { getSoundEffects } from './engine/SoundEffects.js';
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

  const handleStart = () => setScreen(SCREENS.SONG_SELECT);
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
