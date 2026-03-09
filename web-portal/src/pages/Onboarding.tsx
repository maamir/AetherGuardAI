import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Key, Settings, CheckCircle, Code, Database, Zap } from 'lucide-react';

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [config, setConfig] = useState({
    enablePII: true,
    enableToxicity: true,
    enableInjection: true,
    enableHallucination: false,
    piiRedactionStrategy: 'mask',
    toxicityThreshold: 0.8,
  });

  const generateApiKey = () => {
    const key = 'ag_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setApiKey(key);
  };

  const handleComplete = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900">Welcome to AetherGuard AI</h1>
          <p className="text-gray-600 mt-2">Let's get you set up in just a few steps</p>
        </div>

        {/* Progress */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step >= s ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {step > s ? <CheckCircle className="w-6 h-6" /> : s}
                </div>
                {s < 3 && <div className="w-16 h-0.5 bg-gray-300 mx-2"></div>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xl p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <Key className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Generate Your API Key</h2>
                <p className="text-gray-600">This key will be used to authenticate your requests</p>
              </div>

              {!apiKey ? (
                <div className="text-center py-8">
                  <button
                    onClick={generateApiKey}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700"
                  >
                    Generate API Key
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your API Key
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white px-4 py-3 rounded border border-gray-300 font-mono text-sm">
                        {apiKey}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(apiKey)}
                        className="px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Important:</strong> Save this key securely. You won't be able to see it again.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!apiKey}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <Settings className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure Security Settings</h2>
                <p className="text-gray-600">Choose which detectors to enable</p>
              </div>

              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">PII Detection</h3>
                      <p className="text-sm text-gray-600">Detect and redact sensitive personal information</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enablePII}
                        onChange={(e) => setConfig({ ...config, enablePII: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  {config.enablePII && (
                    <select
                      value={config.piiRedactionStrategy}
                      onChange={(e) => setConfig({ ...config, piiRedactionStrategy: e.target.value })}
                      className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="mask">Mask (e.g., [EMAIL])</option>
                      <option value="substitute">Substitute (e.g., fake data)</option>
                      <option value="hash">Hash (e.g., SHA-256)</option>
                      <option value="synthetic">Synthetic (e.g., generated data)</option>
                    </select>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">Toxicity Detection</h3>
                      <p className="text-sm text-gray-600">Filter harmful, abusive, and profane content</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enableToxicity}
                        onChange={(e) => setConfig({ ...config, enableToxicity: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  {config.enableToxicity && (
                    <div className="mt-2">
                      <label className="text-sm text-gray-600">Threshold: {config.toxicityThreshold}</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={config.toxicityThreshold}
                        onChange={(e) => setConfig({ ...config, toxicityThreshold: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">Prompt Injection Detection</h3>
                      <p className="text-sm text-gray-600">Detect malicious prompt manipulation attempts</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enableInjection}
                        onChange={(e) => setConfig({ ...config, enableInjection: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">Hallucination Detection</h3>
                      <p className="text-sm text-gray-600">Verify factual accuracy of AI responses</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.enableHallucination}
                        onChange={(e) => setConfig({ ...config, enableHallucination: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <Code className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Integration Guide</h2>
                <p className="text-gray-600">Start using AetherGuard AI in your application</p>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">1. Install SDK (Optional)</h3>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <code>npm install @aetherguard/sdk</code>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">2. Make Your First Request</h3>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`curl -X POST http://localhost:8080/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-2">3. Using the SDK</h3>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{`import { AetherGuard } from '@aetherguard/sdk';

const client = new AetherGuard({
  apiKey: '${apiKey}',
  baseURL: 'http://localhost:8080'
});

const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});`}</pre>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">Quick Tips</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• View real-time metrics in the Dashboard</li>
                        <li>• Configure policies in the Policies section</li>
                        <li>• Monitor usage in Budget Management</li>
                        <li>• Review audit logs for compliance</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleComplete}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
