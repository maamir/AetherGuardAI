"""
Admin Authentication Router
Handles admin login and authentication
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
from models.admin_user import AdminUser

router = APIRouter(prefix="/api/admin/auth", tags=["Admin Auth"])
security = HTTPBearer()

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "aetherguard-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


# Pydantic Models
class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    admin: dict


# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_admin_jwt_token(admin_id: str, email: str, role: str) -> str:
    payload = {
        "admin_id": admin_id,
        "email": email,
        "role": role,
        "type": "admin",
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_admin_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "admin":
            raise HTTPException(status_code=403, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> AdminUser:
    token = credentials.credentials
    payload = verify_admin_jwt_token(token)
    admin_id = payload.get("admin_id")
    
    admin = db.query(AdminUser).filter(AdminUser.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    if not admin.is_active:
        raise HTTPException(status_code=403, detail="Admin account is disabled")
    
    return admin


# Endpoints
@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest, db: Session = Depends(get_db)):
    """
    Admin login endpoint
    """
    # Find admin by email
    admin = db.query(AdminUser).filter(AdminUser.email == request.email).first()
    
    if not admin or not verify_password(request.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account is disabled"
        )
    
    # Update last login
    admin.last_login = datetime.utcnow()
    db.commit()
    
    # Create JWT token
    token = create_admin_jwt_token(str(admin.id), admin.email, admin.role)
    
    return {
        "token": token,
        "admin": admin.to_dict()
    }


@router.get("/me")
async def get_current_admin_info(admin: AdminUser = Depends(get_current_admin)):
    """
    Get current admin user information
    """
    return admin.to_dict()


@router.post("/logout")
async def admin_logout(admin: AdminUser = Depends(get_current_admin)):
    """
    Admin logout endpoint (client should discard token)
    """
    return {"message": "Logged out successfully"}
