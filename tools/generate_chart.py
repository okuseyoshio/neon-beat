#!/usr/bin/env python3
"""generate_chart.py - Analyze a single WAV file and generate chart.json.

Usage:
    python tools/generate_chart.py path/to/song.wav [--output-dir public/songs]
"""
from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import sys
from typing import List, Tuple

import numpy as np

try:
    import librosa
except ImportError:
    sys.stderr.write(
        "ERROR: librosa is not installed.\n"
        "Run: pip install -r tools/requirements.txt\n"
    )
    sys.exit(1)


LANES = 4
HOP_LENGTH = 512


# ========================================================================
# Lane assignment
# ========================================================================
def assign_lane_by_spectrum(
    S: np.ndarray, freqs: np.ndarray, sr: int, t: float, hop_length: int = HOP_LENGTH
) -> int:
    """Pick a lane (0..3) based on which frequency band has the most energy at time t.

    Bands are chosen on a perceptual log scale and energy is averaged per FFT
    bin (not summed) so that wide high-frequency bands don't automatically win.
    The high lane (3) is also slightly de-weighted to compensate for the bright
    mastering common in modern music.
    """
    frame = int(librosa.time_to_frames(t, sr=sr, hop_length=hop_length))
    if frame < 0 or frame >= S.shape[1]:
        return random.randint(0, LANES - 1)
    spectrum = S[:, frame]
    # Log-spaced band edges. Cap the top at 6 kHz so cymbal/hi-hat hash
    # doesn't dominate every onset.
    bands = [(20, 200), (200, 800), (800, 2500), (2500, 6000)]
    energies = []
    for lo, hi in bands:
        mask = (freqs >= lo) & (freqs < hi)
        count = int(np.sum(mask))
        if count == 0:
            energies.append(0.0)
            continue
        # Average per bin so each band is on equal footing regardless of width
        energies.append(float(np.sum(spectrum[mask])) / count)
    # De-weight the highest lane slightly so bright masters don't always win it
    energies[3] *= 0.80
    # Slight boost to the bass lane so kicks reliably get pinged to lane 0
    energies[0] *= 1.10
    return int(np.argmax(energies))


# ========================================================================
# Note generators per difficulty
# ========================================================================
def _make_note(t: float, lane: int) -> dict:
    return {"time": round(float(t), 4), "lane": int(lane), "type": "normal"}


def generate_easy(beat_times: np.ndarray) -> List[dict]:
    """EASY: every other beat, alternating lanes 0 and 3."""
    notes: List[dict] = []
    for i, t in enumerate(beat_times[::2]):
        lane = 0 if i % 2 == 0 else 3
        notes.append(_make_note(t, lane))
    return notes


def generate_normal(beat_times: np.ndarray) -> List[dict]:
    """NORMAL: every beat, all 4 lanes, avoid repeating the previous lane."""
    notes: List[dict] = []
    last_lane = -1
    for t in beat_times:
        choices = [l for l in range(LANES) if l != last_lane]
        lane = random.choice(choices)
        notes.append(_make_note(t, lane))
        last_lane = lane
    return notes


def _merge_unique_sorted(*arrays: np.ndarray, min_gap: float) -> List[float]:
    merged = sorted({round(float(x), 5) for arr in arrays for x in arr})
    out: List[float] = []
    for t in merged:
        if not out or t - out[-1] >= min_gap:
            out.append(t)
    return out


def generate_hard(
    beat_times: np.ndarray,
    onset_times: np.ndarray,
    S: np.ndarray,
    freqs: np.ndarray,
    sr: int,
) -> List[dict]:
    """HARD: beats + onsets, min gap 100ms, spectrum-based lanes, occasional doubles on beats."""
    times = _merge_unique_sorted(beat_times, onset_times, min_gap=0.1)
    beat_set = {round(float(b), 3) for b in beat_times}
    notes: List[dict] = []
    for t in times:
        lane = assign_lane_by_spectrum(S, freqs, sr, t)
        notes.append(_make_note(t, lane))
        # Strong beat → add a second note in a different lane
        if round(t, 3) in beat_set and random.random() < 0.18:
            other_lane = (lane + random.choice([1, 2, 3])) % LANES
            notes.append(_make_note(t, other_lane))
    notes.sort(key=lambda n: (n["time"], n["lane"]))
    return notes


