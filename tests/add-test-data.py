#!/usr/bin/env python3
"""
Add test data to the database for demonstration purposes
"""

import psycopg2
from datetime import datetime, timedelta
import uuid
import random

# Database connection
conn = psycopg2.connect(
    host="postgres",
    port="5432",
    database="aetherguard",
    user="aetherguard",
    password="password"
)
cur = conn.cursor()

# Get the test tenant ID
cur.execute("SELECT id FROM tenants WHERE name = 'Test Company'")
tenant_result = cur.fetchone()
if not tenant_result:
    print("Test tenant not found!")
    exit(1)

tenant_id = tenant_result[0]
print(f"Using tenant ID: {tenant_id}")

# Get an API key for the tenant
cur.execute("SELECT id FROM api_keys WHERE tenant_id = %s LIMIT 1", (tenant_id,))
api_key_result = cur.fetchone()
api_key_id = api_key_result[0] if api_key_result else None

# Add usage analytics data for the last 7 days
print("Adding usage analytics data...")
for i in range(7):
    date = (datetime.now() - timedelta(days=i)).date()
    
    # Random usage data
    total_requests = random.randint(1000, 5000)
    successful_requests = int(total_requests * 0.85)
    blocked_requests = int(total_requests * 0.10)
    failed_requests = total_requests - successful_requests - blocked_requests
    total_tokens = random.randint(50000, 200000)
    cost_usd = round(total_tokens * 0.002 / 1000, 4)  # Rough cost calculation
    avg_latency_ms = random.randint(15, 50)
    
    cur.execute("""
        INSERT INTO usage_analytics 
        (id, tenant_id, api_key_id, date, total_requests, successful_requests, 
         blocked_requests, failed_requests, total_tokens, cost_usd, avg_latency_ms)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        str(uuid.uuid4()), tenant_id, api_key_id, date,
        total_requests, successful_requests, blocked_requests, failed_requests,
        total_tokens, cost_usd, avg_latency_ms
    ))

# Add security events
print("Adding security events...")
event_types = ['prompt_injection', 'toxicity', 'pii_detection', 'hallucination', 'bias_detection']
severities = ['low', 'medium', 'high', 'critical']

for i in range(50):  # Add 50 security events
    created_at = datetime.now() - timedelta(
        days=random.randint(0, 6),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59)
    )
    
    event_type = random.choice(event_types)
    severity = random.choice(severities)
    
    cur.execute("""
        INSERT INTO security_events 
        (id, tenant_id, api_key_id, event_type, severity, description, metadata, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        str(uuid.uuid4()), tenant_id, api_key_id, event_type, severity,
        f"Detected {event_type} with {severity} severity",
        f'{{"detected_content": "sample_{event_type}", "confidence": {random.randint(70, 99)}}}',
        created_at
    ))

# Add some policies if they don't exist
print("Adding sample policies...")
policy_categories = ['prompt_injection', 'toxicity', 'pii', 'hallucination', 'bias']
feature_names = {
    'detection': 'Detection',
    'blocking': 'Blocking',
    'logging': 'Logging'
}

for category in policy_categories:
    for feature, feature_name in feature_names.items():
        try:
            cur.execute("""
                INSERT INTO policy_configs 
                (id, tenant_id, category, feature_key, feature_name, enabled, config)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                str(uuid.uuid4()), tenant_id, category, feature, feature_name,
                random.choice([True, False]),
                f'{{"threshold": {random.randint(70, 90)}, "action": "block"}}'
            ))
        except Exception as e:
            # Skip if already exists
            pass

conn.commit()
cur.close()
conn.close()

print("Test data added successfully!")
print("You can now refresh the dashboard to see the data.")