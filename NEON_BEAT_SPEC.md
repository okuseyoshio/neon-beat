# NEON BEAT — 開発仕様書（完全版）

**現在のバージョン: v1.1.0**（2026-04-08）

## プロジェクト概要

**ゲーム名:** NEON BEAT  
**フォルダ名:** `neon-beat`  
**ジャンル:** 音楽リズムゲーム（4レーン落下型）  
**プラットフォーム:** Webブラウザ + Tauri 2 Windows デスクトップ  
**技術スタック:** Vite 8 + React 19（フロントエンド）、Python（譜面生成ツール）、Tauri 2（デスクトップ配布）  
**初回実装で全機能を実装すること。Phase分割はしない。**

---

## 0. バージョン履歴

### v1.1.0（2026-04-08）

機能拡張リリース。プレイヤー体験 / カスタマイズ性 / 演出を大きく強化。

**新機能 — UX**
- **スクロール・リードイン**: ゲーム開始時、最初のノートが画面外上から流れ込むよう自動調整。`leadInSec = max(0, judgeLineY/noteSpeed - firstNoteTime)` ぶんだけ仮想負時間でフィールドをスクロールしてから音を再生。
- **HUD AUTO バッジ**: AUTO PLAY 中は HUD 右上に黄色のパルスバッジを表示。ゲーム中の A キートグルにも追従。
- **ゲーム中 SE オン/オフ**: 設定 `gameSeEnabled` を追加。OFF にすると判定SE / コンボSE / 歓声 / 落胆 / ブーイング / 連続歓声を一括ミュート。カウントダウンSEは別系統。

**新機能 — 入力 / オーディオ補正**
- **2種類のキャリブレーション** を設定画面に追加。
  - **INPUT CALIBRATION**: 10本のバー（一定間隔）を順次落下させ、判定線でキー入力を取得。両端の外れ値を除外した中央値を `judgeOffset` の推奨値として表示。標準偏差 / ドット可視化 / RETRY も提供。
  - **AUDIO SYNC**: 0.6秒間隔のメトロノーム（フラッシュ円 + クリック音）を流しつつ、スライダーで `audioOffset` を微調整。WebAudio の precise scheduling で音の発音を ±200ms の範囲で前後できる。矢印キー (1ms) / Shift+矢印 (10ms) / 画面上の `−10/−1/+1/+10` ボタンで微調整可能。
- 新規設定 **`audioOffset`** (-200..+200 ms): ゲーム本番の**描画用 currentTime** を `audioTime - audioOffset/1000` にシフト。判定 (`audioTime + judgeOffsetSec`) には影響しないので、ハードウェア音遅延と人間反応速度を独立に補正できる。

**新機能 — 曲選択 / リザルト**
- **曲ソート**: 設定 `songSortMode` を追加。NEWEST / OLDEST / RECENT / MOST PLAYED / TITLE A→Z の5モード。Tab / Shift+Tab で循環。
- **プレイ統計**: 完走時に `recordSongPlay(songId, scoreEntry)` を呼び、localStorage キー `'neonbeat.songstats.v1'` に `{ lastPlayed, playCount, scores[] }` を保存。
- **ハイスコア記録**: 各曲ごとに最大10件のトップスコア（score / difficulty / accuracy / maxCombo / autoPlay / timestamp）を保持。AUTO PLAY のスコアは記録対象外。
- **リザルト画面のランキング表示**: TOP5 + 自分の順位 + 1位更新時の `NEW HIGH!` バッジ。
- **曲カードのハイスコア + 難易度グレード**: 各カードに `★ <topScore>` と C/B/A/S グレード（NPS+BPM 補正値の四分位ランクで判定）。曲が3曲以下の場合は固定NPS閾値にフォールバック。
- **長い曲名のホバー / 選択時スクロール**: ResizeObserver で overflow を計測し、はみ出すタイトルだけ marquee アニメーションを CSS keyframes で発火。

**新機能 — 演出 / SE**
- **カウントダウンSE**: イントロの「3 / 2 / 1」digit ごとに同じピッチの「ピッ」音（square + sine + triangle 3層）を `setTimeout` で deterministic にスケジュール。
- **オーディエンス歓声**:
  - `playCrowdCheer(combo)` — コンボ 25/50/100/200/300/500 達成時に5段階で盛り上がる単発歓声。
  - `updateCrowdAmbience(combo)` — コンボ50で開始する**連続歓声ループ**。tier1=50, tier2=100, tier3=200。50を切ると 0.4s フェードアウト。
  - 構造: ピンクノイズループ → ローパス → 3層フォルマント (720/1180/2400 Hz) → マスタゲイン。F1 を 0.4Hz LFO で ±60Hz 揺らして「呼吸する群衆」感。
  - whoop は三角波 + 二重フォルマントで「ahh」母音感を出す。
