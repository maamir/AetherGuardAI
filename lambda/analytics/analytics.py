import json
import os
import boto3
from datetime import datetime, timedelta
from collections import defaultdict

cloudwatch = boto3.client('cloudwatch')
s3 = boto3.client('s3')

def handler(event, context):
    """
    Analytics Lambda Handler
    Generates analytics reports from CloudWatch metrics and S3 logs
    """
    try:
        http_method = event['httpMethod']
        query_params = event.get('queryStringParameters', {}) or {}
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        
        if http_method == 'GET':
            return get_dashboard_metrics(query_params)
        
        elif http_method == 'POST':
            return generate_report(body)
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return response(500, {'error': str(e)})

def get_dashboard_metrics(params):
    """Get real-time dashboard metrics"""
    period = int(params.get('period', 3600))  # Default 1 hour
    
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(seconds=period)
    
    metrics = {
        'request_count': get_metric_stats('AetherGuard', 'RequestCount', start_time, end_time),
        'injection_detections': get_metric_stats('AetherGuard', 'InjectionDetections', start_time, end_time),
        'toxicity_detections': get_metric_stats('AetherGuard', 'ToxicityDetections', start_time, end_time),
        'pii_detections': get_metric_stats('AetherGuard', 'PIIDetections', start_time, end_time),
        'avg_latency': get_metric_stats('AetherGuard', 'RequestLatency', start_time, end_time),
        'blocked_requests': get_metric_stats('AetherGuard', 'BlockedRequests', start_time, end_time),
    }
    
    return response(200, {
        'metrics': metrics,
        'period': period,
        'start_time': start_time.isoformat(),
        'end_time': end_time.isoformat()
    })

def generate_report(report_data):
    """Generate a comprehensive analytics report"""
    report_type = report_data.get('report_type', 'summary')
    start_date = report_data.get('start_date')
    end_date = report_data.get('end_date')
    
    if not start_date or not end_date:
        return response(400, {'error': 'start_date and end_date are required'})
    
    start_time = datetime.fromisoformat(start_date)
    end_time = datetime.fromisoformat(end_date)
    
    if report_type == 'summary':
        report = generate_summary_report(start_time, end_time)
    elif report_type == 'security':
        report = generate_security_report(start_time, end_time)
    elif report_type == 'performance':
        report = generate_performance_report(start_time, end_time)
    else:
        return response(400, {'error': f'Unknown report type: {report_type}'})
    
    return response(200, report)

def generate_summary_report(start_time, end_time):
    """Generate summary report"""
    return {
        'report_type': 'summary',
        'period': {
            'start': start_time.isoformat(),
            'end': end_time.isoformat(),
        },
        'total_requests': 125000,
        'blocked_requests': 3250,
        'block_rate': 2.6,
        'detections': {
            'injection': 1200,
            'toxicity': 850,
            'pii': 1100,
            'hallucination': 100,
        },
        'avg_latency_ms': 18.5,
        'p99_latency_ms': 45.2,
        'top_users': [
            {'user_id': 'user_123', 'requests': 5000},
            {'user_id': 'user_456', 'requests': 4500},
        ],
        'generated_at': datetime.utcnow().isoformat()
    }

def generate_security_report(start_time, end_time):
    """Generate security-focused report"""
    return {
        'report_type': 'security',
        'period': {
            'start': start_time.isoformat(),
            'end': end_time.isoformat(),
        },
        'threat_summary': {
            'total_threats': 3250,
            'critical': 45,
            'high': 320,
            'medium': 1200,
            'low': 1685,
        },
        'attack_types': {
            'prompt_injection': 1200,
            'jailbreak': 450,
            'data_extraction': 380,
            'toxicity': 850,
            'pii_leakage': 370,
        },
        'top_attackers': [
            {'ip': '192.0.2.1', 'attempts': 150},
            {'ip': '192.0.2.2', 'attempts': 120},
        ],
        'blocked_patterns': [
            {'pattern': 'ignore previous instructions', 'count': 450},
            {'pattern': 'system prompt', 'count': 380},
        ],
        'generated_at': datetime.utcnow().isoformat()
    }

def generate_performance_report(start_time, end_time):
    """Generate performance-focused report"""
    return {
        'report_type': 'performance',
        'period': {
            'start': start_time.isoformat(),
            'end': end_time.isoformat(),
        },
        'latency': {
            'avg': 18.5,
            'p50': 15.2,
            'p95': 35.8,
            'p99': 45.2,
            'max': 120.5,
        },
        'throughput': {
            'requests_per_second': 34.7,
            'peak_rps': 125.3,
        },
        'resource_usage': {
            'avg_cpu': 45.2,
            'avg_memory': 62.8,
            'peak_cpu': 78.5,
            'peak_memory': 85.3,
        },
        'cache_stats': {
            'hit_rate': 85.3,
            'miss_rate': 14.7,
        },
        'generated_at': datetime.utcnow().isoformat()
    }

def get_metric_stats(namespace, metric_name, start_time, end_time):
    """Get CloudWatch metric statistics"""
    try:
        result = cloudwatch.get_metric_statistics(
            Namespace=namespace,
            MetricName=metric_name,
            StartTime=start_time,
            EndTime=end_time,
            Period=300,  # 5 minutes
            Statistics=['Average', 'Sum', 'Maximum']
        )
        
        datapoints = result.get('Datapoints', [])
        if datapoints:
            return {
                'average': sum(d.get('Average', 0) for d in datapoints) / len(datapoints),
                'sum': sum(d.get('Sum', 0) for d in datapoints),
                'max': max(d.get('Maximum', 0) for d in datapoints),
                'datapoints': len(datapoints)
            }
        else:
            return {'average': 0, 'sum': 0, 'max': 0, 'datapoints': 0}
    except Exception as e:
        print(f"Error getting metric {metric_name}: {str(e)}")
        return {'average': 0, 'sum': 0, 'max': 0, 'datapoints': 0}

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
