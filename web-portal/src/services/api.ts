/**
 * AetherGuard API Client
 * Centralized API service for all backend communication
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    tenantId: string;
    tenantName: string;
  };
}

export interface ApiError {
  detail: string;
}

// API Client Class
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }

      const error: ApiError = await response.json().catch(() => ({
        detail: 'An error occurred',
      }));
      throw new Error(error.detail);
    }

    return response.json();
  }

  // Authentication
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${this.baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    return this.handleResponse<LoginResponse>(response);
  }

  async getCurrentUser() {
    const response = await fetch(`${this.baseURL}/api/auth/me`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async logout() {
    const response = await fetch(`${this.baseURL}/api/auth/logout`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    return this.handleResponse(response);
  }

  // LLM Providers
  async getLLMProviders() {
    const response = await fetch(`${this.baseURL}/api/llm-providers`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async createLLMProvider(data: any) {
    const response = await fetch(`${this.baseURL}/api/llm-providers`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  async updateLLMProvider(id: string, data: any) {
    const response = await fetch(`${this.baseURL}/api/llm-providers/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  async deleteLLMProvider(id: string) {
    const response = await fetch(`${this.baseURL}/api/llm-providers/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async testLLMProvider(id: string) {
    const response = await fetch(`${this.baseURL}/api/llm-providers/${id}/test`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Policies
  async getPolicies() {
    const response = await fetch(`${this.baseURL}/api/policies`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getDefaultPolicies() {
    const response = await fetch(`${this.baseURL}/api/policies/defaults`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async updatePolicy(category: string, featureKey: string, data: any) {
    const response = await fetch(
      `${this.baseURL}/api/policies/${category}/${featureKey}`,
      {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );

    return this.handleResponse(response);
  }

  async bulkUpdatePolicies(updates: any[]) {
    const response = await fetch(`${this.baseURL}/api/policies/bulk-update`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ updates }),
    });

    return this.handleResponse(response);
  }

  // Analytics
  async getUsageAnalytics(days: number = 7, apiKeyId?: string) {
    const params = new URLSearchParams({ days: days.toString() });
    if (apiKeyId) params.append('api_key_id', apiKeyId);

    const response = await fetch(
      `${this.baseURL}/api/analytics/usage?${params}`,
      {
        headers: this.getAuthHeaders(),
      }
    );

    return this.handleResponse(response);
  }

  async getSecurityAnalytics(days: number = 7, severity?: string, eventType?: string) {
    const params = new URLSearchParams({ days: days.toString() });
    if (severity) params.append('severity', severity);
    if (eventType) params.append('event_type', eventType);

    const response = await fetch(
      `${this.baseURL}/api/analytics/security?${params}`,
      {
        headers: this.getAuthHeaders(),
      }
    );

    return this.handleResponse(response);
  }

  async getCostAnalytics(days: number = 30) {
    const params = new URLSearchParams({ days: days.toString() });

    const response = await fetch(
      `${this.baseURL}/api/analytics/costs?${params}`,
      {
        headers: this.getAuthHeaders(),
      }
    );

    return this.handleResponse(response);
  }

  // API Keys
  async getApiKeys() {
    const response = await fetch(`${this.baseURL}/api/api-keys`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async createApiKey(data: any) {
    const response = await fetch(`${this.baseURL}/api/api-keys`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  async updateApiKey(id: string, data: any) {
    const response = await fetch(`${this.baseURL}/api/api-keys/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  async deleteApiKey(id: string) {
    const response = await fetch(`${this.baseURL}/api/api-keys/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async revokeApiKey(id: string, reason?: string) {
    const response = await fetch(`${this.baseURL}/api/api-keys/${id}/revoke`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });

    return this.handleResponse(response);
  }

  async rotateApiKey(id: string) {
    const response = await fetch(`${this.baseURL}/api/api-keys/${id}/rotate`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // Activities
  async getActivities(limit: number = 50, types?: string[]) {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (types && types.length > 0) {
      params.append('types', types.join(','));
    }

    const response = await fetch(`${this.baseURL}/api/activities?${params}`, {
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async logActivity(type: string, description: string, metadata?: Record<string, any>) {
    const response = await fetch(`${this.baseURL}/api/activities`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ type, description, metadata }),
    });

    return this.handleResponse(response);
  }

  // Provider Statistics
  async getProviderStats(providerId: string, days: number = 7) {
    const params = new URLSearchParams({ days: days.toString() });

    const response = await fetch(
      `${this.baseURL}/api/llm-providers/${providerId}/stats?${params}`,
      {
        headers: this.getAuthHeaders(),
      }
    );

    return this.handleResponse(response);
  }

  // API Key Statistics
  async getApiKeyStats(apiKeyId: string, days: number = 7) {
    const params = new URLSearchParams({ days: days.toString() });

    const response = await fetch(
      `${this.baseURL}/api/api-keys/${apiKeyId}/stats?${params}`,
      {
        headers: this.getAuthHeaders(),
      }
    );

    return this.handleResponse(response);
  }
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);

// Export default
export default api;
