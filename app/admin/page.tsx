'use client';

import { useState, useEffect } from 'react';

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('smartgram-admin-2024');
  const [userId, setUserId] = useState('');
  const [newDeviceHash, setNewDeviceHash] = useState('FFMZ3GTSJC6J');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  // File upload states
  const [uploadUserId, setUploadUserId] = useState('');
  const [uploadDeviceHash, setUploadDeviceHash] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  // Guides management states
  const [guides, setGuides] = useState<any[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [editingGuide, setEditingGuide] = useState<any>(null);
  const [guideForm, setGuideForm] = useState({
    title: '',
    slug: '',
    description: '',
    content: '',
    requires_access: false,
    sort_order: 0,
    is_published: true
  });
  const [showGuideEditor, setShowGuideEditor] = useState(false);

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
          new_device_hash: newDeviceHash,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage(`✅ Device hash updated successfully for user ${userId}`);
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const createTestData = async () => {
    if (!adminKey) {
      setMessage('Please enter admin key');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/create-test-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_key: adminKey,
          device_hash: 'FFMZ3GTSJC6J',
          trial_days: 3,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage(`✅ Test user created successfully. User ID: ${result.user_id}`);
        setUserId(result.user_id);
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const listUsers = async () => {
    if (!adminKey) {
      setMessage('Please enter admin key');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/list-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_key: adminKey,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setUsers(result.users);
        setMessage(`✅ Found ${result.users.length} users`);
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const uploadPackage = async () => {
    if (!adminKey || !uploadUserId || !uploadDeviceHash || !uploadFile) {
      setMessage('Please fill all required fields for file upload');
      return;
    }

    setUploadLoading(true);
    setMessage('');

    try {
      // ファイルをbase64に変換
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
        setMessage(`✅ Package uploaded successfully! Package ID: ${result.package_id}, Version: ${result.version}`);
        // Reset upload form
        setUploadUserId('');
        setUploadDeviceHash('');
        setUploadFile(null);
        setUploadNotes('');
        // Clear file input
        const fileInput = document.getElementById('packageFile') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setMessage(`❌ Upload Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadLoading(false);
    }
  };

  // Guides management functions
  const loadGuides = async () => {
    if (!adminKey) {
      setMessage('Please enter admin key');
      return;
    }

    setGuidesLoading(true);
    try {
      const response = await fetch('/api/admin/guides/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_key: adminKey,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setGuides(result.guides);
        setMessage(`✅ Loaded ${result.guides.length} guides`);
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGuidesLoading(false);
    }
  };

  const saveGuide = async () => {
    if (!adminKey) {
      setMessage('Please enter admin key');
      return;
    }

    if (!guideForm.title || !guideForm.slug || !guideForm.content) {
      setMessage('Please fill required fields (title, slug, content)');
      return;
    }

    setGuidesLoading(true);
    try {
      const endpoint = editingGuide ? '/api/admin/guides/update' : '/api/admin/guides/create';
      const payload = editingGuide
        ? { admin_key: adminKey, id: editingGuide.id, ...guideForm }
        : { admin_key: adminKey, ...guideForm };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (result.success) {
        setMessage(`✅ Guide ${editingGuide ? 'updated' : 'created'} successfully`);
        resetGuideForm();
        loadGuides(); // Reload guides list
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGuidesLoading(false);
    }
  };

  const deleteGuide = async (guideId: string) => {
    if (!adminKey) {
      setMessage('Please enter admin key');
      return;
    }

    if (!confirm('Are you sure you want to delete this guide?')) {
      return;
    }

    setGuidesLoading(true);
    try {
      const response = await fetch('/api/admin/guides/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_key: adminKey,
          id: guideId,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setMessage(`✅ Guide deleted successfully`);
        loadGuides(); // Reload guides list
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGuidesLoading(false);
    }
  };

  const editGuide = (guide: any) => {
    setEditingGuide(guide);
    setGuideForm({
      title: guide.title,
      slug: guide.slug,
      description: guide.description || '',
      content: guide.content,
      requires_access: guide.requires_access,
      sort_order: guide.sort_order,
      is_published: guide.is_published
    });
    setShowGuideEditor(true);
  };

  const resetGuideForm = () => {
    setEditingGuide(null);
    setGuideForm({
      title: '',
      slug: '',
      description: '',
      content: '',
      requires_access: false,
      sort_order: 0,
      is_published: true
    });
    setShowGuideEditor(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Smartgram Admin Panel</h1>

        <div className="space-y-4">
          <div>
            <label htmlFor="adminKey" className="block text-sm font-medium text-gray-700 mb-1">
              Admin Key
            </label>
            <input
              type="password"
              id="adminKey"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter admin key"
            />
          </div>

          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <input
              type="text"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter user ID"
            />
          </div>

          <div>
            <label htmlFor="deviceHash" className="block text-sm font-medium text-gray-700 mb-1">
              New Device Hash
            </label>
            <input
              type="text"
              id="deviceHash"
              value={newDeviceHash}
              onChange={(e) => setNewDeviceHash(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter device hash"
            />
          </div>

          <div className="flex space-x-2">
            <button
              onClick={updateDeviceHash}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Updating...' : 'Update Hash'}
            </button>

            <button
              onClick={createTestData}
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>

            <button
              onClick={listUsers}
              disabled={loading}
              className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Loading...' : 'List Users'}
            </button>
          </div>

          {message && (
            <div className={`p-3 rounded-md ${
              message.includes('✅')
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div className="mt-6 text-sm text-gray-600">
            <h3 className="font-medium mb-2">Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Enter the admin key</li>
              <li>Either create a test user or update existing user&apos;s device hash</li>
              <li>For updating: Enter user ID and new device hash (default: FFMZ3GTSJC6J)</li>
              <li>For creating: Click &quot;Create Test User&quot; to generate test data</li>
            </ol>
          </div>

          {users.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium mb-3 text-gray-900">Current Users:</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {users.map((user, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded border text-sm">
                    <div className="font-mono text-xs text-blue-600 mb-1">
                      User ID: {user.user_id}
                    </div>
                    <div className="text-gray-700">
                      Device Hash: <span className="font-mono">{user.device_hash}</span>
                    </div>
                    <div className="text-gray-600 text-xs mt-1">
                      Status: {user.status} | Created: {new Date(user.created_at).toLocaleDateString()}
                    </div>
                    <button
                      onClick={() => {
                        setUserId(user.user_id);
                        setNewDeviceHash('FFMZ3GTSJC6J');
                      }}
                      className="mt-2 text-blue-600 hover:text-blue-800 text-xs underline"
                    >
                      Use this User ID
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>

        {/* File Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📦 Package Upload</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="uploadUserId" className="block text-sm font-medium text-gray-700 mb-1">
                  User ID *
                </label>
                <input
                  type="text"
                  id="uploadUserId"
                  value={uploadUserId}
                  onChange={(e) => setUploadUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter user ID"
                />
              </div>
              <div>
                <label htmlFor="uploadDeviceHash" className="block text-sm font-medium text-gray-700 mb-1">
                  Device Hash *
                </label>
                <input
                  type="text"
                  id="uploadDeviceHash"
                  value={uploadDeviceHash}
                  onChange={(e) => setUploadDeviceHash(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter device hash"
                />
              </div>
            </div>

            <div>
              <label htmlFor="packageFile" className="block text-sm font-medium text-gray-700 mb-1">
                Package File (.ate) *
              </label>
              <input
                type="file"
                id="packageFile"
                accept=".ate"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="uploadNotes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                id="uploadNotes"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Package description or version notes"
              />
            </div>

            {uploadFile && (
              <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Selected File:</strong> {uploadFile.name} ({(uploadFile.size / 1024).toFixed(2)} KB)
                </p>
              </div>
            )}

            <button
              onClick={uploadPackage}
              disabled={uploadLoading || !adminKey || !uploadUserId || !uploadDeviceHash || !uploadFile}
              className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadLoading ? 'Uploading...' : '📦 Upload Package'}
            </button>

            <div className="text-xs text-gray-600">
              <p className="mb-1"><strong>Instructions:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Upload .ate packages that users can download from their dashboard</li>
                <li>Each upload creates a new version and makes previous versions inactive</li>
                <li>Users will see the uploaded package as available for download</li>
                <li>File must be a valid .ate format</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Guides Management Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">📚 Guides Management</h2>
            <div className="space-x-2">
              <button
                onClick={loadGuides}
                disabled={guidesLoading || !adminKey}
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {guidesLoading ? 'Loading...' : 'Load Guides'}
              </button>
              <button
                onClick={() => setShowGuideEditor(true)}
                disabled={!adminKey}
                className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                + New Guide
              </button>
            </div>
          </div>

          {/* Guide Editor Modal */}
          {showGuideEditor && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">
                      {editingGuide ? 'Edit Guide' : 'Create New Guide'}
                    </h3>
                    <button
                      onClick={resetGuideForm}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={guideForm.title}
                        onChange={(e) => setGuideForm({...guideForm, title: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Guide title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Slug *
                      </label>
                      <input
                        type="text"
                        value={guideForm.slug}
                        onChange={(e) => setGuideForm({...guideForm, slug: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="URL slug (e.g., setup-guide)"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={guideForm.description}
                      onChange={(e) => setGuideForm({...guideForm, description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Brief description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Content * (Markdown supported)
                    </label>
                    <textarea
                      value={guideForm.content}
                      onChange={(e) => setGuideForm({...guideForm, content: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={15}
                      placeholder="Guide content in markdown format..."
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sort Order
                      </label>
                      <input
                        type="number"
                        value={guideForm.sort_order}
                        onChange={(e) => setGuideForm({...guideForm, sort_order: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={guideForm.requires_access}
                          onChange={(e) => setGuideForm({...guideForm, requires_access: e.target.checked})}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Requires Access</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={guideForm.is_published}
                          onChange={(e) => setGuideForm({...guideForm, is_published: e.target.checked})}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Published</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <button
                      onClick={saveGuide}
                      disabled={guidesLoading}
                      className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {guidesLoading ? 'Saving...' : (editingGuide ? 'Update' : 'Create')}
                    </button>
                    <button
                      onClick={resetGuideForm}
                      className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Guides List */}
          {guides.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">Current Guides:</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {guides.map((guide) => (
                  <div key={guide.id} className="bg-gray-50 p-4 rounded border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium text-gray-900">{guide.title}</h4>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            /{guide.slug}
                          </span>
                          {guide.requires_access && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              Access Required
                            </span>
                          )}
                          {!guide.is_published && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                              Draft
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{guide.description}</p>
                        <div className="text-xs text-gray-500">
                          Order: {guide.sort_order} |
                          Created: {new Date(guide.created_at).toLocaleDateString()} |
                          Updated: {new Date(guide.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => editGuide(guide)}
                          className="text-blue-600 hover:text-blue-800 text-sm underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteGuide(guide.id)}
                          className="text-red-600 hover:text-red-800 text-sm underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-600 mt-4">
            <p className="mb-1"><strong>Instructions:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Create and manage guide pages that appear on the /guides page</li>
              <li>Use Markdown formatting in the content field for rich text</li>
              <li>Set &quot;Requires Access&quot; to true for premium content</li>
              <li>Sort order determines the display order (lower numbers first)</li>
              <li>Unpublished guides are drafts and won&apos;t appear to users</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}