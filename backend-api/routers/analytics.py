"""
Analytics Router
Tenant-facing analytics and usage statistics
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import Optional

from models.base import get_db
from models.usage_analytics import UsageAnalytics
from models.security_event import SecurityEvent
from .tenant_auth import get_current_tenant_user

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


# Helper function to get tenant_id (simplified for now)
def get_tenant_id_from_user(user_id: str, db: Session) -> str:
    from models.tenant import Tenant
    tenant = db.query(Tenant).filter(Tenant.owner_id == user_id).first()
    if not tenant:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Tenant not found")
    return str(tenant.id)


@router.get("/usage")
async def get_usage_analytics(
    days: int = Query(7, ge=1, le=90),
    api_key_id: Optional[str] = None,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get usage analytics for the tenant
    """
    tenant_id = current_user["tenant_id"]
    
    start_date = datetime.utcnow().date() - timedelta(days=days)
    
    query = db.query(
        UsageAnalytics.date,
        func.sum(UsageAnalytics.total_requests).label("requests"),
        func.sum(UsageAnalytics.successful_requests).label("successful"),
        func.sum(UsageAnalytics.blocked_requests).label("blocked"),
        func.sum(UsageAnalytics.failed_requests).label("failed"),
        func.sum(UsageAnalytics.total_tokens).label("tokens"),
        func.sum(UsageAnalytics.cost_usd).label("cost"),
        func.avg(UsageAnalytics.avg_latency_ms).label("latency")
    ).filter(
        UsageAnalytics.tenant_id == tenant_id,
        UsageAnalytics.date >= start_date
    )
    
    if api_key_id:
        query = query.filter(UsageAnalytics.api_key_id == api_key_id)
    
    usage_data = query.group_by(UsageAnalytics.date).order_by(UsageAnalytics.date).all()
    
    # Calculate totals
    totals = db.query(
        func.sum(UsageAnalytics.total_requests).label("total_requests"),
        func.sum(UsageAnalytics.blocked_requests).label("blocked_requests"),
        func.sum(UsageAnalytics.total_tokens).label("total_tokens"),
        func.sum(UsageAnalytics.cost_usd).label("total_cost")
    ).filter(
        UsageAnalytics.tenant_id == tenant_id,
        UsageAnalytics.date >= start_date
    ).first()
    
    return {
        "summary": {
            "totalRequests": totals.total_requests or 0,
            "blockedRequests": totals.blocked_requests or 0,
            "totalTokens": totals.total_tokens or 0,
            "totalCost": float(totals.total_cost or 0)
        },
        "data": [
            {
                "date": row.date.isoformat(),
                "requests": row.requests or 0,
                "successful": row.successful or 0,
                "blocked": row.blocked or 0,
                "failed": row.failed or 0,
                "tokens": row.tokens or 0,
                "cost": float(row.cost or 0),
                "latency": int(row.latency or 0)
            }
            for row in usage_data
        ]
    }


@router.get("/security")
async def get_security_analytics(
    days: int = Query(7, ge=1, le=90),
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get security events for the tenant
    """
    tenant_id = current_user["tenant_id"]
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(SecurityEvent).filter(
        SecurityEvent.tenant_id == tenant_id,
        SecurityEvent.created_at >= start_date
    )
    
    if severity:
        query = query.filter(SecurityEvent.severity == severity)
    if event_type:
        query = query.filter(SecurityEvent.event_type == event_type)
    
    events = query.order_by(desc(SecurityEvent.created_at)).limit(100).all()
    
    # Get event type counts
    event_counts = db.query(
        SecurityEvent.event_type,
        func.count(SecurityEvent.id).label("count")
    ).filter(
        SecurityEvent.tenant_id == tenant_id,
        SecurityEvent.created_at >= start_date
    ).group_by(
        SecurityEvent.event_type
    ).order_by(
        desc("count")
    ).all()
    
    # Get severity counts
    severity_counts = db.query(
        SecurityEvent.severity,
        func.count(SecurityEvent.id).label("count")
    ).filter(
        SecurityEvent.tenant_id == tenant_id,
        SecurityEvent.created_at >= start_date
    ).group_by(
        SecurityEvent.severity
    ).all()
    
    return {
        "events": [event.to_dict() for event in events],
        "eventTypeCounts": [
            {"type": row.event_type, "count": row.count}
            for row in event_counts
        ],
        "severityCounts": [
            {"severity": row.severity, "count": row.count}
            for row in severity_counts
        ]
    }


@router.get("/costs")
async def get_cost_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get cost analytics for the tenant
    """
    tenant_id = current_user["tenant_id"]
    
    start_date = datetime.utcnow().date() - timedelta(days=days)
    
    # Daily costs
    daily_costs = db.query(
        UsageAnalytics.date,
        func.sum(UsageAnalytics.cost_usd).label("cost"),
        func.sum(UsageAnalytics.total_tokens).label("tokens")
    ).filter(
        UsageAnalytics.tenant_id == tenant_id,
        UsageAnalytics.date >= start_date
    ).group_by(
        UsageAnalytics.date
    ).order_by(
        UsageAnalytics.date
    ).all()
    
    # Total cost
    total_cost = db.query(
        func.sum(UsageAnalytics.cost_usd).label("total")
    ).filter(
        UsageAnalytics.tenant_id == tenant_id,
        UsageAnalytics.date >= start_date
    ).first()
    
    # Cost by API key
    cost_by_key = db.query(
        UsageAnalytics.api_key_id,
        func.sum(UsageAnalytics.cost_usd).label("cost")
    ).filter(
        UsageAnalytics.tenant_id == tenant_id,
        UsageAnalytics.date >= start_date,
        UsageAnalytics.api_key_id.isnot(None)
    ).group_by(
        UsageAnalytics.api_key_id
    ).order_by(
        desc("cost")
    ).limit(10).all()
    
    return {
        "totalCost": float(total_cost.total or 0),
        "dailyCosts": [
            {
                "date": row.date.isoformat(),
                "cost": float(row.cost or 0),
                "tokens": row.tokens or 0
            }
            for row in daily_costs
        ],
        "costByApiKey": [
            {
                "apiKeyId": str(row.api_key_id),
                "cost": float(row.cost or 0)
            }
            for row in cost_by_key
        ]
    }
