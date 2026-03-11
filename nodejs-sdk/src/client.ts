/**
 * AetherGuard Node.js SDK - Main Client
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import WebSocket from 'ws';
import {
  AetherGuardConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  SecurityScanRequest,
  SecurityScanResponse,
  UsageMetrics,
  ApiKeyInfo,
  SecurityPolicy,
  LLMProvider,
  AetherGuardError,
  StreamChunk,
  AnalyticsQuery,
  AnalyticsResponse
} from './types';

export class AetherGuardClient {
  private http: AxiosInstance;
  private config: Required<AetherGuardConfig>;

  constructor(config: AetherGuardConfig) {
    this.config = {
      baseUrl: 'http://localhost:8080',
      timeout: 30000,
      retries: 3,
      debug: false,
      ...config
    };

    this.http = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': '@aetherguard/nodejs-sdk/1.0.0'
      }
    });

    // Add request/response interceptors for debugging and error handling
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for debugging
    this.http.interceptors.request.use(
      (config) => {
        if (this.config.debug) {
          console.log(`[AetherGuard] ${config.method?.toUpperCase()} ${config.url}`);
          console.log(`[AetherGuard] Headers:`, config.headers);
          if (config.data) {
            console.log(`[AetherGuard] Body:`, JSON.stringify(config.data, null, 2));
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.http.interceptors.response.use(
      (response) => {
        if (this.config.debug) {
          console.log(`[AetherGuard] Response ${response.status}:`, response.data);
        }
        return response;
      },
      (error) => {
        const aetherGuardError: AetherGuardError = {
          code: error.response?.data?.code || 'UNKNOWN_ERROR',
          message: error.response?.data?.message || error.message,
          details: error.response?.data?.details,
          request_id: error.response?.headers['x-request-id']
        };
        
        if (this.config.debug) {
          console.error(`[AetherGuard] Error:`, aetherGuardError);
        }
        
        return Promise.reject(aetherGuardError);
      }
    );
  }

  // Chat Completions API (OpenAI-compatible)
  async createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await this.http.post<ChatCompletionResponse>('/v1/chat/completions', request);
    return response.data;
  }

  // Streaming Chat Completions
  async createChatCompletionStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: StreamChunk) => void,
    onError?: (error: AetherGuardError) => void,
    onComplete?: () => void
  ): Promise<void> {
    const streamRequest = { ...request, stream: true };
    
    try {
      const response = await this.http.post('/v1/chat/completions', streamRequest, {
        responseType: 'stream'
      });

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              onComplete?.();
              return;
            }
            
            try {
              const parsed = JSON.parse(data) as StreamChunk;
              onChunk(parsed);
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      });

      response.data.on('error', (error: any) => {
        onError?.({
          code: 'STREAM_ERROR',
          message: error.message
        });
      });

    } catch (error: any) {
      onError?.(error);
    }
  }

  // Security Scanning
  async scanText(request: SecurityScanRequest): Promise<SecurityScanResponse> {
    const response = await this.http.post<SecurityScanResponse>('/v1/security/scan', request);
    return response.data;
  }

  // Usage Metrics
  async getUsageMetrics(startDate?: string, endDate?: string): Promise<UsageMetrics> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const response = await this.http.get<UsageMetrics>(`/v1/usage/metrics?${params}`);
    return response.data;
  }

  // API Key Management
  async getApiKeyInfo(): Promise<ApiKeyInfo> {
    const response = await this.http.get<ApiKeyInfo>('/v1/api-keys/current');
    return response.data;
  }

  async updateApiKey(updates: Partial<Pick<ApiKeyInfo, 'name' | 'usage_limit' | 'ip_whitelist' | 'usage_alerts'>>): Promise<ApiKeyInfo> {
    const response = await this.http.patch<ApiKeyInfo>('/v1/api-keys/current', updates);
    return response.data;
  }

  // Security Policies
  async listPolicies(): Promise<SecurityPolicy[]> {
    const response = await this.http.get<SecurityPolicy[]>('/v1/policies');
    return response.data;
  }

  async getPolicy(policyId: string): Promise<SecurityPolicy> {
    const response = await this.http.get<SecurityPolicy>(`/v1/policies/${policyId}`);
    return response.data;
  }

  async createPolicy(policy: Omit<SecurityPolicy, 'id' | 'created_at' | 'updated_at'>): Promise<SecurityPolicy> {
    const response = await this.http.post<SecurityPolicy>('/v1/policies', policy);
    return response.data;
  }

  async updatePolicy(policyId: string, updates: Partial<SecurityPolicy>): Promise<SecurityPolicy> {
    const response = await this.http.patch<SecurityPolicy>(`/v1/policies/${policyId}`, updates);
    return response.data;
  }

  async deletePolicy(policyId: string): Promise<void> {
    await this.http.delete(`/v1/policies/${policyId}`);
  }

  // LLM Providers
  async listProviders(): Promise<LLMProvider[]> {
    const response = await this.http.get<LLMProvider[]>('/v1/providers');
    return response.data;
  }

  async getProvider(providerId: string): Promise<LLMProvider> {
    const response = await this.http.get<LLMProvider>(`/v1/providers/${providerId}`);
    return response.data;
  }

  async getProviderHealth(): Promise<LLMProvider[]> {
    const response = await this.http.get<LLMProvider[]>('/v1/providers/health');
    return response.data;
  }

  // Analytics
  async getAnalytics(query: AnalyticsQuery): Promise<AnalyticsResponse> {
    const response = await this.http.post<AnalyticsResponse>('/v1/analytics/query', query);
    return response.data;
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; version: string; timestamp: string }> {
    const response = await this.http.get('/health');
    return response.data;
  }

  // WebSocket connection for real-time events
  connectWebSocket(
    onEvent: (event: any) => void,
    onError?: (error: Error) => void,
    onClose?: () => void
  ): WebSocket {
    const wsUrl = this.config.baseUrl.replace('http', 'ws') + '/ws';
    const ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`
      }
    });

    ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        onEvent(event);
      } catch (e) {
        console.error('[AetherGuard] Failed to parse WebSocket message:', e);
      }
    });

    ws.on('error', (error) => {
      onError?.(error);
    });

    ws.on('close', () => {
      onClose?.();
    });

    return ws;
  }

  // Utility methods
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch {
      return false;
    }
  }

  // Configuration updates
  updateConfig(updates: Partial<AetherGuardConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Update axios instance if needed
    if (updates.baseUrl) {
      this.http.defaults.baseURL = updates.baseUrl;
    }
    if (updates.timeout) {
      this.http.defaults.timeout = updates.timeout;
    }
    if (updates.apiKey) {
      this.http.defaults.headers['Authorization'] = `Bearer ${updates.apiKey}`;
    }
  }
}