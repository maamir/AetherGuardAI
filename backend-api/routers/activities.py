"""
Activities Router
Tenant-facing activity tracking and retrieval
"""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel

from models.base import get_db
from models.activity import Activity
from routers.tenant_auth import get_current_tenant_user

router = APIRouter(prefix="/api/activities", tags=["Activities"])


# Pydantic Models
class LogActivityRequest(BaseModel):
    type: str
    description: str
    metadata: Optional[dict] = {}


@router.post("")
async def log_activity(
    request_data: LogActivityRequest,
    request: Request,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Log a new activity for the tenant
    """
    # Extract IP and user agent from request
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    
    activity = Activity(
        tenant_id=current_user["tenant_id"],
        user_id=current_user.get("user_id"),
        activity_type=request_data.type,
        description=request_data.description,
        activity_metadata=request_data.metadata or {},
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    db.add(activity)
    db.commit()
    db.refresh(activity)
    
    return {
        "status": "logged",
        "activity_id": activity.id
    }


@router.get("")
async def get_activities(
    limit: int = Query(50, ge=1, le=100),
    types: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get activities for the tenant with optional filtering
    """
    query = db.query(Activity).filter(
        Activity.tenant_id == current_user["tenant_id"]
    )
    
    # Filter by activity types
    if types:
        type_list = [t.strip() for t in types.split(',')]
        query = query.filter(Activity.activity_type.in_(type_list))
    
    # Filter by date range
    if start_date:
        query = query.filter(Activity.created_at >= start_date)
    
    if end_date:
        query = query.filter(Activity.created_at <= end_date)
    
    # Order by most recent first and limit
    activities = query.order_by(
        Activity.created_at.desc()
    ).limit(limit).all()
    
    return [activity.to_dict() for activity in activities]


@router.get("/summary")
async def get_activity_summary(
    days: int = Query(7, ge=1, le=90),
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get activity summary statistics for the tenant
    """
    from sqlalchemy import func
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Get activity counts by type
    activity_counts = db.query(
        Activity.activity_type,
        func.count(Activity.id).label("count")
    ).filter(
        Activity.tenant_id == current_user["tenant_id"],
        Activity.created_at >= start_date
    ).group_by(
        Activity.activity_type
    ).order_by(
        func.count(Activity.id).desc()
    ).all()
    
    # Get total count
    total_count = db.query(func.count(Activity.id)).filter(
        Activity.tenant_id == current_user["tenant_id"],
        Activity.created_at >= start_date
    ).scalar()
    
    return {
        "period_days": days,
        "total_activities": total_count or 0,
        "by_type": [
            {
                "type": row.activity_type,
                "count": row.count
            }
            for row in activity_counts
        ]
    }
