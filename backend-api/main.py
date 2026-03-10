#!/usr/bin/env python3
"""
AetherGuard AI - Backend API Service
Handles authentication, user management, and business logic
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Dict, Optional
import jwt
import bcrypt
import uuid
from datetime import datetime, timedelta
import logging
import os
from contextlib import asynccontextmanager

# Database imports
try:
    from sqlalchemy import create_engine, Column, String, DateTime, Integer, Boolean, Text, Float
    from sqlalchemy.ext.declarative import declarative_base
    from sqlalchemy.orm import sessionmaker, Session
    from sqlalchemy.dialects.postgresql import UUID
    import psycopg2
    DATABASE_AVAILABLE = True
except ImportError:
    DATABASE_AVAILABLE = False

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "aetherguard-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///aetherguard.db")

# Security
security = HTTPBearer()

# Database Models
if DATABASE_AVAILABLE:
    Base = declarative_base()
    
    class User(Base):
        __tablename__ = "users"
        
        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        email = Column(String, unique=True, index=True, nullable=False)
        password_hash = Column(String, nullable=False)
        first_name = Column(String, nullable=False)
        last_name = Column(String, nullable=False)
        company_name = Column(String, nullable=False)
        phone = Column(String)
        industry = Column(String)
        tier = Column(String, default="free")
        is_active = Column(Boolean, default=True)
        is_verified = Column(Boolean, default=False)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    class Tenant(Base):
        __tablename__ = "tenants"
        
        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        name = Column(String, nullable=False)
        owner_id = Column(UUID(as_uuid=True), nullable=False)
        tier = Column(String, default="free")
        api_quota = Column(Integer, default=10000)
        api_used = Column(Integer, default=0)
        rate_limit = Column(Integer, default=10)
        is_active = Column(Boolean, default=True)
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    class ApiKey(Base):
        __tablename__ = "api_keys"
        
        id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        key_hash = Column(String, unique=True, nullable=False)
        name = Column(String, nullable=False)
        tenant_id = Column(UUID(as_uuid=True), nullable=False)
        user_id = Column(UUID(as_uuid=True), nullable=False)
        is_active = Column(Boolean, default=True)
        last_used = Column(DateTime)
        created_at = Column(DateTime, default=datetime.utcnow)
        expires_at = Column(DateTime)

# In-memory storage fallback
users_db = {}
tenants_db = {}
api_keys_db = {}

# Pydantic Models
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    confirmPassword: str
    firstName: str
    lastName: str
    companyName: str
    phone: Optional[str] = None
    industry: Optional[str] = None
    tier: str = "free"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    firstName: str
    lastName: str
    companyName: str
    tier: str
    isActive: bool
    createdAt: datetime

class TenantResponse(BaseModel):
    id: str
    name: str
    tier: str
    apiQuota: int
    apiUsed: int
    rateLimit: int
    isActive: bool
    createdAt: datetime

class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key: str
    isActive: bool
    createdAt: datetime
    lastUsed: Optional[datetime] = None

class CreateApiKeyRequest(BaseModel):
    name: str

# Database setup
def get_database():
    if DATABASE_AVAILABLE:
        try:
            engine = create_engine(DATABASE_URL)
            Base.metadata.create_all(bind=engine)
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            return SessionLocal, engine
        except Exception as e:
            logger.warning(f"Database connection failed: {e}, using in-memory storage")
            return None, None
    return None, None

SessionLocal, engine = get_database()

def get_db():
    if SessionLocal:
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
    else:
        yield None

# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> Dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = verify_jwt_token(token)
    user_id = payload.get("user_id")
    
    if db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    else:
        # Fallback to in-memory
        user = users_db.get(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

def generate_api_key() -> str:
    return f"ag_{uuid.uuid4().hex[:24]}"

# Startup event
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 AetherGuard Backend API starting up...")
    
    # Create demo data if database is empty
    if SessionLocal:
        db = SessionLocal()
        try:
            if db.query(User).count() == 0:
                logger.info("Creating demo user...")
                demo_user = User(
                    email="admin@acme.com",
                    password_hash=hash_password("password123"),
                    first_name="Admin",
                    last_name="User",
                    company_name="ACME Corp",
                    phone="+1-555-0123",
                    industry="technology",
                    tier="enterprise",
                    is_verified=True
                )
                db.add(demo_user)
                db.commit()
                
                # Create demo tenant
                demo_tenant = Tenant(
                    name="ACME Corp",
                    owner_id=demo_user.id,
                    tier="enterprise",
                    api_quota=1000000,
                    rate_limit=10000
                )
                db.add(demo_tenant)
                db.commit()
                
                logger.info("✅ Demo data created")
        except Exception as e:
            logger.error(f"Failed to create demo data: {e}")
        finally:
            db.close()
    else:
        # Create demo data in memory
        demo_user_id = str(uuid.uuid4())
        users_db[demo_user_id] = {
            "id": demo_user_id,
            "email": "admin@acme.com",
            "password_hash": hash_password("password123"),
            "first_name": "Admin",
            "last_name": "User",
            "company_name": "ACME Corp",
            "phone": "+1-555-0123",
            "industry": "technology",
            "tier": "enterprise",
            "is_active": True,
            "is_verified": True,
            "created_at": datetime.utcnow()
        }
        
        demo_tenant_id = str(uuid.uuid4())
        tenants_db[demo_tenant_id] = {
            "id": demo_tenant_id,
            "name": "ACME Corp",
            "owner_id": demo_user_id,
            "tier": "enterprise",
            "api_quota": 1000000,
            "api_used": 0,
            "rate_limit": 10000,
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        
        logger.info("✅ Demo data created in memory")
    
    logger.info("✅ Backend API ready!")
    yield
    logger.info("🛑 Backend API shutting down...")

# Create FastAPI app
app = FastAPI(
    title="AetherGuard Backend API",
    description="Authentication and business logic API for AetherGuard AI",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "aetherguard-backend-api",
        "version": "1.0.0",
        "database": "connected" if SessionLocal else "in-memory"
    }

# Authentication endpoints
@app.post("/api/auth/signup")
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    # Validate passwords match
    if request.password != request.confirmPassword:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    # Check if user already exists
    if db:
        existing_user = db.query(User).filter(User.email == request.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create new user
        user = User(
            email=request.email,
            password_hash=hash_password(request.password),
            first_name=request.firstName,
            last_name=request.lastName,
            company_name=request.companyName,
            phone=request.phone,
            industry=request.industry,
            tier=request.tier
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create tenant for the user
        tenant = Tenant(
            name=request.companyName,
            owner_id=user.id,
            tier=request.tier,
            api_quota=10000 if request.tier == "free" else 1000000,
            rate_limit=10 if request.tier == "free" else 1000
        )
        db.add(tenant)
        db.commit()
        
        user_id = str(user.id)
    else:
        # In-memory fallback
        if any(u["email"] == request.email for u in users_db.values()):
            raise HTTPException(status_code=400, detail="Email already registered")
        
        user_id = str(uuid.uuid4())
        users_db[user_id] = {
            "id": user_id,
            "email": request.email,
            "password_hash": hash_password(request.password),
            "first_name": request.firstName,
            "last_name": request.lastName,
            "company_name": request.companyName,
            "phone": request.phone,
            "industry": request.industry,
            "tier": request.tier,
            "is_active": True,
            "is_verified": False,
            "created_at": datetime.utcnow()
        }
        
        # Create tenant
        tenant_id = str(uuid.uuid4())
        tenants_db[tenant_id] = {
            "id": tenant_id,
            "name": request.companyName,
            "owner_id": user_id,
            "tier": request.tier,
            "api_quota": 10000 if request.tier == "free" else 1000000,
            "api_used": 0,
            "rate_limit": 10 if request.tier == "free" else 1000,
            "is_active": True,
            "created_at": datetime.utcnow()
        }
    
    # Create JWT token
    token = create_jwt_token(user_id, request.email)
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": request.email,
            "firstName": request.firstName,
            "lastName": request.lastName,
            "companyName": request.companyName,
            "tier": request.tier
        }
    }

@app.post("/api/auth/login")
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    if db:
        user = db.query(User).filter(User.email == request.email).first()
        if not user or not verify_password(request.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        if not user.is_active:
            raise HTTPException(status_code=401, detail="Account is disabled")
        
        user_data = {
            "id": str(user.id),
            "email": user.email,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "companyName": user.company_name,
            "tier": user.tier
        }
    else:
        # In-memory fallback
        user = None
        for u in users_db.values():
            if u["email"] == request.email:
                user = u
                break
        
        if not user or not verify_password(request.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        if not user["is_active"]:
            raise HTTPException(status_code=401, detail="Account is disabled")
        
        user_data = {
            "id": user["id"],
            "email": user["email"],
            "firstName": user["first_name"],
            "lastName": user["last_name"],
            "companyName": user["company_name"],
            "tier": user["tier"]
        }
    
    token = create_jwt_token(user_data["id"], user_data["email"])
    
    return {
        "token": token,
        "user": user_data
    }

@app.get("/api/auth/me")
async def get_current_user_info(current_user = Depends(get_current_user)):
    if hasattr(current_user, 'id'):
        # Database user
        return {
            "id": str(current_user.id),
            "email": current_user.email,
            "firstName": current_user.first_name,
            "lastName": current_user.last_name,
            "companyName": current_user.company_name,
            "tier": current_user.tier,
            "isActive": current_user.is_active,
            "createdAt": current_user.created_at
        }
    else:
        # In-memory user
        return {
            "id": current_user["id"],
            "email": current_user["email"],
            "firstName": current_user["first_name"],
            "lastName": current_user["last_name"],
            "companyName": current_user["company_name"],
            "tier": current_user["tier"],
            "isActive": current_user["is_active"],
            "createdAt": current_user["created_at"]
        }

# Tenant endpoints
@app.get("/api/tenants")
async def get_tenants(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    if db:
        tenants = db.query(Tenant).all()
        return [
            {
                "id": str(tenant.id),
                "name": tenant.name,
                "tier": tenant.tier,
                "apiQuota": tenant.api_quota,
                "apiUsed": tenant.api_used,
                "rateLimit": tenant.rate_limit,
                "isActive": tenant.is_active,
                "createdAt": tenant.created_at
            }
            for tenant in tenants
        ]
    else:
        return [
            {
                "id": tenant["id"],
                "name": tenant["name"],
                "tier": tenant["tier"],
                "apiQuota": tenant["api_quota"],
                "apiUsed": tenant["api_used"],
                "rateLimit": tenant["rate_limit"],
                "isActive": tenant["is_active"],
                "createdAt": tenant["created_at"]
            }
            for tenant in tenants_db.values()
        ]

# API Key endpoints
@app.get("/api/api-keys")
async def get_api_keys(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    
    if db:
        keys = db.query(ApiKey).filter(ApiKey.user_id == user_id).all()
        return [
            {
                "id": str(key.id),
                "name": key.name,
                "key": f"ag_****{key.key_hash[-4:]}",
                "isActive": key.is_active,
                "createdAt": key.created_at,
                "lastUsed": key.last_used
            }
            for key in keys
        ]
    else:
        return [
            {
                "id": key["id"],
                "name": key["name"],
                "key": f"ag_****{key['key_hash'][-4:]}",
                "isActive": key["is_active"],
                "createdAt": key["created_at"],
                "lastUsed": key.get("last_used")
            }
            for key in api_keys_db.values()
            if key["user_id"] == str(user_id)
        ]

@app.post("/api/api-keys")
async def create_api_key(request: CreateApiKeyRequest, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id if hasattr(current_user, 'id') else current_user["id"]
    api_key = generate_api_key()
    
    if db:
        key_record = ApiKey(
            key_hash=api_key,
            name=request.name,
            tenant_id=user_id,  # Simplified for now
            user_id=user_id
        )
        db.add(key_record)
        db.commit()
        db.refresh(key_record)
        
        return {
            "id": str(key_record.id),
            "name": key_record.name,
            "key": api_key,
            "isActive": key_record.is_active,
            "createdAt": key_record.created_at
        }
    else:
        key_id = str(uuid.uuid4())
        api_keys_db[key_id] = {
            "id": key_id,
            "key_hash": api_key,
            "name": request.name,
            "tenant_id": str(user_id),
            "user_id": str(user_id),
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        
        return {
            "id": key_id,
            "name": request.name,
            "key": api_key,
            "isActive": True,
            "createdAt": datetime.utcnow()
        }

# Analytics endpoints
@app.get("/api/analytics/overview")
async def get_analytics_overview(current_user = Depends(get_current_user)):
    # Mock analytics data
    return {
        "totalRequests": 125430,
        "blockedRequests": 1247,
        "averageLatency": 45,
        "uptime": 99.9,
        "detectionAccuracy": 94.2,
        "requestsToday": 8934,
        "blockedToday": 89,
        "topThreats": [
            {"type": "Prompt Injection", "count": 456},
            {"type": "PII Exposure", "count": 234},
            {"type": "Toxicity", "count": 189}
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)