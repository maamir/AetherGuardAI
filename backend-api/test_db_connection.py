#!/usr/bin/env python3

import os
import sys
sys.path.append('.')

from models.base import SessionLocal, engine
from models.tenant import Tenant
from sqlalchemy import text

def test_database_connection():
    print("Testing database connection...")
    print(f"DATABASE_URL: {os.environ.get('DATABASE_URL')}")
    
    # Test each query in a separate transaction to avoid rollback issues
    
    # Test 1: Basic connection
    try:
        db = SessionLocal()
        result = db.execute(text("SELECT 1 as test")).fetchone()
        print(f"✅ Basic connection works: {result[0]}")
        db.close()
    except Exception as e:
        print(f"❌ Basic connection failed: {e}")
        return
    
    # Test 2: Check current database and connection info
    try:
        db = SessionLocal()
        result = db.execute(text("""
            SELECT 
                current_database(), 
                current_user, 
                inet_server_addr(), 
                inet_server_port(),
                pg_backend_pid()
        """)).fetchone()
        print(f"✅ Connected to database '{result[0]}' as user '{result[1]}'")
        print(f"✅ Server: {result[2]}:{result[3]}, PID: {result[4]}")
        db.close()
    except Exception as e:
        print(f"❌ Database info failed: {e}")
    
    # Test 3: Check if tenants table exists
    try:
        db = SessionLocal()
        result = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'tenants'
            ) as table_exists
        """)).fetchone()
        print(f"✅ Tenants table exists: {result[0]}")
        db.close()
    except Exception as e:
        print(f"❌ Table check failed: {e}")
    
    # Test 4: Check exact connection details and compare with psql
    try:
        db = SessionLocal()
        result = db.execute(text("""
            SELECT 
                current_database() as db_name,
                current_user as user_name,
                current_setting('server_version') as pg_version,
                pg_backend_pid() as backend_pid,
                application_name,
                client_addr
            FROM pg_stat_activity 
            WHERE pid = pg_backend_pid()
        """)).fetchone()
        print(f"✅ Connection details:")
        print(f"  - Database: {result[0]}")
        print(f"  - User: {result[1]}")
        print(f"  - PostgreSQL version: {result[2]}")
        print(f"  - Backend PID: {result[3]}")
        print(f"  - Application: {result[4]}")
        print(f"  - Client address: {result[5]}")
        db.close()
    except Exception as e:
        print(f"❌ Connection details failed: {e}")
    
    # Test 5: Raw SQL count with explicit schema
    try:
        db = SessionLocal()
        result = db.execute(text("SELECT COUNT(*) FROM public.tenants")).fetchone()
        print(f"✅ Raw SQL tenant count (explicit schema): {result[0]}")
        db.close()
    except Exception as e:
        print(f"❌ Raw SQL count (explicit schema) failed: {e}")
    
    # Test 6: Check if we can see the exact same rows as psql
    try:
        db = SessionLocal()
        result = db.execute(text("""
            SELECT id, name, owner_id, status, subscription_tier 
            FROM public.tenants 
            ORDER BY name
        """)).fetchall()
        print(f"✅ Raw SQL tenants with details ({len(result)} found):")
        for row in result:
            print(f"  - {row[1]} (ID: {row[0][:8]}..., Owner: {row[2][:8]}..., Status: {row[3]}, Tier: {row[4]})")
        db.close()
    except Exception as e:
        print(f"❌ Raw SQL detailed list failed: {e}")
    
    # Test 7: Check table permissions
    try:
        db = SessionLocal()
        result = db.execute(text("""
            SELECT 
                grantee, 
                privilege_type 
            FROM information_schema.role_table_grants 
            WHERE table_name = 'tenants' 
            AND grantee = current_user
        """)).fetchall()
        print(f"✅ Table permissions for current user:")
        for row in result:
            print(f"  - {row[1]} granted to {row[0]}")
        db.close()
    except Exception as e:
        print(f"❌ Permission check failed: {e}")
    
    # Test 8: SQLAlchemy ORM count
    try:
        db = SessionLocal()
        count = db.query(Tenant).count()
        print(f"✅ SQLAlchemy ORM tenant count: {count}")
        db.close()
    except Exception as e:
        print(f"❌ SQLAlchemy count failed: {e}")
        print(f"Error details: {type(e).__name__}: {e}")
    
    # Test 9: List all tenants with SQLAlchemy
    try:
        db = SessionLocal()
        tenants = db.query(Tenant).limit(5).all()
        print(f"✅ SQLAlchemy tenants ({len(tenants)} found):")
        for tenant in tenants:
            print(f"  - {tenant.name} ({tenant.id}) owner: {tenant.owner_id}")
        db.close()
    except Exception as e:
        print(f"❌ SQLAlchemy list failed: {e}")
        print(f"Error details: {type(e).__name__}: {e}")
    
    # Test 10: Check table schema
    try:
        db = SessionLocal()
        result = db.execute(text("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'tenants' 
            ORDER BY column_name
        """)).fetchall()
        print(f"✅ Table schema ({len(result)} columns):")
        for row in result:
            print(f"  - {row[0]}: {row[1]} (nullable: {row[2]})")
        db.close()
    except Exception as e:
        print(f"❌ Schema check failed: {e}")
    print("\n🎯 Database connection test completed!")

if __name__ == "__main__":
    # Set the DATABASE_URL environment variable
    os.environ["DATABASE_URL"] = "postgresql://aetherguard:password@localhost:5432/aetherguard"
    test_database_connection()