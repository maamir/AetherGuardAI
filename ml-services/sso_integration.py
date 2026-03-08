"""
SSO Integration for AetherGuard AI
Supports SAML 2.0, OAuth 2.0/OIDC, and Active Directory
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import hashlib
import jwt
import secrets


class SSOProvider(Enum):
    """Supported SSO providers"""
    SAML = "saml"
    OAUTH = "oauth"
    OIDC = "oidc"
    ACTIVE_DIRECTORY = "active_directory"
    OKTA = "okta"
    AUTH0 = "auth0"
    AZURE_AD = "azure_ad"
    GOOGLE = "google"


class UserRole(Enum):
    """User roles for RBAC"""
    ADMIN = "admin"
    OPERATOR = "operator"
    ANALYST = "analyst"
    VIEWER = "viewer"
    DEVELOPER = "developer"


@dataclass
class Permission:
    """Permission definition"""
    resource: str  # e.g., "models", "policies", "audit_logs"
    actions: List[str]  # e.g., ["read", "write", "delete"]
    
    def allows(self, action: str) -> bool:
        """Check if permission allows an action"""
        return action in self.actions or "*" in self.actions


@dataclass
class Role:
    """Role with permissions"""
    name: UserRole
    permissions: List[Permission]
    description: str = ""
    
    def has_permission(self, resource: str, action: str) -> bool:
        """Check if role has permission for resource/action"""
        for perm in self.permissions:
            if perm.resource == resource or perm.resource == "*":
                if perm.allows(action):
                    return True
        return False


# Predefined roles with permissions
ROLES = {
    UserRole.ADMIN: Role(
        name=UserRole.ADMIN,
        description="Full system access",
        permissions=[
            Permission(resource="*", actions=["*"]),
        ]
    ),
    UserRole.OPERATOR: Role(
        name=UserRole.OPERATOR,
        description="Manage models and policies",
        permissions=[
            Permission(resource="models", actions=["read", "write", "deploy"]),
            Permission(resource="policies", actions=["read", "write"]),
            Permission(resource="audit_logs", actions=["read"]),
            Permission(resource="analytics", actions=["read"]),
        ]
    ),
    UserRole.ANALYST: Role(
        name=UserRole.ANALYST,
        description="View analytics and audit logs",
        permissions=[
            Permission(resource="analytics", actions=["read", "export"]),
            Permission(resource="audit_logs", actions=["read", "export"]),
            Permission(resource="models", actions=["read"]),
            Permission(resource="policies", actions=["read"]),
        ]
    ),
    UserRole.VIEWER: Role(
        name=UserRole.VIEWER,
        description="Read-only access",
        permissions=[
            Permission(resource="*", actions=["read"]),
        ]
    ),
    UserRole.DEVELOPER: Role(
        name=UserRole.DEVELOPER,
        description="Develop and test models",
        permissions=[
            Permission(resource="models", actions=["read", "write", "test"]),
            Permission(resource="policies", actions=["read"]),
            Permission(resource="analytics", actions=["read"]),
        ]
    ),
}


@dataclass
class User:
    """User account"""
    user_id: str
    email: str
    name: str
    tenant_id: str
    roles: List[UserRole]
    sso_provider: Optional[SSOProvider] = None
    sso_subject: Optional[str] = None  # SSO provider's user ID
    created_at: datetime = field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    status: str = "active"  # active, suspended, deleted
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def has_permission(self, resource: str, action: str) -> bool:
        """Check if user has permission for resource/action"""
        for role_name in self.roles:
            role = ROLES.get(role_name)
            if role and role.has_permission(resource, action):
                return True
        return False
    
    def is_admin(self) -> bool:
        """Check if user is admin"""
        return UserRole.ADMIN in self.roles


@dataclass
class SSOConfig:
    """SSO provider configuration"""
    provider: SSOProvider
    enabled: bool
    client_id: str
    client_secret: str
    issuer_url: str
    redirect_uri: str
    scopes: List[str] = field(default_factory=lambda: ["openid", "profile", "email"])
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuthSession:
    """Authentication session"""
    session_id: str
    user_id: str
    tenant_id: str
    created_at: datetime
    expires_at: datetime
    ip_address: str
    user_agent: str
    
    def is_valid(self) -> bool:
        """Check if session is still valid"""
        return datetime.utcnow() < self.expires_at


class SSOManager:
    """Manage SSO authentication and authorization"""
    
    def __init__(self, jwt_secret: str = None):
        self.users: Dict[str, User] = {}
        self.sessions: Dict[str, AuthSession] = {}
        self.sso_configs: Dict[str, SSOConfig] = {}
        self.jwt_secret = jwt_secret or secrets.token_urlsafe(32)
        self._load_demo_data()
    
    def _load_demo_data(self):
        """Load demo users and SSO configs"""
        # Demo users
        demo_users = [
            User(
                user_id="user_admin",
                email="admin@acme.com",
                name="Admin User",
                tenant_id="tenant_acme",
                roles=[UserRole.ADMIN],
                sso_provider=SSOProvider.AZURE_AD,
                sso_subject="azure_123456",
            ),
            User(
                user_id="user_operator",
                email="operator@acme.com",
                name="Operator User",
                tenant_id="tenant_acme",
                roles=[UserRole.OPERATOR],
                sso_provider=SSOProvider.OKTA,
                sso_subject="okta_789012",
            ),
            User(
                user_id="user_analyst",
                email="analyst@startup.com",
                name="Analyst User",
                tenant_id="tenant_startup",
                roles=[UserRole.ANALYST],
                sso_provider=SSOProvider.GOOGLE,
                sso_subject="google_345678",
            ),
        ]
        
        for user in demo_users:
            self.users[user.user_id] = user
        
        # Demo SSO configs
        self.sso_configs = {
            "azure_ad": SSOConfig(
                provider=SSOProvider.AZURE_AD,
                enabled=True,
                client_id="azure_client_id",
                client_secret="azure_client_secret",
                issuer_url="https://login.microsoftonline.com/tenant_id",
                redirect_uri="https://aetherguard.ai/auth/callback",
            ),
            "okta": SSOConfig(
                provider=SSOProvider.OKTA,
                enabled=True,
                client_id="okta_client_id",
                client_secret="okta_client_secret",
                issuer_url="https://dev-123456.okta.com",
                redirect_uri="https://aetherguard.ai/auth/callback",
            ),
            "google": SSOConfig(
                provider=SSOProvider.GOOGLE,
                enabled=True,
                client_id="google_client_id",
                client_secret="google_client_secret",
                issuer_url="https://accounts.google.com",
                redirect_uri="https://aetherguard.ai/auth/callback",
            ),
        }
    
    def authenticate_saml(self, saml_response: str, tenant_id: str) -> Optional[User]:
        """
        Authenticate user via SAML 2.0
        In production, use python3-saml library
        """
        # Mock implementation
        # In production: parse SAML response, validate signature, extract attributes
        
        # Extract user info from SAML response (mock)
        email = "user@example.com"
        name = "SAML User"
        sso_subject = "saml_" + hashlib.sha256(email.encode()).hexdigest()[:12]
        
        # Find or create user
        user = self._find_or_create_user(
            email=email,
            name=name,
            tenant_id=tenant_id,
            sso_provider=SSOProvider.SAML,
            sso_subject=sso_subject,
        )
        
        return user
    
    def authenticate_oauth(self, code: str, provider: str, tenant_id: str) -> Optional[User]:
        """
        Authenticate user via OAuth 2.0/OIDC
        In production, use authlib or similar library
        """
        config = self.sso_configs.get(provider)
        if not config or not config.enabled:
            return None
        
        # Mock implementation
        # In production: exchange code for token, validate token, get user info
        
        # Extract user info from OAuth token (mock)
        email = "user@example.com"
        name = "OAuth User"
        sso_subject = f"{provider}_" + hashlib.sha256(email.encode()).hexdigest()[:12]
        
        # Find or create user
        user = self._find_or_create_user(
            email=email,
            name=name,
            tenant_id=tenant_id,
            sso_provider=SSOProvider(config.provider.value),
            sso_subject=sso_subject,
        )
        
        return user
    
    def authenticate_ad(self, username: str, password: str, tenant_id: str) -> Optional[User]:
        """
        Authenticate user via Active Directory
        In production, use ldap3 library
        """
        # Mock implementation
        # In production: connect to AD, bind with credentials, search for user
        
        if not username or not password:
            return None
        
        # Extract user info from AD (mock)
        email = f"{username}@company.com"
        name = username.title()
        sso_subject = "ad_" + hashlib.sha256(username.encode()).hexdigest()[:12]
        
        # Find or create user
        user = self._find_or_create_user(
            email=email,
            name=name,
            tenant_id=tenant_id,
            sso_provider=SSOProvider.ACTIVE_DIRECTORY,
            sso_subject=sso_subject,
        )
        
        return user
    
    def _find_or_create_user(
        self,
        email: str,
        name: str,
        tenant_id: str,
        sso_provider: SSOProvider,
        sso_subject: str,
    ) -> User:
        """Find existing user or create new one"""
        # Find by SSO subject
        for user in self.users.values():
            if user.sso_provider == sso_provider and user.sso_subject == sso_subject:
                user.last_login = datetime.utcnow()
                return user
        
        # Find by email
        for user in self.users.values():
            if user.email == email and user.tenant_id == tenant_id:
                # Update SSO info
                user.sso_provider = sso_provider
                user.sso_subject = sso_subject
                user.last_login = datetime.utcnow()
                return user
        
        # Create new user
        user_id = "user_" + hashlib.sha256(email.encode()).hexdigest()[:12]
        user = User(
            user_id=user_id,
            email=email,
            name=name,
            tenant_id=tenant_id,
            roles=[UserRole.VIEWER],  # Default role
            sso_provider=sso_provider,
            sso_subject=sso_subject,
            last_login=datetime.utcnow(),
        )
        
        self.users[user_id] = user
        return user
    
    def create_session(
        self,
        user: User,
        ip_address: str,
        user_agent: str,
        duration_hours: int = 24,
    ) -> AuthSession:
        """Create authentication session"""
        session_id = secrets.token_urlsafe(32)
        
        session = AuthSession(
            session_id=session_id,
            user_id=user.user_id,
            tenant_id=user.tenant_id,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(hours=duration_hours),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        
        self.sessions[session_id] = session
        return session
    
    def validate_session(self, session_id: str) -> Optional[User]:
        """Validate session and return user"""
        session = self.sessions.get(session_id)
        if not session or not session.is_valid():
            return None
        
        user = self.users.get(session.user_id)
        if not user or user.status != "active":
            return None
        
        return user
    
    def revoke_session(self, session_id: str) -> bool:
        """Revoke authentication session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False
    
    def generate_jwt(self, user: User, session: AuthSession) -> str:
        """Generate JWT token for API access"""
        payload = {
            "sub": user.user_id,
            "email": user.email,
            "name": user.name,
            "tenant_id": user.tenant_id,
            "roles": [role.value for role in user.roles],
            "session_id": session.session_id,
            "iat": datetime.utcnow(),
            "exp": session.expires_at,
        }
        
        token = jwt.encode(payload, self.jwt_secret, algorithm="HS256")
        return token
    
    def validate_jwt(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate JWT token and return payload"""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=["HS256"])
            
            # Validate session still exists
            session_id = payload.get("session_id")
            if session_id and session_id not in self.sessions:
                return None
            
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def check_permission(self, user_id: str, resource: str, action: str) -> bool:
        """Check if user has permission for resource/action"""
        user = self.users.get(user_id)
        if not user or user.status != "active":
            return False
        
        return user.has_permission(resource, action)
    
    def assign_role(self, user_id: str, role: UserRole) -> bool:
        """Assign role to user"""
        user = self.users.get(user_id)
        if not user:
            return False
        
        if role not in user.roles:
            user.roles.append(role)
        
        return True
    
    def revoke_role(self, user_id: str, role: UserRole) -> bool:
        """Revoke role from user"""
        user = self.users.get(user_id)
        if not user:
            return False
        
        if role in user.roles:
            user.roles.remove(role)
        
        return True
    
    def list_users(self, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List users with optional tenant filter"""
        users = []
        
        for user in self.users.values():
            if tenant_id and user.tenant_id != tenant_id:
                continue
            
            users.append({
                "user_id": user.user_id,
                "email": user.email,
                "name": user.name,
                "tenant_id": user.tenant_id,
                "roles": [role.value for role in user.roles],
                "sso_provider": user.sso_provider.value if user.sso_provider else None,
                "status": user.status,
                "last_login": user.last_login.isoformat() if user.last_login else None,
            })
        
        return users


# Global SSO manager instance
_sso_manager = None


def get_sso_manager() -> SSOManager:
    """Get or create global SSO manager instance"""
    global _sso_manager
    if _sso_manager is None:
        _sso_manager = SSOManager()
    return _sso_manager


# Example usage
if __name__ == "__main__":
    manager = get_sso_manager()
    
    # Authenticate via OAuth
    user = manager.authenticate_oauth(
        code="auth_code_123",
        provider="azure_ad",
        tenant_id="tenant_acme",
    )
    
    if user:
        print(f"Authenticated: {user.name} ({user.email})")
        print(f"Roles: {[role.value for role in user.roles]}")
        
        # Create session
        session = manager.create_session(
            user=user,
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
        )
        
        # Generate JWT
        token = manager.generate_jwt(user, session)
        print(f"\nJWT Token: {token[:50]}...")
        
        # Check permissions
        print(f"\nPermissions:")
        print(f"  Read models: {user.has_permission('models', 'read')}")
        print(f"  Write policies: {user.has_permission('policies', 'write')}")
        print(f"  Delete users: {user.has_permission('users', 'delete')}")
