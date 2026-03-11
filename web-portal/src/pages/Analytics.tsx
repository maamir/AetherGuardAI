import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, DollarSign, AlertTriangle, Activity } from 'lucide-react';
import { api } from '../services/api';

const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c'];

export default function Analytics() {
  const [timeRange, setTimeRange] = useState(7);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');

  // Fetch analytics data
  const { data: usageData = [], isLoading: usageLoading } = useQuery({
    queryKey: ['usage-analytics', timeRange, selectedApiKey],
    queryFn: () => api.getUsageAnalytics(timeRange, selectedApiKey || undefined),
  });

  const { data: securityData = [], isLoading: securityLoading } = useQuery({
    queryKey: ['security-analytics', timeRange],
    queryFn: () => api.getSecurityAnalytics(timeRange),
  });

  const { data: costData = [], isLoading: costLoading } = useQuery({
    queryKey: ['cost-analytics', timeRange],
    queryFn: () => api.getCostAnalytics(timeRange),
  });

  const { data: apiKeys = [] } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.getApiKeys(),
  });

  const isLoading = usageLoading || securityLoading || costLoading;

  // Calculate summary metrics
  const totalRequests = usageData?.summary?.totalRequests || 0
  const totalCost = costData?.totalCost || 0
  const totalSecurityEvents = securityData?.events?.length || 0
  const avgLatency = usageData?.data?.length > 0
    ? (usageData.data.reduce((sum: number, item: any) => sum + (item.latency || 0), 0) / usageData.data.length).toFixed(1)
    : '0'

  // Prepare chart data
  const requestsOverTime = usageData?.data?.map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    requests: item.requests || 0,
    latency: item.latency || 0,
  })) || []

  const costOverTime = costData?.dailyCosts?.map((item: any) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    cost: item.cost || 0,
    tokens: item.tokens || 0,
  })) || []

  // Prepare security data for charts
  const securityPieData = securityData?.eventTypeCounts?.map((item: any) => ({
    name: item.type?.replace(/_/g, ' ') || 'unknown',
    value: item.count || 0,
  })) || []

  const severityData = securityData?.severityCounts?.map((item: any) => ({
    name: item.severity || 'unknown',
    value: item.count || 0,
  })) || []

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Analytics
        </h1>
        <p style={{ color: '#64748b' }}>
          Monitor usage, costs, and security events
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        flexWrap: 'wrap',
      }}>
        <div>
          <label style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>
            Time Range
          </label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            style={{
              padding: '0.5rem 1rem',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              color: '#e2e8f0',
            }}
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.875rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>
            API Key
          </label>
          <select
            value={selectedApiKey}
            onChange={(e) => setSelectedApiKey(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              color: '#e2e8f0',
              minWidth: '200px',
            }}
          >
            <option value="">All API Keys</option>
            {apiKeys.map((key: any) => (
              <option key={key.id} value={key.id}>
                {key.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
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
                Total Requests
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {isLoading ? '...' : totalRequests.toLocaleString()}
              </p>
            </div>
            <div style={{
              background: '#60a5fa20',
              padding: '0.75rem',
              borderRadius: '0.5rem',
            }}>
              <Activity size={24} color="#60a5fa" />
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
                Total Cost
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {isLoading ? '...' : `$${totalCost.toFixed(2)}`}
              </p>
            </div>
            <div style={{
              background: '#34d39920',
              padding: '0.75rem',
              borderRadius: '0.5rem',
            }}>
              <DollarSign size={24} color="#34d399" />
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
                Security Events
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {isLoading ? '...' : totalSecurityEvents.toLocaleString()}
              </p>
            </div>
            <div style={{
              background: '#f8717120',
              padding: '0.75rem',
              borderRadius: '0.5rem',
            }}>
              <AlertTriangle size={24} color="#f87171" />
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
                Avg Latency
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {isLoading ? '...' : `${avgLatency}ms`}
              </p>
            </div>
            <div style={{
              background: '#fbbf2420',
              padding: '0.75rem',
              borderRadius: '0.5rem',
            }}>
              <TrendingUp size={24} color="#fbbf24" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '1.5rem' }}>
        {/* Requests Over Time */}
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Requests Over Time
          </h2>
          {isLoading ? (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#94a3b8' }}>Loading...</p>
            </div>
          ) : requestsOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={requestsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                  }}
                />
                <Line type="monotone" dataKey="requests" stroke="#60a5fa" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#94a3b8' }}>No data available</p>
            </div>
          )}
        </div>

        {/* Cost Over Time */}
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Cost Over Time
          </h2>
          {isLoading ? (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#94a3b8' }}>Loading...</p>
            </div>
          ) : costOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={costOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                  }}
                />
                <Bar dataKey="cost" fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#94a3b8' }}>No data available</p>
            </div>
          )}
        </div>

        {/* Security Events by Type */}
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Security Events by Type
          </h2>
          {isLoading ? (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#94a3b8' }}>Loading...</p>
            </div>
          ) : securityPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={securityPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {securityPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#94a3b8' }}>No security events</p>
            </div>
          )}
        </div>

        {/* Security Events by Severity */}
        <div style={{
          background: '#1e293b',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #334155',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Security Events by Severity
          </h2>
          {isLoading ? (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#94a3b8' }}>Loading...</p>
            </div>
          ) : severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={severityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                  }}
                />
                <Bar dataKey="value" fill="#f87171" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: '#94a3b8' }}>No security events</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
