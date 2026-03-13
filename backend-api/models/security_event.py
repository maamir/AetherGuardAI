"""
Security Event Model
"""

from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey
from datetime import datetime
import uuid
from .base import Base


class SecurityEvent(Base):
    __tablename__ = "security_events"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    api_key_id = Column(String(36), ForeignKey("api_keys.id", ondelete="SET NULL"), index=True)
    
    # Event details
    event_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)  # low, medium, high, critical
    description = Column(Text)
    
    # Request context
    request_id = Column(String(100))
    source_ip = Column(String(45))
    user_agent = Column(Text)
    
    # Additional data
    event_metadata = Column("metadata", JSON, default={})
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "tenantId": self.tenant_id,
            "apiKeyId": self.api_key_id if self.api_key_id else None,
            "eventType": self.event_type,
            "severity": self.severity,
            "description": self.description,
            "requestId": self.request_id,
            "sourceIp": self.source_ip,
            "userAgent": self.user_agent,
            "metadata": self.event_metadata,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