- **落胆の「ああ…」**: `playCrowdGroan(lostCombo)` — コンボ25以上が途切れた瞬間に発火。下降ピッチスイープ + ローパスノイズで4段階。
- **ブーイング**: `playCrowdBoo(missStreak)` — 5連続ミスで発火、以降3ミスごと。「oo」フォルマント (320Hz) + 低音ノコギリで4段階。

**バグ修正**
- **計測の純粋性**: キャリブレーション中は既存 `judgeOffset` を 0 として扱う。
- **メトロノームのリーク修正**: AudioCalibrationModal クローズ時、すでに WebAudio に予約済みのオシレータを `osc.stop(0)` + `disconnect()` で強制停止する。lookahead を 12拍 → 6拍に縮小して安全マージンも追加。
- **イントロでのバー位置ジャンプ修正**: チャートロード直後に `setCurrentTime(-leadInSec)` を呼ぶことで、カウントダウン中もノートが画面外上に隠れた状態を維持。

**互換性**
- 既存 `localStorage` キー (`neonbeat.settings.v2`) はそのまま使用。新規フィールドは欠損時にデフォルト値を返すので、v1.0.x からの自動移行可。
- 新規 localStorage キー: `'neonbeat.songstats.v1'`。

---

## 1. プロジェクト構成

```
neon-beat/
├── README.md
├── package.json
├── vite.config.js
├── index.html
├── import/                         # WAVファイル投入フォルダ
│   └── .gitkeep
├── public/
│   ├── songs/                      # パッケージ済み曲データ（ツールが自動生成）
│   │   ├── song-list.json          #   曲一覧マニフェスト
│   │   └── {song_id}/
│   │       ├── audio.wav
│   │       └── chart.json
│   └── se/                         # 効果音
│       ├── hit_perfect.wav
│       ├── hit_great.wav
│       ├── hit_good.wav
│       ├── miss.wav
│       └── combo_milestone.wav
├── src/
│   ├── main.jsx
│   ├── App.jsx                     # 画面遷移管理（state machine）
│   ├── components/
│   │   ├── game/
│   │   │   ├── GameScreen.jsx
│   │   │   ├── Lane.jsx
│   │   │   ├── Note.jsx
│   │   │   ├── HitEffect.jsx
│   │   │   ├── JudgmentDisplay.jsx
│   │   │   ├── PauseMenu.jsx
│   │   │   └── ProgressBar.jsx
│   │   ├── background/
│   │   │   └── CanvasBackground.jsx
│   │   ├── ui/
│   │   │   ├── MenuScreen.jsx
│   │   │   ├── SongSelect.jsx
│   │   │   ├── DifficultySelect.jsx
│   │   │   ├── ResultScreen.jsx
│   │   │   └── SettingsPanel.jsx
│   │   └── hud/
│   │       ├── ScoreDisplay.jsx
│   │       ├── ComboDisplay.jsx
│   │       └── DiscoLevelIndicator.jsx
│   ├── engine/
│   │   ├── AudioEngine.js
│   │   ├── GameEngine.js
│   │   ├── ChartLoader.js
│   │   ├── InputHandler.js
│   │   └── SoundEffects.js
│   ├── utils/
│   │   ├── constants.js
│   │   └── helpers.js
│   └── styles/
│       └── global.css
└── tools/
    ├── requirements.txt
    ├── generate_chart.py
    ├── batch_import.py
    └── README.md
```

---

## 2. ゲーム仕様

### 2.1 基本ルール

- 画面上部から4つのレーンにノーツが落下する
- ノーツが判定ラインに重なるタイミングでキーを押す（またはタップ）
- タイミングの精度に応じてPERFECT / GREAT / GOOD / MISSの判定
- スコアとコンボを競う

### 2.2 レーン構成

| レーン | PCキー | 色 | カラーコード |
|--------|--------|-----|------------|
| レーン1（左端） | D | ピンク | `#ff2d95` |
| レーン2 | F | シアン | `#00e5ff` |
| レーン3 | J | イエロー | `#ffe600` |
| レーン4（右端） | K | パープル | `#b388ff` |

モバイルでは各レーンの判定ライン付近にタッチ領域を配置する。

### 2.3 判定

| 判定 | 許容誤差 | スコア | 表示色 |
|------|---------|--------|--------|
| PERFECT | ±50ms | 100 × (1 + combo × 0.1) | `#ffe600` |
| GREAT | ±100ms | 75 × (1 + combo × 0.1) | `#00e5ff` |
| GOOD | ±150ms | 50 × (1 + combo × 0.1) | `#b388ff` |
| MISS | それ以外 | 0（コンボリセット） | `#ff2d95` |

