"""
API Key Model
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, JSON, Text, ForeignKey
from datetime import datetime
import uuid
from .base import Base


class ApiKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=False)
    
    # Key identification
    name = Column(String(255), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False)
    key_prefix = Column(String(10), index=True)
    key_suffix = Column(String(10))
    
    # Permissions and limits
    permissions = Column(JSON, default={})
    rate_limit = Column(Integer)
    monthly_quota = Column(Integer)
    usage_count = Column(Integer, default=0)
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    
    # Usage tracking
    last_used = Column(DateTime)
    last_used_ip = Column(String(45))
    
    # Expiration and revocation
    expires_at = Column(DateTime, index=True)
    revoked_at = Column(DateTime)
    revoked_by = Column(String(36), ForeignKey("admin_users.id", ondelete="SET NULL"))
    revoke_reason = Column(Text)
    
    # Security enhancements
    ip_whitelist = Column(JSON, default=[])
    usage_alerts = Column(JSON, default=[])
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self, show_full_key=False):
        data = {
            "id": self.id,
            "tenantId": self.tenant_id,
            "userId": self.user_id,
            "name": self.name,
            "permissions": self.permissions,
            "rateLimit": self.rate_limit,
            "monthlyQuota": self.monthly_quota,
            "usageCount": self.usage_count,
            "isActive": self.is_active,
            "lastUsed": self.last_used.isoformat() if self.last_used else None,
            "lastUsedIp": self.last_used_ip,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "revokedAt": self.revoked_at.isoformat() if self.revoked_at else None,
            "revokedBy": self.revoked_by if self.revoked_by else None,
            "revokeReason": self.revoke_reason,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "ipWhitelist": self.ip_whitelist if self.ip_whitelist else [],
            "usageAlerts": self.usage_alerts if self.usage_alerts else [],
        }
        
        if show_full_key:
            data["key"] = self.key_hash
        else:
            data["keyDisplay"] = f"{self.key_prefix}****{self.key_suffix}"
        
        return data
