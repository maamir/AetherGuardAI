import { useState } from 'react';
import { Building, Users, CreditCard, Settings, TrendingUp, Shield, Plus, Edit, Trash2 } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  tier: string;
  status: 'active' | 'suspended' | 'trial';
  users: number;
  requests: number;
  quota: number;
  createdAt: string;
  billingEmail: string;
}

export default function TenantManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([
    {
      id: 'tenant-1',
      name: 'Acme Corporation',
      tier: 'Professional',
      status: 'active',
      users: 45,
      requests: 8500000,
      quota: 10000000,
      createdAt: '2024-01-15',
      billingEmail: 'billing@acme.com',
    },
    {
      id: 'tenant-2',
      name: 'TechStart Inc',
      tier: 'Starter',
      status: 'active',
      users: 8,
      requests: 750000,
      quota: 1000000,
      createdAt: '2024-02-20',
      billingEmail: 'admin@techstart.io',
    },
    {
      id: 'tenant-3',
      name: 'Beta Testing Co',
      tier: 'Free',
      status: 'trial',
      users: 3,
      requests: 5000,
      quota: 10000,
      createdAt: '2024-03-01',
      billingEmail: 'test@beta.com',
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Enterprise': return 'bg-purple-100 text-purple-800';
      case 'Professional': return 'bg-blue-100 text-blue-800';
      case 'Starter': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
          <p className="text-gray-600 mt-1">Manage all tenant accounts and subscriptions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add Tenant
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Tenants</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{tenants.length}</p>
            </div>
            <Building className="w-12 h-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {tenants.reduce((sum, t) => sum + t.users, 0)}
              </p>
            </div>
            <Users className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {(tenants.reduce((sum, t) => sum + t.requests, 0) / 1000000).toFixed(1)}M
              </p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Tenants</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {tenants.filter(t => t.status === 'active').length}
              </p>
            </div>
            <Shield className="w-12 h-12 text-orange-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                      <div className="text-sm text-gray-500">{tenant.billingEmail}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTierColor(tenant.tier)}`}>
                      {tenant.tier}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(tenant.status)}`}>
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {tenant.users}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1">
                        <div className="text-sm text-gray-900">
                          {(tenant.requests / 1000000).toFixed(2)}M / {(tenant.quota / 1000000).toFixed(0)}M
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(tenant.requests / tenant.quota) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTenant(tenant)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {/* Handle delete */}}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {/* Handle settings */}}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tenant Details Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedTenant.name}</h2>
                  <p className="text-gray-600 mt-1">{selectedTenant.billingEmail}</p>
                </div>
                <button
                  onClick={() => setSelectedTenant(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tier</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option>Free</option>
                    <option>Starter</option>
                    <option>Professional</option>
                    <option>Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option>Active</option>
                    <option>Trial</option>
                    <option>Suspended</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Quota</label>
                  <input
                    type="number"
                    defaultValue={selectedTenant.quota}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Users</label>
                  <input
                    type="number"
                    defaultValue={selectedTenant.users}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Security Settings</h3>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
                    <span className="ml-2 text-sm text-gray-700">Enable PII Detection</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
                    <span className="ml-2 text-sm text-gray-700">Enable Toxicity Filtering</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded" />
                    <span className="ml-2 text-sm text-gray-700">Enable Injection Detection</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                    <span className="ml-2 text-sm text-gray-700">Enable Hallucination Detection</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedTenant(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
