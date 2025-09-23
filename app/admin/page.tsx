'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [userId, setUserId] = useState('');
  const [newDeviceHash, setNewDeviceHash] = useState('FFMZ3GTSJC6J');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
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
    </div>
  );
}