#!/usr/bin/env python3
"""
Database Migration Runner
Applies all pending migrations to the database
"""

import os
import sys
from pathlib import Path
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'aetherguard'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

MIGRATIONS_DIR = Path(__file__).parent / 'migrations'

def get_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        return conn
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        sys.exit(1)

def create_migrations_table(conn):
    """Create migrations tracking table if it doesn't exist"""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
    print("✅ Migrations table ready")

def get_applied_migrations(conn):
    """Get list of already applied migrations"""
    with conn.cursor() as cur:
        cur.execute("SELECT filename FROM schema_migrations ORDER BY applied_at")
        return {row[0] for row in cur.fetchall()}

def get_pending_migrations(applied):
    """Get list of pending migrations"""
    all_migrations = sorted([
        f.name for f in MIGRATIONS_DIR.glob('*.sql')
    ])
    return [m for m in all_migrations if m not in applied]

def apply_migration(conn, filename):
    """Apply a single migration"""
    filepath = MIGRATIONS_DIR / filename
    
    print(f"📝 Applying migration: {filename}")
    
    try:
        with open(filepath, 'r') as f:
            sql = f.read()
        
        with conn.cursor() as cur:
            # Execute migration
            cur.execute(sql)
            
            # Record migration
            cur.execute(
                "INSERT INTO schema_migrations (filename) VALUES (%s)",
                (filename,)
            )
        
        print(f"✅ Applied: {filename}")
        return True
    
    except Exception as e:
        print(f"❌ Failed to apply {filename}: {e}")
        return False

def main():
    """Main migration runner"""
    print("🚀 Starting database migrations...")
    print(f"📍 Database: {DB_CONFIG['database']} @ {DB_CONFIG['host']}")
    
    # Connect to database
    conn = get_connection()
    
    try:
        # Create migrations table
        create_migrations_table(conn)
        
        # Get applied and pending migrations
        applied = get_applied_migrations(conn)
        pending = get_pending_migrations(applied)
        
        if not pending:
            print("✅ No pending migrations")
            return
        
        print(f"📋 Found {len(pending)} pending migration(s)")
        
        # Apply each pending migration
        success_count = 0
        for migration in pending:
            if apply_migration(conn, migration):
                success_count += 1
            else:
                print(f"⚠️  Stopping at failed migration: {migration}")
                break
        
        print(f"\n✅ Applied {success_count}/{len(pending)} migration(s)")
        
    finally:
        conn.close()

if __name__ == '__main__':
    main()
