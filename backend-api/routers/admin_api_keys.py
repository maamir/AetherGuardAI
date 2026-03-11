"""
Admin API Keys Management Router
Manage API keys across all tenants
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from models.base import get_db
from models.api_key import ApiKey
from models.tenant import Tenant
from models.admin_user import AdminUser
from models.audit_log import AuditLog
from .admin_auth import get_current_admin

router = APIRouter(prefix="/api/admin/api-keys", tags=["Admin API Keys"])


class ApiKeyListResponse(BaseModel):
    apiKeys: List[dict]
    total: int
    page: int
    pageSize: int


@router.get("", response_model=ApiKeyListResponse)
async def list_all_api_keys(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tenant_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    List all API keys across all tenants
    """
    query = db.query(ApiKey).join(Tenant, ApiKey.tenant_id == Tenant.id)
    
    # Apply filters
    if tenant_id:
        query = query.filter(ApiKey.tenant_id == tenant_id)
    if is_active is not None:
        query = query.filter(ApiKey.is_active == is_active)
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    api_keys = query.order_by(ApiKey.created_at.desc()).offset(offset).limit(page_size).all()
    
    # Enrich with tenant info
    result = []
    for key in api_keys:
        key_dict = key.to_dict()
        tenant = db.query(Tenant).filter(Tenant.id == key.tenant_id).first()
        if tenant:
            key_dict["tenantName"] = tenant.name
        result.append(key_dict)
    
    return {
        "apiKeys": result,
        "total": total,
        "page": page,
        "pageSize": page_size
    }


@router.get("/{key_id}")
async def get_api_key(
    key_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Get API key details
    """
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    key_dict = api_key.to_dict()
    
    # Add tenant info
    tenant = db.query(Tenant).filter(Tenant.id == api_key.tenant_id).first()
    if tenant:
        key_dict["tenantName"] = tenant.name
    
    return key_dict


@router.post("/{key_id}/revoke")
async def revoke_api_key(
    key_id: str,
    reason: Optional[str] = None,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Revoke an API key
    """
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    if api_key.revoked_at:
        raise HTTPException(status_code=400, detail="API key already revoked")
    
    # Revoke the key
    api_key.is_active = False
    api_key.revoked_at = datetime.utcnow()
    api_key.revoked_by = admin.id
    api_key.revoke_reason = reason or "Revoked by admin"
    
    db.commit()
    
    # Log audit
    audit_log = AuditLog(
        tenant_id=api_key.tenant_id,
        admin_id=admin.id,
        action="revoke_api_key",
        resource_type="api_key",
        resource_id=api_key.id,
        changes={"reason": reason}
    )
    db.add(audit_log)
    db.commit()
    
    return {"message": "API key revoked successfully"}


@router.get("/{key_id}/usage")
async def get_api_key_usage(
    key_id: str,
    days: int = Query(7, ge=1, le=90),
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Get usage statistics for an API key
    """
    from models.usage_analytics import UsageAnalytics
    from datetime import timedelta
    from sqlalchemy import func
    
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    start_date = datetime.utcnow().date() - timedelta(days=days)
    
    # Get usage data
    usage_data = db.query(
        UsageAnalytics.date,
        func.sum(UsageAnalytics.total_requests).label("requests"),
        func.sum(UsageAnalytics.total_tokens).label("tokens"),
        func.sum(UsageAnalytics.cost_usd).label("cost")
    ).filter(
        UsageAnalytics.api_key_id == key_id,
        UsageAnalytics.date >= start_date
    ).group_by(
        UsageAnalytics.date
    ).order_by(
        UsageAnalytics.date
    ).all()
    
    return {
        "apiKeyId": key_id,
        "data": [
            {
                "date": row.date.isoformat(),
                "requests": row.requests or 0,
                "tokens": row.tokens or 0,
                "cost": float(row.cost or 0)
            }
            for row in usage_data
        ]
    }
