import json
import os
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
kms = boto3.client('kms')

def handler(event, context):
    """
    Policy Management Lambda Handler
    Manages firewall policies stored in DynamoDB
    """
    try:
        http_method = event['httpMethod']
        path_params = event.get('pathParameters', {})
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        
        if http_method == 'GET':
            if path_params and 'policyId' in path_params:
                return get_policy(path_params['policyId'])
            else:
                return list_policies()
        
        elif http_method == 'POST':
            return create_policy(body)
        
        elif http_method == 'PUT':
            return update_policy(path_params['policyId'], body)
        
        elif http_method == 'DELETE':
            return delete_policy(path_params['policyId'])
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return response(500, {'error': str(e)})

def get_policy(policy_id):
    """Get a specific policy"""
    table = dynamodb.Table(os.environ.get('POLICY_TABLE', 'AetherGuardPolicies'))
    result = table.get_item(Key={'policy_id': policy_id})
    
    if 'Item' in result:
        return response(200, result['Item'])
    else:
        return response(404, {'error': 'Policy not found'})

def list_policies():
    """List all policies"""
    table = dynamodb.Table(os.environ.get('POLICY_TABLE', 'AetherGuardPolicies'))
    result = table.scan()
    
    return response(200, {
        'policies': result.get('Items', []),
        'count': len(result.get('Items', []))
    })

def create_policy(policy_data):
    """Create a new policy"""
    table = dynamodb.Table(os.environ.get('POLICY_TABLE', 'AetherGuardPolicies'))
    
    policy_id = policy_data.get('policy_id')
    if not policy_id:
        return response(400, {'error': 'policy_id is required'})
    
    item = {
        'policy_id': policy_id,
        'name': policy_data.get('name', ''),
        'rules': policy_data.get('rules', []),
        'enabled': policy_data.get('enabled', True),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    
    table.put_item(Item=item)
    return response(201, item)

def update_policy(policy_id, policy_data):
    """Update an existing policy"""
    table = dynamodb.Table(os.environ.get('POLICY_TABLE', 'AetherGuardPolicies'))
    
    update_expr = "SET updated_at = :updated_at"
    expr_values = {':updated_at': datetime.utcnow().isoformat()}
    
    if 'name' in policy_data:
        update_expr += ", #n = :name"
        expr_values[':name'] = policy_data['name']
    
    if 'rules' in policy_data:
        update_expr += ", rules = :rules"
        expr_values[':rules'] = policy_data['rules']
    
    if 'enabled' in policy_data:
        update_expr += ", enabled = :enabled"
        expr_values[':enabled'] = policy_data['enabled']
    
    table.update_item(
        Key={'policy_id': policy_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values,
        ExpressionAttributeNames={'#n': 'name'} if 'name' in policy_data else None
    )
    
    return response(200, {'message': 'Policy updated', 'policy_id': policy_id})

def delete_policy(policy_id):
    """Delete a policy"""
    table = dynamodb.Table(os.environ.get('POLICY_TABLE', 'AetherGuardPolicies'))
    table.delete_item(Key={'policy_id': policy_id})
    
    return response(200, {'message': 'Policy deleted', 'policy_id': policy_id})

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
