export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-2xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4">SocialTouch</h1>
        <p className="text-xl text-gray-600 mb-8">
          iPhone 7/8専用 Instagram自動化ツール
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="p-6 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">主な機能</h3>
            <ul className="text-left text-sm text-gray-600 space-y-1">
              <li>• タイムライン自動いいね</li>
              <li>• 発見タブ自動いいね</li>
              <li>• ハッシュタグ検索＆いいね</li>
              <li>• 自動フォロー/アンフォロー</li>
              <li>• DM自動送信</li>
            </ul>
          </div>

          <div className="p-6 bg-green-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">料金プラン</h3>
            <ul className="text-left text-sm text-gray-600 space-y-1">
              <li>• 月額 2,980円（税込）</li>
              <li>• 3日間の無料体験付き</li>
              <li>• いつでも解約可能</li>
              <li>• 1ライセンス = 1デバイス</li>
              <li>• PayPal決済対応</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-4 justify-center">
            <a
              href="/register"
              className="inline-block bg-blue-500 text-white px-6 py-3 rounded-md hover:bg-blue-600 transition"
            >
              新規登録（3日間無料体験）
            </a>
            <a
              href="/login"
              className="inline-block bg-gray-500 text-white px-6 py-3 rounded-md hover:bg-gray-600 transition"
            >
              ログイン
            </a>
          </div>

          <div className="text-sm text-gray-500">
            <p>iPhone 7/8 + Jailbreak + AutoTouch が必要です</p>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>© 2024 SocialTouch. All rights reserved.</p>
      </div>
    </main>
  );
}
