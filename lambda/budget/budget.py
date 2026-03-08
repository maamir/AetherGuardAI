import json
import os
import boto3
from datetime import datetime, timedelta
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')

def handler(event, context):
    """
    Budget Management Lambda Handler
    Manages per-user token budgets
    """
    try:
        http_method = event['httpMethod']
        path_params = event.get('pathParameters', {})
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        
        if http_method == 'GET':
            if path_params and 'userId' in path_params:
                return get_budget(path_params['userId'])
            else:
                return list_budgets()
        
        elif http_method == 'POST':
            return create_budget(body)
        
        elif http_method == 'PUT':
            return update_budget(path_params['userId'], body)
        
        else:
            return response(405, {'error': 'Method not allowed'})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return response(500, {'error': str(e)})

def get_budget(user_id):
    """Get budget for a specific user"""
    table = dynamodb.Table(os.environ.get('BUDGET_TABLE', 'AetherGuardBudgets'))
    result = table.get_item(Key={'user_id': user_id})
    
    if 'Item' in result:
        item = result['Item']
        # Convert Decimal to float for JSON serialization
        item = convert_decimals(item)
        return response(200, item)
    else:
        return response(404, {'error': 'Budget not found'})

def list_budgets():
    """List all budgets"""
    table = dynamodb.Table(os.environ.get('BUDGET_TABLE', 'AetherGuardBudgets'))
    result = table.scan()
    
    items = [convert_decimals(item) for item in result.get('Items', [])]
    
    return response(200, {
        'budgets': items,
        'count': len(items)
    })

def create_budget(budget_data):
    """Create a new budget"""
    table = dynamodb.Table(os.environ.get('BUDGET_TABLE', 'AetherGuardBudgets'))
    
    user_id = budget_data.get('user_id')
    if not user_id:
        return response(400, {'error': 'user_id is required'})
    
    item = {
        'user_id': user_id,
        'daily_limit': Decimal(str(budget_data.get('daily_limit', 10000))),
        'monthly_limit': Decimal(str(budget_data.get('monthly_limit', 300000))),
        'current_daily_usage': Decimal('0'),
        'current_monthly_usage': Decimal('0'),
        'reset_date': (datetime.utcnow() + timedelta(days=1)).isoformat(),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    
    table.put_item(Item=item)
    return response(201, convert_decimals(item))

def update_budget(user_id, budget_data):
    """Update an existing budget"""
    table = dynamodb.Table(os.environ.get('BUDGET_TABLE', 'AetherGuardBudgets'))
    
    update_expr = "SET updated_at = :updated_at"
    expr_values = {':updated_at': datetime.utcnow().isoformat()}
    
    if 'daily_limit' in budget_data:
        update_expr += ", daily_limit = :daily_limit"
        expr_values[':daily_limit'] = Decimal(str(budget_data['daily_limit']))
    
    if 'monthly_limit' in budget_data:
        update_expr += ", monthly_limit = :monthly_limit"
        expr_values[':monthly_limit'] = Decimal(str(budget_data['monthly_limit']))
    
    if 'current_daily_usage' in budget_data:
        update_expr += ", current_daily_usage = :current_daily_usage"
        expr_values[':current_daily_usage'] = Decimal(str(budget_data['current_daily_usage']))
    
    if 'current_monthly_usage' in budget_data:
        update_expr += ", current_monthly_usage = :current_monthly_usage"
        expr_values[':current_monthly_usage'] = Decimal(str(budget_data['current_monthly_usage']))
    
    table.update_item(
        Key={'user_id': user_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values
    )
    
    return response(200, {'message': 'Budget updated', 'user_id': user_id})

def convert_decimals(obj):
    """Convert Decimal objects to float for JSON serialization"""
    if isinstance(obj, list):
        return [convert_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return float(obj)
    else:
        return obj

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
