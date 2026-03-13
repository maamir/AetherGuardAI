"""
Activity Model
Tracks all user and system activities for audit and monitoring
"""

from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from datetime import datetime
import uuid
from models.base import Base, DATABASE_URL

# Use UUID for PostgreSQL, String for SQLite
if DATABASE_URL.startswith("postgresql"):
    UUIDType = PGUUID(as_uuid=True)
    uuid_default = uuid.uuid4
else:
    UUIDType = String(36)
    uuid_default = lambda: str(uuid.uuid4())

class Activity(Base):
    __tablename__ = "activities"
    
    id = Column(UUIDType, primary_key=True, default=uuid_default)
    tenant_id = Column(UUIDType, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(UUIDType, nullable=True)  # NULL for system actions
    activity_type = Column(String(50), nullable=False, index=True)
    description = Column(String, nullable=False)
    activity_metadata = Column(JSON, default={})  # Renamed from 'metadata' to avoid SQLAlchemy conflict
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    def to_dict(self):
        """Convert activity to dictionary"""
        return {
            "id": str(self.id) if not isinstance(self.id, str) else self.id,
            "tenant_id": str(self.tenant_id) if not isinstance(self.tenant_id, str) else self.tenant_id,
            "user_id": str(self.user_id) if self.user_id and not isinstance(self.user_id, str) else self.user_id,
            "type": self.activity_type,
            "description": self.description,
            "metadata": self.activity_metadata,
            "timestamp": self.created_at.isoformat(),
            "ip_address": self.ip_address,
            "user_agent": self.user_agent
        }
