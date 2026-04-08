import { useEffect, useState } from 'react';
import { SETTINGS_RANGE } from '../../utils/constants.js';
import InputCalibrationModal from './InputCalibrationModal.jsx';
import AudioCalibrationModal from './AudioCalibrationModal.jsx';

export default function SettingsPanel({ settings, onChange, onClose, inputHandler }) {
  const [calibration, setCalibration] = useState(null); // null | 'input' | 'audio'
  useEffect(() => {
    if (!inputHandler) return;
    // Don't claim Escape while a calibration modal is open — the modal owns it.
    if (calibration) return;
    inputHandler.setShortcut('Escape', () => onClose());
    return () => {
      // Caller is responsible for re-installing its Escape handler.
      inputHandler.clearShortcut('Escape');
    };
  }, [inputHandler, onClose, calibration]);

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
          onCalibrate={() => setCalibration('input')}
        />
        <SliderRow
          label="AUDIO OFFSET"
          value={settings.audioOffset || 0}
          min={SETTINGS_RANGE.audioOffset.min}
          max={SETTINGS_RANGE.audioOffset.max}
          step={SETTINGS_RANGE.audioOffset.step}
          display={`${(settings.audioOffset || 0) > 0 ? '+' : ''}${settings.audioOffset || 0} ms`}
          onChange={(v) => update('audioOffset', v)}
          onCalibrate={() => setCalibration('audio')}
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

        <ToggleRow
          label="GAME SE"
          value={settings.gameSeEnabled !== false}
          onColor="#00e5ff"
          onChange={(v) => update('gameSeEnabled', v)}
        />

        <ToggleRow
          label="AUTO PLAY"
          value={settings.autoPlay}
          onColor="#ffe600"
          onChange={(v) => update('autoPlay', v)}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="neon-button" style={{ color: '#ff2d95' }} onClick={onClose}>
            CLOSE
          </button>
        </div>
      </div>

      {calibration === 'input' && (
        <InputCalibrationModal
          inputHandler={inputHandler}
          onApply={(ms) => update('judgeOffset', ms)}
          onClose={() => setCalibration(null)}
        />
      )}
      {calibration === 'audio' && (
        <AudioCalibrationModal
          inputHandler={inputHandler}
          initialOffset={settings.audioOffset || 0}
          onApply={(ms) => update('audioOffset', ms)}
          onClose={() => setCalibration(null)}
        />
      )}
    </div>
  );
}

function ToggleRow({ label, value, onColor, onChange }) {
  return (
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
        {label}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          padding: '6px 18px',
          borderRadius: 4,
          border: `2px solid ${value ? onColor : '#ffffff40'}`,
          color: value ? onColor : '#ffffff80',
          background: value ? `${onColor}20` : 'transparent',
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 700,
          letterSpacing: '0.1em',
          boxShadow: value ? `0 0 12px ${onColor}80` : 'none',
        }}
      >
        {value ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, display, onChange, onCalibrate }) {
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
          alignItems: 'center',
        }}
      >
        <span>{label}</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#00e5ff' }}>{display}</span>
          {onCalibrate && (
            <button
              onClick={onCalibrate}
              style={{
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                padding: '2px 8px',
                borderRadius: 3,
                border: '1px solid #00e5ff80',
                background: '#00e5ff15',
                color: '#00e5ff',
                cursor: 'pointer',
              }}
            >
              CALIBRATE
            </button>
          )}
        </span>
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
