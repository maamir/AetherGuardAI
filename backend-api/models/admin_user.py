"""
Admin User Model
"""

from sqlalchemy import Column, String, Boolean, DateTime, JSON
from datetime import datetime
import uuid
from .base import Base


class AdminUser(Base):
    __tablename__ = "admin_users"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    role = Column(String(50), default="admin", index=True)
    permissions = Column(JSON, default={})
    is_active = Column(Boolean, default=True, index=True)
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "firstName": self.first_name,
            "lastName": self.last_name,
            "role": self.role,
            "permissions": self.permissions,
            "isActive": self.is_active,
            "lastLogin": self.last_login.isoformat() if self.last_login else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
