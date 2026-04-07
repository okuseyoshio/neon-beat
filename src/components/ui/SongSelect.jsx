import { useEffect, useState } from 'react';
import { loadSongList } from '../../engine/ChartLoader.js';
import { DIFFICULTIES, DIFFICULTY_LABELS } from '../../utils/constants.js';
import { formatTime } from '../../utils/helpers.js';

export default function SongSelect({
  onSelect,
  onBack,
  onOpenSettings,
  inputHandler,
}) {
  const [songs, setSongs] = useState(null);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    let active = true;
    loadSongList().then((data) => {
      if (active) setSongs(data.songs || []);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!inputHandler) return;
    inputHandler.setShortcut('ArrowUp', () =>
      setCursor((c) => Math.max(0, c - 1))
    );
    inputHandler.setShortcut('ArrowDown', () =>
      setCursor((c) => (songs ? Math.min(songs.length - 1, c + 1) : 0))
    );
    inputHandler.setShortcut('Enter', () => {
      if (songs && songs[cursor]) onSelect(songs[cursor]);
    });
    inputHandler.setShortcut('Escape', () => onBack());
    return () => {
      inputHandler.clearShortcut('ArrowUp');
      inputHandler.clearShortcut('ArrowDown');
      inputHandler.clearShortcut('Enter');
      inputHandler.clearShortcut('Escape');
    };
  }, [inputHandler, songs, cursor, onSelect, onBack]);

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
          marginBottom: 24,
          letterSpacing: '0.1em',
        }}
      >
        SELECT SONG
      </div>

      {songs === null && (
        <div style={{ color: '#ffffff80' }}>Loading…</div>
      )}

      {songs && songs.length === 0 && (
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

      {songs && songs.length > 0 && (
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
          {songs.map((song, i) => (
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
                className="font-display"
                style={{ fontSize: 20, color: '#fff', marginBottom: 4 }}
              >
                {song.title}
              </div>
              <div style={{ fontSize: 12, color: '#ffffffa0', marginBottom: 6 }}>
                {song.artist || 'Unknown'} · BPM {Math.round(song.bpm)} ·{' '}
                {formatTime(song.duration)}
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
          ))}
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
