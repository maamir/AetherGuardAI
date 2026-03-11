import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

interface Policy {
  id: string;
  category: string;
  feature_key: string;
  enabled: boolean;
  config: any;
  created_at: string;
  updated_at: string;
}

const POLICY_CATEGORIES = {
  'prompt_injection': 'Prompt Injection Protection',
  'toxicity': 'Toxicity Detection',
  'pii': 'PII Detection',
  'hallucination': 'Hallucination Detection',
  'bias': 'Bias Detection',
};

export default function Policies() {
  const queryClient = useQueryClient();
  const [editingPolicy, setEditingPolicy] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<any>({});

  // Fetch policies
  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['policies'],
    queryFn: () => api.getPolicies(),
  });

  // Update policy mutation
  const updateMutation = useMutation({
    mutationFn: ({ category, featureKey, data }: any) => 
      api.updatePolicy(category, featureKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      setEditingPolicy(null);
      setEditConfig({});
    },
    onError: (error: any) => {
      alert(`Error updating policy: ${error.message}`);
    },
  });

  // Group policies by category
  const groupedPolicies = policies.reduce((acc: any, policy: Policy) => {
    if (!acc[policy.category]) {
      acc[policy.category] = [];
    }
    acc[policy.category].push(policy);
    return acc;
  }, {});

  const startEditing = (policy: Policy) => {
    setEditingPolicy(policy.id);
    setEditConfig({
      enabled: policy.enabled,
      config: { ...policy.config },
    });
  };

  const cancelEditing = () => {
    setEditingPolicy(null);
    setEditConfig({});
  };

  const savePolicy = (policy: Policy) => {
    updateMutation.mutate({
      category: policy.category,
      featureKey: policy.feature_key,
      data: editConfig,
    });
  };

  const togglePolicy = (policy: Policy) => {
    updateMutation.mutate({
      category: policy.category,
      featureKey: policy.feature_key,
      data: {
        enabled: !policy.enabled,
        config: policy.config,
      },
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>
          Security Policies
        </h1>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: '#94a3b8' }}>Loading policies...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Security Policies
        </h1>
        <p style={{ color: '#64748b' }}>
          Configure security policies to protect your LLM applications
        </p>
      </div>

      {/* Summary */}
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
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Total Policies</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                {policies.length}
              </p>
            </div>
            <Shield size={32} color="#60a5fa" style={{ opacity: 0.3 }} />
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
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Enabled</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                {policies.filter((p: Policy) => p.enabled).length}
              </p>
            </div>
            <Shield size={32} color="#34d399" style={{ opacity: 0.3 }} />
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
              <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Categories</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
                {Object.keys(groupedPolicies).length}
              </p>
            </div>
            <Shield size={32} color="#fbbf24" style={{ opacity: 0.3 }} />
          </div>
        </div>
      </div>

      {/* Policies by Category */}
      {policies.length === 0 ? (
        <div style={{
          background: '#1e293b',
          padding: '3rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          textAlign: 'center',
        }}>
          <AlertTriangle size={48} color="#fbbf24" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            No Policies Configured
          </h3>
          <p style={{ color: '#94a3b8' }}>
            Policies will appear here once configured for your tenant
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.entries(groupedPolicies).map(([category, categoryPolicies]: [string, any]) => (
            <div
              key={category}
              style={{
                background: '#1e293b',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                border: '1px solid #334155',
              }}
            >
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                textTransform: 'capitalize',
              }}>
                {POLICY_CATEGORIES[category as keyof typeof POLICY_CATEGORIES] || category.replace(/_/g, ' ')}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {categoryPolicies.map((policy: Policy) => {
                  const isEditing = editingPolicy === policy.id;
                  const currentConfig = isEditing ? editConfig : { enabled: policy.enabled, config: policy.config };

                  return (
                    <div
                      key={policy.id}
                      style={{
                        background: '#0f172a',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        border: isEditing ? '1px solid #60a5fa' : '1px solid #1e293b',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>
                              {policy.feature_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h3>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              borderRadius: '0.25rem',
                              background: currentConfig.enabled ? '#10b98120' : '#ef444420',
                              color: currentConfig.enabled ? '#10b981' : '#ef4444',
                            }}>
                              {currentConfig.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>

                          {/* Config Display */}
                          {isEditing ? (
                            <div style={{ marginTop: '1rem' }}>
                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.75rem',
                                cursor: 'pointer',
                              }}>
                                <input
                                  type="checkbox"
                                  checked={currentConfig.enabled}
                                  onChange={(e) => setEditConfig({
                                    ...editConfig,
                                    enabled: e.target.checked,
                                  })}
                                  style={{ width: '1rem', height: '1rem' }}
                                />
                                <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Enable this policy</span>
                              </label>

                              <div style={{ marginTop: '0.75rem' }}>
                                <label style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>
                                  Configuration (JSON)
                                </label>
                                <textarea
                                  value={JSON.stringify(currentConfig.config, null, 2)}
                                  onChange={(e) => {
                                    try {
                                      const parsed = JSON.parse(e.target.value);
                                      setEditConfig({ ...editConfig, config: parsed });
                                    } catch (err) {
                                      // Invalid JSON, keep editing
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    minHeight: '100px',
                                    padding: '0.5rem',
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '0.375rem',
                                    color: '#e2e8f0',
                                    fontFamily: 'monospace',
                                    fontSize: '0.875rem',
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div style={{ marginTop: '0.5rem' }}>
                              <pre style={{
                                fontSize: '0.75rem',
                                color: '#94a3b8',
                                background: '#1e293b',
                                padding: '0.5rem',
                                borderRadius: '0.375rem',
                                overflow: 'auto',
                                maxHeight: '150px',
                              }}>
                                {JSON.stringify(policy.config, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => savePolicy(policy)}
                                disabled={updateMutation.isPending}
                                style={{
                                  padding: '0.5rem',
                                  background: '#10b981',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                title="Save changes"
                              >
                                <Save size={16} color="white" />
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={updateMutation.isPending}
                                style={{
                                  padding: '0.5rem',
                                  background: '#64748b',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                title="Cancel"
                              >
                                <RotateCcw size={16} color="white" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEditing(policy)}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: '#334155',
                                  border: '1px solid #475569',
                                  borderRadius: '0.375rem',
                                  color: '#e2e8f0',
                                  fontSize: '0.875rem',
                                  cursor: 'pointer',
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => togglePolicy(policy)}
                                disabled={updateMutation.isPending}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: policy.enabled ? '#ef4444' : '#10b981',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  color: 'white',
                                  fontSize: '0.875rem',
                                  cursor: 'pointer',
                                }}
                              >
                                {policy.enabled ? 'Disable' : 'Enable'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
