/**
 * Admin Portal API Client
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8081'

class AdminApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('admin_token')
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('admin_token')
        window.location.href = '/login'
      }

      const error = await response.json().catch(() => ({
        detail: 'An error occurred',
      }))
      throw new Error(error.detail)
    }

    return response.json()
  }

  // Authentication
  async login(email: string, password: string): Promise<any> {
    const response = await fetch(`${this.baseURL}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data: any = await this.handleResponse(response)
    localStorage.setItem('admin_token', data.token)
    return data
  }

  async logout() {
    localStorage.removeItem('admin_token')
  }

  // Tenants
  async getTenants(skip: number = 0, limit: number = 10): Promise<any> {
    const response = await fetch(
      `${this.baseURL}/api/admin/tenants?skip=${skip}&limit=${limit}`,
      { headers: this.getAuthHeaders() }
    )
    return this.handleResponse<any>(response)
  }

  async getTenant(tenantId: string): Promise<any> {
    const response = await fetch(
      `${this.baseURL}/api/admin/tenants/${tenantId}`,
      { headers: this.getAuthHeaders() }
    )
    return this.handleResponse<any>(response)
  }

  async updateTenant(tenantId: string, data: any): Promise<any> {
    const response = await fetch(
      `${this.baseURL}/api/admin/tenants/${tenantId}`,
      {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      }
    )
    return this.handleResponse<any>(response)
  }

  async suspendTenant(tenantId: string, reason?: string): Promise<any> {
    const response = await fetch(
      `${this.baseURL}/api/admin/tenants/${tenantId}/suspend`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ reason }),
      }
    )
    return this.handleResponse<any>(response)
  }

  async activateTenant(tenantId: string): Promise<any> {
    const response = await fetch(
      `${this.baseURL}/api/admin/tenants/${tenantId}/activate`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
      }
    )
    return this.handleResponse<any>(response)
  }

  // System Analytics
  async getSystemMetrics(): Promise<any> {
    const response = await fetch(
      `${this.baseURL}/api/admin/metrics`,
      { headers: this.getAuthHeaders() }
    )
    return this.handleResponse<any>(response)
  }

  async getSystemAnalytics(days: number = 30): Promise<any> {
    const response = await fetch(
      `${this.baseURL}/api/admin/analytics?days=${days}`,
      { headers: this.getAuthHeaders() }
    )
    return this.handleResponse<any>(response)
  }

  // Audit Logs
  async getAuditLogs(skip: number = 0, limit: number = 50, filters?: any): Promise<any> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    })

    if (filters?.action) params.append('action', filters.action)
    if (filters?.userId) params.append('user_id', filters.userId)
    if (filters?.tenantId) params.append('tenant_id', filters.tenantId)

    const response = await fetch(
      `${this.baseURL}/api/admin/audit-logs?${params}`,
      { headers: this.getAuthHeaders() }
    )
    return this.handleResponse<any>(response)
  }
}

export const adminApi = new AdminApiClient(API_BASE_URL)
export default adminApi
