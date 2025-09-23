// Cloudflare Function: デバイス情報取得
export async function onRequestGet(context: {
  request: Request;
  env: any;
  params: { device_hash: string };
}) {
  try {
    const { request, env, params } = context;
    const { device_hash } = params;

    // CORS対応
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // OPTIONSリクエストの場合
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    // デバイスハッシュの検証
    if (!device_hash || device_hash.length < 8) {
      return new Response(JSON.stringify({
        error: 'Invalid device hash',
        device_hash: device_hash
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    console.log('Device status request for:', device_hash);

    // 実際の環境では Supabase や データベースから取得
    // ここではサンプルデータを返す
    const deviceInfo = await getDeviceInfo(device_hash, env);

    // AutoTouch用のファイルダウンロード形式で返す
    const response = {
      device_hash: device_hash,
      is_registered: deviceInfo.is_registered,
      status: deviceInfo.status,
      subscription_end: deviceInfo.subscription_end,
      trial_end: deviceInfo.trial_end,
      last_updated: new Date().toISOString(),
      source: 'smartgram-dashboard'
    };

    // ファイルダウンロード用のヘッダーを追加
    const downloadHeaders = {
      ...corsHeaders,
      'Content-Disposition': `attachment; filename="smartgram_device_info.json"`,
      'Content-Type': 'application/json'
    };

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: downloadHeaders
    });

  } catch (error) {
    console.error('Device status error:', error);

    return new Response(JSON.stringify({
      error: 'Failed to get device status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// デバイス情報を取得（実際の実装）
async function getDeviceInfo(deviceHash: string, env: any) {
  // 現在は固定データを返す（実際の環境では Supabase から取得）
  const knownDevices: Record<string, any> = {
    'FFMZ3GTSJC6J': {
      is_registered: true,
      status: 'active',
      subscription_end: '2025-12-31T23:59:59Z',
      trial_end: null
    },
    'NN2HJ6K990': {
      is_registered: true,
      status: 'trial',
      subscription_end: null,
      trial_end: '2025-10-01T23:59:59Z'
    }
  };

  const deviceInfo = knownDevices[deviceHash];

  if (deviceInfo) {
    return {
      is_registered: true,
      status: deviceInfo.status,
      subscription_end: deviceInfo.subscription_end,
      trial_end: deviceInfo.trial_end
    };
  }

  // 未登録デバイス
  return {
    is_registered: false,
    status: 'unregistered',
    subscription_end: null,
    trial_end: null
  };
}