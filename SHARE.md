# NEON BEAT を友人と共有する

NEON BEAT は **Tauri v2** を使って Windows 用の単一実行ファイル (`.exe`) としてビルドできます。
Python や Node.js を入れていないPCでもダブルクリックだけでプレイできます。

---

## 開発側（あなた）の手順

### 1. 一度きりのセットアップ

#### Microsoft C++ Build Tools

https://visualstudio.microsoft.com/visual-cpp-build-tools/ から `vs_BuildTools.exe` をダウンロード → 実行 → 「**C++ によるデスクトップ開発**」にチェック → インストール（1〜2GB、数分）

#### Rust

https://rustup.rs/ から `rustup-init.exe` をダウンロード → 実行 → 標準インストール（`1` を入力）

完了後、ターミナルを開き直して以下が動けばOK:
```bash
rustc --version
cargo --version
```

> Rust と Build Tools は合計2〜3GBですが、一度入れれば以降は追加インストール不要です。

### 2. 配布ファイルをビルドする

```bash
cd e:/neon-beat

# 共有したい曲を譜面化（先にやっておく）
cp 配布したい曲.wav import/
python tools/batch_import.py

# Tauri ビルド（初回は依存クレートのコンパイルで5〜10分）
npm run tauri:build
```

成功すると以下が生成されます:

| ファイル | 説明 |
|---------|------|
| `src-tauri/target/release/bundle/nsis/NEON BEAT_1.0.0_x64-setup.exe` | NSIS インストーラ |
| `src-tauri/target/release/neon-beat.exe` | 単体の実行ファイル本体 |

**インストーラ版**（推奨）はダブルクリックで「次へ→次へ→完了」、デスクトップ/スタートメニューにショートカットが作られます。
**本体 .exe** は単独では動きません（必要なリソースは別途同フォルダ構成にする必要あり）。友人に渡すのは **インストーラ** が確実です。

### 3. 友人への送り方

- インストーラ `.exe` を Google Drive / OneDrive / Dropbox 等で送る
- または USB メモリで渡す
- ファイル名例: `NEON_BEAT_1.0.0_x64-setup.exe`（200〜300MB程度。曲数で変動）

---

## 友人側（受け取った人）の手順

### 1. インストール

1. 受け取った `.exe` をダブルクリック
2. **Windows SmartScreen 警告** が出る場合があります（署名なしのため）
   - 「詳細情報」をクリック → 「実行」 で進められます
3. インストーラの指示に従って次へ進む
4. デスクトップまたはスタートメニューに **NEON BEAT** ショートカットが作成される

### 2. 起動

ショートカットをダブルクリック → ゲームウィンドウが開く

### 3. 必要環境

| 項目 | 要件 |
|------|------|
| OS | Windows 10 / 11（64bit） |
| WebView2 | Win10/11 は通常標準搭載。なければインストーラが自動でダウンロード |
| メモリ | 1GB 以上 |
| ディスク | アプリ + 曲データで数百MB |

---

## トラブルシューティング

### 「Windows によって PC が保護されました」と出る

署名なしの `.exe` のため SmartScreen に止められます。「**詳細情報**」 → 「**実行**」をクリックしてください。

### WebView2 が無いと言われる

通常 Windows 10/11 には標準搭載されていますが、もし出た場合:
- インストーラが自動でダウンロードします（インターネット接続が必要）
- 手動で入れたい場合: https://developer.microsoft.com/microsoft-edge/webview2/

### 起動するが画面が真っ白

- WebView2 のバージョンが古い可能性あり → Edge を最新化
- それでもダメなら開発側に連絡を

### Mac/Linux で動かしたい

Tauri はクロスプラットフォーム対応ですが、**ビルドはターゲット OS 上で行う必要があります**。
Mac 用 `.app` を作るには Mac で `npm run tauri:build` を、Linux 用 `.AppImage` を作るには Linux で同じく実行します。

---

## 配布物の中身

ビルドされた `.exe` の中には:

- **ゲーム本体**（HTML/CSS/JS バンドル、約 240KB）
- **アイコン・フォント**
- **譜面データ**（`public/songs/<曲名>/` 一式）
- **メニュー BGM**（`public/bgm/menu.wav` がある場合）
- **WebView2 ランタイム**（友人のPCに無ければ初回起動時に自動ダウンロード）

すべてオフラインで動作します（フォントは初回 Google Fonts から読み込みますが、キャッシュ後はオフライン動作可）。

---

## 版を更新したい

`tauri.conf.json` の `version` を上げる → `npm run tauri:build` → 新しい `.exe` が生成されます。
インストーラが古い版を自動でアンインストールしてから入れ直してくれます。
