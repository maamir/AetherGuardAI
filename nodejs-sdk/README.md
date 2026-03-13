# AetherGuard Node.js SDK

Official Node.js SDK for [AetherGuard AI Gateway](https://aetherguard.ai) - A secure AI API proxy with advanced security features including toxicity detection, prompt injection prevention, PII redaction, and comprehensive monitoring.

## Features

- 🛡️ **Security-First**: Built-in protection against harmful content, prompt injection, and data leaks
- 🔌 **OpenAI Compatible**: Drop-in replacement for OpenAI SDK with enhanced security
- 📊 **Real-time Monitoring**: Usage analytics, security events, and provider health monitoring
- 🎯 **Policy Management**: Flexible security policies with customizable rules and thresholds
- 🚀 **High Performance**: Optimized for production workloads with retry logic and error handling
- 📡 **Streaming Support**: Real-time chat completions with security scanning
- 🔧 **TypeScript**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @aetherguard/nodejs-sdk
```

## Quick Start

```javascript
const { AetherGuardClient } = require('@aetherguard/nodejs-sdk');

// Initialize the client
const client = new AetherGuardClient({
  apiKey: 'your-aetherguard-api-key',
  baseUrl: process.env.AETHERGUARD_BASE_URL || 'https://api.aetherguard.ai'
});

// Make a secure chat completion
async function example() {
  try {
    const response = await client.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'What is artificial intelligence?' }
      ],
      max_tokens: 150
    });
    
    console.log(response.choices[0].message.content);
  } catch (error) {
    if (error.code === 'CONTENT_BLOCKED') {
      console.log('Content was blocked by security policy');
    } else {
      console.error('Error:', error.message);
    }
  }
}

example();
```

## Configuration

### Basic Configuration

```javascript
const client = new AetherGuardClient({
  apiKey: 'your-api-key',           // Required: Your AetherGuard API key
  baseUrl: process.env.AETHERGUARD_BASE_URL || 'https://api.aetherguard.ai', // Optional: API endpoint
  timeout: 30000,                   // Optional: Request timeout in ms (default: 30000)
  retries: 3,                       // Optional: Max retry attempts (default: 3)
  debug: false                      // Optional: Enable debug logging (default: false)
});
```

### Environment Variables

You can also configure using environment variables:

```bash
export AETHERGUARD_API_KEY="your-api-key"
export AETHERGUARD_BASE_URL="https://api.aetherguard.ai"
```

```javascript
const client = new AetherGuardClient({
  apiKey: process.env.AETHERGUARD_API_KEY,
  baseUrl: process.env.AETHERGUARD_BASE_URL
});
```

## Core Features

### Chat Completions

Standard OpenAI-compatible chat completions with built-in security:

```javascript
const response = await client.createChatCompletion({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing' }
  ],
  max_tokens: 200,
  temperature: 0.7
});

console.log(response.choices[0].message.content);
console.log('Tokens used:', response.usage.total_tokens);
```

### Streaming Chat Completions

Real-time streaming with security scanning:

```javascript
await client.createChatCompletionStream(
  {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'Write a story about AI' }],
    max_tokens: 300
  },
  // onChunk callback
  (chunk) => {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
    }
  },
  // onError callback
  (error) => {
    console.error('Stream error:', error);
  },
  // onComplete callback
  () => {
    console.log('\nStream completed!');
  }
);
```

### Security Scanning

Scan text for security violations before processing:

```javascript
const scanResult = await client.scanText({
  text: 'Your text to scan',
  scanTypes: ['toxicity', 'injection', 'pii', 'adversarial', 'secrets']
});

if (!scanResult.safe) {
  console.log('Security violations found:');
  scanResult.violations.forEach(violation => {
    console.log(`- ${violation.type}: ${violation.score} (${violation.details})`);
  });
}

// Use redacted text if PII was found
if (scanResult.redacted_text) {
  console.log('Redacted text:', scanResult.redacted_text);
}
```

### Usage Analytics

Monitor your API usage and security events:

```javascript
// Get current usage metrics
const metrics = await client.getUsageMetrics();
console.log('Total requests:', metrics.requests_count);
console.log('Blocked requests:', metrics.blocked_requests);
console.log('Security violations:', metrics.security_violations);

// Get metrics for specific date range
const weeklyMetrics = await client.getUsageMetrics('2024-01-01', '2024-01-07');

// Get detailed analytics
const analytics = await client.getAnalytics({
  start_date: '2024-01-01',
  end_date: '2024-01-07',
  metrics: ['requests', 'tokens', 'violations', 'latency'],
  group_by: 'day',
  filters: {
    model: 'gpt-3.5-turbo'
  }
});
```

## Security Policies

### Managing Security Policies

```javascript
// List all policies
const policies = await client.listPolicies();

// Create a new policy
const newPolicy = await client.createPolicy({
  name: 'Strict Content Policy',
  description: 'High security for sensitive applications',
  enabled: true,
  rules: [
    {
      type: 'toxicity',
      threshold: 0.3,    // Lower = more strict
      action: 'block',   // block, warn, or log
      enabled: true
    },
    {
      type: 'injection',
      threshold: 0.5,
      action: 'block',
      enabled: true
    },
    {
      type: 'pii',
      threshold: 0.7,
      action: 'warn',    // Warn instead of block for PII
      enabled: true
    }
  ]
});

// Update a policy
const updatedPolicy = await client.updatePolicy(newPolicy.id, {
  description: 'Updated policy description'
});

