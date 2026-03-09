import { useState } from 'react';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, Calendar, Activity } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string;
  requests: number;
  status: 'active' | 'revoked';
}

export default function ApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: 'key-1',
      name: 'Production API Key',
      key: 'ag_prod_1234567890abcdef',
      createdAt: '2024-01-15',
      lastUsed: '2024-03-08T10:30:00',
      requests: 1250000,
      status: 'active',
    },
    {
      id: 'key-2',
      name: 'Development API Key',
      key: 'ag_dev_abcdef1234567890',
      createdAt: '2024-02-01',
      lastUsed: '2024-03-07T15:20:00',
      requests: 45000,
      status: 'active',
    },
    {
      id: 'key-3',
      name: 'Testing API Key',
      key: 'ag_test_xyz9876543210',
      createdAt: '2024-01-20',
      lastUsed: '2024-02-15T09:10:00',
      requests: 8500,
      status: 'revoked',
    },
  ]);

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('API key copied to clipboard!');
  };

  const maskKey = (key: string) => {
    return key.substring(0, 8) + '••••••••••••••••' + key.substring(key.length - 4);
  };

  const createApiKey = () => {
    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: newKeyName,
      key: `ag_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
      requests: 0,
      status: 'active',
    };
    setApiKeys([...apiKeys, newKey]);
    setNewKeyName('');
    setShowCreateModal(false);
  };

  const revokeKey = (keyId: string) => {
    if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      setApiKeys(apiKeys.map(key => 
        key.id === keyId ? { ...key, status: 'revoked' as const } : key
      ));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-600 mt-1">Manage your API keys for authentication</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Create API Key
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Keys</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{apiKeys.length}</p>
            </div>
            <Key className="w-12 h-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Keys</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {apiKeys.filter(k => k.status === 'active').length}
              </p>
            </div>
            <Activity className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {(apiKeys.reduce((sum, k) => sum + k.requests, 0) / 1000000).toFixed(2)}M
              </p>
            </div>
            <Activity className="w-12 h-12 text-purple-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.map((apiKey) => (
          <div key={apiKey.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{apiKey.name}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    apiKey.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {apiKey.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Created: {new Date(apiKey.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-4 h-4" />
                    Last used: {apiKey.lastUsed === 'Never' ? 'Never' : new Date(apiKey.lastUsed).toLocaleString()}
                  </div>
                  <div>
                    Requests: {apiKey.requests.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 font-mono text-sm">
                {showKeys[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
              </div>
              <button
                onClick={() => toggleKeyVisibility(apiKey.id)}
                className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                title={showKeys[apiKey.id] ? 'Hide key' : 'Show key'}
              >
                {showKeys[apiKey.id] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              <button
                onClick={() => copyToClipboard(apiKey.key)}
                className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                title="Copy to clipboard"
              >
                <Copy className="w-5 h-5" />
              </button>
              {apiKey.status === 'active' && (
                <button
                  onClick={() => revokeKey(apiKey.id)}
                  className="p-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  title="Revoke key"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Create New API Key</h2>
              <p className="text-gray-600 mt-1">Give your API key a descriptive name</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Production API Key"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Make sure to copy your API key now. You won't be able to see it again!
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewKeyName('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createApiKey}
                  disabled={!newKeyName.trim()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