### 2.4 コンボ

- PERFECT / GREAT / GOODでコンボ加算
- MISSでコンボリセット
- コンボボーナス: スコア倍率 = `1 + combo × 0.1`
- MAX COMBOをリザルトに記録

### 2.5 ノーツの種類

- **通常ノーツ:** 単押し。タイミングに合わせて1回押す
- **同時押しノーツ:** 2レーン以上を同時に押す（HARD/EXPERT難易度で出現）

### 2.6 難易度

| 難易度 | ノーツ密度 | 使用レーン | 同時押し |
|--------|-----------|-----------|---------|
| EASY | ビートの1/1〜1/2 | 2レーン中心 | なし |
| NORMAL | ビートの1/2 | 4レーン | 少ない |
| HARD | ビートの1/4 + オンセット | 4レーン | あり |
| EXPERT | 高密度オンセット | 4レーン全開 | 多い |

### 2.7 設定項目

| 項目 | キー | デフォルト | 範囲 | 説明 |
|------|-----|-----------|------|------|
| ノーツ速度 | `noteSpeed` | 400px/s | 200〜800（スライダー） | ノーツの落下速度 |
| 判定オフセット | `judgeOffset` | 0ms | -100〜+100（スライダー） | 入力反応補正（人間側）。CALIBRATE ボタンで自動計測可 |
| 音オフセット | `audioOffset` | 0ms | -200〜+200（スライダー） | ハードウェア音遅延補正。CALIBRATE ボタンでメトロノームを使い手動調整 |
| 自動プレイ | `autoPlay` | OFF | ON/OFF | デバッグ用。スコアはランキング非対象 |
| BGM音量 | `bgmVolume` | 100% | 0〜100%（スライダー） | 音楽の音量 |
| SE音量 | `seVolume` | 35% | 0〜100%（スライダー） | 効果音の音量 |
| ゲームSE | `gameSeEnabled` | ON | ON/OFF | ゲーム中の判定SE / 歓声 / 落胆 / ブーイングを一括ミュート |
| 曲ソート | `songSortMode` | `addedDesc` | NEWEST/OLDEST/RECENT/MOST PLAYED/TITLE A→Z | 曲選択画面の並び順 |

設定はlocalStorageに保存し、次回起動時に復元する。
- 設定キー: `'neonbeat.settings.v2'`
- 曲統計キー（v1.1.0新規）: `'neonbeat.songstats.v1'` — 各曲の `{ lastPlayed, playCount, scores[] }`

---

## 3. 画面フロー

```
[タイトル画面] → [曲選択画面] → [難易度選択] → [ゲーム画面] → [リザルト画面]
     ↑                ↑                          ↓  ↑              ↓
     │                │                    [ESC] ↓  │        [RETRY] 同じ曲で再プレイ
     │                │                   [ポーズメニュー]    
     │                │                     │ [RESUME] → ゲーム再開
     │                │                     │ [RETRY]  → 同じ曲で再プレイ
     │                └─────────────────────┘ [QUIT]
     └──────────────────────────────────────────────── [TITLE] タイトルに戻る
                      └──────────────────────────────── [SELECT] 曲選択に戻る
```

### 3.1 タイトル画面（MenuScreen）

- ゲームタイトル「NEON BEAT」をネオングロウ付きで大きく表示
- サブタイトル「DISCO RHYTHM」
- 「START」ボタン → 曲選択へ
- 「SETTINGS」ボタン → 設定画面をモーダル表示
- 背景: CanvasBackground（イコライザーがアイドル動作 combo=10相当）
- ショートカット: Spaceで START

### 3.2 曲選択画面（SongSelect）

- `public/songs/song-list.json` から曲一覧を読み込んで表示
- 曲名 = WAVファイル名（拡張子なし、`_`はスペースに変換して表示）
- 各曲カードに表示する情報: 曲名、アーティスト名、BPM、曲の長さ（mm:ss）、各難易度のノーツ数
- 曲が0件の場合は案内:「import/ フォルダにWAVファイルを置いて python tools/batch_import.py を実行してください」
- ネオン風のカード型リスト（選択中の曲はグロウ強調）
- 操作: クリック/タップで選択→難易度選択へ、上下矢印キーでカーソル移動、Enterで決定、Escape/BACKでタイトルに戻る
- 「SETTINGS」ボタン → 設定モーダル

### 3.3 難易度選択画面（DifficultySelect）

