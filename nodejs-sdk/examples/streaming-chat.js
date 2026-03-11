/**
 * Streaming Chat Example - AetherGuard Node.js SDK
 */

const { AetherGuardClient } = require('@aetherguard/nodejs-sdk');

async function streamingExample() {
  const client = new AetherGuardClient({
    apiKey: 'your-api-key-here',
    debug: true
  });

  console.log('Starting streaming chat completion...\n');

  try {
    await client.createChatCompletionStream(
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Write a short story about a robot learning to paint' }
        ],
        max_tokens: 300,
        temperature: 0.7
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
        console.error('\nStreaming error:', error);
      },
      // onComplete callback
      () => {
        console.log('\n\nStreaming completed!');
      }
    );

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
streamingExample();