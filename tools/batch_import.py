#!/usr/bin/env python3
"""batch_import.py - Import all WAVs from import/ and rebuild song-list.json.

Usage:
    python tools/batch_import.py
    python tools/batch_import.py --force
    python tools/batch_import.py --import-dir ./other_folder
"""
from __future__ import annotations

import argparse
import json
import os
import sys

# Allow running both as a module and as a top-level script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from generate_chart import generate_chart  # noqa: E402


def find_wavs(import_dir: str):
    if not os.path.isdir(import_dir):
        return []
    out = []
    for name in sorted(os.listdir(import_dir)):
        if name.lower().endswith(".wav"):
            out.append(os.path.join(import_dir, name))
    return out


def update_song_list(songs_dir: str) -> int:
    songs = []
    if os.path.isdir(songs_dir):
        for folder in sorted(os.listdir(songs_dir)):
            folder_path = os.path.join(songs_dir, folder)
            chart_path = os.path.join(folder_path, "chart.json")
            if not os.path.isfile(chart_path):
                continue
            with open(chart_path, encoding="utf-8") as f:
                chart = json.load(f)
            meta = chart.get("meta", {})
            diffs_in = chart.get("difficulties", {})
            diffs_out = {
                k: {"level": v.get("level", 0), "noteCount": v.get("noteCount", 0)}
                for k, v in diffs_in.items()
            }
            songs.append(
                {
                    "id": folder,
                    "title": meta.get("title", folder),
                    "artist": meta.get("artist", "Unknown"),
                    "bpm": meta.get("bpm", 120),
                    "duration": meta.get("duration", 0),
                    "folder": folder,
                    "difficulties": diffs_out,
                }
            )
    out_path = os.path.join(songs_dir, "song-list.json")
    os.makedirs(songs_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"songs": songs}, f, indent=2, ensure_ascii=False)
    return len(songs)


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch-import WAVs and build chart data.")
    parser.add_argument("--import-dir", default="import", help="Folder to scan for .wav files")
    parser.add_argument(
        "--songs-dir",
        default=os.path.join("public", "songs"),
        help="Output folder under which song subfolders are placed",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-analyze even if the song folder already exists",
    )
    args = parser.parse_args()

    wavs = find_wavs(args.import_dir)
    if not wavs:
        print(f"[batch_import] no .wav files in {args.import_dir}/")
    else:
        print(f"[batch_import] found {len(wavs)} file(s) in {args.import_dir}/")

    processed = 0
    skipped = 0
    failed = 0
    for wav in wavs:
        filename = os.path.splitext(os.path.basename(wav))[0]
        song_id = filename.replace(" ", "_")
        target_folder = os.path.join(args.songs_dir, song_id)
        if os.path.isdir(target_folder) and not args.force:
            print(f"[batch_import] skip existing: {song_id}")
            skipped += 1
            continue
        try:
            generate_chart(wav, args.songs_dir)
            processed += 1
        except Exception as e:  # noqa: BLE001
            print(f"[batch_import] FAILED {song_id}: {e}")
            failed += 1

    total = update_song_list(args.songs_dir)
    print(
        f"[batch_import] done. processed={processed} skipped={skipped} "
        f"failed={failed} song-list total={total}"
    )


if __name__ == "__main__":
    main()
