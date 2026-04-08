import { useEffect, useMemo } from 'react';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '../../utils/constants.js';
import { accuracyPercent, getSongScores } from '../../utils/helpers.js';
import FixedWidthNumber from '../hud/FixedWidthNumber.jsx';

export default function ResultScreen({
  song,
  difficulty,
  result,
  onRetry,
  onSelect,
  onTitle,
  inputHandler,
}) {
  useEffect(() => {
    if (!inputHandler) return;
    inputHandler.setShortcut('KeyR', () => onRetry());
    inputHandler.setShortcut('KeyS', () => onSelect());
    inputHandler.setShortcut('KeyT', () => onTitle());
    return () => {
      inputHandler.clearShortcut('KeyR');
      inputHandler.clearShortcut('KeyS');
      inputHandler.clearShortcut('KeyT');
    };
  }, [inputHandler, onRetry, onSelect, onTitle]);

  const acc = accuracyPercent(
    result.perfects,
    result.greats,
    result.goods,
    result.totalNotes
  );

  // Load all scores for this song, then identify the entry that corresponds
  // to the play that just finished. We match by score+autoPlay+latest timestamp.
  const { topScores, currentRank, isNewHigh } = useMemo(() => {
    if (!song?.id || result.autoPlay) {
      return { topScores: getSongScores(song?.id), currentRank: -1, isNewHigh: false };
    }
    const all = getSongScores(song.id);
    // Most-recent matching entry = the one we just inserted
    let matchIdx = -1;
    let newest = -Infinity;
    for (let i = 0; i < all.length; i++) {
      const e = all[i];
      if (e.score === result.score && !e.autoPlay && (e.timestamp || 0) > newest) {
        newest = e.timestamp || 0;
        matchIdx = i;
      }
    }
    return {
      topScores: all,
      currentRank: matchIdx,
      isNewHigh: matchIdx === 0 && all.length > 0,
    };
  }, [song?.id, result.score, result.autoPlay]);

  return (
    <div className="screen" style={{ pointerEvents: 'auto' }}>
      <div
        className="font-display"
        style={{ fontSize: 18, color: '#ffffffa0', letterSpacing: '0.1em' }}
      >
        {song?.title} · {DIFFICULTY_LABELS[difficulty]}
        {result.autoPlay && (
          <span
            style={{
              marginLeft: 12,
              padding: '2px 8px',
              borderRadius: 3,
              border: '1px solid #ffe600',
              color: '#ffe600',
              fontSize: 11,
            }}
          >
            AUTO PLAY
          </span>
        )}
      </div>

      <div
        className="font-display"
        style={{
          fontSize: 'clamp(64px, 12vw, 144px)',
          fontWeight: 900,
          color: '#fff',
          textShadow: '0 0 24px #00e5ff, 0 0 48px #ff2d95',
          margin: '12px 0 6px',
        }}
      >
        {/* Wider digit slots for the giant Orbitron 900 result score */}
        <FixedWidthNumber
          value={result.score}
          digitWidth="0.92em"
          commaWidth="0.36em"
        />
      </div>

      <div
        className="font-display"
        style={{ fontSize: 18, color: '#ffe600', textShadow: '0 0 10px #ffe600' }}
      >
        MAX COMBO {result.maxCombo}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 24,
          marginTop: 28,
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 16,
        }}
      >
        <Stat label="PERFECT" value={result.perfects} color="#ffe600" />
        <Stat label="GREAT" value={result.greats} color="#00e5ff" />
        <Stat label="GOOD" value={result.goods} color="#b388ff" />
        <Stat label="MISS" value={result.misses} color="#ff2d95" />
      </div>

      <div
        className="font-display"
        style={{
          marginTop: 20,
          fontSize: 22,
          color: '#fff',
          letterSpacing: '0.1em',
          textShadow: '0 0 12px #00e5ff',
        }}
      >
        ACCURACY {acc.toFixed(2)}%
      </div>

      {/* High score ranking for this song */}
      {topScores.length > 0 && (
        <ScoreRanking
          scores={topScores}
          currentRank={currentRank}
          isNewHigh={isNewHigh}
        />
      )}

      <div style={{ display: 'flex', gap: 18, marginTop: 24 }}>
        <ResultButton color="#00e5ff" label="RETRY" hint="R" onClick={onRetry} />
        <ResultButton color="#b388ff" label="SELECT" hint="S" onClick={onSelect} />
        <ResultButton color="#ff2d95" label="TITLE" hint="T" onClick={onTitle} />
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 96 }}>
      <div style={{ color, fontSize: 12, letterSpacing: '0.1em' }}>{label}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color,
          textShadow: `0 0 10px ${color}`,
        }}
      >
        {/* Slightly wider slots so 4-digit counts (e.g. 3,354 PERFECT) breathe */}
        <FixedWidthNumber value={value} digitWidth="0.84em" commaWidth="0.34em" />
      </div>
    </div>
  );
}

