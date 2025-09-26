# SocialTouch Lua認証モジュール統合ガイド

## ファイル概要

### 作成したファイル
- `lua/main_v2.lua` - ライセンス認証対応版メインランチャー

## 主要な変更点

### 1. ライセンス認証システム追加

#### デバイスハッシュ生成
```lua
local function generateDeviceHash()
    local deviceId = getSN() or "unknown_device"
    local model = getDeviceModel() or "iPhone"
    local data = deviceId .. ":" .. model .. ":socialtouch"

    -- 16文字のハッシュを生成
    return hash
end
```

#### API通信機能
```lua
local function verifyLicense(deviceHash)
    -- キャッシュチェック
    local cache = readLicenseCache()
    if cache and cache.is_valid then
        return true, cache.expires_at
    end

    -- API認証
    local url = Config.API_BASE_URL .. "/license/verify"
    local response = httpRequest(url, "POST", {device_hash = deviceHash})

    -- キャッシュ保存
    writeLicenseCache(response.is_valid, response.expires_at, deviceHash)

    return response.is_valid, response.expires_at
end
```

### 2. ユーザーフロー

#### 未登録デバイスの場合
1. デバイスハッシュを自動生成・表示
2. 登録URLと手順を案内
3. デバイスハッシュをクリップボードにコピー
4. 登録完了後、再実行を促す

#### 登録済みデバイスの場合
1. ライセンス認証（キャッシュ優先）
2. 認証成功後、ツール選択画面表示
3. 選択されたツール実行

### 3. キャッシュシステム
- **キャッシュファイル**: `/var/mobile/Documents/socialtouch_license.cache`
- **有効期間**: 24時間
- **オフラインサポート**: ネットワーク障害時にキャッシュを使用

### 4. 設定項目

```lua
local Config = {
    VERSION = "2.0.0",
    API_BASE_URL = "https://your-domain.com/api",  -- 本番環境URL
    CACHE_FILE = "/var/mobile/Documents/socialtouch_license.cache",
    CACHE_DURATION = 24 * 60 * 60, -- 24時間
    DEBUG = true
}
```

## セットアップ手順

### 1. API URL設定
`Config.API_BASE_URL`を本番環境のURLに変更：
```lua
API_BASE_URL = "https://socialtouch.app/api",
```

### 2. ファイル配置
既存の`smartgram.ate`を`main_v2.lua`で置き換え：
```bash
cp lua/main_v2.lua /var/mobile/Library/AutoTouch/Scripts/smartgram.ate
```

### 3. AutoTouch設定
- HTTP機能が有効であることを確認
- デバイスID取得関数（`getSN()`）が利用可能であることを確認

## AutoTouch API使用関数

### 必須関数
- `httpPost(url, data)` - POST通信
- `httpGet(url)` - GET通信
- `getSN()` - デバイスシリアル番号取得
- `getDeviceModel()` - デバイスモデル取得

### オプション関数
- `copyText(text)` - クリップボードコピー

## ユーザー体験フロー

### 初回実行時
```
1. smartgram.ate実行
   ↓
2. デバイスハッシュ生成 (例: a1b2c3d4e5f6g7h8)
   ↓
3. ライセンス未登録エラー表示
   ↓
4. 登録画面案内
   - デバイスハッシュ表示
   - 登録URL案内
   - 手順説明
   ↓
5. ユーザーがWeb登録
   ↓
6. smartgram.ate再実行でツール選択画面表示
```

### 2回目以降
```
1. smartgram.ate実行
   ↓
2. キャッシュからライセンス確認 (24時間有効)
   ↓
3. ツール選択画面表示
   ↓
4. 選択したツール実行
```

## エラーハンドリング

### API通信エラー
- ネットワーク障害時はキャッシュを使用
- 完全にオフラインの場合は登録案内を表示

### ライセンス期限切れ
- 期限切れの場合は再登録案内
- 猶予期間なしで即座に無効化

### HTTP機能未対応
- AutoTouchのHTTP機能が利用できない場合のエラー表示
- 代替手段の案内

## セキュリティ

### デバイスハッシュ
- デバイス固有の情報から生成
- 16文字の16進数形式
- 推測困難な組み合わせ

### キャッシュ保護
- ローカルファイルに平文保存（簡易実装）
- タイムスタンプベースの自動期限切れ

### API通信
- HTTPS通信（本番環境）
- デバイスハッシュのみ送信（個人情報なし）

## 注意事項

### AutoTouch制限
- JSON解析ライブラリなし → 簡易パーサーで代替
- HTTP機能の制限 → 基本的なGET/POSTのみ
- ファイルアクセス制限 → 特定ディレクトリのみ

### 互換性
- iPhone 7/8専用
- AutoTouch最新版推奨
- iOS 15対応

### デバッグ
- ログ出力による動作確認
- スクリーンショット自動保存（エラー時）
- デバッグモード切り替え可能

このシステムにより、既存のツール選択画面を維持しながら、ライセンス認証機能を統合できます。