"""
Admin Analytics Router
System-wide analytics for admins
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import Optional

from models.base import get_db
from models.tenant import Tenant
from models.usage_analytics import UsageAnalytics
from models.security_event import SecurityEvent
from models.api_key import ApiKey
from models.admin_user import AdminUser
from .admin_auth import get_current_admin

router = APIRouter(prefix="/api/admin/analytics", tags=["Admin Analytics"])


@router.get("/overview")
async def get_system_overview(
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Get system-wide overview statistics
    """
    # Count tenants by status
    total_tenants = db.query(Tenant).count()
    active_tenants = db.query(Tenant).filter(Tenant.status == "active").count()
    suspended_tenants = db.query(Tenant).filter(Tenant.status == "suspended").count()
    
    # Count API keys
    total_api_keys = db.query(ApiKey).count()
    active_api_keys = db.query(ApiKey).filter(ApiKey.is_active == True).count()
    
    # Get today's analytics
    today = datetime.utcnow().date()
    today_analytics = db.query(
        func.sum(UsageAnalytics.total_requests).label("total_requests"),
        func.sum(UsageAnalytics.blocked_requests).label("blocked_requests"),
        func.sum(UsageAnalytics.total_tokens).label("total_tokens"),
        func.sum(UsageAnalytics.cost_usd).label("total_cost")
    ).filter(UsageAnalytics.date == today).first()
    
    # Get security events count
    today_security_events = db.query(SecurityEvent).filter(
        func.date(SecurityEvent.created_at) == today
    ).count()
    
    return {
        "tenants": {
            "total": total_tenants,
            "active": active_tenants,
            "suspended": suspended_tenants
        },
        "apiKeys": {
            "total": total_api_keys,
            "active": active_api_keys
        },
        "today": {
            "requests": today_analytics.total_requests or 0,
            "blocked": today_analytics.blocked_requests or 0,
            "tokens": today_analytics.total_tokens or 0,
            "cost": float(today_analytics.total_cost or 0),
            "securityEvents": today_security_events
        }
    }


@router.get("/usage")
async def get_system_usage(
    days: int = Query(7, ge=1, le=90),
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Get system-wide usage statistics
    """
    start_date = datetime.utcnow().date() - timedelta(days=days)
    
    # Get daily aggregated usage
    usage_data = db.query(
        UsageAnalytics.date,
        func.sum(UsageAnalytics.total_requests).label("requests"),
        func.sum(UsageAnalytics.blocked_requests).label("blocked"),
        func.sum(UsageAnalytics.total_tokens).label("tokens"),
        func.sum(UsageAnalytics.cost_usd).label("cost")
    ).filter(
        UsageAnalytics.date >= start_date
    ).group_by(
        UsageAnalytics.date
    ).order_by(
        UsageAnalytics.date
    ).all()
    
    return {
        "data": [
            {
                "date": row.date.isoformat(),
                "requests": row.requests or 0,
                "blocked": row.blocked or 0,
                "tokens": row.tokens or 0,
                "cost": float(row.cost or 0)
            }
            for row in usage_data
        ]
    }


@router.get("/security")
async def get_system_security(
    days: int = Query(7, ge=1, le=90),
    severity: Optional[str] = None,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Get system-wide security events
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(SecurityEvent).filter(
        SecurityEvent.created_at >= start_date
    )
    
    if severity:
        query = query.filter(SecurityEvent.severity == severity)
    
    events = query.order_by(desc(SecurityEvent.created_at)).limit(100).all()
    
    # Get event type counts
    event_counts = db.query(
        SecurityEvent.event_type,
        func.count(SecurityEvent.id).label("count")
    ).filter(
        SecurityEvent.created_at >= start_date
    ).group_by(
        SecurityEvent.event_type
    ).order_by(
        desc("count")
    ).limit(10).all()
    
    return {
        "events": [event.to_dict() for event in events],
        "topEventTypes": [
            {"type": row.event_type, "count": row.count}
            for row in event_counts
        ]
    }


@router.get("/tenants/top")
async def get_top_tenants(
    metric: str = Query("requests", regex="^(requests|tokens|cost)$"),
    limit: int = Query(10, ge=1, le=50),
    days: int = Query(7, ge=1, le=90),
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Get top tenants by usage metric
    """
    start_date = datetime.utcnow().date() - timedelta(days=days)
    
    # Map metric to column
    metric_map = {
        "requests": func.sum(UsageAnalytics.total_requests),
        "tokens": func.sum(UsageAnalytics.total_tokens),
        "cost": func.sum(UsageAnalytics.cost_usd)
    }
    
    metric_col = metric_map[metric]
    
    # Get top tenants
    top_tenants = db.query(
        Tenant.id,
        Tenant.name,
        metric_col.label("value")
    ).join(
        UsageAnalytics, Tenant.id == UsageAnalytics.tenant_id
    ).filter(
        UsageAnalytics.date >= start_date
    ).group_by(
        Tenant.id, Tenant.name
    ).order_by(
        desc("value")
    ).limit(limit).all()
    
    return {
        "metric": metric,
        "tenants": [
            {
                "id": str(row.id),
                "name": row.name,
                "value": float(row.value) if metric == "cost" else (row.value or 0)
            }
            for row in top_tenants
        ]
    }
