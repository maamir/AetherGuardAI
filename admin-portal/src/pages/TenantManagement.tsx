import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { adminApi } from '../services/api'
import { Edit2, Lock, Unlock, Plus } from 'lucide-react'

interface TenantsData {
  tenants: Array<{
    id: string
    name: string
    email: string
    status: string
    [key: string]: any
  }>
  total: number
}

export default function TenantManagement() {
  const [skip, setSkip] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const queryClient = useQueryClient()

  const { data: tenantsData, isLoading } = useQuery<TenantsData>({
    queryKey: ['tenants', skip],
    queryFn: () => adminApi.getTenants(skip, 10),
  })

  const suspendMutation = useMutation({
    mutationFn: (tenantId: string) => adminApi.suspendTenant(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  const activateMutation = useMutation({
    mutationFn: (tenantId: string) => adminApi.activateTenant(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })

  const tenants = tenantsData?.tenants || []
  const filteredTenants = tenants.filter((t: any) =>
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Tenant Management</h1>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          <Plus size={18} />
          New Tenant
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          placeholder="Search tenants..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            color: '#e2e8f0',
          }}
        />
      </div>

      {/* Tenants Table */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            Loading tenants...
          </div>
        ) : filteredTenants.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            No tenants found
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', background: '#0f172a' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600' }}>
                  Name
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600' }}>
                  Email
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600' }}>
                  Status
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600' }}>
                  Created
                </th>
                <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map((tenant: any) => (
                <tr key={tenant.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '1rem' }}>{tenant.name}</td>
                  <td style={{ padding: '1rem', color: '#94a3b8' }}>{tenant.email}</td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        background: tenant.is_active ? '#10b98120' : '#ef444420',
                        color: tenant.is_active ? '#10b981' : '#ef4444',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                      }}
                    >
                      {tenant.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        style={{
                          padding: '0.5rem',
                          background: '#334155',
                          color: '#e2e8f0',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit2 size={16} />
                      </button>
                      {tenant.is_active ? (
                        <button
                          onClick={() => suspendMutation.mutate(tenant.id)}
                          style={{
                            padding: '0.5rem',
                            background: '#ef444420',
                            color: '#ef4444',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                          }}
                        >
                          <Lock size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => activateMutation.mutate(tenant.id)}
                          style={{
                            padding: '0.5rem',
                            background: '#10b98120',
                            color: '#10b981',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                          }}
                        >
                          <Unlock size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
        <button
          onClick={() => setSkip(Math.max(0, skip - 10))}
          disabled={skip === 0}
          style={{
            padding: '0.5rem 1rem',
            background: skip === 0 ? '#334155' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: skip === 0 ? 'not-allowed' : 'pointer',
            opacity: skip === 0 ? 0.5 : 1,
          }}
        >
          Previous
        </button>
        <span style={{ color: '#94a3b8' }}>
          Page {Math.floor(skip / 10) + 1}
        </span>
        <button
          onClick={() => setSkip(skip + 10)}
          disabled={filteredTenants.length < 10}
          style={{
            padding: '0.5rem 1rem',
            background: filteredTenants.length < 10 ? '#334155' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: filteredTenants.length < 10 ? 'not-allowed' : 'pointer',
            opacity: filteredTenants.length < 10 ? 0.5 : 1,
          }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
