/**
 * AetherGuard Client Tests
 */

import axios from 'axios';
import { AetherGuardClient } from '../src/client';
import { AetherGuardConfig, AetherGuardError } from '../src/types';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AetherGuardClient', () => {
  let client: AetherGuardClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      defaults: {
        baseURL: '',
        timeout: 0,
        headers: {}
      },
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    const config: AetherGuardConfig = {
      apiKey: 'test-api-key-12345678901234567890123456789012'
    };

    client = new AetherGuardClient(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8080',
        timeout: 30000,
        headers: {
          'Authorization': 'Bearer test-api-key-12345678901234567890123456789012',
          'Content-Type': 'application/json',
          'User-Agent': '@aetherguard/nodejs-sdk/1.0.0'
        }
      });
    });

    it('should create client with custom config', () => {
      const customConfig: AetherGuardConfig = {
        apiKey: 'custom-key-12345678901234567890123456789012',
        baseUrl: 'https://api.aetherguard.ai',
        timeout: 60000,
        debug: true
      };

      new AetherGuardClient(customConfig);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.aetherguard.ai',
        timeout: 60000,
        headers: {
          'Authorization': 'Bearer custom-key-12345678901234567890123456789012',
          'Content-Type': 'application/json',
          'User-Agent': '@aetherguard/nodejs-sdk/1.0.0'
        }
      });
    });
  });

  describe('createChatCompletion', () => {
    it('should make chat completion request', async () => {
      const mockResponse = {
        data: {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?'
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 9,
            completion_tokens: 12,
            total_tokens: 21
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user' as const, content: 'Hello' }]
      };

      const result = await client.createChatCompletion(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/chat/completions', request);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle API errors', async () => {
      const mockError = {
        response: {
          data: {
            code: 'CONTENT_BLOCKED',
            message: 'Content blocked by security policy'
          },
          headers: {
            'x-request-id': 'req-123'
          }
        }
      };

      // The interceptor will transform this error
      mockAxiosInstance.post.mockImplementation(() => {
        const transformedError: AetherGuardError = {
          code: 'CONTENT_BLOCKED',
          message: 'Content blocked by security policy',
          details: undefined,
          request_id: 'req-123'
        };
        return Promise.reject(transformedError);
      });

      const request = {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user' as const, content: 'Harmful content' }]
      };

      await expect(client.createChatCompletion(request)).rejects.toMatchObject({
        code: 'CONTENT_BLOCKED',
        message: 'Content blocked by security policy',
        request_id: 'req-123'
      });
    });
  });

  describe('scanText', () => {
    it('should scan text for security violations', async () => {
      const mockResponse = {
        data: {
          safe: false,
          violations: [{
            type: 'toxicity',
            score: 0.85,
            details: 'High toxicity detected'
          }]
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const request = {
        text: 'You are stupid',
        scanTypes: ['toxicity' as const]
      };

      const result = await client.scanText(request);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/security/scan', request);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getUsageMetrics', () => {
    it('should get usage metrics without date range', async () => {
      const mockResponse = {
        data: {
          requests_count: 100,
          tokens_used: 5000,
          blocked_requests: 5,
          security_violations: [
            { type: 'toxicity', count: 3 },
            { type: 'injection', count: 2 }
          ]
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.getUsageMetrics();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/usage/metrics?');
      expect(result).toEqual(mockResponse.data);
    });

    it('should get usage metrics with date range', async () => {
      const mockResponse = {
        data: {
          requests_count: 50,
          tokens_used: 2500,
          blocked_requests: 2,
          security_violations: []
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.getUsageMetrics('2024-01-01', '2024-01-07');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/usage/metrics?start_date=2024-01-01&end_date=2024-01-07');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('policy management', () => {
    it('should list policies', async () => {
      const mockResponse = {
        data: [{
          id: 'policy-1',
          name: 'Default Policy',
          description: 'Default security policy',
          rules: [],
          enabled: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }]
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.listPolicies();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/policies');
      expect(result).toEqual(mockResponse.data);
    });

    it('should create policy', async () => {
      const mockResponse = {
        data: {
          id: 'policy-2',
          name: 'Strict Policy',
          description: 'Strict security policy',
          rules: [{
            type: 'toxicity',
            threshold: 0.3,
            action: 'block',
            enabled: true
          }],
          enabled: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const policyData = {
        name: 'Strict Policy',
        description: 'Strict security policy',
        rules: [{
          type: 'toxicity' as const,
          threshold: 0.3,
          action: 'block' as const,
          enabled: true
        }],
        enabled: true
      };

      const result = await client.createPolicy(policyData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/policies', policyData);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('healthCheck', () => {
    it('should check service health', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
          version: '1.0.0',
          timestamp: '2024-01-01T00:00:00Z'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.healthCheck();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('testConnection', () => {
    it('should return true when connection is successful', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { status: 'healthy' }
      });

      const result = await client.testConnection();

      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update client configuration', () => {
      client.updateConfig({
        baseUrl: 'https://new-api.aetherguard.ai',
        timeout: 45000,
        apiKey: 'new-key-12345678901234567890123456789012'
      });

      expect(mockAxiosInstance.defaults.baseURL).toBe('https://new-api.aetherguard.ai');
      expect(mockAxiosInstance.defaults.timeout).toBe(45000);
      expect(mockAxiosInstance.defaults.headers['Authorization']).toBe('Bearer new-key-12345678901234567890123456789012');
    });
  });
});