import { useState } from 'react';
import { Users, Mail, Shield, Plus, Edit, Trash2, Key, Lock } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'analyst' | 'viewer' | 'developer';
  status: 'active' | 'inactive' | 'pending';
  lastLogin: string;
  createdAt: string;
  mfaEnabled: boolean;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([
    {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@acme.com',
      role: 'admin',
      status: 'active',
      lastLogin: '2024-03-08T10:30:00',
      createdAt: '2024-01-15',
      mfaEnabled: true,
    },
    {
      id: 'user-2',
      name: 'Jane Smith',
      email: 'jane@acme.com',
      role: 'operator',
      status: 'active',
      lastLogin: '2024-03-08T09:15:00',
      createdAt: '2024-01-20',
      mfaEnabled: true,
    },
    {
      id: 'user-3',
      name: 'Bob Johnson',
      email: 'bob@acme.com',
      role: 'analyst',
      status: 'active',
      lastLogin: '2024-03-07T16:45:00',
      createdAt: '2024-02-01',
      mfaEnabled: false,
    },
    {
      id: 'user-4',
      name: 'Alice Williams',
      email: 'alice@acme.com',
      role: 'viewer',
      status: 'inactive',
      lastLogin: '2024-02-28T14:20:00',
      createdAt: '2024-02-10',
      mfaEnabled: false,
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'operator': return 'bg-blue-100 text-blue-800';
      case 'analyst': return 'bg-green-100 text-green-800';
      case 'developer': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRolePermissions = (role: string) => {
    const permissions: Record<string, string[]> = {
      admin: ['Full system access', 'User management', 'Tenant management', 'Policy configuration', 'Billing'],
      operator: ['View metrics', 'Manage policies', 'View audit logs', 'Configure detectors'],
      analyst: ['View metrics', 'View audit logs', 'Generate reports', 'View analytics'],
      viewer: ['View metrics', 'View audit logs'],
      developer: ['API access', 'View metrics', 'Test detectors', 'View documentation'],
    };
    return permissions[role] || [];
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add User
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{users.length}</p>
            </div>
            <Users className="w-12 h-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {users.filter(u => u.status === 'active').length}
              </p>
            </div>
            <Shield className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">MFA Enabled</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {users.filter(u => u.mfaEnabled).length}
              </p>
            </div>
            <Lock className="w-12 h-12 text-purple-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Admins</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {users.filter(u => u.role === 'admin').length}
              </p>
            </div>
            <Key className="w-12 h-12 text-orange-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MFA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
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
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.mfaEnabled ? (
                      <span className="text-green-600 text-sm">✓ Enabled</span>
                    ) : (
                      <span className="text-gray-400 text-sm">Disabled</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.lastLogin).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedUser(user)}
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-medium">
                    {selectedUser.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedUser.name}</h2>
                    <p className="text-gray-600">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    defaultValue={selectedUser.role}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="admin">Admin</option>
                    <option value="operator">Operator</option>
                    <option value="analyst">Analyst</option>
                    <option value="viewer">Viewer</option>
                    <option value="developer">Developer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    defaultValue={selectedUser.status}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Role Permissions</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2">
                    {getRolePermissions(selectedUser.role).map((permission, idx) => (
                      <li key={idx} className="flex items-center text-sm text-gray-700">
                        <Shield className="w-4 h-4 text-green-600 mr-2" />
                        {permission}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Security Settings</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">Multi-Factor Authentication (MFA)</span>
                    <input
                      type="checkbox"
                      defaultChecked={selectedUser.mfaEnabled}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>
                  <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                    Reset Password
                  </button>
                  <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                    Revoke All Sessions
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedUser(null)}
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

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add New User</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="john@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="viewer">Viewer</option>
                  <option value="analyst">Analyst</option>
                  <option value="developer">Developer</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Add User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
