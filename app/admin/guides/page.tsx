'use client';

import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Edit, Trash2, Plus, Save, X, Youtube, FileText, Eye, EyeOff } from 'lucide-react';

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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">ガイド管理</h1>

      {message && (
        <div className={`mb-4 p-4 rounded-md ${
          message.includes('失敗') || message.includes('エラー')
            ? 'bg-red-100 text-red-700'
            : 'bg-green-100 text-green-700'
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
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          新しいガイドを追加
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {editingGuide ? 'ガイドを編集' : '新しいガイドを作成'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  カテゴリー
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ガイドの簡単な説明"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  YouTube URL
                </label>
                <div className="flex items-center gap-2">
                  <Youtube className="w-5 h-5 text-red-600" />
                  <input
                    type="url"
                    value={formData.youtube_url}
                    onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  YouTube動画のURLを入力すると、ガイドページに埋め込み表示されます
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  コンテンツ（マークダウン形式）
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={10}
                  placeholder="# 見出し&#10;&#10;テキスト内容...&#10;&#10;- リスト項目1&#10;- リスト項目2"
                />
                <p className="text-xs text-gray-500 mt-1">
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
                  <span className="text-sm font-medium text-gray-700">公開する</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
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
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                順序
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                タイトル
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                カテゴリー
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                動画
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状態
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {guides.map((guide, index) => (
              <tr key={guide.id} className={!guide.is_active ? 'opacity-50' : ''}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleReorder(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleReorder(index, 'down')}
                      disabled={index === guides.length - 1}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <span className="ml-2 text-sm text-gray-600">{guide.order_index}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{guide.title}</div>
                    {guide.description && (
                      <div className="text-sm text-gray-500">{guide.description}</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                    {categories.find(c => c.value === guide.category)?.label || guide.category}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {guide.youtube_url ? (
                    <Youtube className="w-5 h-5 text-red-600" />
                  ) : (
                    <FileText className="w-5 h-5 text-gray-400" />
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={() => toggleActive(guide)}
                    className="flex items-center gap-1 text-sm"
                  >
                    {guide.is_active ? (
                      <>
                        <Eye className="w-4 h-4 text-green-600" />
                        <span className="text-green-600">公開中</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400">非公開</span>
                      </>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(guide)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(guide.id)}
                      className="text-red-600 hover:text-red-800"
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
          <div className="text-center py-8 text-gray-500">
            まだガイドが登録されていません
          </div>
        )}
      </div>
    </div>
  );
}