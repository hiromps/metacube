import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabaseClient(env: any) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// YouTube URL からVideo IDを抽出
function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// ガイド一覧取得
export async function handleGuidesListInternal(request: Request, env: any) {
  try {
    const supabase = getSupabaseClient(env);
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    let query = supabase
      .from('guides')
      .select('*')
      .order('order_index', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching guides:', error);
      return new Response(JSON.stringify({ error: 'ガイドの取得に失敗しました' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({ guides: data || [] }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error in handleGuidesListInternal:', error);
    return new Response(JSON.stringify({ error: '内部エラーが発生しました' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// ガイド作成
export async function handleGuideCreateInternal(request: Request, env: any) {
  try {
    const supabase = getSupabaseClient(env);
    const guideData = await request.json();

    // 管理者認証チェック
    if (guideData.admin_key !== 'smartgram-admin-2024') {
      return new Response(JSON.stringify({ error: '無効な管理者キー' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // YouTube URLからVideo IDを抽出
    const videoId = extractYouTubeVideoId(guideData.youtube_url);

    // 新しいorder_indexを計算
    const { data: maxOrderData } = await supabase
      .from('guides')
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1)
      .single();

    const nextOrderIndex = maxOrderData ? maxOrderData.order_index + 1 : 1;

    // ガイドを作成
    const { data, error } = await supabase
      .from('guides')
      .insert({
        title: guideData.title,
        description: guideData.description,
        youtube_url: guideData.youtube_url,
        video_id: videoId,
        content: guideData.content,
        category: guideData.category || 'beginner',
        order_index: nextOrderIndex,
        is_active: guideData.is_active !== false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating guide:', error);
      return new Response(JSON.stringify({ error: 'ガイドの作成に失敗しました' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({ success: true, guide: data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error in handleGuideCreateInternal:', error);
    return new Response(JSON.stringify({ error: '内部エラーが発生しました' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// ガイド更新
export async function handleGuideUpdateInternal(request: Request, env: any, guideId: string) {
  try {
    const supabase = getSupabaseClient(env);
    const updateData = await request.json();

    // 管理者認証チェック
    if (updateData.admin_key !== 'smartgram-admin-2024') {
      return new Response(JSON.stringify({ error: '無効な管理者キー' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // YouTube URLからVideo IDを抽出
    const videoId = extractYouTubeVideoId(updateData.youtube_url);

    // ガイドを更新
    const { data, error } = await supabase
      .from('guides')
      .update({
        title: updateData.title,
        description: updateData.description,
        youtube_url: updateData.youtube_url,
        video_id: videoId,
        content: updateData.content,
        category: updateData.category,
        order_index: updateData.order_index,
        is_active: updateData.is_active
      })
      .eq('id', guideId)
      .select()
      .single();

    if (error) {
      console.error('Error updating guide:', error);
      return new Response(JSON.stringify({ error: 'ガイドの更新に失敗しました' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({ success: true, guide: data }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error in handleGuideUpdateInternal:', error);
    return new Response(JSON.stringify({ error: '内部エラーが発生しました' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// ガイド削除
export async function handleGuideDeleteInternal(request: Request, env: any, guideId: string) {
  try {
    const supabase = getSupabaseClient(env);
    const { admin_key } = await request.json();

    // 管理者認証チェック
    if (admin_key !== 'smartgram-admin-2024') {
      return new Response(JSON.stringify({ error: '無効な管理者キー' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // ガイドを削除
    const { error } = await supabase
      .from('guides')
      .delete()
      .eq('id', guideId);

    if (error) {
      console.error('Error deleting guide:', error);
      return new Response(JSON.stringify({ error: 'ガイドの削除に失敗しました' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error in handleGuideDeleteInternal:', error);
    return new Response(JSON.stringify({ error: '内部エラーが発生しました' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// ガイドの順序変更
export async function handleGuideReorderInternal(request: Request, env: any) {
  try {
    const supabase = getSupabaseClient(env);
    const { admin_key, guides } = await request.json();

    // 管理者認証チェック
    if (admin_key !== 'smartgram-admin-2024') {
      return new Response(JSON.stringify({ error: '無効な管理者キー' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 各ガイドの順序を更新
    const updatePromises = guides.map((guide: { id: string; order_index: number }) =>
      supabase
        .from('guides')
        .update({ order_index: guide.order_index })
        .eq('id', guide.id)
    );

    const results = await Promise.all(updatePromises);
    const hasError = results.some(result => result.error);

    if (hasError) {
      return new Response(JSON.stringify({ error: 'ガイドの順序変更に失敗しました' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error in handleGuideReorderInternal:', error);
    return new Response(JSON.stringify({ error: '内部エラーが発生しました' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}