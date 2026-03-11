/**
 * Utility Functions Tests
 */

import {
  validateApiKey,
  formatMessages,
  createSimpleRequest,
  extractResponseText,
  estimateTokens,
  validatePolicyRules,
  formatDate,
  parseError,
  sanitizeForLogging,
  isSecurityViolation,
  generateRequestId,
  validateUrl,
  deepMerge
} from '../src/utils';

describe('Utility Functions', () => {
  describe('validateApiKey', () => {
    it('should validate correct API key format', () => {
      expect(validateApiKey('test-api-key-12345678901234567890123456789012')).toBe(true);
      expect(validateApiKey('sk-1234567890abcdefghijklmnopqrstuvwxyz123456')).toBe(true);
    });

    it('should reject invalid API key format', () => {
      expect(validateApiKey('short-key')).toBe(false);
      expect(validateApiKey('')).toBe(false);
      expect(validateApiKey(null as any)).toBe(false);
    });
  });

  describe('formatMessages', () => {
    it('should format string as user message', () => {
      const result = formatMessages('Hello world');
      expect(result).toEqual([{ role: 'user', content: 'Hello world' }]);
    });

    it('should return messages array as-is', () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' }
      ];
      const result = formatMessages(messages);
      expect(result).toEqual(messages);
    });
  });

  describe('createSimpleRequest', () => {
    it('should create basic request', () => {
      const result = createSimpleRequest('Hello world');
      expect(result).toEqual({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello world' }],
        max_tokens: undefined,
        temperature: undefined
      });
    });

    it('should create request with options', () => {
      const result = createSimpleRequest('Hello world', 'gpt-4', {
        maxTokens: 100,
        temperature: 0.7,
        systemPrompt: 'You are helpful'
      });
      expect(result).toEqual({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello world' }
        ],
        max_tokens: 100,
        temperature: 0.7
      });
    });
  });

  describe('extractResponseText', () => {
    it('should extract text from response', () => {
      const response = {
        choices: [{
          message: {
            content: 'Hello! How can I help?'
          }
        }]
      };
      expect(extractResponseText(response)).toBe('Hello! How can I help?');
    });

    it('should return empty string for invalid response', () => {
      expect(extractResponseText({})).toBe('');
      expect(extractResponseText({ choices: [] })).toBe('');
      expect(extractResponseText({ choices: [{}] })).toBe('');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      expect(estimateTokens('Hello world')).toBe(3); // 11 chars / 4 = 2.75 -> 3
      expect(estimateTokens('This is a longer text')).toBe(6); // 21 chars / 4 = 5.25 -> 6
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('validatePolicyRules', () => {
    it('should validate correct rules', () => {
      const rules = [
        { type: 'toxicity' as const, threshold: 0.5, action: 'block' as const, enabled: true },
        { type: 'injection' as const, threshold: 0.7, action: 'warn' as const, enabled: false }
   
      ];
      const errors = validatePolicyRules(rules);
      expect(errors).toEqual([]);
    });

    it('should detect invalid rule types', () => {
      const rules = [
        { type: 'invalid_type' as any, threshold: 0.5, action: 'block' as const, enabled: true }
      ];
      const errors = validatePolicyRules(rules);
      expect(errors).toContain('Invalid rule type: invalid_type');
    });

    it('should detect invalid thresholds', () => {
      const rules = [
        { type: 'toxicity' as const, threshold: 1.5, action: 'block' as const, enabled: true },
        { type: 'injection' as const, threshold: -0.1, action: 'warn' as const, enabled: true }
      ];
      const errors = validatePolicyRules(rules);
      expect(errors).toContain('Invalid threshold for toxicity: must be between 0 and 1');
      expect(errors).toContain('Invalid threshold for injection: must be between 0 and 1');
    });

    it('should detect invalid actions', () => {
      const rules = [
        { type: 'toxicity' as const, threshold: 0.5, action: 'invalid_action' as any, enabled: true }
      ];
      const errors = validatePolicyRules(rules);
      expect(errors).toContain('Invalid action for toxicity: must be \'block\', \'warn\', or \'log\'');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(formatDate(date)).toBe('2024-01-15');
    });
  });

  describe('parseError', () => {
    it('should parse API error response', () => {
      const error = {
        response: {
          data: {
            code: 'CONTENT_BLOCKED',
            message: 'Content blocked',
            details: { reason: 'toxicity' }
          }
        }
      };
      const result = parseError(error);
      expect(result).toEqual({
        code: 'CONTENT_BLOCKED',
        message: 'Content blocked',
        details: { reason: 'toxicity' }
      });
    });

    it('should parse network error', () => {
      const error = { message: 'Network timeout' };
      const result = parseError(error);
      expect(result).toEqual({
        code: 'NETWORK_ERROR',
        message: 'Network timeout'
      });
    });
  });

  describe('sanitizeForLogging', () => {
    it('should sanitize API keys', () => {
      const text = 'My API key is sk-1234567890abcdefghijklmnopqrstuvwxyz123456';
      expect(sanitizeForLogging(text)).toBe('My API key is sk-***');
    });

    it('should sanitize Bearer tokens', () => {
      const text = 'Authorization: Bearer abc123def456';
      expect(sanitizeForLogging(text)).toBe('Authorization: Bearer ***');
    });

    it('should sanitize passwords', () => {
      const text = 'password: "mypassword123"';
      expect(sanitizeForLogging(text)).toBe('password: "***"');
    });
  });

  describe('isSecurityViolation', () => {
    it('should detect content filter', () => {
      const response = {
        choices: [{ finish_reason: 'content_filter' }]
      };
      expect(isSecurityViolation(response)).toBe(true);
    });

    it('should detect security error codes', () => {
      const response1 = { error: { code: 'CONTENT_BLOCKED' } };
      const response2 = { error: { code: 'SECURITY_VIOLATION' } };
      expect(isSecurityViolation(response1)).toBe(true);
      expect(isSecurityViolation(response2)).toBe(true);
    });

    it('should return false for normal responses', () => {
      const response = {
        choices: [{ finish_reason: 'stop' }]
      };
      expect(isSecurityViolation(response)).toBe(false);
    });
  });

  describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).toMatch(/^req_\d+_[a-z0-9]{9}$/);
      expect(id2).toMatch(/^req_\d+_[a-z0-9]{9}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://api.aetherguard.ai')).toBe(true);
      expect(validateUrl('http://localhost:8080')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('')).toBe(false);
    });
  });

  describe('deepMerge', () => {
    it('should merge objects deeply', () => {
      const target = {
        a: 1,
        b: { c: 2, d: 3 },
        e: [1, 2, 3]
      };
      const source = {
        b: { c: 4, f: 5 },
        g: 6
      };
      const result = deepMerge(target, source);
      expect(result).toEqual({
        a: 1,
        b: { c: 4, d: 3, f: 5 },
        e: [1, 2, 3],
        g: 6
      });
    });

    it('should handle undefined values', () => {
      const target = { a: 1, b: 2 };
      const source = { b: undefined, c: 3 };
      const result = deepMerge(target, source);
      expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });
  });
});