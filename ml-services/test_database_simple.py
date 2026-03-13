#!/usr/bin/env python3
"""
Simple Database Integration Test for ML Services
Tests database logging without foreign key constraints
"""

import asyncio
import os
import sys
import logging
import json
from datetime import datetime

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from async_database import get_database_manager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_direct_database_insert():
    """Test direct database insert without foreign key constraints"""
    print("=" * 60)
    print("Testing Direct Database Insert")
    print("=" * 60)
    
    database_url = os.getenv(
        'DATABASE_URL', 
        'postgresql+asyncpg://aetherguard:password@localhost:5432/aetherguard'
    )
    
    # Convert sync URL to async if needed
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(database_url)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        async with async_session() as session:
            # Test 1: Insert security event with known tenant
            print("Testing security event insert...")
            
            # Use known tenant ID from database
            tenant_id = "6c2d14c2-77e0-4e6b-827e-6dee496eb5b3"  # ACME Corp
            print(f"Using tenant ID: {tenant_id}")
            
            # Insert security event directly
            event_id = str(uuid.uuid4())
            await session.execute(text("""
                INSERT INTO security_events 
                (id, tenant_id, event_type, severity, description, metadata, created_at)
                VALUES (:id, :tenant_id, :event_type, :severity, :description, :metadata, :created_at)
            """), {
                "id": event_id,
                "tenant_id": tenant_id,
                "event_type": "injection_detected",
                "severity": "high",
                "description": "Test injection detection from ML Services",
                "metadata": json.dumps({
                    "detection_type": "injection",
                    "confidence": 0.95,
                    "method": "ml_model",
                    "test": True
                }),
                "created_at": datetime.utcnow()
            })
            
            await session.commit()
            print("✅ Security event inserted successfully")
            
            # Test 2: Insert activity
            print("Testing activity insert...")
            
            activity_id = str(uuid.uuid4())
            await session.execute(text("""
                INSERT INTO activities 
                (id, tenant_id, activity_type, description, activity_metadata, created_at)
                VALUES (:id, :tenant_id, :activity_type, :description, :metadata, :created_at)
            """), {
                "id": activity_id,
                "tenant_id": tenant_id,
                "activity_type": "toxicity_scan_completed",
                "description": "Test toxicity scan completed - no threats detected",
                "metadata": json.dumps({
                    "detection_type": "toxicity",
                    "confidence": 0.15,
                    "method": "granite_guardian",
                    "test": True
                }),
                "created_at": datetime.utcnow()
            })
            
            await session.commit()
            print("✅ Activity inserted successfully")
            
            # Test 3: Verify inserts
            print("Verifying inserted data...")
            
            # Check security event
            result = await session.execute(text("""
                SELECT event_type, severity, description 
                FROM security_events 
                WHERE id = :id
            """), {"id": event_id})
            
            event_row = result.fetchone()
            if event_row:
                print(f"✅ Security event verified: {event_row[0]} - {event_row[1]}")
            else:
                print("❌ Security event not found")
                return False
            
            # Check activity
            result = await session.execute(text("""
                SELECT activity_type, description 
                FROM activities 
                WHERE id = :id
            """), {"id": activity_id})
            
            activity_row = result.fetchone()
            if activity_row:
                print(f"✅ Activity verified: {activity_row[0]}")
            else:
                print("❌ Activity not found")
                return False
            
            # Clean up test data
            print("Cleaning up test data...")
            await session.execute(text("DELETE FROM security_events WHERE id = :id"), {"id": event_id})
            await session.execute(text("DELETE FROM activities WHERE id = :id"), {"id": activity_id})
            await session.commit()
            print("✅ Test data cleaned up")
            
            return True
            
    except Exception as e:
        print(f"❌ Database test failed: {e}")
        return False
    
    finally:
        await engine.dispose()

async def test_async_database_manager():
    """Test the async database manager with simplified logging"""
    print("\n" + "=" * 60)
    print("Testing Async Database Manager")
    print("=" * 60)
    
    try:
        db = await get_database_manager()
        
        if not db.is_connected:
            print("❌ Database manager not connected")
            return False
        
        print("✅ Database manager connected")
        
        # Test connection
        connection_ok = await db.test_connection()
        if not connection_ok:
            print("❌ Database connection test failed")
            return False
        
        print("✅ Database connection test passed")
        
        # Get an existing tenant for testing
        tenant_id = "6c2d14c2-77e0-4e6b-827e-6dee496eb5b3"  # ACME Corp
        print(f"Using tenant ID: {tenant_id}")
        
        # Test security event logging with proper tenant
        print("Testing security event logging...")
        success = await db.log_security_event(
            tenant_id=tenant_id,
            event_type="test_injection_detected",
            severity="medium",
            description="Test injection detection from ML Services integration test",
            metadata={
                "detection_type": "injection",
                "confidence": 0.85,
                "method": "test",
                "source": "integration_test"
            },
            request_id="test-req-001"
        )
        
        if success:
            print("✅ Security event logged successfully")
        else:
            print("❌ Security event logging failed")
            return False
        
        # Test activity logging
        print("Testing activity logging...")
        success = await db.log_activity(
            tenant_id=tenant_id,
            activity_type="test_scan_completed",
            description="Test scan completed successfully",
            metadata={
                "scan_type": "integration_test",
                "duration_ms": 150,
                "items_scanned": 1
            }
        )
        
        if success:
            print("✅ Activity logged successfully")
        else:
            print("❌ Activity logging failed")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Database manager test failed: {e}")
        return False

async def main():
    """Run simplified database integration tests"""
    print("AetherGuard ML Services - Simple Database Integration Test")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Database URL: {os.getenv('DATABASE_URL', 'postgresql+asyncpg://aetherguard:password@localhost:5432/aetherguard')}")
    print()
    
    # Test 1: Direct database operations
    direct_test_ok = await test_direct_database_insert()
    if not direct_test_ok:
        print("\n❌ Direct database test failed")
        return False
    
    # Test 2: Async database manager
    manager_test_ok = await test_async_database_manager()
    if not manager_test_ok:
        print("\n❌ Database manager test failed")
        return False
    
    # All tests passed
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
    print("ML Services can successfully log to PostgreSQL database.")
    print("Security events and activities are being written correctly.")
    print()
    
    return True

if __name__ == "__main__":
    # Run the tests
    success = asyncio.run(main())
    
    if success:
        print("Database integration test completed successfully.")
        sys.exit(0)
    else:
        print("Database integration test failed.")
        sys.exit(1)