function ScoreRanking({ scores, currentRank, isNewHigh }) {
  // Show top 5 by default, but always include the current rank if it's beyond
  const visible = [];
  const showCount = 5;
  for (let i = 0; i < Math.min(scores.length, showCount); i++) visible.push(i);
  if (currentRank >= 0 && currentRank >= showCount) {
    visible.push(currentRank);
  }

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  };

  return (
    <div
      style={{
        marginTop: 18,
        width: 'min(560px, 92vw)',
        background: 'rgba(10, 10, 24, 0.65)',
        border: '1px solid #00e5ff40',
        borderRadius: 6,
        padding: '12px 16px',
        boxShadow: '0 0 18px #00e5ff20',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 12,
            color: '#00e5ff',
            letterSpacing: '0.18em',
          }}
        >
          HIGH SCORES
        </div>
        {isNewHigh && (
          <div
            className="font-display"
            style={{
              fontSize: 11,
              color: '#ffe600',
              letterSpacing: '0.15em',
              padding: '2px 8px',
              border: '1px solid #ffe600',
              borderRadius: 3,
              background: '#ffe60018',
              boxShadow: '0 0 8px #ffe60080',
            }}
          >
            NEW HIGH!
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {visible.map((rankIdx) => {
          const entry = scores[rankIdx];
          const isCurrent = rankIdx === currentRank;
          const diffColor = entry.difficulty
            ? DIFFICULTY_COLORS[entry.difficulty]
            : '#ffffff60';
          return (
            <div
              key={rankIdx}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 64px 60px 110px',
                gap: 8,
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 3,
                fontSize: 12,
                fontFamily: 'Orbitron, sans-serif',
                background: isCurrent ? '#00e5ff20' : 'transparent',
                border: isCurrent ? '1px solid #00e5ff' : '1px solid transparent',
                color: isCurrent ? '#fff' : '#ffffffa0',
                boxShadow: isCurrent ? '0 0 10px #00e5ff60' : 'none',
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: rankIdx === 0 ? '#ffe600' : isCurrent ? '#fff' : '#ffffff80',
                }}
              >
                #{rankIdx + 1}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: isCurrent ? '#fff' : '#ffffffe0',
                  textAlign: 'right',
                }}
              >
                {entry.score.toLocaleString()}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: diffColor,
                  textAlign: 'center',
                  letterSpacing: '0.1em',
                }}
              >
                {entry.difficulty
                  ? DIFFICULTY_LABELS[entry.difficulty]
                  : '—'}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: '#ffffff80',
                  textAlign: 'right',
                }}
              >
                {entry.accuracy != null
                  ? `${entry.accuracy.toFixed(1)}%`
                  : '—'}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: '#ffffff60',
                  textAlign: 'right',
                }}
              >
                {formatDate(entry.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultButton({ color, label, hint, onClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button className="neon-button" style={{ color }} onClick={onClick}>
        {label}
      </button>
      <div style={{ fontSize: 11, color: '#ffffff60', letterSpacing: '0.1em' }}>[{hint}]</div>
    </div>
  );
}
