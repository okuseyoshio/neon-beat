# NEON BEAT

**現在のバージョン: v1.1.0**

ネオン × ディスコ風の音楽リズムゲーム。
自分のWAVファイルをインポートして遊べる4レーン落下型音ゲー。

## クイックスタート

```bash
# 1. 依存をインストール
npm install
pip install -r tools/requirements.txt

# 2. WAVファイルを import/ に置く
cp your_song.wav import/

# 3. 譜面を自動生成
python tools/batch_import.py

# 4. ゲームを起動
npm run dev
# → http://localhost:5173
```

詳しい説明は [MANUAL.md](MANUAL.md) を参照。
友人にゲームを配布したい場合は [SHARE.md](SHARE.md) を参照。

## ワンクリック ランチャー (Windows)

プロジェクト直下に置いてある bat ファイルで、よく使う操作を即実行できます:

| バッチ | 用途 |
|-------|------|
| `PLAY.bat` | ビルド済み `neon-beat.exe` を即起動（最速、開発不要） |
| `DEV.bat` | `npm run tauri:dev`（ホットリロード付き開発モード） |
| `REBUILD.bat` | `npm run tauri:build`（リリース exe + インストーラ再生成） |
| `IMPORT_SONGS.bat` | WAV を **ドラッグ&ドロップ** すると自動で `import/` にコピー → 譜面解析まで実行 |

`IMPORT_SONGS.bat` は WAV ファイルを bat の上にドロップするだけで、ファイルコピー → librosa 解析 → `song-list.json` 更新までワンステップで完了します。ダブルクリックすると import フォルダを開いて手動配置にも対応します。

## 操作（PC）

| キー | 動作 |
|------|------|
| D / F / J / K | レーン1〜4入力 |
| Space | スタート（タイトル） |
| ↑↓ | 曲選択カーソル |
| ←→ | 難易度カーソル / AUDIO SYNC キャリブレーション中の値調整（Shift+矢印で10ms単位） |
| Tab | 曲選択でソートモード切替（Shift+Tabで逆送り） |
| Enter | 決定 |
| Escape | 戻る / ポーズ |
| R | リトライ |
| Q | 曲選択へ戻る |
| S | 曲選択へ（リザルト） |
| T | タイトルへ（リザルト） |
| A | AUTO PLAY 切り替え（ゲーム中もOK） |

## 操作（モバイル）

各レーンの判定ライン付近をタップ。マルチタッチ対応。

## 主な機能

- **5画面ステートマシン**: タイトル / 曲選択 / 難易度選択 / ゲーム / リザルト
- **派手な遷移演出**: 難易度決定後、画面全体が2秒で白フェード → 「ピカーン」SE → ゲーム画面が現れて → 5秒のカウントダウン（GET READY → 3 → 2 → 1, 各digitで「ピッ」SE）→ スクロール・リードイン → プレイ開始
- **リアルタイム音響解析**: AnalyserNode で40バンド対数集約、ブロック型イコライザー背景に反映（バーは画面高さの約半分まで伸びる）
- **コンボ連動ディスコレベル**: 0〜4の5段階でディスコライト・レーザー・グリッドが進化
- **オーディエンス演出（v1.1.0新規）**:
  - コンボ 25/50/100/200/300/500 達成時に**歓声**（5段階で盛り上がり）
  - コンボ 50 以上で**連続歓声アンビエンス**（100/200 でさらにラウドに）
  - 25以上のコンボが途切れると**落胆の「ああ…」**
  - 5連続ミスで**ブーイング**
  - 全てピンクノイズ + 母音フォルマントで合成 — 外部ファイル不要
- **HUDの AUTO バッジ（v1.1.0新規）**: AUTO PLAY 中はゲーム画面右上に黄色のパルスバッジを表示
- **メニューBGM**: タイトル/曲選択/難易度/リザルト画面で `public/bgm/menu.wav` をループ再生（ゲーム遷移時はクロスフェード）
- **自動譜面生成**: librosa のビート/オンセット検出 + 周波数帯別エネルギー解析でレーン割り当て
- **高速描画**: ノーツ可視範囲フィルタ + アクティブ区間カーソルで EXPERT 700ノーツでも安定
- **曲終了演出**: 4.5秒の余韻中にランク評価（ALL PERFECT / AMAZING / EXCELLENT / GREAT / GOOD / ...）が大スラムイン
- **設定の永続化**: ノーツ速度・判定オフセット・音オフセット・音量・AUTO PLAY・GAME SE・曲ソートを localStorage に保存

## v1.1.0 で追加された機能

- **キャリブレーションツール**: 設定画面の `JUDGE OFFSET` / `AUDIO OFFSET` 横の `CALIBRATE` ボタンから起動
  - **INPUT CALIBRATION**: 10本のバーをタップしてズレを計測。外れ値を除いた中央値を推奨値として表示
  - **AUDIO SYNC**: メトロノーム（フラッシュ + クリック音）を見ながらスライダーで音映像のズレを補正。矢印キーで微調整可
- **ハイスコア記録**: 各曲ごとにトップ10を localStorage に保存。リザルト画面で TOP5 + 自分の順位を表示、新記録時は `NEW HIGH!` バッジ
- **曲選択画面の強化**:
  - 5種類のソート（NEWEST / OLDEST / RECENT / MOST PLAYED / TITLE A→Z）
  - 各曲カードに**ハイスコア**（★ 表示）と**曲難易度グレード C/B/A/S**（NPS+BPM 補正値の四分位ランク）
  - 長い曲名はホバー / 選択時に**自動スクロール**
- **スクロール・リードイン**: ゲーム開始時、最初のノートが画面上端から流れ込むよう自動で調整
- **GAME SE オン/オフ**: 設定でゲーム中の判定SE・歓声・落胆・ブーイングを一括ミュート可能（カウントダウンSEは別扱い）
- **ゲーム中の AUTO バッジ**: AUTO PLAY 中は HUD 右上にパルスバッジ表示

## 構成

- フロントエンド: **Vite 8 + React 19**
- 譜面生成: **Python + librosa 0.11**
- 音声: **Web Audio API**（AnalyserNode で40バンド集約）
- フォント: Orbitron / Rajdhani（Google Fonts）

## ファイル構成

```
neon-beat/
├── import/                  ← WAV投入フォルダ
├── public/
│   ├── songs/              ← 生成された曲データ
│   ├── se/                 ← 効果音（任意・無ければOscillatorフォールバック）
│   └── bgm/menu.wav        ← メニュー画面のループBGM（任意）
├── src/
│   ├── App.jsx             ← ステートマシン + 白フェード遷移
│   ├── components/
│   │   ├── background/     ← CanvasBackground
│   │   ├── game/           ← GameScreen, IntroOverlay, Lane, Note, ...
│   │   ├── hud/            ← Score, Combo, DiscoLevelIndicator
│   │   └── ui/             ← Menu, SongSelect, Difficulty, Result, Settings, WhiteFade
│   ├── engine/             ← AudioEngine, GameEngine, SoundEffects, MenuBgmPlayer, ChartLoader, InputHandler
│   ├── utils/              ← constants.js, helpers.js
│   └── styles/global.css
├── tools/
│   ├── generate_chart.py   ← 単一WAV→譜面
│   └── batch_import.py     ← 一括処理
├── README.md
└── MANUAL.md               ← 詳細な取扱説明書
```
