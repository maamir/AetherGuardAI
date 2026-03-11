"""
Tenant Authentication Router
Handles tenant user login and authentication
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import bcrypt
import jwt
import os

from models.base import get_db
from models.tenant import Tenant

router = APIRouter(prefix="/api/auth", tags=["Tenant Auth"])
security = HTTPBearer()

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "aetherguard-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


# Pydantic Models
class TenantLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TenantSignupRequest(BaseModel):
    email: EmailStr
    password: str
    confirmPassword: str
    firstName: str
    lastName: str
    companyName: str
    phone: str = None
    industry: str = None


class TenantLoginResponse(BaseModel):
    token: str
    user: dict


# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_tenant_jwt_token(user_id: str, email: str, tenant_id: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "tenant_id": tenant_id,
        "type": "tenant",
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_tenant_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "tenant":
            raise HTTPException(status_code=403, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_tenant_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> dict:
    """Get current authenticated tenant user"""
    token = credentials.credentials
    payload = verify_tenant_jwt_token(token)
    
    user_id = payload.get("user_id")
    tenant_id = payload.get("tenant_id")
    
    # Get tenant
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    if not tenant.is_active:
        raise HTTPException(status_code=403, detail="Tenant account is disabled")
    
    return {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "email": payload.get("email"),
        "tenant": tenant
    }


# Endpoints
@router.post("/login", response_model=TenantLoginResponse)
async def tenant_login(request: TenantLoginRequest, db: Session = Depends(get_db)):
    """
    Tenant user login endpoint
    """
    # Check in users table (legacy table for tenant users)
    from sqlalchemy import Column, String, Boolean, DateTime
    from sqlalchemy.dialects.postgresql import UUID as PGUUID
    from models.base import Base
    import uuid
    
    # Define User model inline (legacy table)
    class User(Base):
        __tablename__ = "users"
        __table_args__ = {'extend_existing': True}
        
        id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
        email = Column(String)
        password_hash = Column(String)
        first_name = Column(String)
        last_name = Column(String)
        is_active = Column(Boolean, default=True)
    
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    # Find tenant for this user
    tenant = db.query(Tenant).filter(Tenant.owner_id == user.id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="No tenant found for this user")
    
    # Create JWT token
    token = create_tenant_jwt_token(str(user.id), user.email, str(tenant.id))
    
    return {
        "token": token,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "firstName": user.first_name,
            "lastName": user.last_name,
            "tenantId": str(tenant.id),
            "tenantName": tenant.name
        }
    }


@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_tenant_user)):
    """
    Get current tenant user information
    """
    tenant = current_user["tenant"]
    return {
        "userId": current_user["user_id"],
        "email": current_user["email"],
        "tenantId": str(tenant.id),
        "tenantName": tenant.name,
        "status": tenant.status,
        "tier": tenant.subscription_tier,
        "apiQuota": tenant.api_quota,
        "apiUsed": tenant.api_used,
        "rateLimit": tenant.rate_limit
    }


@router.post("/logout")
async def tenant_logout(current_user: dict = Depends(get_current_tenant_user)):
    """
    Tenant logout endpoint (client should discard token)
    """
    return {"message": "Logged out successfully"}
