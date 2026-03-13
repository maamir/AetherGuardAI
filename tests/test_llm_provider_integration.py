#!/usr/bin/env python3
"""
Test script to verify LLM provider integration with database
"""
import requests
import json
import hashlib
import secrets

# Generate a test API key for GFenesis tenant
api_key = f"ag_test_{secrets.token_urlsafe(32)}"
key_hash = hashlib.sha256(api_key.encode()).hexdigest()

print(f"Generated API key: {api_key}")
print(f"Key hash: {key_hash}")

# Insert the API key into database for GFenesis tenant
import subprocess
tenant_id = "69dc7533-8c55-42da-b67e-6411fd78a446"

insert_cmd = f"""
docker-compose exec -T postgres psql -U aetherguard -d aetherguard -c "
INSERT INTO api_keys (id, tenant_id, name, key_hash, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), '{tenant_id}', 'Test Integration Key', '{key_hash}', true, NOW(), NOW())
ON CONFLICT DO NOTHING;
"
"""

print("\nInserting API key into database...")
result = subprocess.run(insert_cmd, shell=True, capture_output=True, text=True)
print(result.stdout)
if result.returncode != 0:
    print(f"Error: {result.stderr}")
    exit(1)

# Test the proxy with this API key
print("\nTesting chat completion with database provider...")
response = requests.post(
    "http://localhost:8080/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    },
    json={
        "model": "gpt-4",
        "messages": [
            {"role": "user", "content": "Hello, this is a test!"}
        ]
    }
)

print(f"Status Code: {response.status_code}")
print(f"Response Headers:")
for key, value in response.headers.items():
    if key.startswith('X-'):
        print(f"  {key}: {value}")

if response.status_code == 200:
    data = response.json()
    print(f"\nResponse:")
    print(json.dumps(data, indent=2))
    
    # Check if it's using the mock response or real provider
    content = data['choices'][0]['message']['content']
    if "mock response" in content.lower():
        print("\n❌ FAILED: Still using mock response")
        print("Check proxy-engine logs for details")
    else:
        print("\n✅ SUCCESS: Using real LLM provider from database!")
else:
    print(f"\n❌ ERROR: {response.text}")

print("\nCheck proxy-engine logs:")
print("docker-compose logs --tail=20 proxy-engine | grep -E '(forward_to_llm|Database available|provider|tenant)'")
