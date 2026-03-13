"""
API Keys Router
Tenant-facing API key management
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, Dict
from datetime import datetime, timedelta
import uuid
import hashlib

from models.base import get_db
from models.api_key import ApiKey
from .tenant_auth import get_current_tenant_user

router = APIRouter(prefix="/api/api-keys", tags=["API Keys"])


# Pydantic Models
class CreateApiKeyRequest(BaseModel):
    name: str
    permissions: Optional[Dict] = {}
    rateLimit: Optional[int] = None
    monthlyQuota: Optional[int] = None
    expiresInDays: Optional[int] = None
    ipWhitelist: Optional[list] = None
    usageAlerts: Optional[list] = None


class UpdateApiKeyRequest(BaseModel):
    name: Optional[str] = None
    permissions: Optional[Dict] = None
    rateLimit: Optional[int] = None
    monthlyQuota: Optional[int] = None
    isActive: Optional[bool] = None
    ipWhitelist: Optional[list] = None
    usageAlerts: Optional[list] = None


# Helper functions
def generate_api_key() -> str:
    """Generate a new API key"""
    return f"ag_{uuid.uuid4().hex}"


def hash_api_key(key: str) -> str:
    """Hash an API key for storage"""
    return hashlib.sha256(key.encode()).hexdigest()


def get_tenant_id_from_user(user_id: str, db: Session) -> str:
    from models.tenant import Tenant
    tenant = db.query(Tenant).filter(Tenant.owner_id == user_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return str(tenant.id)


# Endpoints
@router.get("")
async def list_api_keys(
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    List all API keys for the tenant
    """
    tenant_id = current_user["tenant_id"]
    
    api_keys = db.query(ApiKey).filter(
        ApiKey.tenant_id == tenant_id
    ).order_by(ApiKey.created_at.desc()).all()
    
    return [key.to_dict() for key in api_keys]