- 選択中の曲名を上部に表示
- EASY / NORMAL / HARD / EXPERT を横並びカードで表示
- 各カード: 難易度名、レベル数値、ノーツ数
- chart.jsonにない難易度はグレーアウト
- 操作: クリック/タップで決定、左右矢印キーでカーソル移動、Enterで決定、Escape/BACKで曲選択に戻る
- カードカラー: EASY=グリーン系、NORMAL=シアン(`#00e5ff`)、HARD=ピンク(`#ff2d95`)、EXPERT=パープル(`#b388ff`)+強グロウ

### 3.4 ゲーム画面（GameScreen）

レイアウト:
```
┌──────────────────────────────────────────────┐
│ [SCORE]   [JUDGMENT]   [COMBO] [♪ 曲名] [✕] │  ← HUD
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  ← プログレスバー
│                                              │
│     ┌───────────────────────────┐            │
│     │   ↓   ↓   ↓   ↓         │            │
│     │   ■   ■   ■   ■  ノーツ  │            │
│     │   ↓   ↓   ↓   ↓         │            │
│     │ ──────────────────────── │  ← 判定ライン
│     │  [D] [F] [J] [K]        │  ← ヒットゾーン
│     └───────────────────────────┘            │
│                                              │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← イコライザー
└──────────────────────────────────────────────┘
```

- ゲームフィールドは中央配置、幅固定、半透明背景
- 判定ラインのY座標: ゲームフィールド下部から80px上
- HUD右側に曲名を小さく表示
- プログレスバー: HUD直下、幅=ゲームフィールド幅、高さ3px
  - 背景: `#ffffff10`
  - 進行部分: `linear-gradient(90deg, #ff2d95, #00e5ff, #ffe600, #b388ff)`
  - 位置 = `currentTime / duration`

#### ポーズメニュー（PauseMenu）

- **Escapeキー** または **画面右上✕ボタン** で表示
- ポーズ中は音楽+ゲームループを一時停止
- 半透明黒背景 `rgba(0,0,0,0.7)` の上にネオン風ボタン

| ボタン | 色 | キー | 動作 |
|--------|-----|------|------|
| RESUME | イエロー `#ffe600` | Escape再押し | ゲーム再開 |
| RETRY | シアン `#00e5ff` | R | 最初からやり直し |
| QUIT | ピンク `#ff2d95` | Q | 曲選択画面に戻る |

- ✕ボタンは `#ffffff40` の控えめなスタイル

### 3.5 リザルト画面（ResultScreen）

表示内容:
- 曲名 + 難易度
- 総合スコア（大きく中央に）
- MAX COMBO
- 判定内訳（4項目）: PERFECT数(イエロー)、GREAT数(シアン)、GOOD数(パープル)、MISS数(ピンク)
- 精度: `(PERFECT×100 + GREAT×75 + GOOD×50) / (totalNotes×100) × 100%`
- AUTO PLAYだった場合は「AUTO PLAY」バッジ

操作ボタン（3つ横並び）:

| ボタン | 色 | キー | 動作 |
|--------|-----|------|------|
| RETRY | シアン `#00e5ff` | R | 同じ曲で再プレイ |
| SELECT | パープル `#b388ff` | S | 曲選択に戻る |
| TITLE | ピンク `#ff2d95` | T | タイトルに戻る |

各ボタン下にショートカットキーを小さく表示。

### 3.6 設定画面（SettingsPanel）

- モーダルオーバーレイ（タイトル・曲選択から開ける）
- 半透明黒背景の上にパネル（`#0d0d1a`背景、ネオンボーダー）

| 項目 | UI | 表示 |
|------|-----|------|
| ノーツ速度 | スライダー + 数値 | `200`〜`800` px/s |
| 判定オフセット | スライダー + 数値 | `-100`〜`+100` ms |
| BGM音量 | スライダー + % | `0%`〜`100%` |
| SE音量 | スライダー + % | `0%`〜`100%` |
| 自動プレイ | トグルスイッチ | ON / OFF |

- CLOSE/Escapeで閉じる。設定変更は即時反映。localStorage自動保存。

---

## 4. ビジュアル仕様

### 4.1 全体テーマ

- **テーマ:** ネオン × ディスコ × サイバーパンク
- **背景色:** `hsl(240, 40%, ${8 + discoLevel * 3}%)` — コンボで明るくなる
- **フォント:** Orbitron（タイトル・数値）、Rajdhani（ラベル・説明）
  - `https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap`

### 4.2 Canvas統合背景（CanvasBackground）

**重要:** 背景演出は全て1枚のCanvasに統合描画する。DOMベースの背景要素は使わない（マウスホバー時のパフォーマンス問題回避）。

背景Canvasは**常に動作し続ける**。ゲーム開始・終了で途切れないよう、独立したrAFループで駆動する。ゲーム画面以外ではcombo=10相当のアイドルアニメーションを表示する。

描画レイヤー（奥から手前の順）:

