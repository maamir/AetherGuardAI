"""
Admin Tenant Management Router
Handles tenant CRUD operations for admins
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime
import uuid

from models.base import get_db
from models.tenant import Tenant
from models.admin_user import AdminUser
from models.audit_log import AuditLog
from .admin_auth import get_current_admin

router = APIRouter(prefix="/api/admin/tenants", tags=["Admin Tenants"])


# Pydantic Models
class TenantListResponse(BaseModel):
    tenants: List[dict]
    total: int
    page: int
    pageSize: int


class UpdateTenantRequest(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    subscriptionTier: Optional[str] = None
    billingEmail: Optional[str] = None
    companySize: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    apiQuota: Optional[int] = None
    rateLimit: Optional[int] = None


# Helper function to log audit
def log_audit(
    db: Session,
    admin_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: uuid.UUID,
    changes: dict = None,
    tenant_id: uuid.UUID = None
):
    audit_log = AuditLog(
        tenant_id=tenant_id,
        admin_id=admin_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        changes=changes
    )
    db.add(audit_log)
    db.commit()


# Endpoints
@router.get("", response_model=TenantListResponse)
async def list_tenants(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    tier: Optional[str] = None,
    search: Optional[str] = None,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    List all tenants with pagination and filters
    """
    query = db.query(Tenant)
    
    # Apply filters
    if status:
        query = query.filter(Tenant.status == status)
    if tier:
        query = query.filter(Tenant.subscription_tier == tier)
    if search:
        query = query.filter(
            (Tenant.name.ilike(f"%{search}%")) |
            (Tenant.billing_email.ilike(f"%{search}%"))
        )
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    tenants = query.order_by(Tenant.created_at.desc()).offset(offset).limit(page_size).all()
    
    return {
        "tenants": [tenant.to_dict() for tenant in tenants],
        "total": total,
        "page": page,
        "pageSize": page_size
    }


@router.get("/{tenant_id}")
async def get_tenant(
    tenant_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Get tenant details by ID
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return tenant.to_dict()


@router.put("/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    request: UpdateTenantRequest,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Update tenant information
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Track changes for audit log
    changes = {}
    
    # Update fields
    if request.name is not None:
        changes["name"] = {"old": tenant.name, "new": request.name}
        tenant.name = request.name
    if request.status is not None:
        changes["status"] = {"old": tenant.status, "new": request.status}
        tenant.status = request.status
    if request.subscriptionTier is not None:
        changes["subscriptionTier"] = {"old": tenant.subscription_tier, "new": request.subscriptionTier}
        tenant.subscription_tier = request.subscriptionTier
    if request.billingEmail is not None:
        changes["billingEmail"] = {"old": tenant.billing_email, "new": request.billingEmail}
        tenant.billing_email = request.billingEmail
    if request.companySize is not None:
        changes["companySize"] = {"old": tenant.company_size, "new": request.companySize}
        tenant.company_size = request.companySize
    if request.industry is not None:
        changes["industry"] = {"old": tenant.industry, "new": request.industry}
        tenant.industry = request.industry
    if request.country is not None:
        changes["country"] = {"old": tenant.country, "new": request.country}
        tenant.country = request.country
    if request.timezone is not None:
        changes["timezone"] = {"old": tenant.timezone, "new": request.timezone}
        tenant.timezone = request.timezone
    if request.apiQuota is not None:
        changes["apiQuota"] = {"old": tenant.api_quota, "new": request.apiQuota}
        tenant.api_quota = request.apiQuota
    if request.rateLimit is not None:
        changes["rateLimit"] = {"old": tenant.rate_limit, "new": request.rateLimit}
        tenant.rate_limit = request.rateLimit
    
    tenant.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(tenant)
    
    # Log audit
    log_audit(
        db=db,
        admin_id=admin.id,
        action="update_tenant",
        resource_type="tenant",
        resource_id=tenant.id,
        changes=changes,
        tenant_id=tenant.id
    )
    
    return tenant.to_dict()


@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a tenant (soft delete by setting status to 'deleted')
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Soft delete
    tenant.status = "deleted"
    tenant.is_active = False
    tenant.updated_at = datetime.utcnow()
    db.commit()
    
    # Log audit
    log_audit(
        db=db,
        admin_id=admin.id,
        action="delete_tenant",
        resource_type="tenant",
        resource_id=tenant.id,
        tenant_id=tenant.id
    )
    
    return {"message": "Tenant deleted successfully"}


@router.post("/{tenant_id}/suspend")
async def suspend_tenant(
    tenant_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Suspend a tenant
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant.status = "suspended"
    tenant.is_active = False
    tenant.updated_at = datetime.utcnow()
    db.commit()
    
    # Log audit
    log_audit(
        db=db,
        admin_id=admin.id,
        action="suspend_tenant",
        resource_type="tenant",
        resource_id=tenant.id,
        tenant_id=tenant.id
    )
    
    return {"message": "Tenant suspended successfully"}


@router.post("/{tenant_id}/activate")
async def activate_tenant(
    tenant_id: str,
    admin: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """
    Activate a suspended tenant
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant.status = "active"
    tenant.is_active = True
    tenant.updated_at = datetime.utcnow()
    db.commit()
    
    # Log audit
    log_audit(
        db=db,
        admin_id=admin.id,
        action="activate_tenant",
        resource_type="tenant",
        resource_id=tenant.id,
        tenant_id=tenant.id
    )
    
    return {"message": "Tenant activated successfully"}
