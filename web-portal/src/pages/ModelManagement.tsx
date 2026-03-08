import { useState, useEffect } from 'react'
import { Package, TrendingUp, GitBranch, Play, Pause, Upload, Download, Settings } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface Model {
  id: string
  name: string
  version: string
  type: 'injection' | 'toxicity' | 'hallucination' | 'brand_safety' | 'pii' | 'custom'
  status: 'active' | 'inactive' | 'training' | 'testing'
  accuracy: number
  latency: number
  throughput: number
  size: string
  deployedAt: string
  lastUpdated: string
  metrics: {
    timestamp: string
    accuracy: number
    latency: number
    throughput: number
  }[]
}

export default function ModelManagement() {
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [abTestConfig, setAbTestConfig] = useState({ modelA: '', modelB: '', traffic: 50 })

  useEffect(() => {
    // Mock data - replace with actual API call
    const mockModels: Model[] = [
      {
        id: 'model_llama_guard',
        name: 'Llama Guard',
        version: '1.0.0',
        type: 'injection',
        status: 'active',
        accuracy: 92.5,
        latency: 45,
        throughput: 120,
        size: '350MB',
        deployedAt: '2026-03-01T10:00:00Z',
        lastUpdated: '2026-03-08T08:00:00Z',
        metrics: Array.from({ length: 24 }, (_, i) => ({
          timestamp: `${i}:00`,
          accuracy: 90 + Math.random() * 5,
          latency: 40 + Math.random() * 10,
          throughput: 110 + Math.random() * 20,
        })),
      },
      {
        id: 'model_granite_guardian',
        name: 'Granite Guardian',
        version: '2.1.0',
        type: 'toxicity',
        status: 'active',
        accuracy: 88.3,
        latency: 38,
        throughput: 150,
        size: '150MB',
        deployedAt: '2026-02-15T14:30:00Z',
        lastUpdated: '2026-03-07T12:00:00Z',
        metrics: Array.from({ length: 24 }, (_, i) => ({
          timestamp: `${i}:00`,
          accuracy: 86 + Math.random() * 4,
          latency: 35 + Math.random() * 8,
          throughput: 140 + Math.random() * 20,
        })),
      },
      {
        id: 'model_deberta_nli',
        name: 'DeBERTa NLI',
        version: '3.0.0',
        type: 'hallucination',
        status: 'active',
        accuracy: 85.7,
        latency: 75,
        throughput: 80,
        size: '700MB',
        deployedAt: '2026-02-20T09:00:00Z',
        lastUpdated: '2026-03-06T16:00:00Z',
        metrics: Array.from({ length: 24 }, (_, i) => ({
          timestamp: `${i}:00`,
          accuracy: 83 + Math.random() * 5,
          latency: 70 + Math.random() * 15,
          throughput: 70 + Math.random() * 20,
        })),
      },
      {
        id: 'model_bart_zeroshot',
        name: 'BART Zero-Shot',
        version: '1.5.0',
        type: 'brand_safety',
        status: 'active',
        accuracy: 81.2,
        latency: 95,
        throughput: 60,
        size: '1.6GB',
        deployedAt: '2026-02-10T11:00:00Z',
        lastUpdated: '2026-03-05T10:00:00Z',
        metrics: Array.from({ length: 24 }, (_, i) => ({
          timestamp: `${i}:00`,
          accuracy: 79 + Math.random() * 4,
          latency: 90 + Math.random() * 15,
          throughput: 50 + Math.random() * 20,
        })),
      },
      {
        id: 'model_custom_intent',
        name: 'Intent Classifier',
        version: '1.0.0',
        type: 'custom',
        status: 'testing',
        accuracy: 87.9,
        latency: 25,
        throughput: 200,
        size: '50MB',
        deployedAt: '2026-03-05T15:00:00Z',
        lastUpdated: '2026-03-08T09:00:00Z',
        metrics: Array.from({ length: 24 }, (_, i) => ({
          timestamp: `${i}:00`,
          accuracy: 85 + Math.random() * 5,
          latency: 20 + Math.random() * 10,
          throughput: 190 + Math.random() * 20,
        })),
      },
    ]
    
    setModels(mockModels)
    setSelectedModel(mockModels[0])
  }, [])

  const toggleModelStatus = (modelId: string) => {
    setModels(models.map(m => 
      m.id === modelId 
        ? { ...m, status: m.status === 'active' ? 'inactive' : 'active' }
        : m
    ))
  }

  const getStatusColor = (status: Model['status']) => {
    const colors = {
      active: '#34d399',
      inactive: '#94a3b8',
      training: '#fbbf24',
      testing: '#60a5fa',
    }
    return colors[status]
  }

  const getTypeColor = (type: Model['type']) => {
    const colors = {
      injection: '#f87171',
      toxicity: '#fb923c',
      hallucination: '#a78bfa',
      brand_safety: '#fbbf24',
      pii: '#f472b6',
      custom: '#60a5fa',
    }
    return colors[type]
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
          Model Management
        </h1>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowDeployModal(true)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#60a5fa',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Upload size={16} />
            Deploy Model
          </button>
          
          <button
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#a78bfa',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <GitBranch size={16} />
            A/B Test
          </button>
        </div>
      </div>

      {/* Model Registry */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Model List */}
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          maxHeight: '800px',
          overflowY: 'auto',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Model Registry
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {models.map((model) => (
              <div
                key={model.id}
                onClick={() => setSelectedModel(model)}
                style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: `2px solid ${selectedModel?.id === model.id ? '#60a5fa' : '#334155'}`,
                  background: selectedModel?.id === model.id ? '#60a5fa20' : '#0f172a',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      {model.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      v{model.version}
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    background: getStatusColor(model.status) + '30',
                    color: getStatusColor(model.status),
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                  }}>
                    {model.status.toUpperCase()}
                  </div>
                </div>
                
                <div style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  background: getTypeColor(model.type) + '30',
                  color: getTypeColor(model.type),
                  fontSize: '0.75rem',
                  display: 'inline-block',
                  marginBottom: '0.5rem',
                }}>
                  {model.type.replace('_', ' ')}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
                  <div>Accuracy: {model.accuracy}%</div>
                  <div>Latency: {model.latency}ms</div>
                  <div>Size: {model.size}</div>
                  <div>RPS: {model.throughput}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Model Details */}
        {selectedModel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Model Info */}
            <div style={{
              background: '#1e293b',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    {selectedModel.name}
                  </h2>
                  <div style={{ color: '#94a3b8' }}>
                    Version {selectedModel.version} • {selectedModel.size}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => toggleModelStatus(selectedModel.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: selectedModel.status === 'active' ? '#f87171' : '#34d399',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    {selectedModel.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                    {selectedModel.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  
                  <button
                    style={{
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: '#334155',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <Settings size={16} />
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <div style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Accuracy
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#34d399' }}>
                    {selectedModel.accuracy}%
                  </div>
                </div>
                
                <div style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Latency
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>
                    {selectedModel.latency}ms
                  </div>
                </div>
                
                <div style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Throughput
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#a78bfa' }}>
                    {selectedModel.throughput} RPS
                  </div>
                </div>
                
                <div style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Status
                  </div>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    color: getStatusColor(selectedModel.status),
                  }}>
                    {selectedModel.status.toUpperCase()}
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem', color: '#cbd5e1' }}>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Deployed:</span> {new Date(selectedModel.deployedAt).toLocaleString()}
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Updated:</span> {new Date(selectedModel.lastUpdated).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div style={{
              background: '#1e293b',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                Performance Metrics (24h)
              </h3>
              
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={selectedModel.metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="timestamp" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="accuracy" stroke="#34d399" strokeWidth={2} name="Accuracy (%)" />
                  <Line type="monotone" dataKey="latency" stroke="#60a5fa" strokeWidth={2} name="Latency (ms)" />
                  <Line type="monotone" dataKey="throughput" stroke="#a78bfa" strokeWidth={2} name="Throughput (RPS)" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Version History */}
            <div style={{
              background: '#1e293b',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                Version History
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {['3.0.0', '2.1.0', '2.0.0', '1.5.0', '1.0.0'].map((version, index) => (
                  <div
                    key={version}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                        Version {version}
                        {index === 0 && (
                          <span style={{
                            marginLeft: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            background: '#34d399',
                            fontSize: '0.75rem',
                          }}>
                            CURRENT
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                        Released {new Date(Date.now() - index * 7 * 24 * 3600000).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <button
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        background: index === 0 ? '#334155' : '#60a5fa',
                        color: '#fff',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                      disabled={index === 0}
                    >
                      <Download size={16} />
                      {index === 0 ? 'Active' : 'Rollback'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deploy Modal */}
      {showDeployModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowDeployModal(false)}
        >
          <div
            style={{
              background: '#1e293b',
              padding: '2rem',
              borderRadius: '0.75rem',
              border: '1px solid #334155',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              Deploy New Model
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>
                  Model Name
                </label>
                <input
                  type="text"
                  placeholder="my-custom-model"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#fff',
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>
                  Model Type
                </label>
                <select
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#fff',
                  }}
                >
                  <option>Injection Detection</option>
                  <option>Toxicity Detection</option>
                  <option>Hallucination Detection</option>
                  <option>Brand Safety</option>
                  <option>PII Detection</option>
                  <option>Custom</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>
                  Model File
                </label>
                <input
                  type="file"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #334155',
                    background: '#0f172a',
                    color: '#fff',
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  onClick={() => setShowDeployModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: '#334155',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    alert('Model deployment started!')
                    setShowDeployModal(false)
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: '#60a5fa',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Deploy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