@router.post("")
async def create_api_key(
    request: CreateApiKeyRequest,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Create a new API key
    """
    tenant_id = current_user["tenant_id"]
    user_id = current_user["user_id"]
    
    # Generate API key
    api_key = generate_api_key()
    key_hash = hash_api_key(api_key)
    
    # Calculate expiration
    expires_at = None
    if request.expiresInDays:
        expires_at = datetime.utcnow() + timedelta(days=request.expiresInDays)
    
    # Create API key record
    api_key_record = ApiKey(
        tenant_id=tenant_id,
        user_id=user_id,
        name=request.name,
        key_hash=key_hash,
        key_prefix=api_key[:7],  # ag_xxxx
        key_suffix=api_key[-4:],
        permissions=request.permissions or {},
        rate_limit=request.rateLimit,
        monthly_quota=request.monthlyQuota,
        expires_at=expires_at,
        ip_whitelist=request.ipWhitelist or [],
        usage_alerts=request.usageAlerts or []
    )
    
    db.add(api_key_record)
    db.commit()
    db.refresh(api_key_record)
    
    # Return with full key (only time it's shown)
    result = api_key_record.to_dict(show_full_key=True)
    result["key"] = api_key  # Override with actual key
    
    return result


@router.get("/{key_id}")
async def get_api_key(
    key_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get API key details
    """
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Verify ownership
    if str(api_key.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return api_key.to_dict()


@router.put("/{key_id}")
async def update_api_key(
    key_id: str,
    request: UpdateApiKeyRequest,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Update API key configuration
    """
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Verify ownership
    if str(api_key.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update fields
    if request.name is not None:
        api_key.name = request.name
    if request.permissions is not None:
        api_key.permissions = request.permissions
    if request.rateLimit is not None:
        api_key.rate_limit = request.rateLimit
    if request.monthlyQuota is not None:
        api_key.monthly_quota = request.monthlyQuota
    if request.isActive is not None:
        api_key.is_active = request.isActive
    if request.ipWhitelist is not None:
        api_key.ip_whitelist = request.ipWhitelist
    if request.usageAlerts is not None:
        api_key.usage_alerts = request.usageAlerts
    
    db.commit()
    db.refresh(api_key)
    
    return api_key.to_dict()


@router.delete("/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Delete an API key
    """
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Verify ownership
    if str(api_key.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(api_key)
    db.commit()
    
    return {"message": "API key deleted successfully"}


@router.post("/{key_id}/revoke")
async def revoke_api_key(
    key_id: str,
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Revoke an API key
    """
    api_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Verify ownership
    if str(api_key.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if api_key.revoked_at:
        raise HTTPException(status_code=400, detail="API key already revoked")
    
    # Revoke the key
    api_key.is_active = False
    api_key.revoked_at = datetime.utcnow()
    api_key.revoke_reason = reason or "Revoked by user"
    
    db.commit()
    
    return {"message": "API key revoked successfully"}


@router.post("/{key_id}/rotate")
async def rotate_api_key(
    key_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Rotate an API key (create new key with same config, revoke old)
    """
    old_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    
    if not old_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Verify ownership
    if str(old_key.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Generate new API key
    new_api_key = generate_api_key()
    new_key_hash = hash_api_key(new_api_key)
    
    # Create new key with same configuration
    new_key_record = ApiKey(
        tenant_id=old_key.tenant_id,
        user_id=old_key.user_id,
        name=f"{old_key.name} (Rotated)",
        key_hash=new_key_hash,
        key_prefix=new_api_key[:7],
        key_suffix=new_api_key[-4:],
        permissions=old_key.permissions,
        rate_limit=old_key.rate_limit,
        monthly_quota=old_key.monthly_quota,
        expires_at=old_key.expires_at,
        ip_whitelist=old_key.ip_whitelist,
        usage_alerts=old_key.usage_alerts
    )
    
    db.add(new_key_record)
    
    # Revoke old key
    old_key.is_active = False
    old_key.revoked_at = datetime.utcnow()
    old_key.revoke_reason = "Rotated"
    
    db.commit()
    db.refresh(new_key_record)
    
    # Return with full key (only time it's shown)
    result = new_key_record.to_dict(show_full_key=True)
    result["key"] = new_api_key  # Override with actual key
    
    return result



@router.get("/{key_id}/stats")
async def get_api_key_stats(
    key_id: str,
    days: int = Query(7, ge=1, le=90),
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get usage statistics for a specific API key
    """
    from models.usage_analytics import UsageAnalytics
    from models.llm_provider import LLMProvider
    from sqlalchemy import func
    
    # Verify API key ownership
    api_key = db.query(ApiKey).filter(
        ApiKey.id == key_id,
        ApiKey.tenant_id == current_user["tenant_id"]
    ).first()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Calculate date range
    start_date = datetime.utcnow().date() - timedelta(days=days)
    
    # Query usage statistics
    stats = db.query(
        func.count(UsageAnalytics.id).label("total_requests"),
        func.sum(UsageAnalytics.cost_usd).label("total_cost"),
        func.avg(UsageAnalytics.avg_latency_ms).label("avg_latency"),
        func.sum(UsageAnalytics.total_tokens).label("total_tokens")
    ).filter(
        UsageAnalytics.tenant_id == current_user["tenant_id"],
        UsageAnalytics.api_key_id == key_id,
        UsageAnalytics.date >= start_date
    ).first()
    
    # Get top provider used with this API key
    top_provider_row = db.query(
        UsageAnalytics.provider_id,
        func.count(UsageAnalytics.id).label("count")
    ).filter(
        UsageAnalytics.tenant_id == current_user["tenant_id"],
        UsageAnalytics.api_key_id == key_id,
        UsageAnalytics.provider_id.isnot(None)
    ).group_by(
        UsageAnalytics.provider_id
    ).order_by(
        func.count(UsageAnalytics.id).desc()
    ).first()
    
    # Get provider name if found
    top_provider_name = None
    if top_provider_row and top_provider_row.provider_id:
        provider = db.query(LLMProvider).filter(
            LLMProvider.id == top_provider_row.provider_id
        ).first()
        if provider:
            top_provider_name = provider.provider_name
    
    return {
        "api_key_id": key_id,
        "api_key_name": api_key.name,
        "total_requests": stats.total_requests or 0,
        "total_cost": float(stats.total_cost or 0),
        "avg_latency": int(stats.avg_latency or 0),
        "total_tokens": stats.total_tokens or 0,
        "top_provider": top_provider_name,
        "last_used": api_key.last_used_at.isoformat() if api_key.last_used_at else None,
        "period_days": days
    }
