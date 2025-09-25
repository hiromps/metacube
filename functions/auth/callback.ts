import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bsujceqmhvpltedjkvum.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzdWpjZXFtaHZwbHRlZGprdnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY3MTg0NDcsImV4cCI6MjA0MjI5NDQ0N30.eOjI7gqPHBIE7aWO1UfO4g3bxgNLZBBB_3xWLc8FU9M';

export async function onRequestGET(context: any) {
  const { request } = context;
  const url = new URL(request.url);

  // URLからcodeとstateパラメータを取得
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return new Response('Missing authorization code', {
      status: 400,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  try {
    // Supabaseクライアントを作成
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // コードを使ってセッションを交換
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error);
      return Response.redirect(`${url.origin}/login?error=auth_callback_error`);
    }

    if (data.session) {
      // 認証成功 - ダッシュボードにリダイレクト
      const response = Response.redirect(`${url.origin}/dashboard`);

      // セッションをクッキーに設定
      const maxAge = 100 * 365 * 24 * 60 * 60; // ~100 years
      response.headers.set(
        'Set-Cookie',
        `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
      );
      response.headers.set(
        'Set-Cookie',
        `sb-refresh-token=${data.session.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
      );

      return response;
    }
  } catch (error) {
    console.error('Auth callback exception:', error);
    return Response.redirect(`${url.origin}/login?error=server_error`);
  }

  return Response.redirect(`${url.origin}/login?error=unknown_error`);
}