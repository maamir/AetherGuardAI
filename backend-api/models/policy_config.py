"""
Policy Configuration Model
"""

from sqlalchemy import Column, String, Boolean, Integer, DateTime, JSON, ForeignKey
from datetime import datetime
import uuid
from .base import Base


class PolicyConfig(Base):
    __tablename__ = "policy_configs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Policy identification
    category = Column(String(50), nullable=False, index=True)  # security, ethical, privacy, integrity, governance
    feature_key = Column(String(100), nullable=False, index=True)
    feature_name = Column(String(200), nullable=False)
    
    # Configuration
    enabled = Column(Boolean, default=True, index=True)
    config = Column(JSON, nullable=False, default={})
    version = Column(Integer, default=1)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "tenantId": self.tenant_id,
            "category": self.category,
            "featureKey": self.feature_key,
            "featureName": self.feature_name,
            "enabled": self.enabled,
            "config": self.config,
            "version": self.version,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
