'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('smartgram-admin-2024');
  const [userId, setUserId] = useState('');
  const [newDeviceHash, setNewDeviceHash] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // File upload states
  const [uploadUserId, setUploadUserId] = useState('');
  const [uploadDeviceHash, setUploadDeviceHash] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  const updateDeviceHash = async () => {
    if (!adminKey || !userId || !newDeviceHash) {
      setMessage('Please fill all fields');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/update-device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_key: adminKey,
          user_id: userId,
          new_device_hash: newDeviceHash
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage(`✅ Successfully updated device hash for user ${userId}`);
        // Clear form
        setUserId('');
        setNewDeviceHash('');
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePackageUpload = async () => {
    if (!uploadUserId || !uploadDeviceHash || !uploadFile) {
      setMessage('Please fill all required fields');
      return;
    }

    setUploadLoading(true);
    setMessage('');

    try {
      // Convert file to base64
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          } else {
            reject(new Error('Failed to read file'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });

      const response = await fetch('/api/admin/upload-package', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_key: adminKey,
          user_id: uploadUserId,
          device_hash: uploadDeviceHash,
          file_name: uploadFile.name,
          file_content: fileContent,
          file_size: uploadFile.size,
          notes: uploadNotes || 'Admin uploaded package'
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage(`✅ Package uploaded successfully! Version: ${result.version}`);
        // Reset form
        setUploadUserId('');
        setUploadDeviceHash('');
        setUploadFile(null);
        setUploadNotes('');
      } else {
        setMessage(`❌ Upload Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadLoading(false);
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
              <Link href="/admin/user-management">
                <button className="px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                  ユーザー管理
                </button>
              </Link>
              <Link href="/admin/guides">
                <button className="px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                  ガイド管理
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
        <h1 className="text-3xl font-bold text-white mb-8">管理者ダッシュボード</h1>

        {message && (
          <div className="bg-green-500/20 border border-green-400/30 text-green-300 px-4 py-3 rounded-lg backdrop-blur-sm mb-4">
            {message}
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link href="/admin/user-management">
            <div className="bg-gradient-to-br from-blue-800/30 via-blue-700/20 to-blue-800/30 backdrop-blur-xl border border-blue-400/30 p-6 rounded-2xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer">
              <h3 className="text-xl font-semibold text-white mb-2">👥 ユーザー管理</h3>
              <p className="text-gray-300">ユーザー情報の閲覧、プラン変更</p>
            </div>
          </Link>
          <Link href="/admin/guides">
            <div className="bg-gradient-to-br from-purple-800/30 via-purple-700/20 to-purple-800/30 backdrop-blur-xl border border-purple-400/30 p-6 rounded-2xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 transition-all cursor-pointer">
              <h3 className="text-xl font-semibold text-white mb-2">📚 ガイド管理</h3>
              <p className="text-gray-300">ガイドコンテンツの作成、編集</p>
            </div>
          </Link>
          <Link href="/dashboard">
            <div className="bg-gradient-to-br from-green-800/30 via-green-700/20 to-green-800/30 backdrop-blur-xl border border-green-400/30 p-6 rounded-2xl shadow-lg shadow-green-500/10 hover:shadow-green-500/20 transition-all cursor-pointer">
              <h3 className="text-xl font-semibold text-white mb-2">📈 ダッシュボード</h3>
              <p className="text-gray-300">通常のユーザービュー</p>
            </div>
          </Link>
        </div>

        {/* Update Device Hash Section */}
        <div className="bg-gradient-to-br from-slate-800/50 via-gray-800/30 to-slate-800/50 backdrop-blur-xl border border-slate-400/30 p-6 rounded-2xl shadow-lg shadow-slate-500/10 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">デバイスハッシュ更新</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-300 mb-2">
                User ID (UUID)
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
              />
            </div>

            <div>
              <label htmlFor="newDeviceHash" className="block text-sm font-medium text-gray-300 mb-2">
                New Device Hash
              </label>
              <input
                type="text"
                id="newDeviceHash"
                value={newDeviceHash}
                onChange={(e) => setNewDeviceHash(e.target.value)}
                className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., ABC123XYZ456"
              />
            </div>

            <button
              onClick={updateDeviceHash}
              disabled={loading}
              className={`w-full py-2 px-4 rounded-lg text-white font-medium transition-all ${
                loading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
              } border border-white/20`}
            >
              {loading ? '更新中...' : 'デバイスハッシュを更新'}
            </button>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="bg-gradient-to-br from-slate-800/50 via-gray-800/30 to-slate-800/50 backdrop-blur-xl border border-slate-400/30 p-6 rounded-2xl shadow-lg shadow-slate-500/10 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">ユーザーパッケージアップロード</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="uploadUserId" className="block text-sm font-medium text-gray-300 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  id="uploadUserId"
                  value={uploadUserId}
                  onChange={(e) => setUploadUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="User UUID"
                />
              </div>

              <div>
                <label htmlFor="uploadDeviceHash" className="block text-sm font-medium text-gray-300 mb-2">
                  Device Hash
                </label>
                <input
                  type="text"
                  id="uploadDeviceHash"
                  value={uploadDeviceHash}
                  onChange={(e) => setUploadDeviceHash(e.target.value)}
                  className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Device Hash"
                />
              </div>
            </div>

            <div>
              <label htmlFor="uploadFile" className="block text-sm font-medium text-gray-300 mb-2">
                Package File (.zip)
              </label>
              <input
                type="file"
                id="uploadFile"
                accept=".zip"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="uploadNotes" className="block text-sm font-medium text-gray-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                id="uploadNotes"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Any notes about this package..."
              />
            </div>

            <button
              onClick={handlePackageUpload}
              disabled={uploadLoading || !uploadFile}
              className={`w-full py-2 px-4 rounded-lg text-white font-medium transition-all ${
                uploadLoading || !uploadFile
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
              } border border-white/20`}
            >
              {uploadLoading ? 'アップロード中...' : 'パッケージをアップロード'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}