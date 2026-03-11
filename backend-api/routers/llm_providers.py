"""
LLM Providers Router
Tenant-facing LLM provider management
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import httpx

from models.base import get_db
from models.llm_provider import LLMProvider
from utils.encryption import EncryptionService
from .tenant_auth import get_current_tenant_user

router = APIRouter(prefix="/api/llm-providers", tags=["LLM Providers"])

# Initialize encryption service
encryption_service = EncryptionService()


# Pydantic Models
class CreateLLMProviderRequest(BaseModel):
    providerType: str  # openai, anthropic, custom
    providerName: str
    apiKey: Optional[str] = None
    providerUrl: Optional[str] = None
    modelName: Optional[str] = None
    modelConfig: Optional[dict] = {}
    isDefault: bool = False


class UpdateLLMProviderRequest(BaseModel):
    providerName: Optional[str] = None
    apiKey: Optional[str] = None
    providerUrl: Optional[str] = None
    modelName: Optional[str] = None
    modelConfig: Optional[dict] = None
    isActive: Optional[bool] = None
    isDefault: Optional[bool] = None


# Helper function to get tenant_id from user (simplified for now)
def get_tenant_id_from_user(user_id: str, db: Session) -> str:
    from models.tenant import Tenant
    tenant = db.query(Tenant).filter(Tenant.owner_id == user_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return str(tenant.id)


# Endpoints
@router.get("")
async def list_llm_providers(
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    List all LLM providers for the tenant
    """
    tenant_id = current_user["tenant_id"]
    
    providers = db.query(LLMProvider).filter(
        LLMProvider.tenant_id == tenant_id
    ).order_by(LLMProvider.created_at.desc()).all()
    
    return [provider.to_dict() for provider in providers]


@router.post("")
async def create_llm_provider(
    request: CreateLLMProviderRequest,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Create a new LLM provider configuration
    """
    tenant_id = current_user["tenant_id"]
    
    # Check if provider name already exists for this tenant
    existing = db.query(LLMProvider).filter(
        LLMProvider.tenant_id == tenant_id,
        LLMProvider.provider_name == request.providerName
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Provider name already exists")
    
    # If this is set as default, unset other defaults
    if request.isDefault:
        db.query(LLMProvider).filter(
            LLMProvider.tenant_id == tenant_id,
            LLMProvider.is_default == True
        ).update({"is_default": False})
    
    # Encrypt API key if provided
    api_key_encrypted = None
    api_key_last_four = None
    if request.apiKey:
        api_key_encrypted = encryption_service.encrypt(request.apiKey)
        api_key_last_four = request.apiKey[-4:] if len(request.apiKey) >= 4 else "****"
    
    # Create provider
    provider = LLMProvider(
        tenant_id=tenant_id,
        provider_type=request.providerType,
        provider_name=request.providerName,
        api_key_encrypted=api_key_encrypted,
        api_key_last_four=api_key_last_four,
        provider_url=request.providerUrl,
        model_name=request.modelName,
        model_config=request.modelConfig or {},
        is_default=request.isDefault
    )
    
    db.add(provider)
    db.commit()
    db.refresh(provider)
    
    return provider.to_dict()


@router.put("/{provider_id}")
async def update_llm_provider(
    provider_id: str,
    request: UpdateLLMProviderRequest,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Update an LLM provider configuration
    """
    provider = db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()
    
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Verify ownership
    if str(provider.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update fields
    if request.providerName is not None:
        provider.provider_name = request.providerName
    
    if request.apiKey is not None:
        provider.api_key_encrypted = encryption_service.encrypt(request.apiKey)
        provider.api_key_last_four = request.apiKey[-4:] if len(request.apiKey) >= 4 else "****"
    
    if request.providerUrl is not None:
        provider.provider_url = request.providerUrl
    
    if request.modelName is not None:
        provider.model_name = request.modelName
    
    if request.modelConfig is not None:
        provider.model_config = request.modelConfig
    
    if request.isActive is not None:
        provider.is_active = request.isActive
    
    if request.isDefault is not None and request.isDefault:
        # Unset other defaults
        db.query(LLMProvider).filter(
            LLMProvider.tenant_id == provider.tenant_id,
            LLMProvider.id != provider_id,
            LLMProvider.is_default == True
        ).update({"is_default": False})
        provider.is_default = True
    
    provider.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(provider)
    
    return provider.to_dict()


@router.delete("/{provider_id}")
async def delete_llm_provider(
    provider_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Delete an LLM provider configuration
    """
    provider = db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()
    
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Verify ownership
    if str(provider.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.delete(provider)
    db.commit()
    
    return {"message": "Provider deleted successfully"}


@router.post("/{provider_id}/test")
async def test_llm_provider(
    provider_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Test connection to an LLM provider
    """
    provider = db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()
    
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    # Verify ownership
    if str(provider.tenant_id) != current_user["tenant_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Decrypt API key
    if not provider.api_key_encrypted:
        raise HTTPException(status_code=400, detail="No API key configured")
    
    api_key = encryption_service.decrypt(provider.api_key_encrypted)
    
    # Test connection based on provider type
    try:
        if provider.provider_type == "openai":
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=10.0
                )
                response.raise_for_status()
        
        elif provider.provider_type == "anthropic":
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": provider.model_name or "claude-3-sonnet-20240229",
                        "max_tokens": 10,
                        "messages": [{"role": "user", "content": "test"}]
                    },
                    timeout=10.0
                )
                response.raise_for_status()
        
        elif provider.provider_type == "custom" and provider.provider_url:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{provider.provider_url}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "model": provider.model_name or "gpt-3.5-turbo",
                        "messages": [{"role": "user", "content": "test"}],
                        "max_tokens": 10
                    },
                    timeout=10.0
                )
                response.raise_for_status()
        
        # Update provider status
        provider.connection_status = "connected"
        provider.last_tested = datetime.utcnow()
        provider.test_error = None
        db.commit()
        
        return {"status": "success", "message": "Connection successful"}
    
    except Exception as e:
        # Update provider status
        provider.connection_status = "failed"
        provider.last_tested = datetime.utcnow()
        provider.test_error = str(e)
        db.commit()
        
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")
