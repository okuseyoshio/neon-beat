import { useEffect } from 'react';
import { SETTINGS_RANGE } from '../../utils/constants.js';

export default function SettingsPanel({ settings, onChange, onClose, inputHandler }) {
  useEffect(() => {
    if (!inputHandler) return;
    // Save the previous Escape handler so we can restore it
    inputHandler.setShortcut('Escape', () => onClose());
    return () => {
      // Caller is responsible for re-installing its Escape handler.
      inputHandler.clearShortcut('Escape');
    };
  }, [inputHandler, onClose]);

  const update = (key, value) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0d0d1a',
          border: '2px solid #00e5ff',
          borderRadius: 10,
          padding: '32px 40px',
          width: 'min(480px, 92vw)',
          boxShadow: '0 0 36px #00e5ff60, inset 0 0 24px #00e5ff20',
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 24,
            color: '#fff',
            textShadow: '0 0 12px #00e5ff',
            marginBottom: 24,
            letterSpacing: '0.15em',
          }}
        >
          SETTINGS
        </div>

        <SliderRow
          label="NOTE SPEED"
          value={settings.noteSpeed}
          min={SETTINGS_RANGE.noteSpeed.min}
          max={SETTINGS_RANGE.noteSpeed.max}
          step={SETTINGS_RANGE.noteSpeed.step}
          display={`${settings.noteSpeed} px/s`}
          onChange={(v) => update('noteSpeed', v)}
        />
        <SliderRow
          label="JUDGE OFFSET"
          value={settings.judgeOffset}
          min={SETTINGS_RANGE.judgeOffset.min}
          max={SETTINGS_RANGE.judgeOffset.max}
          step={SETTINGS_RANGE.judgeOffset.step}
          display={`${settings.judgeOffset > 0 ? '+' : ''}${settings.judgeOffset} ms`}
          onChange={(v) => update('judgeOffset', v)}
        />
        <SliderRow
          label="BGM VOLUME"
          value={settings.bgmVolume}
          min={SETTINGS_RANGE.bgmVolume.min}
          max={SETTINGS_RANGE.bgmVolume.max}
          step={SETTINGS_RANGE.bgmVolume.step}
          display={`${Math.round(settings.bgmVolume * 100)}%`}
          onChange={(v) => update('bgmVolume', v)}
        />
        <SliderRow
          label="SE VOLUME"
          value={settings.seVolume}
          min={SETTINGS_RANGE.seVolume.min}
          max={SETTINGS_RANGE.seVolume.max}
          step={SETTINGS_RANGE.seVolume.step}
          display={`${Math.round(settings.seVolume * 100)}%`}
          onChange={(v) => update('seVolume', v)}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid #ffffff20',
          }}
        >
          <div style={{ color: '#fff', fontWeight: 600, letterSpacing: '0.1em' }}>
            AUTO PLAY
          </div>
          <button
            onClick={() => update('autoPlay', !settings.autoPlay)}
            style={{
              padding: '6px 18px',
              borderRadius: 4,
              border: `2px solid ${settings.autoPlay ? '#ffe600' : '#ffffff40'}`,
              color: settings.autoPlay ? '#ffe600' : '#ffffff80',
              background: settings.autoPlay ? '#ffe60020' : 'transparent',
              fontFamily: 'Orbitron, sans-serif',
              fontWeight: 700,
              letterSpacing: '0.1em',
              boxShadow: settings.autoPlay ? '0 0 12px #ffe60080' : 'none',
            }}
          >
            {settings.autoPlay ? 'ON' : 'OFF'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="neon-button" style={{ color: '#ff2d95' }} onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, display, onChange }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6,
          color: '#fff',
          fontWeight: 600,
          letterSpacing: '0.1em',
          fontSize: 13,
        }}
      >
        <span>{label}</span>
        <span style={{ color: '#00e5ff' }}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: '#00e5ff' }}
      />
    </div>
  );
}
