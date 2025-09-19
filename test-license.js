// SocialTouch License Test Script
// API通信テスト用JavaScriptスクリプト

const API_BASE_URL = "http://localhost:3001/api";
const TEST_DEVICE_HASH = "58ff07d6539b1b8c";

// ライセンス認証テスト
async function testLicenseVerification() {
    console.log("=== ライセンス認証テスト開始 ===");

    try {
        const response = await fetch(`${API_BASE_URL}/license/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                device_hash: TEST_DEVICE_HASH
            })
        });

        const data = await response.json();

        console.log("📊 認証結果:");
        console.log("  - success:", data.success);
        console.log("  - is_valid:", data.is_valid);
        console.log("  - status:", data.status);
        console.log("  - expires_at:", data.expires_at);
        console.log("  - cached:", data.cached);

        if (data.success && data.is_valid) {
            console.log("✅ ライセンス認証成功！");
            return { success: true, expires_at: data.expires_at };
        } else {
            console.log("❌ ライセンス認証失敗");
            return { success: false };
        }
    } catch (error) {
        console.error("❌ API通信エラー:", error.message);
        return { success: false, error: error.message };
    }
}

// デバイスハッシュ生成シミュレーション
function simulateDeviceHashGeneration() {
    console.log("=== デバイスハッシュ生成テスト ===");

    const deviceId = "test_device_001";
    const model = "iPhone";
    const data = `${deviceId}:${model}:socialtouch`;

    console.log("ハッシュ元データ:", data);

    // 簡易ハッシュ生成（Luaスクリプトと同じロジック）
    let hash = "";
    let sum = 0;

    for (let i = 0; i < data.length; i++) {
        sum += data.charCodeAt(i);
    }

    // Math.randomをseedで初期化する代替手段
    let seed = sum;
    function seededRandom() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    }

    for (let i = 0; i < 16; i++) {
        const n = Math.floor(seededRandom() * 16);
        if (n < 10) {
            hash += n.toString();
        } else {
            hash += String.fromCharCode(87 + n); // a-f
        }
    }

    console.log("生成されたハッシュ:", hash);
    return hash;
}

// キャッシュ機能テスト
async function testCaching() {
    console.log("=== キャッシュ機能テスト ===");

    console.log("1回目のリクエスト（キャッシュなし）:");
    const result1 = await testLicenseVerification();

    console.log("\n2回目のリクエスト（キャッシュあり）:");
    const result2 = await testLicenseVerification();

    return { result1, result2 };
}

// 期限切れデバイスハッシュのテスト
async function testExpiredDevice() {
    console.log("=== 期限切れデバイステスト ===");

    try {
        const response = await fetch(`${API_BASE_URL}/license/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                device_hash: "expired_device_hash"
            })
        });

        const data = await response.json();

        console.log("期限切れデバイスの結果:");
        console.log("  - success:", data.success);
        console.log("  - is_valid:", data.is_valid);
        console.log("  - error:", data.error);

        return data;
    } catch (error) {
        console.error("API通信エラー:", error.message);
        return { success: false, error: error.message };
    }
}

// API健全性チェック
async function healthCheck() {
    console.log("=== API健全性チェック ===");

    try {
        const response = await fetch(`${API_BASE_URL}/license/verify`, {
            method: 'GET'
        });

        const data = await response.json();
        console.log("Health Check結果:", data);
        return data;
    } catch (error) {
        console.error("Health Check失敗:", error.message);
        return { success: false, error: error.message };
    }
}

// メイン実行
async function main() {
    console.log("==========================================");
    console.log("    SocialTouch License Test Script      ");
    console.log("==========================================\n");

    // 1. デバイスハッシュ生成テスト
    const generatedHash = simulateDeviceHashGeneration();
    console.log("");

    // 2. API健全性チェック
    await healthCheck();
    console.log("");

    // 3. 有効なライセンス認証テスト
    const licenseResult = await testLicenseVerification();
    console.log("");

    // 4. キャッシュ機能テスト
    await testCaching();
    console.log("");

    // 5. 期限切れデバイステスト
    await testExpiredDevice();
    console.log("");

    // 結果サマリー
    console.log("==========================================");
    if (licenseResult.success) {
        console.log("🎉 すべてのテストが正常に完了しました");
        console.log("📅 有効期限:", licenseResult.expires_at);
        console.log("");
        console.log("📱 実際のAutoTouchスクリプトでは以下の処理を実行:");
        console.log("  1. ツール選択画面を表示");
        console.log("  2. 選択されたツールを実行");
        console.log("  3. ライセンス認証は24時間キャッシュされます");
    } else {
        console.log("⚠️ ライセンス認証に失敗しました");
        console.log("📝 実際のスクリプトでは登録画面を表示します");
    }
    console.log("==========================================");
}

// テスト実行
main().catch(console.error);