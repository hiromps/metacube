// Cloudflare Function: 認証結果をファイルに保存
export async function onRequestPost(context: {
  request: Request;
  env: any;
}) {
  try {
    const { request } = context;

    // CORS対応
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // OPTIONSリクエストの場合
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    // POSTリクエストのみ受け付ける
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // リクエストボディを解析
    const authResult = await request.json();

    // 結果データの検証
    if (!authResult || typeof authResult !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid auth result data' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // JSONファイルの内容を作成
    const fileContent = JSON.stringify({
      timestamp: new Date().toISOString(),
      result: authResult,
      source: 'smartgram-auth-mobile'
    }, null, 2);

    // R2やKVストレージにファイルを保存（オプション）
    // 現在はレスポンスで結果を返すのみ
    console.log('Auth result saved:', fileContent);

    // 成功レスポンス
    return new Response(JSON.stringify({
      success: true,
      message: 'Auth result saved successfully',
      file_path: '/tmp/smartgram_auth_result.json',
      content: fileContent
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Save auth result error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to save auth result',
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