#### 1. パースペクティブグリッド（最奥）
- 画面下半分に収束する格子線（水平15本、垂直12本）
- 色: Lv3以上で `#ffe600`、それ以下で `#00e5ff`
- 不透明度: `0.03 + (beatPulse ? 0.04 : 0) + level * 0.015`

#### 2. ディスコボールライト
- 回遊する光の円（Canvas radialGradient）
- 個数: `4 + level * 4`
- 各光は独立した速度と位相で移動、色相は時間で回転
- ビートパルスでサイズ増加

#### 3. レーザービーム（Lv2以上で出現）
- 画面上部中央から斜め下に伸びるライン
- 本数: Lv2=2, Lv3=4, Lv4=6
- LANE_COLORSの4色、ビートパルスで太くなる
- 角度は `Math.sin()` でゆっくり揺れる

#### 4. 浮遊パーティクル
- 画面全体を漂い上昇する光の粒（`6 + level * 6`個）
- 色相は時間で回転、ビートパルスで輝度増加

#### 5. エッジグロウ（四辺）
- 左:`#ff2d95`、右:`#00e5ff`、上:`#ffe600`、下:`#b388ff`
- 幅: `50 + level * 25 + (beatPulse ? 20 : 0)` px

#### 6. ブロック型イコライザー（最前面、画面下部）

**最も重要な背景要素。**

- バー本数: 40本
- 各バーは**縦に積み上がるブロック**（1バー最大20ブロック）
- ブロック: 幅=`(画面幅-20)/40-2`px、高さ10px、垂直ギャップ3px
- 配置: 画面下端から15px上を基点に上方向へ積む
- **色:** レインボーグラデーション `barHue = (i / totalBars) * 300 + 180`
- 明度: 下段40%→上段90%
- 最上段ブロック: グロウ付き `ctx.shadowBlur = 8 + level * 4`
- 下部にリフレクション
- ビートパルスでグロウ強化

#### スキャンライン（CSS、Canvas外）
- `repeating-linear-gradient` で2px間隔の薄い水平線
- `pointerEvents: "none"` 必須

### 4.3 ディスコレベル（コンボ連動）

| レベル | コンボ | 演出 |
|--------|--------|------|
| 0 | 0-4 | 控えめ。グリッドとイコライザーのみ |
| 1 | 5-14 | ディスコライト出現、パーティクル増加 |
| 2 | 15-24 | レーザー出現、エッジグロウ強化 |
| 3 | 25-39 | グリッド/レーザー色がゴールドに変化 |
| 4 | 40+ | 全開。レーザー6本。背景最大輝度 |

### 4.4 ゲームフィールドUI

- 背景: `#0a0a1890`（半透明）+ `backdropFilter: blur(2px)`
- ボーダー: Lv3以上で `#ffe60025`、それ以下で `#ffffff15`
- ビートパルスでbox-shadow発光
- ノーツ: レーンカラーのグラデーション + グロウ
- 判定ライン: 白のlinear-gradient + ビート連動

### 4.5 ヒットエフェクト

- パーティクル8個が放射状に飛散（DOM、最大60個制限）
- 色=該当レーンカラー
- ライフ1.0→0減衰（decay: 0.025〜0.055）、重力 `vy += 0.06`
- レーンフラッシュ: 120ms光る

### 4.6 ディスコレベルインジケーター

- ゲーム画面右上に4本バー（短→長、下揃え）
- 到達バーは `LANE_COLORS[i]` + グロウ、未到達は `#ffffff15`

---

## 5. 音声仕様

### 5.1 AudioEngine（Web Audio API）

```
AudioContext
├── sourceNode (WAV再生)
│   ├── gainNode (BGM音量)
│   │   └── destination
│   └── analyserNode (周波数解析)
│       └── getByteFrequencyData() → Uint8Array
├── seGainNode (SE音量)
│   └── destination
```

- AnalyserNode: fftSize=2048, smoothingTimeConstant=0.8
- 周波数データを0〜1正規化、40バンドに対数スケール集約
- 時刻管理: `AudioContext.currentTime` ベース + オフセット補正
- ポーズ: `AudioContext.suspend()` / `resume()`

### 5.2 効果音（SoundEffects）

| SE | ファイル | タイミング |
|----|---------|-----------|
| PERFECT | `se/hit_perfect.wav` | PERFECT判定時 |
| GREAT | `se/hit_great.wav` | GREAT判定時 |
| GOOD | `se/hit_good.wav` | GOOD判定時 |
| MISS | `se/miss.wav` | MISS判定時 |
| コンボ | `se/combo_milestone.wav` | コンボ25,50,100到達 |

