/**
 * Analytics and Monitoring Example - AetherGuard Node.js SDK
 */

const { AetherGuardClient, formatDate } = require('@aetherguard/nodejs-sdk');

async function analyticsExample() {
  const client = new AetherGuardClient({
    apiKey: 'your-api-key-here'
  });

  try {
    // Get current usage metrics
    console.log('--- Current Usage Metrics ---');
    const metrics = await client.getUsageMetrics();
    console.log('Total requests:', metrics.requests_count);
    console.log('Total tokens used:', metrics.tokens_used);
    console.log('Blocked requests:', metrics.blocked_requests);
    console.log('Security violations by type:');
    metrics.security_violations.forEach(violation => {
      console.log(`- ${violation.type}: ${violation.count}`);
    });

    // Get usage metrics for specific date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days

    console.log('\n--- Weekly Usage Metrics ---');
    const weeklyMetrics = await client.getUsageMetrics(
      formatDate(startDate),
      formatDate(endDate)
    );
    console.log('Weekly requests:', weeklyMetrics.requests_count);
    console.log('Weekly tokens:', weeklyMetrics.tokens_used);

    // Get detailed analytics
    console.log('\n--- Detailed Analytics ---');
    const analytics = await client.getAnalytics({
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      metrics: ['requests', 'tokens', 'violations', 'latency'],
      group_by: 'day',
      filters: {
        model: 'gpt-3.5-turbo'
      }
    });

    console.log('Analytics summary:');
    console.log('- Total requests:', analytics.summary.total_requests);
    console.log('- Total tokens:', analytics.summary.total_tokens);
    console.log('- Total violations:', analytics.summary.total_violations);
    console.log('- Average latency:', analytics.summary.avg_latency_ms, 'ms');

    console.log('\nDaily breakdown:');
    analytics.data.forEach(day => {
      console.log(`${day.timestamp}:`);
      console.log(`  Requests: ${day.metrics.requests || 0}`);
      console.log(`  Tokens: ${day.metrics.tokens || 0}`);
      console.log(`  Violations: ${day.metrics.violations || 0}`);
      console.log(`  Latency: ${day.metrics.latency || 0}ms`);
    });

    // Check provider health
    console.log('\n--- Provider Health Status ---');
    const providers = await client.getProviderHealth();
    providers.forEach(provider => {
      const status = provider.health_status === 'healthy' ? '✅' : 
                    provider.health_status === 'degraded' ? '⚠️' : '❌';
      console.log(`${status} ${provider.name} (${provider.type}): ${provider.health_status} - ${provider.response_time_ms}ms`);
    });

    // Real-time monitoring with WebSocket
    console.log('\n--- Starting Real-time Monitoring ---');
    console.log('Listening for real-time events... (Press Ctrl+C to stop)');
    
    const ws = client.connectWebSocket(
      // onEvent
      (event) => {
        console.log(`[${new Date().toISOString()}] Event: ${event.type}`);
        console.log('Data:', JSON.stringify(event.data, null, 2));
      },
      // onError
      (error) => {
        console.error('WebSocket error:', error.message);
      },
      // onClose
      () => {
        console.log('WebSocket connection closed');
      }
    );

    // Keep the connection alive for demonstration
    setTimeout(() => {
      console.log('\nClosing WebSocket connection...');
      ws.close();
    }, 10000); // Close after 10 seconds

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
analyticsExample();