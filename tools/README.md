# NEON BEAT 譜面生成ツール

WAVファイルを解析して4レーン譜面（chart.json）を自動生成します。

## インストール

```bash
pip install -r requirements.txt
```

> 推奨 Python: 3.10〜3.12（librosa 0.11 公式サポート範囲）。
> Python 3.13 は Windows で `samplerate` バックエンドに問題が出ることがあります。

## 使い方

1. WAVファイルを `import/` フォルダに置く
2. `python tools/batch_import.py` を実行
3. `public/songs/<曲名>/audio.wav` と `chart.json` が生成され、`public/songs/song-list.json` が更新される

## オプション

```bash
# 既存曲も再解析（上書き）
python tools/batch_import.py --force

# 別フォルダからインポート
python tools/batch_import.py --import-dir ./my_audio

# 単一ファイルだけ処理
python tools/generate_chart.py path/to/song.wav
```

## ファイル名ルール

- `.wav` のみ対応
- ファイル名がそのまま曲名（`_` はスペースとして表示）
- 例: `My_Cool_Song.wav` → 曲名「My Cool Song」、ID「My_Cool_Song」

## 曲の削除

`public/songs/<曲名>/` を手動削除 → `python tools/batch_import.py` で song-list.json を更新。
