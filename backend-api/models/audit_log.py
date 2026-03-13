"""
Audit Log Model
"""

from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey
from datetime import datetime
import uuid
from .base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    admin_id = Column(String(36), ForeignKey("admin_users.id", ondelete="SET NULL"), index=True)
    
    # Action details
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(String(36))
    changes = Column(JSON)
    
    # Request context
    ip_address = Column(String(45))
    user_agent = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "tenantId": self.tenant_id if self.tenant_id else None,
            "adminId": self.admin_id if self.admin_id else None,
            "action": self.action,
            "resourceType": self.resource_type,
            "resourceId": self.resource_id if self.resource_id else None,
            "changes": self.changes,
            "ipAddress": self.ip_address,
            "userAgent": self.user_agent,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
