"""
Tenant Model
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from .base import Base


class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    owner_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Subscription and billing
    status = Column(String(50), default="active", index=True)
    subscription_tier = Column(String(50), default="free", index=True)
    billing_email = Column(String(255))
    
    # Company info
    company_size = Column(String(50))
    industry = Column(String(100))
    country = Column(String(100))
    timezone = Column(String(100), default="UTC")
    
    # API limits
    api_quota = Column(Integer, default=10000)
    api_used = Column(Integer, default=0)
    rate_limit = Column(Integer, default=10)
    
    # Metadata
    tenant_metadata = Column("metadata", JSON, default={})
    is_active = Column(Boolean, default=True)
    last_active = Column(DateTime)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "ownerId": str(self.owner_id),
            "status": self.status,
            "subscriptionTier": self.subscription_tier,
            "billingEmail": self.billing_email,
            "companySize": self.company_size,
            "industry": self.industry,
            "country": self.country,
            "timezone": self.timezone,
            "apiQuota": self.api_quota,
            "apiUsed": self.api_used,
            "rateLimit": self.rate_limit,
            "metadata": self.tenant_metadata,
            "isActive": self.is_active,
            "lastActive": self.last_active.isoformat() if self.last_active else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
