import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import RealTimeDashboard from './pages/RealTimeDashboard'
import AdvancedAnalytics from './pages/AdvancedAnalytics'
import BudgetManagement from './pages/BudgetManagement'
import Analytics from './pages/Analytics'
import AuditLogs from './pages/AuditLogs'
import Policies from './pages/Policies'
import PolicyEditor from './pages/PolicyEditor'
import ModelManagement from './pages/ModelManagement'
import TenantManagement from './pages/TenantManagement'
import UserManagement from './pages/UserManagement'
import ApiKeys from './pages/ApiKeys'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Onboarding from './pages/Onboarding'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Protected Routes */}
      <Route path="/" element={
        <PrivateRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/realtime" element={
        <PrivateRoute>
          <Layout>
            <RealTimeDashboard />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/advanced-analytics" element={
        <PrivateRoute>
          <Layout>
            <AdvancedAnalytics />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/budgets" element={
        <PrivateRoute>
          <Layout>
            <BudgetManagement />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/analytics" element={
        <PrivateRoute>
          <Layout>
            <Analytics />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/audit" element={
        <PrivateRoute>
          <Layout>
            <AuditLogs />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/policies" element={
        <PrivateRoute>
          <Layout>
            <Policies />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/policies/edit/:id" element={
        <PrivateRoute>
          <Layout>
            <PolicyEditor />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/models" element={
        <PrivateRoute>
          <Layout>
            <ModelManagement />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/tenants" element={
        <PrivateRoute>
          <Layout>
            <TenantManagement />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/users" element={
        <PrivateRoute>
          <Layout>
            <UserManagement />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/api-keys" element={
        <PrivateRoute>
          <Layout>
            <ApiKeys />
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  )
}

export default App
