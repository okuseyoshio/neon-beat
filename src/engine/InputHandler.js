import { LANE_KEY_CODES } from '../utils/constants.js';

/**
 * InputHandler - global keyboard input dispatcher.
 *
 * Usage:
 *   const handler = createInputHandler();
 *   handler.attach();
 *   handler.setLaneCallback((lane) => ...);
 *   handler.setShortcut('Space', () => ...);
 *
 * Lane touch input is handled directly inside GameScreen for layout reasons.
 */
export function createInputHandler() {
  let laneCb = null;
  let shortcuts = new Map();
  let attached = false;

  const onKeyDown = (e) => {
    if (e.repeat) return;

    // Lane keys
    const laneIdx = LANE_KEY_CODES.indexOf(e.code);
    if (laneIdx >= 0) {
      if (laneCb) {
        laneCb(laneIdx);
        e.preventDefault();
      }
      return;
    }

    // Shortcut keys (by event.code)
    const cb = shortcuts.get(e.code);
    if (cb) {
      cb(e);
      // Prevent space from scrolling
      if (e.code === 'Space') e.preventDefault();
    }
  };

  return {
    attach() {
      if (attached) return;
      window.addEventListener('keydown', onKeyDown);
      attached = true;
    },
    detach() {
      if (!attached) return;
      window.removeEventListener('keydown', onKeyDown);
      attached = false;
    },
    setLaneCallback(cb) {
      laneCb = cb;
    },
    clearLaneCallback() {
      laneCb = null;
    },
    setShortcut(code, cb) {
      shortcuts.set(code, cb);
    },
    clearShortcut(code) {
      shortcuts.delete(code);
    },
    clearAllShortcuts() {
      shortcuts.clear();
    },
  };
}
