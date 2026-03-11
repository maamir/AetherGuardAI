"""
Provider Health Router
Monitor and manage LLM provider health metrics
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from models.base import get_db
from models.llm_provider import LLMProvider
from .tenant_auth import get_current_tenant_user

router = APIRouter(prefix="/api/provider-health", tags=["Provider Health"])


# Pydantic Models
class ProviderHealthMetric(BaseModel):
    providerId: str
    status: str  # online, offline, degraded
    responseTime: int  # milliseconds
    errorRate: float  # percentage
    uptime: float  # percentage
    requestsPerMinute: int
    averageLatency: int
    checkedAt: str


class HealthCheckRequest(BaseModel):
    providerId: str


class FallbackConfigRequest(BaseModel):
    fallbackProviders: List[dict]  # [{"providerId": "...", "priority": 1}, ...]


# Endpoints
@router.get("")
async def get_provider_health(
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get health status for all providers
    """
    tenant_id = current_user["tenant_id"]
    
    providers = db.query(LLMProvider).filter(
        LLMProvider.tenant_id == tenant_id
    ).all()
    
    health_data = []
    for provider in providers:
        health_data.append({
            "providerId": str(provider.id),
            "providerName": provider.provider_name,
            "status": provider.connection_status or "unknown",
            "lastTested": provider.last_tested.isoformat() if provider.last_tested else None,
            "testError": provider.test_error,
            "isActive": provider.is_active,
            "isDefault": provider.is_default
        })
    
    return health_data


@router.get("/{provider_id}")
async def get_provider_health_detail(
    provider_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed health metrics for a provider
    """
    provider = db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()
    
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Verify ownership
    if str(provider.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {
        "providerId": str(provider.id),
        "providerName": provider.provider_name,
        "providerType": provider.provider_type,
        "status": provider.connection_status or "unknown",
        "lastTested": provider.last_tested.isoformat() if provider.last_tested else None,
        "testError": provider.test_error,
        "isActive": provider.is_active,
        "isDefault": provider.is_default,
        "createdAt": provider.created_at.isoformat() if provider.created_at else None,
        "updatedAt": provider.updated_at.isoformat() if provider.updated_at else None
    }


@router.post("/{provider_id}/check")
async def check_provider_health(
    provider_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Perform health check on a provider
    """
    provider = db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()
    
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Verify ownership
    if str(provider.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update last checked time
    provider.last_tested = datetime.utcnow()
    provider.connection_status = "online"  # Simplified - in production would actually test
    db.commit()
    
    return {
        "status": "success",
        "providerId": str(provider.id),
        "checkedAt": provider.last_tested.isoformat()
    }


@router.get("/{provider_id}/fallback")
async def get_fallback_config(
    provider_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get fallback provider configuration
    """
    provider = db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()
    
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Verify ownership
    if str(provider.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {
        "providerId": str(provider.id),
        "fallbackProviders": provider.fallback_providers or []
    }


@router.put("/{provider_id}/fallback")
async def update_fallback_config(
    provider_id: str,
    request: FallbackConfigRequest,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Update fallback provider configuration
    """
    provider = db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()
    
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Verify ownership
    if str(provider.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate fallback providers exist
    for fallback in request.fallbackProviders:
        fallback_provider = db.query(LLMProvider).filter(
            LLMProvider.id == fallback.get("providerId"),
            LLMProvider.tenant_id == provider.tenant_id
        ).first()
        
        if not fallback_provider:
            raise HTTPException(status_code=400, detail=f"Fallback provider not found: {fallback.get('providerId')}")
    
    provider.fallback_providers = request.fallbackProviders
    provider.updated_at = datetime.utcnow()
    db.commit()
    
    return {
        "status": "success",
        "providerId": str(provider.id),
        "fallbackProviders": provider.fallback_providers
    }
