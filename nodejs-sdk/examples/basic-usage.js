/**
 * Basic Usage Example - AetherGuard Node.js SDK
 */

const { AetherGuardClient } = require('@aetherguard/nodejs-sdk');

async function basicExample() {
  // Initialize the client
  const client = new AetherGuardClient({
    apiKey: 'your-api-key-here',
    baseUrl: 'http://localhost:8080', // Optional: defaults to localhost:8080
    debug: true // Optional: enable debug logging
  });

  try {
    // Test connection
    console.log('Testing connection...');
    const isConnected = await client.testConnection();
    console.log('Connected:', isConnected);

    // Simple chat completion
    console.log('\n--- Simple Chat Completion ---');
    const response = await client.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'What is artificial intelligence?' }
      ],
      max_tokens: 150
    });

    console.log('Response:', response.choices[0].message.content);
    console.log('Usage:', response.usage);

    // Security scanning
    console.log('\n--- Security Scanning ---');
    const scanResult = await client.scanText({
      text: 'This is a test message for security scanning',
      scanTypes: ['toxicity', 'injection', 'pii']
    });

    console.log('Security scan result:', scanResult);

    // Get usage metrics
    console.log('\n--- Usage Metrics ---');
    const metrics = await client.getUsageMetrics();
    console.log('Usage metrics:', metrics);

    // Get API key info
    console.log('\n--- API Key Info ---');
    const keyInfo = await client.getApiKeyInfo();
    console.log('API Key info:', keyInfo);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
basicExample();