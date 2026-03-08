import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import BudgetManagement from './pages/BudgetManagement'
import Analytics from './pages/Analytics'
import AuditLogs from './pages/AuditLogs'
import Policies from './pages/Policies'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/budgets" element={<BudgetManagement />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/audit" element={<AuditLogs />} />
        <Route path="/policies" element={<Policies />} />
      </Routes>
    </Layout>
  )
}

export default App
