import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { loadSongList } from '../../engine/ChartLoader.js';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  SONG_SORT_MODES,
  SONG_SORT_LABELS,
} from '../../utils/constants.js';
import { formatTime, loadSongStats } from '../../utils/helpers.js';

// Highest available difficulty per song, in priority order
const DIFFICULTY_ORDER = ['expert', 'hard', 'normal', 'easy'];

function pickTopChart(song) {
  if (!song?.difficulties) return null;
  for (const d of DIFFICULTY_ORDER) {
    const chart = song.difficulties[d];
    if (chart && chart.noteCount > 0) return { diff: d, chart };
  }
  return null;
}

function rawDifficultyScore(song) {
  const top = pickTopChart(song);
  if (!top) return null;
  const noteCount = top.chart.noteCount || 0;
  const duration = song.duration || 0;
  const bpm = song.bpm || 120;
  if (duration <= 0) return null;
  const density = noteCount / duration; // notes per second
  const bpmFactor = bpm / 120;
  return density * (0.6 + 0.4 * bpmFactor);
}

/**
 * Build a Map<songId, 'C'|'B'|'A'|'S'> for the entire library.
 * Grades are assigned by quartile across the songs' top-difficulty raw scores
 * so the four grades are always populated even when raw NPS varies wildly.
 * If there are fewer than 4 songs, we fall back to fixed NPS thresholds.
 */
function computeDifficultyGrades(songs) {
  const map = new Map();
  if (!Array.isArray(songs) || songs.length === 0) return map;

  const scored = songs
    .map((s) => ({ id: s.id, score: rawDifficultyScore(s) }))
    .filter((e) => e.score != null);

  if (scored.length === 0) return map;

  if (scored.length < 4) {
    // Not enough songs for meaningful percentiles — use absolute thresholds.
    for (const e of scored) {
      let g;
      if (e.score >= 5.0) g = 'S';
      else if (e.score >= 3.5) g = 'A';
      else if (e.score >= 2.0) g = 'B';
      else g = 'C';
      map.set(e.id, g);
    }
    return map;
  }

  // Quartile-based grading across the library
  const sorted = [...scored].sort((a, b) => a.score - b.score);
  const q1 = sorted[Math.floor(sorted.length * 0.25)].score;
  const q2 = sorted[Math.floor(sorted.length * 0.5)].score;
  const q3 = sorted[Math.floor(sorted.length * 0.75)].score;
  for (const e of scored) {
    let g;
    if (e.score >= q3) g = 'S';
    else if (e.score >= q2) g = 'A';
    else if (e.score >= q1) g = 'B';
    else g = 'C';
    map.set(e.id, g);
  }
  return map;
}

const GRADE_COLORS = {
  S: '#ff2d95',
  A: '#ffe600',
  B: '#00e5ff',
  C: '#5cffa6',
};

/**
 * Renders a song title that stays on one line. If the title is wider than its
 * container, it gets a hover-scroll marquee animation. Short titles render
 * normally with no animation.
 */
