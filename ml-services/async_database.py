"""
Async PostgreSQL Integration for ML Services
Logs security events and activities to PostgreSQL database
"""

import logging
import os
from typing import Dict, Optional, Any
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.exc import SQLAlchemyError
import uuid
import asyncio

logger = logging.getLogger(__name__)

Base = declarative_base()

class Activity(Base):
    """Activity model matching backend-api schema"""
    __tablename__ = "activities"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    activity_type = Column(String(50), nullable=False, index=True)
    description = Column(String, nullable=False)
    activity_metadata = Column(JSON, default={})
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class SecurityEvent(Base):
    """Security event model matching backend-api schema"""
    __tablename__ = "security_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    api_key_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    severity = Column(String(20), nullable=False, index=True)
    description = Column(Text)
    request_id = Column(String(100))
    source_ip = Column(String(45))
    user_agent = Column(Text)
    event_metadata = Column("metadata", JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class AsyncDatabaseManager:
    """Async database manager for ML Services"""
    
    def __init__(self, database_url: str = None):
        """Initialize async database connection"""
        self.database_url = database_url or os.getenv(
            'DATABASE_URL', 
            'postgresql+asyncpg://aetherguard:password@localhost:5432/aetherguard'
        )
        
        # Convert sync URL to async if needed
        if self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        self.engine = None
        self.async_session = None
        self.is_connected = False
        
        try:
            # Create async engine
            self.engine = create_async_engine(
                self.database_url,
                pool_size=5,
                max_overflow=10,
                pool_pre_ping=True,
                echo=os.getenv('SQL_DEBUG', 'false').lower() == 'true'
            )
            
            # Create async session factory
            self.async_session = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            self.is_connected = True
            logger.info("Async database connection established successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            self.is_connected = False
    
    async def test_connection(self) -> bool:
        """Test database connection"""
        if not self.is_connected:
            return False
        
        try:
            from sqlalchemy import text
            async with self.async_session() as session:
                await session.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False
    
    async def log_security_event(
        self,
        tenant_id: str,
        event_type: str,
        severity: str,
        description: str,
        metadata: Dict[str, Any] = None,
        api_key_id: str = None,
        request_id: str = None,
        source_ip: str = None,
        user_agent: str = None
    ) -> bool:
        """
        Log security event to database
        
        Args:
            tenant_id: Tenant ID (string, will be converted to UUID)
            event_type: Type of security event (injection_detected, toxicity_detected, etc.)
            severity: Severity level (low, medium, high, critical)
            description: Human-readable description
            metadata: Additional event data
            api_key_id: API key ID (optional, string, will be converted to UUID)
            request_id: Request ID for tracing (optional)
            source_ip: Source IP address (optional)
            user_agent: User agent string (optional)
        
        Returns:
            bool: True if logged successfully, False otherwise
        """
        if not self.is_connected:
            logger.warning("Database not connected, cannot log security event")
            return False
        
        try:
            async with self.async_session() as session:
                # Convert string IDs to UUIDs
                tenant_uuid = uuid.UUID(tenant_id) if tenant_id else None
                api_key_uuid = uuid.UUID(api_key_id) if api_key_id else None
                
                event = SecurityEvent(
                    tenant_id=tenant_uuid,
                    api_key_id=api_key_uuid,
                    event_type=event_type,
                    severity=severity,
                    description=description,
                    request_id=request_id,
                    source_ip=source_ip,
                    user_agent=user_agent,
                    event_metadata=metadata or {},
                    created_at=datetime.utcnow()
                )
                
                session.add(event)
                await session.commit()
                
                logger.info(f"Security event logged: {event_type} for tenant {tenant_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to log security event: {e}")
            return False
    
    async def log_activity(
        self,
        tenant_id: str,
        activity_type: str,
        description: str,
        metadata: Dict[str, Any] = None,
        user_id: str = None,
        ip_address: str = None,
        user_agent: str = None
    ) -> bool:
        """
        Log activity to database
        
        Args:
            tenant_id: Tenant ID (string, will be converted to UUID)
            activity_type: Type of activity (detection_completed, model_loaded, etc.)
            description: Human-readable description
            metadata: Additional activity data
            user_id: User ID (optional, string, will be converted to UUID)
            ip_address: IP address (optional)
            user_agent: User agent string (optional)
        
        Returns:
            bool: True if logged successfully, False otherwise
        """
        if not self.is_connected:
            logger.warning("Database not connected, cannot log activity")
            return False
        
        try:
            async with self.async_session() as session:
                # Convert string IDs to UUIDs
                tenant_uuid = uuid.UUID(tenant_id) if tenant_id else None
                user_uuid = uuid.UUID(user_id) if user_id else None
                
                activity = Activity(
                    tenant_id=tenant_uuid,
                    user_id=user_uuid,
                    activity_type=activity_type,
                    description=description,
                    activity_metadata=metadata or {},
                    ip_address=ip_address,
                    user_agent=user_agent,
                    created_at=datetime.utcnow()
                )
                
                session.add(activity)
                await session.commit()
                
                logger.debug(f"Activity logged: {activity_type} for tenant {tenant_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to log activity: {e}")
            return False
    
    async def close(self):
        """Close database connection"""
        if self.engine:
            await self.engine.dispose()
            logger.info("Database connection closed")

# Global database manager instance
_db_manager = None

async def get_database_manager() -> AsyncDatabaseManager:
    """Get global async database manager instance"""
    global _db_manager
    
    if _db_manager is None:
        _db_manager = AsyncDatabaseManager()
        
        # Test connection
        if _db_manager.is_connected:
            connection_ok = await _db_manager.test_connection()
            if not connection_ok:
                logger.warning("Database connection test failed")
    
    return _db_manager

async def init_database(database_url: str = None) -> AsyncDatabaseManager:
    """Initialize database with custom URL"""
    global _db_manager
    _db_manager = AsyncDatabaseManager(database_url)
    
    if _db_manager.is_connected:
        connection_ok = await _db_manager.test_connection()
        if not connection_ok:
            logger.warning("Database connection test failed")
    
    return _db_manager

# Convenience functions for logging
async def log_detection_event(
    tenant_id: str,
    detection_type: str,
    detected: bool,
    confidence: float,
    text_length: int,
    method: str = "ml_model",
    model_name: str = None,
    processing_time_ms: int = None,
    api_key_id: str = None,
    request_id: str = None,
    source_ip: str = None,
    user_agent: str = None
) -> bool:
    """
    Log detection event (injection, toxicity, PII, etc.)
    
    Args:
        tenant_id: Tenant ID
        detection_type: Type of detection (injection, toxicity, pii, etc.)
        detected: Whether threat was detected
        confidence: Detection confidence score (0.0-1.0)
        text_length: Length of analyzed text
        method: Detection method (ml_model, heuristic, etc.)
        model_name: Name of ML model used
        processing_time_ms: Processing time in milliseconds
        api_key_id: API key ID (optional)
        request_id: Request ID for tracing (optional)
        source_ip: Source IP address (optional)
        user_agent: User agent string (optional)
    
    Returns:
        bool: True if logged successfully, False otherwise
    """
    db = await get_database_manager()
    
    if detected:
        # Log as security event if threat detected
        event_type = f"{detection_type}_detected"
        severity = "high" if confidence > 0.8 else "medium" if confidence > 0.5 else "low"
        description = f"{detection_type.title()} detected with {confidence:.2f} confidence"
        
        metadata = {
            "detection_type": detection_type,
            "confidence": confidence,
            "text_length": text_length,
            "method": method,
            "detected": detected
        }
        
        if model_name:
            metadata["model_name"] = model_name
        if processing_time_ms:
            metadata["processing_time_ms"] = processing_time_ms
        
        return await db.log_security_event(
            tenant_id=tenant_id,
            event_type=event_type,
            severity=severity,
            description=description,
            metadata=metadata,
            api_key_id=api_key_id,
            request_id=request_id,
            source_ip=source_ip,
            user_agent=user_agent
        )
    else:
        # Log as activity if no threat detected
        activity_type = f"{detection_type}_scan_completed"
        description = f"{detection_type.title()} scan completed - no threats detected"
        
        metadata = {
            "detection_type": detection_type,
            "confidence": confidence,
            "text_length": text_length,
            "method": method,
            "detected": detected
        }
        
        if model_name:
            metadata["model_name"] = model_name
        if processing_time_ms:
            metadata["processing_time_ms"] = processing_time_ms
        
        return await db.log_activity(
            tenant_id=tenant_id,
            activity_type=activity_type,
            description=description,
            metadata=metadata,
            ip_address=source_ip,
            user_agent=user_agent
        )

async def log_model_integrity_event(
    tenant_id: str,
    event_type: str,
    severity: str,
    description: str,
    metadata: Dict[str, Any] = None,
    api_key_id: str = None,
    request_id: str = None
) -> bool:
    """Log model integrity event (poisoning, backdoor, etc.)"""
    db = await get_database_manager()
    
    return await db.log_security_event(
        tenant_id=tenant_id,
        event_type=event_type,
        severity=severity,
        description=description,
        metadata=metadata or {},
        api_key_id=api_key_id,
        request_id=request_id
    )

async def log_watermark_event(
    tenant_id: str,
    action: str,
    detected: bool,
    confidence: float = None,
    watermark_type: str = None,
    api_key_id: str = None,
    request_id: str = None
) -> bool:
    """Log watermark embedding or detection event"""
    db = await get_database_manager()
    
    if action == "embed":
        activity_type = "watermark_embedded"
        description = f"Watermark embedded in generated content"
        
        return await db.log_activity(
            tenant_id=tenant_id,
            activity_type=activity_type,
            description=description,
            metadata={
                "action": action,
                "watermark_type": watermark_type
            }
        )
    
    elif action == "detect" and detected:
        event_type = "watermark_detected"
        severity = "medium"
        description = f"Watermark detected in content with {confidence:.2f} confidence"
        
        return await db.log_security_event(
            tenant_id=tenant_id,
            event_type=event_type,
            severity=severity,
            description=description,
            metadata={
                "action": action,
                "detected": detected,
                "confidence": confidence,
                "watermark_type": watermark_type
            },
            api_key_id=api_key_id,
            request_id=request_id
        )
    
    return True  # No logging needed for undetected watermarks