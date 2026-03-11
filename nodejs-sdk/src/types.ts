/**
 * AetherGuard Node.js SDK Types
 */

// Configuration types
export interface AetherGuardConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  debug?: boolean;
}

// OpenAI-compatible types
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Security and monitoring types
export interface SecurityScanRequest {
  text: string;
  scanTypes?: ('toxicity' | 'injection' | 'pii' | 'adversarial' | 'secrets' | 'dos')[];
}

export interface SecurityScanResponse {
  safe: boolean;
  violations: Array<{
    type: string;
    score: number;
    details: string;
  }>;
  redacted_text?: string;
}

export interface UsageMetrics {
  requests_count: number;
  tokens_used: number;
  blocked_requests: number;
  security_violations: Array<{
    type: string;
    count: number;
  }>;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  created_at: string;
  last_used?: string;
  usage_limit?: number;
  usage_count: number;
  ip_whitelist?: string[];
  usage_alerts?: boolean;
  status: 'active' | 'inactive' | 'suspended';
}

// Policy types
export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: PolicyRule[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PolicyRule {
  type: 'toxicity' | 'injection' | 'pii' | 'adversarial' | 'secrets' | 'dos' | 'bias' | 'brand_safety';
  threshold: number;
  action: 'block' | 'warn' | 'log';
  enabled: boolean;
}

// Provider types
export interface LLMProvider {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'bedrock' | 'azure' | 'custom';
  endpoint: string;
  models: string[];
  enabled: boolean;
  health_status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms: number;
}

// Error types
export interface AetherGuardError {
  code: string;
  message: string;
  details?: any;
  request_id?: string;
}

// Streaming types
export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
}

// Webhook types
export interface WebhookEvent {
  id: string;
  type: 'security_violation' | 'usage_limit_exceeded' | 'provider_health_change';
  timestamp: string;
  data: any;
}

// Analytics types
export interface AnalyticsQuery {
  start_date: string;
  end_date: string;
  metrics: ('requests' | 'tokens' | 'violations' | 'latency')[];
  group_by?: 'hour' | 'day' | 'week';
  filters?: {
    model?: string;
    user_id?: string;
    violation_type?: string;
  };
}

export interface AnalyticsResponse {
  data: Array<{
    timestamp: string;
    metrics: {
      [key: string]: number;
    };
  }>;
  summary: {
    total_requests: number;
    total_tokens: number;
    total_violations: number;
    avg_latency_ms: number;
  };
}