function ScrollingTitle({ title }) {
  const wrapperRef = useRef(null);
  const innerRef = useRef(null);
  const [overflow, setOverflow] = useState(0); // px the title is wider than the wrapper

  useLayoutEffect(() => {
    const measure = () => {
      const w = wrapperRef.current;
      const inner = innerRef.current;
      if (!w || !inner) return;
      const diff = inner.scrollWidth - w.clientWidth;
      setOverflow(diff > 4 ? diff : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [title]);

  // Speed: ~60 px/sec, with a small min duration so very short overflows still feel deliberate.
  const duration = overflow > 0 ? Math.max(2.5, overflow / 60) : 0;

  return (
    <div
      ref={wrapperRef}
      className={overflow > 0 ? 'song-title-marquee' : ''}
      style={{
        position: 'relative',
        flex: '1 1 auto',
        minWidth: 0,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        ref={innerRef}
        style={
          overflow > 0
            ? {
                display: 'inline-block',
                whiteSpace: 'nowrap',
                paddingRight: 32,
                '--marquee-shift': `-${overflow + 32}px`,
                '--marquee-duration': `${duration}s`,
              }
            : {
                display: 'inline-block',
                whiteSpace: 'nowrap',
              }
        }
      >
        {title}
      </span>
    </div>
  );
}

function sortSongs(songs, mode, stats) {
  // Tag with original index so we can recover "added order" regardless of mode.
  const arr = songs.map((s, idx) => ({ song: s, idx }));
  switch (mode) {
    case 'addedDesc':
      arr.sort((a, b) => b.idx - a.idx);
      break;
    case 'addedAsc':
      // already in this order
      break;
    case 'recent':
      arr.sort(
        (a, b) =>
          (stats[b.song.id]?.lastPlayed ?? 0) -
          (stats[a.song.id]?.lastPlayed ?? 0)
      );
      break;
    case 'playCount':
      arr.sort(
        (a, b) =>
          (stats[b.song.id]?.playCount ?? 0) -
          (stats[a.song.id]?.playCount ?? 0)
      );
      break;
    case 'title':
      arr.sort((a, b) => (a.song.title || '').localeCompare(b.song.title || ''));
      break;
    default:
      break;
  }
  return arr.map((entry) => entry.song);
}

export default function SongSelect({
  onSelect,
  onBack,
  onOpenSettings,
  inputHandler,
  settings,
  onChangeSettings,
}) {
  const [songs, setSongs] = useState(null);
  const [cursor, setCursor] = useState(0);
  // Load play stats once when entering this screen so the most recent play
  // counts/timestamps are reflected. We don't update them live here.
  const [stats] = useState(() => loadSongStats());

  const sortMode = settings?.songSortMode || 'addedDesc';

  useEffect(() => {
    let active = true;
    loadSongList().then((data) => {
      if (active) setSongs(data.songs || []);
    });
    return () => {
      active = false;
    };
  }, []);

  const sortedSongs = useMemo(
    () => (songs ? sortSongs(songs, sortMode, stats) : null),
    [songs, sortMode, stats]
  );

  // Difficulty grades (C/B/A/S) computed once per song-list load.
  // Uses each song's top-difficulty chart and grades by library-wide quartile.
  const gradeMap = useMemo(() => computeDifficultyGrades(songs || []), [songs]);

  // Clamp cursor when sort mode changes (or song list loads)
  useEffect(() => {
    if (!sortedSongs) return;
    setCursor((c) => Math.min(Math.max(0, c), Math.max(0, sortedSongs.length - 1)));
  }, [sortedSongs]);

  const setSortMode = (mode) => {
    if (!onChangeSettings || !settings) return;
    onChangeSettings({ ...settings, songSortMode: mode });
    setCursor(0);
  };

  useEffect(() => {
    if (!inputHandler) return;
    inputHandler.setShortcut('ArrowUp', () =>
      setCursor((c) => Math.max(0, c - 1))
    );
    inputHandler.setShortcut('ArrowDown', () =>
      setCursor((c) =>
        sortedSongs ? Math.min(sortedSongs.length - 1, c + 1) : 0
      )
    );
    inputHandler.setShortcut('Enter', () => {
      if (sortedSongs && sortedSongs[cursor]) onSelect(sortedSongs[cursor]);
    });
    inputHandler.setShortcut('Escape', () => onBack());
    // Tab cycles sort modes (Shift+Tab cycles backward)
    inputHandler.setShortcut('Tab', (e) => {
      if (!settings || !onChangeSettings) return;
      e.preventDefault();
      const cur = SONG_SORT_MODES.indexOf(sortMode);
      const dir = e.shiftKey ? -1 : 1;
      const next =
        SONG_SORT_MODES[(cur + dir + SONG_SORT_MODES.length) % SONG_SORT_MODES.length];
      setSortMode(next);
    });
    return () => {
      inputHandler.clearShortcut('ArrowUp');
      inputHandler.clearShortcut('ArrowDown');
      inputHandler.clearShortcut('Enter');
      inputHandler.clearShortcut('Escape');
      inputHandler.clearShortcut('Tab');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputHandler, sortedSongs, cursor, onSelect, onBack, sortMode, settings]);

  const formatLastPlayed = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd}`;
  };

  return (
    <div
      className="screen"
      style={{
        pointerEvents: 'auto',
        justifyContent: 'flex-start',
        paddingTop: 60,
      }}
    >
      <div
        className="font-display"
        style={{
          fontSize: 36,
          color: '#fff',
          textShadow: '0 0 16px #00e5ff',
          marginBottom: 16,
          letterSpacing: '0.1em',
        }}
      >
        SELECT SONG
      </div>

      {/* Sort mode chips */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: '#ffffff80',
            letterSpacing: '0.15em',
            fontFamily: 'Orbitron, sans-serif',
            marginRight: 4,
          }}
        >
          SORT
        </span>
        {SONG_SORT_MODES.map((mode) => {
          const active = mode === sortMode;
          return (
            <button
              key={mode}
              onClick={() => setSortMode(mode)}
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                padding: '4px 10px',
                borderRadius: 3,
                border: `1px solid ${active ? '#00e5ff' : '#ffffff30'}`,
                background: active ? '#00e5ff20' : 'transparent',
                color: active ? '#00e5ff' : '#ffffffa0',
                boxShadow: active ? '0 0 10px #00e5ff60' : 'none',
                cursor: 'pointer',
              }}
            >
              {SONG_SORT_LABELS[mode]}
            </button>
          );
        })}
      </div>

      {sortedSongs === null && (
        <div style={{ color: '#ffffff80' }}>Loading…</div>
      )}

      {sortedSongs && sortedSongs.length === 0 && (
        <div
          className="neon-card"
          style={{ maxWidth: 560, textAlign: 'center', lineHeight: 1.6 }}
        >
          <div style={{ color: '#ffe600', fontWeight: 700, marginBottom: 8 }}>
            曲がありません
          </div>
          <div style={{ color: '#ffffffb0', fontSize: 14 }}>
            <code>import/</code> フォルダにWAVファイルを置いて、
            <br />
            <code>python tools/batch_import.py</code> を実行してください。
          </div>
        </div>
      )}

      {sortedSongs && sortedSongs.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            width: 'min(640px, 92vw)',
            maxHeight: '60vh',
            overflowY: 'auto',
            padding: '8px 4px',
          }}
        >
          {sortedSongs.map((song, i) => {
            const songStat = stats[song.id];
            const lastPlayed = formatLastPlayed(songStat?.lastPlayed);
            const playCount = songStat?.playCount || 0;
            const topScore =
              Array.isArray(songStat?.scores) && songStat.scores.length > 0
                ? songStat.scores[0].score
                : null;
            return (
              <div
                key={song.id}
                className={`neon-card${i === cursor ? ' selected' : ''}`}
                onClick={() => {
                  setCursor(i);
                  onSelect(song);
                }}
                style={{ cursor: 'pointer' }}
              >
                <div
                  className="font-display song-title-row"
                  style={{
                    fontSize: 20,
                    color: '#fff',
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <ScrollingTitle title={song.title} />
                  {gradeMap.get(song.id) && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 10px 3px 8px',
                        borderRadius: 4,
                        border: `1px solid ${GRADE_COLORS[gradeMap.get(song.id)]}80`,
                        background: `${GRADE_COLORS[gradeMap.get(song.id)]}12`,
                        boxShadow: `0 0 10px ${GRADE_COLORS[gradeMap.get(song.id)]}40`,
                      }}
                      title="Library difficulty grade (top chart)"
                    >
                      <span
                        style={{
                          fontSize: 9,
                          color: '#ffffffb0',
                          letterSpacing: '0.18em',
                          fontFamily: 'Orbitron, sans-serif',
                          fontWeight: 700,
                        }}
                      >
                        DIFFICULTY
                      </span>
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 900,
                          fontFamily: 'Orbitron, sans-serif',
                          color: GRADE_COLORS[gradeMap.get(song.id)],
                          textShadow: `0 0 8px ${GRADE_COLORS[gradeMap.get(song.id)]}`,
                          lineHeight: 1,
                        }}
                      >
                        {gradeMap.get(song.id)}
                      </span>
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#ffffffa0', marginBottom: 6 }}>
                  {song.artist || 'Unknown'} · BPM {Math.round(song.bpm)} ·{' '}
                  {formatTime(song.duration)}
                  {playCount > 0 && (
                    <span style={{ color: '#00e5ff90', marginLeft: 8 }}>
                      · played {playCount}× {lastPlayed ? `(${lastPlayed})` : ''}
                    </span>
                  )}
                  {topScore != null && (
                    <span
                      style={{
                        color: '#ffe600',
                        marginLeft: 8,
                        fontFamily: 'Orbitron, sans-serif',
                        fontWeight: 700,
                      }}
                    >
                      · ★ {topScore.toLocaleString()}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DIFFICULTIES.map((d) => {
                    const diff = song.difficulties && song.difficulties[d];
                    return (
                      <span
                        key={d}
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 3,
                          border: '1px solid #ffffff30',
                          color: diff ? '#fff' : '#ffffff40',
                          background: diff ? '#ffffff10' : 'transparent',
                        }}
                      >
                        {DIFFICULTY_LABELS[d]}
                        {diff ? ` ${diff.level}・${diff.noteCount}` : ' —'}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
        <button className="neon-button" style={{ color: '#ff2d95' }} onClick={onBack}>
          BACK
        </button>
        <button
          className="neon-button"
          style={{ color: '#b388ff' }}
          onClick={onOpenSettings}
        >
          SETTINGS
        </button>
      </div>
    </div>
  );
}