- AudioBufferSourceNodeを都度生成（同時複数再生可能）
- SE音量は seGainNode で一括制御
- **WAVファイルが存在しない場合のフォールバック:** OscillatorNodeで簡易音を動的生成
  - PERFECT: 880Hz, 30ms
  - GREAT: 660Hz, 30ms
  - GOOD: 440Hz, 30ms
  - MISS: 200Hz, 50ms, 減衰速い
  - コンボ: 440→880Hz上昇, 100ms

---

## 6. 譜面データ仕様

### 6.1 chart.json

```json
{
  "meta": {
    "title": "My Cool Song",
    "artist": "Unknown",
    "bpm": 128,
    "duration": 195.3,
    "audioFile": "audio.wav"
  },
  "difficulties": {
    "easy": {
      "level": 3,
      "noteCount": 120,
      "notes": [
        { "time": 1.234, "lane": 0, "type": "normal" },
        { "time": 1.468, "lane": 2, "type": "normal" }
      ]
    },
    "normal": { "level": 5, "noteCount": 250, "notes": [] },
    "hard": { "level": 8, "noteCount": 450, "notes": [] },
    "expert": { "level": 10, "noteCount": 700, "notes": [] }
  }
}
```

| フィールド | 型 | 説明 |
|-----------|------|------|
| `meta.title` | string | 曲名（WAVファイル名の`_`をスペースに変換） |
| `meta.artist` | string | デフォルト `"Unknown"` |
| `meta.bpm` | number | メインBPM |
| `meta.duration` | number | 曲の長さ（秒） |
| `meta.audioFile` | string | 常に `"audio.wav"` |
| `notes[].time` | number | ノーツ出現時刻（秒） |
| `notes[].lane` | number | レーン番号（0〜3） |
| `notes[].type` | string | `"normal"` |

### 6.2 song-list.json

```json
{
  "songs": [
    {
      "id": "My_Cool_Song",
      "title": "My Cool Song",
      "artist": "Unknown",
      "bpm": 128,
      "duration": 195.3,
      "folder": "My_Cool_Song",
      "difficulties": {
        "easy": { "level": 3, "noteCount": 120 },
        "normal": { "level": 5, "noteCount": 250 },
        "hard": { "level": 8, "noteCount": 450 },
        "expert": { "level": 10, "noteCount": 700 }
      }
    }
  ]
}
```

| フィールド | 説明 |
|-----------|------|
| `id` | WAVファイル名（拡張子なし）= フォルダ名 |
| `title` | `id`の`_`をスペースに置換 |
| `folder` | `public/songs/`内のサブフォルダ名 |

---

## 7. Python譜面生成ツール

### 7.1 ツール構成

- `tools/generate_chart.py` — 単一WAV → 譜面生成
- `tools/batch_import.py` — `import/`内の全WAVを一括処理（メインで使う）

### 7.2 依存ライブラリ

```
# tools/requirements.txt
librosa>=0.10.0
numpy
soundfile
```

### 7.3 使い方

```bash
# 通常フロー
cp ~/Music/My_Song.wav neon-beat/import/
cd neon-beat
python tools/batch_import.py

# オプション
python tools/batch_import.py --force          # 全WAV再解析
python tools/batch_import.py --import-dir ./x # 別フォルダ指定
python tools/generate_chart.py song.wav       # 単一ファイル
```

### 7.4 batch_import.py 処理フロー

```
import/ をスキャン → 各.wavに対して:
  1. ファイル名 → id（拡張子除去、スペースを_に変換）
  2. public/songs/{id}/ 作成
  3. WAVコピー → public/songs/{id}/audio.wav
  4. librosa解析 → public/songs/{id}/chart.json
  5. 既存フォルダはスキップ（--forceで上書き）
全曲処理後:
  6. public/songs/song-list.json を生成・更新
```

### 7.5 曲名ルール

| WAVファイル名 | id | title |
|--------------|-----|-------|
| `My_Cool_Song.wav` | `My_Cool_Song` | `My Cool Song` |
| `Track 01.wav` | `Track_01` | `Track 01` |

### 7.6 解析アルゴリズム