def generate_expert(
    beat_times: np.ndarray,
    onset_times: np.ndarray,
    S: np.ndarray,
    freqs: np.ndarray,
    sr: int,
    bpm: float,
) -> List[dict]:
    """EXPERT: onsets + 16th-note subdivisions, min gap 60ms, lots of doubles."""
    # 16th note interval
    if bpm <= 0:
        bpm = 120.0
    sixteenth = 60.0 / bpm / 4.0
    sixteenth_grid: List[float] = []
    if len(beat_times) >= 2:
        start = float(beat_times[0])
        end = float(beat_times[-1])
        t = start
        while t <= end:
            sixteenth_grid.append(t)
            t += sixteenth

    times = _merge_unique_sorted(onset_times, beat_times, np.array(sixteenth_grid), min_gap=0.06)
    notes: List[dict] = []
    for t in times:
        lane = assign_lane_by_spectrum(S, freqs, sr, t)
        notes.append(_make_note(t, lane))
        if random.random() < 0.28:
            other = (lane + random.choice([1, 2, 3])) % LANES
            notes.append(_make_note(t, other))
    notes.sort(key=lambda n: (n["time"], n["lane"]))
    return notes


# ========================================================================
# Main
# ========================================================================
def _scalar_tempo(tempo) -> float:
    """librosa 0.10+ returns tempo as a 1D ndarray; coerce to a single float."""
    if isinstance(tempo, np.ndarray):
        if tempo.size == 0:
            return 120.0
        return float(tempo.flat[0])
    try:
        return float(tempo)
    except (TypeError, ValueError):
        return 120.0


def generate_chart(audio_path: str, output_dir: str) -> str:
    filename = os.path.splitext(os.path.basename(audio_path))[0]
    song_id = filename.replace(" ", "_")
    song_title = song_id.replace("_", " ")

    print(f"[generate_chart] analyzing: {audio_path}")
    y, sr = librosa.load(audio_path, sr=None, mono=True)
    duration = float(librosa.get_duration(y=y, sr=sr))
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=HOP_LENGTH)
    bpm = _scalar_tempo(tempo)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=HOP_LENGTH)
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=HOP_LENGTH)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=HOP_LENGTH)

    S = np.abs(librosa.stft(y, hop_length=HOP_LENGTH))
    freqs = librosa.fft_frequencies(sr=sr)

    random.seed(hash(song_id) & 0xFFFFFFFF)
    easy_notes = generate_easy(beat_times)
    normal_notes = generate_normal(beat_times)
    hard_notes = generate_hard(beat_times, onset_times, S, freqs, sr)
    expert_notes = generate_expert(beat_times, onset_times, S, freqs, sr, bpm)

    song_dir = os.path.join(output_dir, song_id)
    os.makedirs(song_dir, exist_ok=True)
    audio_dst = os.path.join(song_dir, "audio.wav")
    if os.path.abspath(audio_path) != os.path.abspath(audio_dst):
        shutil.copy2(audio_path, audio_dst)

    chart = {
        "meta": {
            "title": song_title,
            "artist": "Unknown",
            "bpm": round(bpm, 2),
            "duration": round(duration, 3),
            "audioFile": "audio.wav",
        },
        "difficulties": {
            "easy": {"level": 3, "noteCount": len(easy_notes), "notes": easy_notes},
            "normal": {"level": 5, "noteCount": len(normal_notes), "notes": normal_notes},
            "hard": {"level": 8, "noteCount": len(hard_notes), "notes": hard_notes},
            "expert": {"level": 10, "noteCount": len(expert_notes), "notes": expert_notes},
        },
    }

    chart_path = os.path.join(song_dir, "chart.json")
    with open(chart_path, "w", encoding="utf-8") as f:
        json.dump(chart, f, indent=2, ensure_ascii=False)

    print(
        f"[generate_chart] OK: {song_id}  "
        f"BPM={bpm:.1f}  duration={duration:.1f}s  "
        f"E={len(easy_notes)}/N={len(normal_notes)}/H={len(hard_notes)}/X={len(expert_notes)}"
    )
    return song_id


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate chart.json from a single WAV file.")
    parser.add_argument("audio", help="Path to .wav file")
    parser.add_argument(
        "--output-dir",
        default=os.path.join("public", "songs"),
        help="Output songs directory (default: public/songs)",
    )
    args = parser.parse_args()
    if not os.path.isfile(args.audio):
        sys.stderr.write(f"ERROR: file not found: {args.audio}\n")
        sys.exit(1)
    generate_chart(args.audio, args.output_dir)


if __name__ == "__main__":
    main()
