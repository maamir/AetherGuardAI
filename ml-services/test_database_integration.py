#!/usr/bin/env python3
"""
Test script for ML Services PostgreSQL integration
Tests database connection and logging functionality
"""

import asyncio
import os
import sys
import logging
from datetime import datetime

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from async_database import (
    get_database_manager,
    log_detection_event,
    log_model_integrity_event,
    log_watermark_event
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_database_connection():
    """Test basic database connection"""
    print("=" * 60)
    print("Testing Database Connection")
    print("=" * 60)
    
    try:
        db = await get_database_manager()
        
        if db.is_connected:
            print("✅ Database connection established")
            
            # Test connection
            connection_ok = await db.test_connection()
            if connection_ok:
                print("✅ Database connection test passed")
                return True
            else:
                print("❌ Database connection test failed")
                return False
        else:
            print("❌ Database connection failed")
            return False
            
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False

async def test_detection_logging():
    """Test detection event logging"""
    print("\n" + "=" * 60)
    print("Testing Detection Event Logging")
    print("=" * 60)
    
    # Use existing tenant from database
    test_tenant_id = "6c2d14c2-77e0-4e6b-827e-6dee496eb5b3"  # ACME Corp
    test_api_key_id = None  # Will be None for testing
    test_request_id = "test-request-789"
    
    try:
        # Test injection detection logging
        print("Testing injection detection logging...")
        success = await log_detection_event(
            tenant_id=test_tenant_id,
            detection_type="injection",
            detected=True,
            confidence=0.95,
            text_length=150,
            method="ml_model",
            model_name="llama_guard",
            processing_time_ms=85,
            api_key_id=test_api_key_id,
            request_id=test_request_id,
            source_ip="192.168.1.100",
            user_agent="AetherGuard-Test/1.0"
        )
        
        if success:
            print("✅ Injection detection event logged successfully")
        else:
            print("❌ Failed to log injection detection event")
            return False
        
        # Test toxicity detection logging
        print("Testing toxicity detection logging...")
        success = await log_detection_event(
            tenant_id=test_tenant_id,
            detection_type="toxicity",
            detected=False,
            confidence=0.15,
            text_length=75,
            method="granite_guardian",
            model_name="granite_guardian",
            processing_time_ms=45,
            api_key_id=test_api_key_id,
            request_id=f"{test_request_id}-2"
        )
        
        if success:
            print("✅ Toxicity detection event logged successfully")
        else:
            print("❌ Failed to log toxicity detection event")
            return False
        
        # Test PII detection logging
        print("Testing PII detection logging...")
        success = await log_detection_event(
            tenant_id=test_tenant_id,
            detection_type="pii",
            detected=True,
            confidence=0.88,
            text_length=200,
            method="presidio",
            model_name="presidio",
            processing_time_ms=120,
            api_key_id=test_api_key_id,
            request_id=f"{test_request_id}-3"
        )
        
        if success:
            print("✅ PII detection event logged successfully")
            return True
        else:
            print("❌ Failed to log PII detection event")
            return False
            
    except Exception as e:
        print(f"❌ Detection logging error: {e}")
        return False

async def test_model_integrity_logging():
    """Test model integrity event logging"""
    print("\n" + "=" * 60)
    print("Testing Model Integrity Event Logging")
    print("=" * 60)
    
    # Use existing tenant from database
    test_tenant_id = "6c2d14c2-77e0-4e6b-827e-6dee496eb5b3"  # ACME Corp
    test_api_key_id = None  # Will be None for testing
    
    try:
        # Test backdoor detection logging
        print("Testing backdoor detection logging...")
        success = await log_model_integrity_event(
            tenant_id=test_tenant_id,
            event_type="backdoor_detection",
            severity="high",
            description="Backdoor detected in model weights with high confidence",
            metadata={
                "backdoor_detected": True,
                "confidence": 0.92,
                "suspicious_neurons": 15,
                "method": "activation_analysis"
            },
            api_key_id=test_api_key_id,
            request_id="backdoor-test-001"
        )
        
        if success:
            print("✅ Backdoor detection event logged successfully")
        else:
            print("❌ Failed to log backdoor detection event")
            return False
        
        # Test training data validation logging
        print("Testing training data validation logging...")
        success = await log_model_integrity_event(
            tenant_id=test_tenant_id,
            event_type="training_data_validation",
            severity="low",
            description="Training data validation completed - no issues found",
            metadata={
                "batch_size": 1000,
                "poisoning_detected": False,
                "anomaly_score": 0.05,
                "method": "differential_privacy"
            },
            api_key_id=test_api_key_id,
            request_id="validation-test-001"
        )
        
        if success:
            print("✅ Training data validation event logged successfully")
            return True
        else:
            print("❌ Failed to log training data validation event")
            return False
            
    except Exception as e:
        print(f"❌ Model integrity logging error: {e}")
        return False

async def test_watermark_logging():
    """Test watermark event logging"""
    print("\n" + "=" * 60)
    print("Testing Watermark Event Logging")
    print("=" * 60)
    
    # Use existing tenant from database
    test_tenant_id = "6c2d14c2-77e0-4e6b-827e-6dee496eb5b3"  # ACME Corp
    test_api_key_id = None  # Will be None for testing
    
    try:
        # Test watermark embedding logging
        print("Testing watermark embedding logging...")
        success = await log_watermark_event(
            tenant_id=test_tenant_id,
            action="embed",
            detected=False,  # Not applicable for embedding
            watermark_type="text",
            api_key_id=test_api_key_id,
            request_id="watermark-embed-001"
        )
        
        if success:
            print("✅ Watermark embedding event logged successfully")
        else:
            print("❌ Failed to log watermark embedding event")
            return False
        
        # Test watermark detection logging
        print("Testing watermark detection logging...")
        success = await log_watermark_event(
            tenant_id=test_tenant_id,
            action="detect",
            detected=True,
            confidence=0.87,
            watermark_type="text",
            api_key_id=test_api_key_id,
            request_id="watermark-detect-001"
        )
        
        if success:
            print("✅ Watermark detection event logged successfully")
            return True
        else:
            print("❌ Failed to log watermark detection event")
            return False
            
    except Exception as e:
        print(f"❌ Watermark logging error: {e}")
        return False

async def main():
    """Run all database integration tests"""
    print("AetherGuard ML Services - Database Integration Test")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Database URL: {os.getenv('DATABASE_URL', 'postgresql+asyncpg://aetherguard:password@localhost:5432/aetherguard')}")
    print()
    
    # Test database connection
    connection_ok = await test_database_connection()
    if not connection_ok:
        print("\n❌ Database connection failed. Cannot proceed with tests.")
        print("\nTroubleshooting:")
        print("1. Ensure PostgreSQL is running")
        print("2. Check DATABASE_URL environment variable")
        print("3. Verify database credentials and permissions")
        print("4. Run: docker-compose up postgres")
        return False
    
    # Test detection logging
    detection_ok = await test_detection_logging()
    if not detection_ok:
        print("\n❌ Detection logging tests failed")
        return False
    
    # Test model integrity logging
    integrity_ok = await test_model_integrity_logging()
    if not integrity_ok:
        print("\n❌ Model integrity logging tests failed")
        return False
    
    # Test watermark logging
    watermark_ok = await test_watermark_logging()
    if not watermark_ok:
        print("\n❌ Watermark logging tests failed")
        return False
    
    # All tests passed
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED!")
    print("=" * 60)
    print("ML Services PostgreSQL integration is working correctly.")
    print("Security events and activities are being logged to the database.")
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