```python
import librosa, numpy as np, json, os, shutil

def generate_chart(audio_path, output_dir):
    filename = os.path.splitext(os.path.basename(audio_path))[0]
    song_id = filename.replace(" ", "_")
    song_title = song_id.replace("_", " ")

    y, sr = librosa.load(audio_path)
    duration = librosa.get_duration(y=y, sr=sr)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    S = np.abs(librosa.stft(y))
    freqs = librosa.fft_frequencies(sr=sr)

    easy_notes = generate_easy(beat_times)
    normal_notes = generate_normal(beat_times, onset_times)
    hard_notes = generate_hard(beat_times, onset_times, S, freqs, sr)
    expert_notes = generate_expert(beat_times, onset_times, S, freqs, sr)

    song_dir = os.path.join(output_dir, song_id)
    os.makedirs(song_dir, exist_ok=True)
    shutil.copy2(audio_path, os.path.join(song_dir, "audio.wav"))

    chart = {
        "meta": {
            "title": song_title, "artist": "Unknown",
            "bpm": float(tempo) if np.isscalar(tempo) else float(tempo[0]),
            "duration": float(duration), "audioFile": "audio.wav"
        },
        "difficulties": {
            "easy": {"level": 3, "noteCount": len(easy_notes), "notes": easy_notes},
            "normal": {"level": 5, "noteCount": len(normal_notes), "notes": normal_notes},
            "hard": {"level": 8, "noteCount": len(hard_notes), "notes": hard_notes},
            "expert": {"level": 10, "noteCount": len(expert_notes), "notes": expert_notes}
        }
    }
    with open(os.path.join(song_dir, "chart.json"), 'w') as f:
        json.dump(chart, f, indent=2)
    return song_id

def update_song_list(songs_dir):
    songs = []
    for folder in sorted(os.listdir(songs_dir)):
        chart_path = os.path.join(songs_dir, folder, "chart.json")
        if not os.path.isfile(chart_path): continue
        with open(chart_path) as f: chart = json.load(f)
        meta = chart["meta"]
        diffs = {k: {"level": v["level"], "noteCount": v["noteCount"]}
                 for k, v in chart["difficulties"].items()}
        songs.append({"id": folder, "title": meta["title"],
            "artist": meta.get("artist","Unknown"), "bpm": meta["bpm"],
            "duration": meta["duration"], "folder": folder, "difficulties": diffs})
    with open(os.path.join(songs_dir, "song-list.json"), 'w') as f:
        json.dump({"songs": songs}, f, indent=2, ensure_ascii=False)
```

### 7.7 難易度別ノーツ生成

**EASY:** ビート1/2をノーツに。レーン0と3（両端）のみ、交互配置。

**NORMAL:** 全ビート。4レーン使用、直前と同じレーンは避ける。

**HARD:** 全ビート+オンセット（最小間隔100ms）。スペクトル解析でレーン割り当て（低音→レーン0、高音→レーン3）。強ビートで2レーン同時押し。

**EXPERT:** 全オンセット+16分音符分割（最小間隔60ms）。高密度、同時押し多め。スペクトル解析レーン割り当て。

### 7.8 レーン割り当て

```python
def assign_lane_by_spectrum(S, freqs, sr, time, hop_length=512):
    frame = librosa.time_to_frames(time, sr=sr, hop_length=hop_length)
    if frame >= S.shape[1]: return random.randint(0, 3)
    spectrum = S[:, frame]
    bands = [(0,250), (250,1000), (1000,4000), (4000,sr/2)]
    energies = [np.sum(spectrum[(freqs>=lo)&(freqs<hi)]) for lo,hi in bands]
    return int(np.argmax(energies))
```

---

## 8. 入力処理

### 8.1 キーボード

- `keydown` イベント。`event.repeat === true` を無視。

| キー | 画面 | 動作 |
|------|------|------|
| D, F, J, K | ゲーム中 | レーン1〜4入力 |
| Space | タイトル | START |
| ↑↓ | 曲選択 | カーソル移動 |
| ←→ | 難易度選択 | カーソル移動 |
| Enter | 曲選択・難易度選択 | 決定 |
| Escape | 曲選択・難易度選択 | 前の画面に戻る |
| Escape | ゲーム中 | ポーズ表示/非表示 |
| R | ポーズ・リザルト | リトライ |
| Q | ポーズ | 曲選択へ戻る |
| S | リザルト | 曲選択へ戻る |
| T | リザルト | タイトルへ戻る |
| A | 全画面 | AUTO PLAY切り替え |

### 8.2 タッチ

- 各レーン判定ライン付近に60px高のタッチ領域
- `touchstart` で検知（clickは遅延あるため不可）
- `event.preventDefault()` でスクロール防止
- マルチタッチ対応（同時押し）

### 8.3 判定ロジック

1. 入力発生
2. `AudioContext.currentTime` + オフセットで補正済み時刻取得
3. 入力レーンの未ヒットノーツから最も近い時刻のノーツ検索
4. 時刻差が判定窓内 → 判定付与、SE再生、パーティクル生成
5. 判定窓外 → 無視（空打ち）

---

## 9. ゲームループ

### 9.1 メインループ（requestAnimationFrame）

