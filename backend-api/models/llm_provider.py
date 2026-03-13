"""
LLM Provider Model
"""

from sqlalchemy import Column, String, Boolean, DateTime, JSON, Text, ForeignKey
from datetime import datetime
import uuid
from .base import Base


class LLMProvider(Base):
    __tablename__ = "llm_providers"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Provider info
    provider_type = Column(String(50), nullable=False)  # openai, anthropic, custom, etc.
    provider_name = Column(String(100))
    
    # API credentials (encrypted)
    api_key_encrypted = Column(Text)
    api_key_last_four = Column(String(4))
    provider_url = Column(String(500))
    
    # Model configuration
    model_name = Column(String(100))
    model_config = Column(JSON, default={})
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    is_default = Column(Boolean, default=False, index=True)
    connection_status = Column(String(50), default="untested")
    last_tested = Column(DateTime)
    test_error = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self, include_api_key=False):
        data = {
            "id": self.id,
            "tenantId": self.tenant_id,
            "providerType": self.provider_type,
            "providerName": self.provider_name,
            "providerUrl": self.provider_url,
            "modelName": self.model_name,
            "modelConfig": self.model_config,
            "isActive": self.is_active,
            "isDefault": self.is_default,
            "connectionStatus": self.connection_status,
            "lastTested": self.last_tested.isoformat() if self.last_tested else None,
            "testError": self.test_error,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_api_key:
            data["apiKeyLastFour"] = self.api_key_last_four
        else:
            data["apiKeyLastFour"] = self.api_key_last_four
        
        return data
