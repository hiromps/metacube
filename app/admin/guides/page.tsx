'use client';

import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Edit, Trash2, Plus, Save, X, Youtube, FileText, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

interface Guide {
  id: string;
  title: string;
  description: string;
  youtube_url?: string;
  video_id?: string;
  content?: string;
  category: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminGuidesPage() {
  const [adminKey] = useState('smartgram-admin-2024');
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtube_url: '',
    content: '',
    category: 'beginner',
    is_active: true
  });

  const categories = [
    { value: 'beginner', label: '初心者向け' },
    { value: 'advanced', label: '上級者向け' },
    { value: 'troubleshooting', label: 'トラブルシューティング' },
    { value: 'features', label: '機能説明' }
  ];

  useEffect(() => {
    fetchGuides();
  }, []);

  const fetchGuides = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/guides/list?includeInactive=true');
      const data = await response.json();
      if (data.guides) {
        setGuides(data.guides.sort((a: Guide, b: Guide) => a.order_index - b.order_index));
      }
    } catch (error) {
      console.error('Error fetching guides:', error);
      setMessage('ガイド一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const url = editingGuide
        ? `/api/admin/guides/update/${editingGuide.id}`
        : '/api/admin/guides/create';

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          admin_key: adminKey,
          order_index: editingGuide?.order_index
        })
      });

      if (response.ok) {
        setMessage(editingGuide ? 'ガイドを更新しました' : 'ガイドを作成しました');
        setShowForm(false);
        setEditingGuide(null);
        setFormData({
          title: '',
          description: '',
          youtube_url: '',
          content: '',
          category: 'beginner',
          is_active: true
        });
        fetchGuides();
      } else {
        const error = await response.json();
        setMessage(error.error || '操作に失敗しました');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (guide: Guide) => {
    setEditingGuide(guide);
    setFormData({
      title: guide.title,
      description: guide.description || '',
      youtube_url: guide.youtube_url || '',
      content: guide.content || '',
      category: guide.category,
      is_active: guide.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (guideId: string) => {
    if (!confirm('このガイドを削除してもよろしいですか？')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/guides/delete/${guideId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_key: adminKey })
      });

      if (response.ok) {
        setMessage('ガイドを削除しました');
        fetchGuides();
      } else {
        const error = await response.json();
        setMessage(error.error || '削除に失敗しました');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    const newGuides = [...guides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= guides.length) return;

    // Swap order
    [newGuides[index], newGuides[targetIndex]] = [newGuides[targetIndex], newGuides[index]];

    // Update order_index
    const reorderedGuides = newGuides.map((guide, idx) => ({
      id: guide.id,
      order_index: idx + 1
    }));

    setGuides(newGuides);

    try {
      const response = await fetch('/api/admin/guides/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_key: adminKey,
          guides: reorderedGuides
        })
      });

      if (!response.ok) {
        setMessage('順序の変更に失敗しました');
        fetchGuides(); // Revert
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('エラーが発生しました');
      fetchGuides(); // Revert
    }
  };

  const toggleActive = async (guide: Guide) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/guides/update/${guide.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...guide,
          admin_key: adminKey,
          is_active: !guide.is_active
        })
      });

      if (response.ok) {
        fetchGuides();
      } else {
        setMessage('ステータスの変更に失敗しました');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900">
      {/* Navigation */}
      <nav className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link href="/">
              <div className="flex items-center space-x-1 md:space-x-2">
                <span className="text-lg md:text-2xl font-bold">
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">SMART</span>
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">GRAM</span>
                </span>
              </div>
            </Link>
            <div className="flex gap-3">
              <Link href="/admin">
                <button className="px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                  管理TOP
                </button>
              </Link>
              <Link href="/admin/user-management">
                <button className="px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                  ユーザー管理
                </button>
              </Link>
              <Link href="/dashboard">
                <button className="px-4 py-2 text-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all">
                  ダッシュボード
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-white">ガイド管理</h1>

      {message && (
        <div className={`mb-4 p-4 rounded-lg backdrop-blur-sm ${
          message.includes('失敗') || message.includes('エラー')
            ? 'bg-red-500/20 border border-red-400/30 text-red-300'
            : 'bg-green-500/20 border border-green-400/30 text-green-300'
        }`}>
          {message}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={() => {
            setShowForm(true);
            setEditingGuide(null);
            setFormData({
              title: '',
              description: '',
              youtube_url: '',
              content: '',
              category: 'beginner',
              is_active: true
            });
          }}
          className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all flex items-center gap-2 border border-white/20"
        >
          <Plus className="w-5 h-5" />
          新しいガイドを追加
        </button>
      </div>

      {showForm && (
        <div className="bg-gradient-to-br from-slate-800/50 via-gray-800/30 to-slate-800/50 backdrop-blur-xl border border-slate-400/30 p-6 rounded-2xl shadow-lg shadow-slate-500/10 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-white">
            {editingGuide ? 'ガイドを編集' : '新しいガイドを作成'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  タイトル <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  カテゴリー
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  説明
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="ガイドの簡単な説明"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  YouTube URL
                </label>
                <div className="flex items-center gap-2">
                  <Youtube className="w-5 h-5 text-red-400" />
                  <input
                    type="url"
                    value={formData.youtube_url}
                    onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                    className="flex-1 px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  YouTube動画のURLを入力すると、ガイドページに埋め込み表示されます
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  コンテンツ（マークダウン形式）
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={10}
                  placeholder="# 見出し&#10;&#10;テキスト内容...&#10;&#10;- リスト項目1&#10;- リスト項目2"
                />
                <p className="text-xs text-gray-400 mt-1">
                  マークダウン形式で記述できます（# 見出し、**太字**、- リストなど）
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-300">公開する</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 transition-all flex items-center gap-2 border border-white/20"
              >
                <Save className="w-4 h-4" />
                {editingGuide ? '更新' : '作成'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingGuide(null);
                }}
                className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20"
              >
                <X className="w-4 h-4" />
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-gradient-to-br from-slate-800/50 via-gray-800/30 to-slate-800/50 backdrop-blur-xl border border-slate-400/30 rounded-2xl shadow-lg shadow-slate-500/10 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-black/30 border-b border-white/10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                順序
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                タイトル
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                カテゴリー
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                動画
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                状態
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {guides.map((guide, index) => (
              <tr key={guide.id} className={!guide.is_active ? 'opacity-50' : ''}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleReorder(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-white/10 rounded disabled:opacity-30 text-white"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleReorder(index, 'down')}
                      disabled={index === guides.length - 1}
                      className="p-1 hover:bg-white/10 rounded disabled:opacity-30 text-white"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <span className="ml-2 text-sm text-gray-400">{guide.order_index}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-white">{guide.title}</div>
                    {guide.description && (
                      <div className="text-sm text-gray-400">{guide.description}</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs rounded-full bg-white/10 text-gray-300 border border-white/20">
                    {categories.find(c => c.value === guide.category)?.label || guide.category}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {guide.youtube_url ? (
                    <Youtube className="w-5 h-5 text-red-400" />
                  ) : (
                    <FileText className="w-5 h-5 text-gray-500" />
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={() => toggleActive(guide)}
                    className="flex items-center gap-1 text-sm"
                  >
                    {guide.is_active ? (
                      <>
                        <Eye className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">公開中</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-500">非公開</span>
                      </>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(guide)}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(guide.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {guides.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-400">
            まだガイドが登録されていません
          </div>
        )}
      </div>
      </div>
    </div>
  );
}