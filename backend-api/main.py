#!/usr/bin/env python3
"""
AetherGuard AI - Backend API Service
Handles authentication, user management, and business logic
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import routers
from routers import (
    admin_auth_router,
    admin_tenants_router,
    admin_analytics_router,
    admin_api_keys_router,
    tenant_auth_router,
    llm_providers_router,
    policies_router,
    analytics_router,
    api_keys_router,
    provider_health_router,
    reports_router,
)

# Import models for startup initialization
from models.base import engine, Base
from models.admin_user import AdminUser
import bcrypt


# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


# Startup event
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 AetherGuard Backend API starting up...")
    
    # Create tables if they don't exist
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created/verified")
    except Exception as e:
        logger.error(f"Failed to create tables: {e}")
    
    # Create default admin user if none exists
    from models.base import SessionLocal
    db = SessionLocal()
    try:
        admin_count = db.query(AdminUser).count()
        if admin_count == 0:
            logger.info("Creating default admin user...")
            default_admin = AdminUser(
                email="admin@aetherguard.ai",
                password_hash=hash_password("admin123"),
                first_name="Admin",
                last_name="User",
                role="super_admin",
                permissions={"all": True}
            )
            db.add(default_admin)
            db.commit()
            logger.info("✅ Default admin created: admin@aetherguard.ai / admin123")
    except Exception as e:
        logger.error(f"Failed to create default admin: {e}")
    finally:
        db.close()
    
    logger.info("✅ Backend API ready!")
    yield
    logger.info("🛑 Backend API shutting down...")


# Create FastAPI app
app = FastAPI(
    title="AetherGuard Backend API",
    description="Authentication and business logic API for AetherGuard AI",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(admin_auth_router)
app.include_router(admin_tenants_router)
app.include_router(admin_analytics_router)
app.include_router(admin_api_keys_router)
app.include_router(tenant_auth_router)
app.include_router(llm_providers_router)
app.include_router(policies_router)
app.include_router(analytics_router)
app.include_router(api_keys_router)
app.include_router(provider_health_router)
app.include_router(reports_router)

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "aetherguard-backend-api",
        "version": "2.0.0",
        "features": [
            "admin_portal",
            "client_portal",
            "llm_providers",
            "policy_management",
            "analytics",
            "api_keys",
            "provider_health",
            "reports"
        ]
    }

@app.get("/")
async def root():
    return {
        "message": "AetherGuard Backend API",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8081)