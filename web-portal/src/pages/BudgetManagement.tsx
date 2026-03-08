import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingUp, AlertCircle, Users } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

export default function BudgetManagement() {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'monthly'>('daily')

  const { data: budgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      // Mock data - replace with actual API call
      return {
        totalBudget: 1000000,
        usedBudget: 675000,
        remainingBudget: 325000,
        users: [
          { id: 'user_1', name: 'Engineering Team', dailyLimit: 50000, dailyUsed: 42000, monthlyLimit: 1500000, monthlyUsed: 1200000 },
          { id: 'user_2', name: 'Product Team', dailyLimit: 30000, dailyUsed: 18000, monthlyLimit: 900000, monthlyUsed: 540000 },
          { id: 'user_3', name: 'Marketing Team', dailyLimit: 20000, dailyUsed: 15000, monthlyLimit: 600000, monthlyUsed: 450000 },
          { id: 'user_4', name: 'Sales Team', dailyLimit: 15000, dailyUsed: 8000, monthlyLimit: 450000, monthlyUsed: 240000 },
          { id: 'user_5', name: 'Support Team', dailyLimit: 10000, dailyUsed: 7000, monthlyLimit: 300000, monthlyUsed: 210000 },
        ],
        topConsumers: [
          { name: 'Engineering', value: 1200000, color: '#60a5fa' },
          { name: 'Product', value: 540000, color: '#34d399' },
          { name: 'Marketing', value: 450000, color: '#fbbf24' },
          { name: 'Sales', value: 240000, color: '#f87171' },
          { name: 'Support', value: 210000, color: '#a78bfa' },
        ],
      }
    },
  })

  const utilizationRate = budgets ? (budgets.usedBudget / budgets.totalBudget) * 100 : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>
          Budget Management
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setSelectedPeriod('daily')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: selectedPeriod === 'daily' ? '#60a5fa' : '#334155',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Daily
          </button>
          <button
            onClick={() => setSelectedPeriod('monthly')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: selectedPeriod === 'monthly' ? '#60a5fa' : '#334155',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Budget Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
      }}>
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Total Budget
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {budgets?.totalBudget.toLocaleString() || '0'}
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                tokens/month
              </p>
            </div>
            <div style={{
              background: '#60a5fa20',
              padding: '0.75rem',
              borderRadius: '0.5rem',
            }}>
              <DollarSign size={24} color="#60a5fa" />
            </div>
          </div>
        </div>

        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Used Budget
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {budgets?.usedBudget.toLocaleString() || '0'}
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {utilizationRate.toFixed(1)}% utilized
              </p>
            </div>
            <div style={{
              background: '#f8717120',
              padding: '0.75rem',
              borderRadius: '0.5rem',
            }}>
              <TrendingUp size={24} color="#f87171" />
            </div>
          </div>
        </div>

        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Remaining Budget
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {budgets?.remainingBudget.toLocaleString() || '0'}
              </p>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {(100 - utilizationRate).toFixed(1)}% available
              </p>
            </div>
            <div style={{
              background: '#34d39920',
              padding: '0.75rem',
              borderRadius: '0.5rem',
            }}>
              <AlertCircle size={24} color="#34d399" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* User Budget Table */}
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            User Budgets
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontSize: '0.875rem' }}>User</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.875rem' }}>Limit</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.875rem' }}>Used</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.875rem' }}>Remaining</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.875rem' }}>Usage %</th>
                </tr>
              </thead>
              <tbody>
                {budgets?.users.map((user) => {
                  const limit = selectedPeriod === 'daily' ? user.dailyLimit : user.monthlyLimit
                  const used = selectedPeriod === 'daily' ? user.dailyUsed : user.monthlyUsed
                  const remaining = limit - used
                  const usagePercent = (used / limit) * 100

                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.75rem' }}>{user.name}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{limit.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{used.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{remaining.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <span style={{
                          color: usagePercent > 90 ? '#f87171' : usagePercent > 75 ? '#fbbf24' : '#34d399'
                        }}>
                          {usagePercent.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Consumers Pie Chart */}
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Top Consumers
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={budgets?.topConsumers || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {budgets?.topConsumers.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
