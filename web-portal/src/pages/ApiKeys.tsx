import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Copy, Trash2, Eye, EyeOff, Calendar, Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import IpWhitelist from '../components/IpWhitelist';
import UsageAlerts from '../components/UsageAlerts';
import ExpirationManager from '../components/ExpirationManager';

interface ApiKey {
  id: string;
  name: string;
  keyDisplay?: string;  // Masked key for display (e.g., "ag_xxxx****yyyy")
  key?: string;  // Full key (only returned on creation)
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string | null;
  isActive: boolean;
  usageCount: number;
  rateLimit: number | null;
  ipWhitelist?: string[];
  usageAlerts?: Array<{ threshold: number; channel: string; destination: string }>;
}

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRateLimit, setNewKeyRateLimit] = useState('');
  const [newKeyExpiresAt, setNewKeyExpiresAt] = useState<string | null>(null);
  const [newKeyIpWhitelist, setNewKeyIpWhitelist] = useState<string[]>([]);
  const [newKeyUsageAlerts, setNewKeyUsageAlerts] = useState<Array<{ threshold: number; channel: string; destination: string }>>([]);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{key: string; name: string} | null>(null);

  // Fetch API keys
  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.getApiKeys(),
  });

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.createApiKey(data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setShowCreateModal(false);
      setNewKeyName('');
      setNewKeyRateLimit('');
      setNewKeyExpiresAt(null);
      setNewKeyIpWhitelist([]);
      setNewKeyUsageAlerts([]);
      
      // Show the newly created key in a modal
      if (response.key) {
        setNewlyCreatedKey({ key: response.key, name: response.name });
      }
    },
    onError: (error: any) => {
      alert(`Error creating API key: ${error.message}`);
    },
  });

  // Revoke API key mutation
  const revokeMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => 
      api.revokeApiKey(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error: any) => {
      alert(`Error revoking API key: ${error.message}`);
    },
  });

  // Rotate API key mutation
  const rotateMutation = useMutation({
    mutationFn: (id: string) => api.rotateApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      alert('API key rotated successfully! Make sure to copy the new key.');
    },
    onError: (error: any) => {
      alert(`Error rotating API key: ${error.message}`);
    },
  });

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const copyToClipboard = (text: string) => {
    if (!text || text.includes('••••') || text.includes('****')) {
      alert('Full API key is not available. Keys can only be copied once during creation.');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      alert('API key copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy to clipboard');
    });
  };

  const maskKey = (key: string | undefined) => {
    if (!key || key.length <= 12) return '••••••••••••••••';
    return key.substring(0, 8) + '••••••••••••••••' + key.substring(key.length - 4);
  };

  const createApiKey = () => {
    if (!newKeyName.trim()) {
      alert('Please enter a key name');
      return;
    }

    const data: any = { name: newKeyName };
    if (newKeyRateLimit) {
      data.rateLimit = parseInt(newKeyRateLimit);
    }
    if (newKeyExpiresAt) {
      data.expiresInDays = Math.ceil((new Date(newKeyExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }
    if (newKeyIpWhitelist.length > 0) {
      data.ipWhitelist = newKeyIpWhitelist;
    }
    if (newKeyUsageAlerts.length > 0) {
      data.usageAlerts = newKeyUsageAlerts;
    }

    createMutation.mutate(data);
  };

  const revokeKey = (keyId: string) => {
    if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      revokeMutation.mutate({ id: keyId, reason: 'Revoked by user' });
    }
  };

  const rotateKey = (keyId: string) => {
    if (confirm('Are you sure you want to rotate this API key? The old key will be invalidated.')) {
      rotateMutation.mutate(keyId);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">API Keys</h1>
        <div className="text-center py-12">
          <p className="text-gray-600">Loading API keys...</p>
        </div>
      </div>
    );
  }

  const activeKeys = apiKeys.filter((k: ApiKey) => k.isActive);
  const totalRequests = apiKeys.reduce((sum: number, k: ApiKey) => sum + (k.usageCount || 0), 0);

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
              <p className="text-3xl font-bold text-gray-900 mt-1">{activeKeys.length}</p>
            </div>
            <Activity className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {totalRequests >= 1000000 
                  ? `${(totalRequests / 1000000).toFixed(2)}M`
                  : totalRequests.toLocaleString()}
              </p>
            </div>
            <Activity className="w-12 h-12 text-purple-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Key className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No API Keys Yet</h3>
          <p className="text-gray-600 mb-6">Create your first API key to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Create API Key
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((apiKey: ApiKey) => (
            <div key={apiKey.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{apiKey.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      apiKey.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {apiKey.isActive ? 'active' : 'revoked'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Created: {new Date(apiKey.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="w-4 h-4" />
                      Last used: {apiKey.lastUsed 
                        ? new Date(apiKey.lastUsed).toLocaleString() 
                        : 'Never'}
                    </div>
                    <div>
                      Requests: {(apiKey.usageCount || 0).toLocaleString()}
                    </div>
                    {apiKey.rateLimit && (
                      <div>
                        Rate limit: {apiKey.rateLimit}/min
                      </div>
                    )}
                    {apiKey.expiresAt && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                        new Date(apiKey.expiresAt) < new Date() 
                          ? 'bg-red-100 text-red-800'
                          : new Date(apiKey.expiresAt).getTime() - new Date().getTime() < 7 * 24 * 60 * 60 * 1000
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        <Calendar className="w-4 h-4" />
                        Expires: {new Date(apiKey.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                    {apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0 && (
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                        🔒 {apiKey.ipWhitelist.length} IP(s) whitelisted
                      </div>
                    )}
                    {apiKey.usageAlerts && apiKey.usageAlerts.length > 0 && (
                      <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                        🔔 {apiKey.usageAlerts.length} alert(s) configured
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 font-mono text-sm">
                  {apiKey.key ? (
                    // Full key available (newly created)
                    showKeys[apiKey.id] ? apiKey.key : maskKey(apiKey.key)
                  ) : (
                    // Only masked version available (existing key)
                    apiKey.keyDisplay || '••••••••••••••••'
                  )}
                </div>
                {apiKey.key ? (
                  // Show/hide toggle only for keys with full value
                  <button
                    onClick={() => toggleKeyVisibility(apiKey.id)}
                    className="p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                    title={showKeys[apiKey.id] ? 'Hide key' : 'Show key'}
                  >
                    {showKeys[apiKey.id] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                ) : (
                  // Disabled button for existing keys
                  <button
                    className="p-3 border border-gray-200 rounded-lg bg-gray-100 cursor-not-allowed opacity-50"
                    title="Full key not available (only shown once during creation)"
                    disabled
                  >
                    <Eye className="w-5 h-5 text-gray-400" />
                  </button>
                )}
                <button
                  onClick={() => copyToClipboard(apiKey.key || apiKey.keyDisplay || '')}
                  className={`p-3 border rounded-lg ${
                    apiKey.key 
                      ? 'border-gray-300 hover:bg-gray-50' 
                      : 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                  }`}
                  title={apiKey.key ? 'Copy to clipboard' : 'Full key not available'}
                  disabled={!apiKey.key}
                >
                  <Copy className={`w-5 h-5 ${apiKey.key ? '' : 'text-gray-400'}`} />
                </button>
                {apiKey.isActive && (
                  <>
                    <button
                      onClick={() => rotateKey(apiKey.id)}
                      className="p-3 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50"
                      title="Rotate key"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => revokeKey(apiKey.id)}
                      className="p-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                      title="Revoke key"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">Create New API Key</h2>
              <p className="text-gray-600 mt-1">Give your API key a descriptive name</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key Name *
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Production API Key"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rate Limit (requests/minute)
                </label>
                <input
                  type="number"
                  value={newKeyRateLimit}
                  onChange={(e) => setNewKeyRateLimit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional, e.g., 1000"
                />
              </div>

              {/* Expiration Manager */}
              <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem' }}>
                <ExpirationManager
                  expiresAt={newKeyExpiresAt}
                  onChange={setNewKeyExpiresAt}
                />
              </div>

              {/* IP Whitelist */}
              <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem' }}>
                <IpWhitelist
                  ips={newKeyIpWhitelist}
                  onChange={setNewKeyIpWhitelist}
                />
              </div>

              {/* Usage Alerts */}
              <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem' }}>
                <UsageAlerts
                  alerts={newKeyUsageAlerts}
                  onChange={setNewKeyUsageAlerts}
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
                    setNewKeyRateLimit('');
                    setNewKeyExpiresAt(null);
                    setNewKeyIpWhitelist([]);
                    setNewKeyUsageAlerts([]);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={createMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={createApiKey}
                  disabled={!newKeyName.trim() || createMutation.isPending}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Newly Created Key Modal */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Key className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">API Key Created Successfully!</h2>
                <p className="text-sm text-gray-600">Make sure to copy your API key now. You won't be able to see it again!</p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Important:</strong> This is the only time you'll see the full API key. 
                  Copy it now and store it securely. If you lose it, you'll need to create a new key.
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                <div className="bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  {newlyCreatedKey.name}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 font-mono text-sm break-all">
                    {newlyCreatedKey.key}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newlyCreatedKey.key).then(() => {
                        alert('API key copied to clipboard!');
                      });
                    }}
                    className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setNewlyCreatedKey(null)}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                I've Saved My Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
