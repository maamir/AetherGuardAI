import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, TestTube, CheckCircle, XCircle, Server } from 'lucide-react';
import { api } from '../services/api';
import ProviderStats from '../components/ProviderStats';

interface LLMProvider {
  id: string;
  providerName: string;
  providerType: string;
  providerUrl: string;
  modelName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const PROVIDER_TYPES = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'azure_openai', label: 'Azure OpenAI' },
  { value: 'aws_bedrock', label: 'AWS Bedrock' },
  { value: 'google_palm', label: 'Google PaLM' },
  { value: 'huggingface', label: 'Hugging Face' },
  { value: 'custom', label: 'Custom' },
];

export default function LLMProviders() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [formData, setFormData] = useState({
    providerName: '',
    providerType: 'openai',
    providerUrl: '',
    modelName: '',
    apiKey: '',
  });

  // Fetch LLM providers
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: () => api.getLLMProviders(),
  });

  // Create provider mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.createLLMProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
      closeModal();
    },
    onError: (error: any) => {
      alert(`Error creating provider: ${error.message}`);
    },
  });

  // Update provider mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.updateLLMProvider(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
      closeModal();
    },
    onError: (error: any) => {
      alert(`Error updating provider: ${error.message}`);
    },
  });

  // Delete provider mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteLLMProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
    },
    onError: (error: any) => {
      alert(`Error deleting provider: ${error.message}`);
    },
  });

  // Test provider mutation
  const testMutation = useMutation({
    mutationFn: (id: string) => api.testLLMProvider(id),
    onSuccess: () => {
      alert('Provider test successful!');
    },
    onError: (error: any) => {
      alert(`Provider test failed: ${error.message}`);
    },
  });

  const openCreateModal = () => {
    setEditingProvider(null);
    setFormData({
      providerName: '',
      providerType: 'openai',
      providerUrl: '',
      modelName: '',
      apiKey: '',
    });
    setShowModal(true);
  };

  const openEditModal = (provider: LLMProvider) => {
    setEditingProvider(provider);
    setFormData({
      providerName: provider.providerName,
      providerType: provider.providerType,
      providerUrl: provider.providerUrl,
      modelName: provider.modelName,
      apiKey: '', // Don't pre-fill API key for security
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProvider(null);
    setFormData({
      providerName: '',
      providerType: 'openai',
      providerUrl: '',
      modelName: '',
      apiKey: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.providerName || !formData.providerType || !formData.modelName) {
      alert('Please fill in all required fields');
      return;
    }

    const submitData = { ...formData };
    if (!submitData.apiKey) {
      delete submitData.apiKey; // Don't send empty API key
    }

    if (editingProvider) {
      updateMutation.mutate({ id: editingProvider.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const deleteProvider = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
          LLM Providers
        </h1>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#94a3b8' }}>Loading providers...</p>
        </div>
      </div>
    );
  }

  const activeProviders = providers.filter((p: LLMProvider) => p.is_active);

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            LLM Providers
          </h1>
          <p style={{ color: '#64748b' }}>
            Configure and manage your LLM provider connections
          </p>
        </div>
        <button
          onClick={openCreateModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#3b82f6',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={20} />
          Add Provider
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
      }}>
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Total Providers</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                {providers.length}
              </p>
            </div>
            <Server size={32} color="#60a5fa" style={{ opacity: 0.3 }} />
          </div>
        </div>

        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Active</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                {activeProviders.length}
              </p>
            </div>
            <CheckCircle size={32} color="#34d399" style={{ opacity: 0.3 }} />
          </div>
        </div>

        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Provider Types</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                {new Set(providers.map((p: LLMProvider) => p.provider_type)).size}
              </p>
            </div>
            <Server size={32} color="#fbbf24" style={{ opacity: 0.3 }} />
          </div>
        </div>
      </div>

      {/* Providers List */}
      {providers.length === 0 ? (
        <div style={{
          background: '#1e293b',
          padding: '3rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          textAlign: 'center',
        }}>
          <Server size={48} color="#60a5fa" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            No LLM Providers
          </h3>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
            Add your first LLM provider to get started
          </p>
          <button
            onClick={openCreateModal}
            style={{
              background: '#3b82f6',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Add Provider
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {providers.map((provider: LLMProvider) => (
            <div
              key={provider.id}
              style={{
                background: '#1e293b',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                border: '1px solid #334155',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
                      {provider.providerName}
                    </h3>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      borderRadius: '0.25rem',
                      background: provider.isActive ? '#10b98120' : '#64748b20',
                      color: provider.isActive ? '#10b981' : '#64748b',
                    }}>
                      {provider.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      borderRadius: '0.25rem',
                      background: '#60a5fa20',
                      color: '#60a5fa',
                      textTransform: 'capitalize',
                    }}>
                      {provider.providerType.replace('_', ' ')}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Model</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: '500' }}>{provider.modelName}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Endpoint</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: '500', fontFamily: 'monospace' }}>
                        {provider.providerUrl || 'Default'}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Created</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: '500' }}>
                        {new Date(provider.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                  <button
                    onClick={() => testMutation.mutate(provider.id)}
                    disabled={testMutation.isPending}
                    style={{
                      padding: '0.5rem',
                      background: '#10b981',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Test connection"
                  >
                    <TestTube size={16} color="white" />
                  </button>
                  <button
                    onClick={() => openEditModal(provider)}
                    style={{
                      padding: '0.5rem',
                      background: '#3b82f6',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Edit provider"
                  >
                    <Edit size={16} color="white" />
                  </button>
                  <button
                    onClick={() => deleteProvider(provider.id, provider.providerName)}
                    disabled={deleteMutation.isPending}
                    style={{
                      padding: '0.5rem',
                      background: '#ef4444',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Delete provider"
                  >
                    <Trash2 size={16} color="white" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          zIndex: 50,
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: '0.75rem',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid #334155',
            }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                {editingProvider ? 'Edit Provider' : 'Add New Provider'}
              </h2>
              <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>
                Configure your LLM provider connection
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>
                    Provider Name *
                  </label>
                  <input
                    type="text"
                    value={formData.providerName}
                    onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                      color: '#e2e8f0',
                    }}
                    placeholder="e.g., OpenAI GPT-4"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>
                    Provider Type *
                  </label>
                  <select
                    value={formData.providerType}
                    onChange={(e) => setFormData({ ...formData, providerType: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                      color: '#e2e8f0',
                    }}
                  >
                    {PROVIDER_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>
                    Model Name *
                  </label>
                  <input
                    type="text"
                    value={formData.modelName}
                    onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                      color: '#e2e8f0',
                    }}
                    placeholder="e.g., gpt-4, claude-3-opus"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>
                    API Endpoint
                  </label>
                  <input
                    type="url"
                    value={formData.providerUrl}
                    onChange={(e) => setFormData({ ...formData, providerUrl: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                      color: '#e2e8f0',
                    }}
                    placeholder="Leave empty for default endpoint"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>
                    API Key {editingProvider ? '(leave empty to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                      color: '#e2e8f0',
                    }}
                    placeholder="Your API key"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#64748b',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#3b82f6',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingProvider
                    ? 'Update Provider'
                    : 'Create Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}