```
毎フレーム:
1. currentTime更新（AudioContext.currentTime + オフセット）
2. ポーズ中なら描画のみ（ロジック更新しない）
3. AnalyserNodeから周波数データ取得 → 40バンドに集約
4. ビートパルス計算: Math.sin((time / beatInterval) * PI) > 0.85
5. AUTO PLAY: 現在時刻のノーツを自動ヒット（PERFECT判定）
6. 未ヒット＆時刻超過ノーツをMISS判定
7. パーティクル更新（位置・ライフ・重力）
8. プログレスバー更新
9. 画面描画
10. 全ノーツ処理完了 → リザルト画面へ
```

### 9.2 パフォーマンス指針

- 背景演出は全て1枚のCanvasに統合
- 背景Canvas: `pointerEvents: "none"` 必須
- ノーツ・パーティクルはReact DOM可（要素数少ない）
- パーティクル最大60個（古いものから削除）
- ゲーム要素に不要な `transition` CSS を使わない
- state更新は最小限（refを活用してre-render削減）

---

## 10. 音声ファイルの取り込みフロー

### 推奨フォーマット: WAV

理由: デコード遅延なし、先頭無音なし、librosa精度安定

### ユーザー操作

```
1. WAVファイルをリネーム（ファイル名 = 曲名）
2. neon-beat/import/ にコピー
3. python tools/batch_import.py を実行
4. ブラウザでゲームを開く → 曲一覧に表示
5. プレイ！
```

### ファイル名ルール
- `.wav` のみ対応
- ファイル名がそのまま曲名（`_`はスペース表示）
- 使用可能文字: 英数字、`_`、`-`、スペース

### 曲の削除
`public/songs/{曲名}/` を手動削除 → `python tools/batch_import.py` でsong-list.json更新

### 曲の再解析
`python tools/batch_import.py --force`

---

## 11. 画面遷移管理（App.jsx）

useStateまたはuseReducerでステートマシンを実装。

```javascript
const screens = {
  TITLE: 'title',
  SONG_SELECT: 'songSelect',
  DIFFICULTY_SELECT: 'difficultySelect',
  GAME: 'game',
  RESULT: 'result'
};

const gameContext = {
  selectedSong: null,       // song-list.jsonの1曲分
  selectedDifficulty: null, // 'easy' | 'normal' | 'hard' | 'expert'
  chartData: null,          // chart.jsonの内容
  gameResult: null,         // { score, maxCombo, perfects, greats, goods, misses }
  settings: {               // localStorageから復元
    noteSpeed: 400,
    judgeOffset: 0,
    bgmVolume: 0.8,
    seVolume: 0.8,
    autoPlay: false
  }
};
```

---

## 12. README.md

プロジェクトルートのREADME:

```
# NEON BEAT

ネオン×ディスコ風の音楽リズムゲーム。
自分のWAVファイルをインポートして遊べる4レーン落下型音ゲー。

## セットアップ
npm install
pip install -r tools/requirements.txt

## 曲を追加
cp your_song.wav import/
python tools/batch_import.py

## 起動
npm run dev
→ http://localhost:5173

## 操作（PC）
D/F/J/K: レーン入力 | Space: スタート | Escape: ポーズ | A: オートプレイ
```

tools/README.md:

```
# 譜面生成ツール

## インストール
pip install -r requirements.txt

## 使い方
1. WAVファイルを import/ に置く
2. python tools/batch_import.py を実行
3. public/songs/ に曲データが生成される

## オプション
--force: 既存曲も再解析
--import-dir: 別フォルダからインポート
```

---

## 13. プロトタイプからの引き継ぎ

`neon_beat_canvas.jsx` をベースにする。

**引き継ぐ:**
- CanvasBackground描画ロジック（ブロック型イコライザー、ディスコライト、レーザー、パーティクル、エッジグロウ、グリッド）
- ゲームフィールドのレイアウト・色・サイズ
- ノーツの見た目・アニメーション
- ヒットエフェクト（パーティクル、レーンフラッシュ）
- ディスコレベルシステム（5段階コンボ連動）
- 自動プレイロジック

**変更:**
- ダミースペクトラム → `AnalyserNode.getByteFrequencyData()`
- ダミーノーツ → chart.json読み込み
- 時刻: `performance.now()` → `AudioContext.currentTime` + オフセット
- 単一ファイル → コンポーネント分割
- 単一画面 → 5画面ステートマシン
- 設定ハードコード → localStorage設定画面
- 効果音追加
- プログレスバー追加
- ポーズメニュー追加

---

## 付録

プロトタイプ `neon_beat_canvas.jsx` をこの仕様書と一緒にClaude Codeに渡すこと。

**Claude Codeへの指示例:**
「NEON_BEAT_SPEC.md を読んで、全機能を実装した完成版を作成して。neon_beat_canvas.jsx はプロトタイプのUIコードなのでベースとして使って。」
