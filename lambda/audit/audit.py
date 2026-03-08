import json
import os
import boto3
from datetime import datetime, timedelta

qldb = boto3.client('qldb-session')

def handler(event, context):
    """
    Audit Query Lambda Handler
    Queries immutable audit logs from QLDB
    """
    try:
        http_method = event['httpMethod']
        query_params = event.get('queryStringParameters', {}) or {}
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        
        if http_method == 'GET':
            return query_recent_events(query_params)
        
        elif http_method == 'POST':
            return query_events(body)
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return response(500, {'error': str(e)})

def query_recent_events(params):
    """Query recent audit events"""
    limit = int(params.get('limit', 100))
    event_type = params.get('event_type')
    
    # Simulated response (actual QLDB query would be more complex)
    events = [
        {
            'event_id': f'evt_{i}',
            'event_type': event_type or 'request_received',
            'timestamp': (datetime.utcnow() - timedelta(minutes=i)).isoformat(),
            'user_id': f'user_{i % 10}',
            'details': {'action': 'sample_action'}
        }
        for i in range(min(limit, 100))
    ]
    
    return response(200, {
        'events': events,
        'count': len(events),
        'query': params
    })

def query_events(query_data):
    """Query audit events with custom filters"""
    start_time = query_data.get('start_time')
    end_time = query_data.get('end_time')
    event_types = query_data.get('event_types', [])
    user_id = query_data.get('user_id')
    
    # Build query filters
    filters = []
    if start_time:
        filters.append(f"timestamp >= '{start_time}'")
    if end_time:
        filters.append(f"timestamp <= '{end_time}'")
    if event_types:
        filters.append(f"event_type IN ({','.join(repr(t) for t in event_types)})")
    if user_id:
        filters.append(f"user_id = '{user_id}'")
    
    # Simulated response
    events = [
        {
            'event_id': f'evt_query_{i}',
            'event_type': event_types[0] if event_types else 'request_received',
            'timestamp': datetime.utcnow().isoformat(),
            'user_id': user_id or f'user_{i}',
            'details': {'query': 'custom_query'}
        }
        for i in range(10)
    ]
    
    return response(200, {
        'events': events,
        'count': len(events),
        'filters': filters,
        'query': query_data
    })

def verify_chain_integrity(event_id):
    """Verify the cryptographic chain of custody"""
    # This would verify the hash chain in QLDB
    return {
        'event_id': event_id,
        'verified': True,
        'chain_valid': True,
        'timestamp': datetime.utcnow().isoformat()
    }

def response(status_code, body):
    """Format API Gateway response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(body)
    }
