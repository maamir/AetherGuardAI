#!/usr/bin/env python3
"""
Setup test data for ML Services database integration testing
Creates a test tenant and API key for testing purposes
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime
import bcrypt

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import Column, String, DateTime, Boolean, JSON, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(String(36), primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    company = Column(String)
    tier = Column(String, default="free")
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(String(36), primary_key=True)
    tenant_id = Column(String(36), nullable=False)
    name = Column(String, nullable=False)
    key_hash = Column(String, unique=True, nullable=False)
    key_prefix = Column(String)
    key_last_four = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

async def setup_test_data():
    """Create test tenant and API key"""
    database_url = os.getenv(
        'DATABASE_URL', 
        'postgresql+asyncpg://aetherguard:password@localhost:5432/aetherguard'
    )
    
    # Convert sync URL to async if needed
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(database_url)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    test_tenant_id = "test-tenant-123"
    test_api_key_id = "test-api-key-456"
    
    try:
        async with async_session() as session:
            # Check if test tenant already exists
            from sqlalchemy import text
            result = await session.execute(
                text("SELECT id FROM tenants WHERE id = :tenant_id"),
                {"tenant_id": test_tenant_id}
            )
            existing_tenant = result.fetchone()
            
            if not existing_tenant:
                # Create test tenant
                password_hash = bcrypt.hashpw("testpassword".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
                tenant = Tenant(
                    id=test_tenant_id,
                    name="Test Tenant",
                    email="test@aetherguard.ai",
                    password_hash=password_hash,
                    company="AetherGuard Test Corp",
                    tier="professional",
                    status="active"
                )
                
                session.add(tenant)
                print(f"✅ Created test tenant: {test_tenant_id}")
            else:
                print(f"✅ Test tenant already exists: {test_tenant_id}")
            
            # Check if test API key already exists
            result = await session.execute(
                text("SELECT id FROM api_keys WHERE id = :api_key_id"),
                {"api_key_id": test_api_key_id}
            )
            existing_api_key = result.fetchone()
            
            if not existing_api_key:
                # Create test API key
                test_key = "ag_test_1234567890abcdef"
                key_hash = bcrypt.hashpw(test_key.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
                api_key = APIKey(
                    id=test_api_key_id,
                    tenant_id=test_tenant_id,
                    name="Test API Key",
                    key_hash=key_hash,
                    key_prefix=test_key[:8],
                    key_last_four=test_key[-4:],
                    is_active=True
                )
                
                session.add(api_key)
                print(f"✅ Created test API key: {test_api_key_id}")
            else:
                print(f"✅ Test API key already exists: {test_api_key_id}")
            
            await session.commit()
            print("✅ Test data setup completed successfully")
            return True
            
    except Exception as e:
        print(f"❌ Failed to setup test data: {e}")
        return False
    
    finally:
        await engine.dispose()

if __name__ == "__main__":
    success = asyncio.run(setup_test_data())
    sys.exit(0 if success else 1)