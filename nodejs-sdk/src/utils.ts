/**
 * AetherGuard Node.js SDK - Utility Functions
 */

import { ChatMessage, PolicyRule } from './types';

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string): boolean {
  // AetherGuard API keys should be at least 32 characters
  return typeof apiKey === 'string' && apiKey.length >= 32;
}

/**
 * Format messages for OpenAI-compatible API
 */
export function formatMessages(messages: string | ChatMessage[]): ChatMessage[] {
  if (typeof messages === 'string') {
    return [{ role: 'user', content: messages }];
  }
  return messages;
}

/**
 * Create a simple chat completion request
 */
export function createSimpleRequest(
  prompt: string,
  model: string = 'gpt-3.5-turbo',
  options: {
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {}
) {
  const messages: ChatMessage[] = [];
  
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  
  messages.push({ role: 'user', content: prompt });

  return {
    model,
    messages,
    max_tokens: options.maxTokens,
    temperature: options.temperature
  };
}

/**
 * Extract text content from chat completion response
 */
export function extractResponseText(response: any): string {
  return response.choices?.[0]?.message?.content || '';
}

/**
 * Calculate token estimate (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Validate security policy rules
 */
export function validatePolicyRules(rules: PolicyRule[]): string[] {
  const errors: string[] = [];
  
  for (const rule of rules) {
    if (!['toxicity', 'injection', 'pii', 'adversarial', 'secrets', 'dos', 'bias', 'brand_safety'].includes(rule.type)) {
      errors.push(`Invalid rule type: ${rule.type}`);
    }
    
    if (rule.threshold < 0 || rule.threshold > 1) {
      errors.push(`Invalid threshold for ${rule.type}: must be between 0 and 1`);
    }
    
    if (!['block', 'warn', 'log'].includes(rule.action)) {
      errors.push(`Invalid action for ${rule.type}: must be 'block', 'warn', or 'log'`);
    }
  }
  
  return errors;
}

/**
 * Format date for API queries
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse error response
 */
export function parseError(error: any): { code: string; message: string; details?: any } {
  if (error.response?.data) {
    return {
      code: error.response.data.code || 'API_ERROR',
      message: error.response.data.message || 'An API error occurred',
      details: error.response.data.details
    };
  }
  
  return {
    code: 'NETWORK_ERROR',
    message: error.message || 'A network error occurred'
  };
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Sanitize text for logging (remove sensitive data)
 */
export function sanitizeForLogging(text: string): string {
  // Remove potential API keys, tokens, passwords
  return text
    .replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-***')
    .replace(/Bearer [a-zA-Z0-9-._~+/]+=*/g, 'Bearer ***')
    .replace(/password["\s]*[:=]["\s]*"[^"]+"/gi, 'password: "***"')
    .replace(/token["\s]*[:=]["\s]*"[^"]+"/gi, 'token: "***"');
}

/**
 * Check if response indicates a security violation
 */
export function isSecurityViolation(response: any): boolean {
  return response.choices?.[0]?.finish_reason === 'content_filter' ||
         response.error?.code === 'CONTENT_BLOCKED' ||
         response.error?.code === 'SECURITY_VIOLATION';
}

/**
 * Generate request ID for tracking
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {} as any, source[key] as any);
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }
  
  return result;
}