// Delete a policy
await client.deletePolicy(newPolicy.id);
```

### Available Security Rules

| Rule Type | Description | Threshold Range |
|-----------|-------------|-----------------|
| `toxicity` | Detects harmful, abusive, or toxic content | 0.0 - 1.0 |
| `injection` | Prevents prompt injection attacks | 0.0 - 1.0 |
| `pii` | Detects personally identifiable information | 0.0 - 1.0 |
| `adversarial` | Detects adversarial inputs and attacks | 0.0 - 1.0 |
| `secrets` | Detects API keys, passwords, and secrets | 0.0 - 1.0 |
| `dos` | Prevents denial-of-service patterns | 0.0 - 1.0 |
| `bias` | Detects biased or discriminatory content | 0.0 - 1.0 |
| `brand_safety` | Ensures brand-safe content generation | 0.0 - 1.0 |

## Provider Management

Monitor and manage LLM providers:

```javascript
// List all providers
const providers = await client.listProviders();
providers.forEach(provider => {
  console.log(`${provider.name} (${provider.type}): ${provider.health_status}`);
});

// Get provider health status
const healthStatus = await client.getProviderHealth();
healthStatus.forEach(provider => {
  console.log(`${provider.name}: ${provider.response_time_ms}ms`);
});

// Get specific provider details
const provider = await client.getProvider('openai-gpt-3.5');
console.log('Available models:', provider.models);
```

## Real-time Monitoring

Connect to real-time events via WebSocket:

```javascript
const ws = client.connectWebSocket(
  // onEvent callback
  (event) => {
    console.log(`Event: ${event.type}`);
    switch (event.type) {
      case 'security_violation':
        console.log('Security violation:', event.data);
        break;
      case 'usage_limit_exceeded':
        console.log('Usage limit exceeded:', event.data);
        break;
      case 'provider_health_change':
        console.log('Provider health changed:', event.data);
        break;
    }
  },
  // onError callback
  (error) => {
    console.error('WebSocket error:', error);
  },
  // onClose callback
  () => {
    console.log('WebSocket connection closed');
  }
);

// Close connection when done
setTimeout(() => ws.close(), 60000);
```

## API Key Management

Manage your API key settings:

```javascript
// Get current API key info
const keyInfo = await client.getApiKeyInfo();
console.log('Usage:', keyInfo.usage_count, '/', keyInfo.usage_limit);
console.log('Status:', keyInfo.status);

// Update API key settings
const updatedKey = await client.updateApiKey({
  name: 'Production API Key',
  usage_limit: 10000,
  ip_whitelist: ['192.168.1.0/24', '10.0.0.0/8'],
  usage_alerts: true
});
```

## Error Handling

The SDK provides structured error handling:

```javascript
try {
  const response = await client.createChatCompletion(request);
} catch (error) {
  switch (error.code) {
    case 'CONTENT_BLOCKED':
      console.log('Content blocked by security policy');
      break;
    case 'RATE_LIMIT_EXCEEDED':
      console.log('Rate limit exceeded, please retry later');
      break;
    case 'INVALID_API_KEY':
      console.log('Invalid API key provided');
      break;
    case 'PROVIDER_UNAVAILABLE':
      console.log('LLM provider is currently unavailable');
      break;
    default:
      console.log('Unexpected error:', error.message);
  }
  
  // Access additional error details
  if (error.request_id) {
    console.log('Request ID for support:', error.request_id);
  }
}
```

## Utility Functions

The SDK includes helpful utility functions:

```javascript
const { 
  createSimpleRequest, 
  extractResponseText, 
  estimateTokens,
  validateApiKey,
  sanitizeForLogging 
} = require('@aetherguard/nodejs-sdk');

// Create a simple request
const request = createSimpleRequest(
  'Explain machine learning',
  'gpt-3.5-turbo',
  { maxTokens: 200, temperature: 0.7 }
);

// Extract response text
const text = extractResponseText(response);

// Estimate token usage
const tokenCount = estimateTokens('Your text here');

// Validate API key format
const isValid = validateApiKey('your-api-key');

// Sanitize sensitive data for logging
const safeText = sanitizeForLogging('API key: sk-123456...');
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import { 
  AetherGuardClient, 
  ChatCompletionRequest, 
  SecurityScanResponse,
  SecurityPolicy 
} from '@aetherguard/nodejs-sdk';

const client = new AetherGuardClient({
  apiKey: process.env.AETHERGUARD_API_KEY!
});

const request: ChatCompletionRequest = {
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello' }],
  max_tokens: 100
};

const response = await client.createChatCompletion(request);
```

## Examples

Check out the [examples directory](./examples/) for complete working examples:

- [Basic Usage](./examples/basic-usage.js) - Simple chat completions and security scanning
- [Streaming Chat](./examples/streaming-chat.js) - Real-time streaming responses
- [Security Policies](./examples/security-policies.js) - Managing security policies
- [Analytics & Monitoring](./examples/analytics-monitoring.js) - Usage analytics and real-time monitoring
- [Advanced Features](./examples/advanced-features.js) - Advanced SDK features and utilities

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test -- --coverage
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://docs.aetherguard.ai)
- 💬 [Discord Community](https://discord.gg/aetherguard)
- 📧 [Email Support](mailto:support@aetherguard.ai)
- 🐛 [Issue Tracker](https://github.com/aetherguard/nodejs-sdk/issues)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and version history.