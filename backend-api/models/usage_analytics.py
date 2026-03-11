"""
Usage Analytics Model
"""

from sqlalchemy import Column, String, Integer, DateTime, Date, ForeignKey, DECIMAL
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from .base import Base


class UsageAnalytics(Base):
    __tablename__ = "usage_analytics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    api_key_id = Column(UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="SET NULL"), index=True)
    date = Column(Date, nullable=False, index=True)
    hour = Column(Integer)
    
    # Request metrics
    total_requests = Column(Integer, default=0)
    successful_requests = Column(Integer, default=0)
    blocked_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    
    # Token metrics
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    
    # Cost metrics
    cost_usd = Column(DECIMAL(10, 4), default=0)
    
    # Performance metrics
    avg_latency_ms = Column(Integer, default=0)
    p95_latency_ms = Column(Integer, default=0)
    p99_latency_ms = Column(Integer, default=0)
    
    # Security metrics
    injection_attempts = Column(Integer, default=0)
    pii_detections = Column(Integer, default=0)
    secrets_detections = Column(Integer, default=0)
    toxicity_blocks = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "tenantId": str(self.tenant_id),
            "apiKeyId": str(self.api_key_id) if self.api_key_id else None,
            "date": self.date.isoformat() if self.date else None,
            "hour": self.hour,
            "totalRequests": self.total_requests,
            "successfulRequests": self.successful_requests,
            "blockedRequests": self.blocked_requests,
            "failedRequests": self.failed_requests,
            "promptTokens": self.prompt_tokens,
            "completionTokens": self.completion_tokens,
            "totalTokens": self.total_tokens,
            "costUsd": float(self.cost_usd) if self.cost_usd else 0,
            "avgLatencyMs": self.avg_latency_ms,
            "p95LatencyMs": self.p95_latency_ms,
            "p99LatencyMs": self.p99_latency_ms,
            "injectionAttempts": self.injection_attempts,
            "piiDetections": self.pii_detections,
            "secretsDetections": self.secrets_detections,
            "toxicityBlocks": self.toxicity_blocks,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
