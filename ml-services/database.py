"""
Real Database Integration for AetherGuard AI
Replaces in-memory storage with PostgreSQL using SQLAlchemy
"""

import logging
import os
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from sqlalchemy import create_engine, Column, String, DateTime, Integer, Float, Boolean, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
import uuid
import bcrypt
import json

logger = logging.getLogger(__name__)

Base = declarative_base()

# Database Models
class User(Base):
    __tablename__ = 'users'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default='viewer')
    status = Column(String, nullable=False, default='active')
    tenant_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)
    mfa_enabled = Column(Boolean, default=False)
    sso_provider = Column(String)
    sso_subject = Column(String)
    attributes = Column(JSON)

class Tenant(Base):
    __tablename__ = 'tenants'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    tier = Column(String, nullable=False, default='starter')
    status = Column(String, nullable=False, default='active')
    billing_email = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Usage tracking
    users_count = Column(Integer, default=0)
    requests_count = Column(Integer, default=0)
    quota = Column(Integer, default=100000)
    storage_used_gb = Column(Float, default=0.0)
    
    # Configuration
    allowed_models = Column(JSON)
    policy_ids = Column(JSON)
    settings = Column(JSON)

class ApiKey(Base):
    __tablename__ = 'api_keys'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    key_hash = Column(String, nullable=False, unique=True)
    key_prefix = Column(String, nullable=False)  # First 8 chars for display
    user_id = Column(String, nullable=False)
    tenant_id = Column(String, nullable=False)
    status = Column(String, nullable=False, default='active')
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used = Column(DateTime)
    requests_count = Column(Integer, default=0)
    permissions = Column(JSON)

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, nullable=False)
    user_id = Column(String)
    api_key_id = Column(String)
    event_type = Column(String, nullable=False)
    resource = Column(String)
    action = Column(String, nullable=False)
    details = Column(JSON)
    ip_address = Column(String)
    user_agent = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Chain of custody
    previous_hash = Column(String)
    event_hash = Column(String)

class DetectionLog(Base):
    __tablename__ = 'detection_logs'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, nullable=False)
    user_id = Column(String)
    api_key_id = Column(String)
    detector_type = Column(String, nullable=False)
    input_text = Column(Text)
    output_text = Column(Text)
    detected = Column(Boolean, nullable=False)
    confidence = Column(Float)
    details = Column(JSON)
    processing_time_ms = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow)

class Session(Base):
    __tablename__ = 'sessions'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False)
    token_hash = Column(String, nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String)
    user_agent = Column(String)
    is_active = Column(Boolean, default=True)

class DatabaseManager:
    """Real database manager using PostgreSQL"""
    
    def __init__(self, database_url: str = None):
        """Initialize database connection"""
        self.database_url = database_url or os.getenv(
            'DATABASE_URL', 
            'postgresql://aetherguard:password@localhost/aetherguard'
        )
        
        self.engine = None
        self.SessionLocal = None
        self.is_connected = False
        
        try:
            # Create engine
            self.engine = create_engine(
                self.database_url,
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,
                echo=os.getenv('SQL_DEBUG', 'false').lower() == 'true'
            )
            
            # Create session factory
            self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
            
            # Test connection
            with self.engine.connect() as conn:
                conn.execute("SELECT 1")
            
            self.is_connected = True
            logger.info("Database connection established successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            logger.info("Falling back to in-memory storage")
            self._init_fallback()
    
    def _init_fallback(self):
        """Initialize fallback in-memory storage"""
        self.fallback_storage = {
            'users': {},
            'tenants': {},
            'api_keys': {},
            'audit_logs': [],
            'detection_logs': [],
            'sessions': {}
        }
        self.is_connected = False
        logger.info("Database initialized in fallback mode (in-memory)")
    
    def create_tables(self):
        """Create all database tables"""
        if not self.is_connected:
            logger.warning("Database not connected, cannot create tables")
            return False
        
        try:
            Base.metadata.create_all(bind=self.engine)
            logger.info("Database tables created successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            return False
    
    def get_session(self) -> Session:
        """Get database session"""
        if not self.is_connected:
            raise RuntimeError("Database not connected")
        
        return self.SessionLocal()
    
    # User Management
    def create_user(self, user_data: Dict) -> Dict:
        """Create new user"""
        if not self.is_connected:
            return self._create_user_fallback(user_data)
        
        try:
            with self.get_session() as session:
                # Hash password
                password_hash = bcrypt.hashpw(
                    user_data['password'].encode('utf-8'), 
                    bcrypt.gensalt()
                ).decode('utf-8')
                
                user = User(
                    email=user_data['email'],
                    name=user_data['name'],
                    password_hash=password_hash,
                    role=user_data.get('role', 'viewer'),
                    tenant_id=user_data['tenant_id'],
                    sso_provider=user_data.get('sso_provider'),
                    sso_subject=user_data.get('sso_subject'),
                    attributes=user_data.get('attributes', {})
                )
                
                session.add(user)
                session.commit()
                session.refresh(user)
                
                return self._user_to_dict(user)
                
        except Exception as e:
            logger.error(f"Failed to create user: {e}")
            raise
    
    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """Get user by email"""
        if not self.is_connected:
            return self._get_user_by_email_fallback(email)
        
        try:
            with self.get_session() as session:
                user = session.query(User).filter(User.email == email).first()
                return self._user_to_dict(user) if user else None
                
        except Exception as e:
            logger.error(f"Failed to get user by email: {e}")
            return None
    
    def get_user_by_id(self, user_id: str) -> Optional[Dict]:
        """Get user by ID"""
        if not self.is_connected:
            return self._get_user_by_id_fallback(user_id)
        
        try:
            with self.get_session() as session:
                user = session.query(User).filter(User.id == user_id).first()
                return self._user_to_dict(user) if user else None
                
        except Exception as e:
            logger.error(f"Failed to get user by ID: {e}")
            return None
    
    def update_user(self, user_id: str, updates: Dict) -> Optional[Dict]:
        """Update user"""
        if not self.is_connected:
            return self._update_user_fallback(user_id, updates)
        
        try:
            with self.get_session() as session:
                user = session.query(User).filter(User.id == user_id).first()
                if not user:
                    return None
                
                for key, value in updates.items():
                    if hasattr(user, key):
                        setattr(user, key, value)
                
                user.updated_at = datetime.utcnow()
                session.commit()
                session.refresh(user)
                
                return self._user_to_dict(user)
                
        except Exception as e:
            logger.error(f"Failed to update user: {e}")
            raise
    
    def list_users(self, tenant_id: str = None) -> List[Dict]:
        """List users"""
        if not self.is_connected:
            return self._list_users_fallback(tenant_id)
        
        try:
            with self.get_session() as session:
                query = session.query(User)
                if tenant_id:
                    query = query.filter(User.tenant_id == tenant_id)
                
                users = query.all()
                return [self._user_to_dict(user) for user in users]
                
        except Exception as e:
            logger.error(f"Failed to list users: {e}")
            return []
    
    # Tenant Management
    def create_tenant(self, tenant_data: Dict) -> Dict:
        """Create new tenant"""
        if not self.is_connected:
            return self._create_tenant_fallback(tenant_data)
        
        try:
            with self.get_session() as session:
                tenant = Tenant(
                    name=tenant_data['name'],
                    tier=tenant_data.get('tier', 'starter'),
                    billing_email=tenant_data['billing_email'],
                    quota=self._get_tier_quota(tenant_data.get('tier', 'starter')),
                    allowed_models=tenant_data.get('allowed_models', []),
                    policy_ids=tenant_data.get('policy_ids', []),
                    settings=tenant_data.get('settings', {})
                )
                
                session.add(tenant)
                session.commit()
                session.refresh(tenant)
                
                return self._tenant_to_dict(tenant)
                
        except Exception as e:
            logger.error(f"Failed to create tenant: {e}")
            raise
    
    def get_tenant_by_id(self, tenant_id: str) -> Optional[Dict]:
        """Get tenant by ID"""
        if not self.is_connected:
            return self._get_tenant_by_id_fallback(tenant_id)
        
        try:
            with self.get_session() as session:
                tenant = session.query(Tenant).filter(Tenant.id == tenant_id).first()
                return self._tenant_to_dict(tenant) if tenant else None
                
        except Exception as e:
            logger.error(f"Failed to get tenant by ID: {e}")
            return None
    
    def list_tenants(self) -> List[Dict]:
        """List all tenants"""
        if not self.is_connected:
            return self._list_tenants_fallback()
        
        try:
            with self.get_session() as session:
                tenants = session.query(Tenant).all()
                return [self._tenant_to_dict(tenant) for tenant in tenants]
                
        except Exception as e:
            logger.error(f"Failed to list tenants: {e}")
            return []
    
    # API Key Management
    def create_api_key(self, key_data: Dict) -> Dict:
        """Create new API key"""
        if not self.is_connected:
            return self._create_api_key_fallback(key_data)
        
        try:
            with self.get_session() as session:
                # Generate API key
                key_value = f"ag_{key_data.get('role', 'usr')[:3]}_{uuid.uuid4().hex[:16]}"
                key_hash = bcrypt.hashpw(key_value.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
                api_key = ApiKey(
                    name=key_data['name'],
                    key_hash=key_hash,
                    key_prefix=key_value[:8],
                    user_id=key_data['user_id'],
                    tenant_id=key_data['tenant_id'],
                    permissions=key_data.get('permissions', [])
                )
                
                session.add(api_key)
                session.commit()
                session.refresh(api_key)
                
                result = self._api_key_to_dict(api_key)
                result['key'] = key_value  # Only return full key on creation
                return result
                
        except Exception as e:
            logger.error(f"Failed to create API key: {e}")
            raise
    
    def get_api_key_by_hash(self, key_value: str) -> Optional[Dict]:
        """Get API key by value (for authentication)"""
        if not self.is_connected:
            return self._get_api_key_by_hash_fallback(key_value)
        
        try:
            with self.get_session() as session:
                api_keys = session.query(ApiKey).filter(ApiKey.status == 'active').all()
                
                for api_key in api_keys:
                    if bcrypt.checkpw(key_value.encode('utf-8'), api_key.key_hash.encode('utf-8')):
                        # Update last used
                        api_key.last_used = datetime.utcnow()
                        api_key.requests_count += 1
                        session.commit()
                        
                        return self._api_key_to_dict(api_key)
                
                return None
                
        except Exception as e:
            logger.error(f"Failed to get API key: {e}")
            return None
    
    def list_api_keys(self, user_id: str) -> List[Dict]:
        """List API keys for user"""
        if not self.is_connected:
            return self._list_api_keys_fallback(user_id)
        
        try:
            with self.get_session() as session:
                api_keys = session.query(ApiKey).filter(ApiKey.user_id == user_id).all()
                return [self._api_key_to_dict(api_key) for api_key in api_keys]
                
        except Exception as e:
            logger.error(f"Failed to list API keys: {e}")
            return []
    
    # Audit Logging
    def log_event(self, event_data: Dict):
        """Log audit event"""
        if not self.is_connected:
            return self._log_event_fallback(event_data)
        
        try:
            with self.get_session() as session:
                # Get previous hash for chain of custody
                last_log = session.query(AuditLog).filter(
                    AuditLog.tenant_id == event_data['tenant_id']
                ).order_by(AuditLog.timestamp.desc()).first()
                
                previous_hash = last_log.event_hash if last_log else "genesis"
                
                # Create event hash
                import hashlib
                event_string = json.dumps(event_data, sort_keys=True)
                event_hash = hashlib.sha256(f"{previous_hash}{event_string}".encode()).hexdigest()
                
                audit_log = AuditLog(
                    tenant_id=event_data['tenant_id'],
                    user_id=event_data.get('user_id'),
                    api_key_id=event_data.get('api_key_id'),
                    event_type=event_data['event_type'],
                    resource=event_data.get('resource'),
                    action=event_data['action'],
                    details=event_data.get('details', {}),
                    ip_address=event_data.get('ip_address'),
                    user_agent=event_data.get('user_agent'),
                    previous_hash=previous_hash,
                    event_hash=event_hash
                )
                
                session.add(audit_log)
                session.commit()
                
        except Exception as e:
            logger.error(f"Failed to log event: {e}")
    
    # Helper methods
    def _user_to_dict(self, user: User) -> Dict:
        """Convert User model to dict"""
        return {
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'role': user.role,
            'status': user.status,
            'tenant_id': user.tenant_id,
            'created_at': user.created_at.isoformat() if user.created_at else None,
            'updated_at': user.updated_at.isoformat() if user.updated_at else None,
            'last_login': user.last_login.isoformat() if user.last_login else None,
            'mfa_enabled': user.mfa_enabled,
            'sso_provider': user.sso_provider,
            'sso_subject': user.sso_subject,
            'attributes': user.attributes or {}
        }
    
    def _tenant_to_dict(self, tenant: Tenant) -> Dict:
        """Convert Tenant model to dict"""
        return {
            'id': tenant.id,
            'name': tenant.name,
            'tier': tenant.tier,
            'status': tenant.status,
            'billing_email': tenant.billing_email,
            'created_at': tenant.created_at.isoformat() if tenant.created_at else None,
            'updated_at': tenant.updated_at.isoformat() if tenant.updated_at else None,
            'users_count': tenant.users_count,
            'requests_count': tenant.requests_count,
            'quota': tenant.quota,
            'storage_used_gb': tenant.storage_used_gb,
            'allowed_models': tenant.allowed_models or [],
            'policy_ids': tenant.policy_ids or [],
            'settings': tenant.settings or {}
        }
    
    def _api_key_to_dict(self, api_key: ApiKey) -> Dict:
        """Convert ApiKey model to dict"""
        return {
            'id': api_key.id,
            'name': api_key.name,
            'key_prefix': api_key.key_prefix,
            'user_id': api_key.user_id,
            'tenant_id': api_key.tenant_id,
            'status': api_key.status,
            'created_at': api_key.created_at.isoformat() if api_key.created_at else None,
            'last_used': api_key.last_used.isoformat() if api_key.last_used else None,
            'requests_count': api_key.requests_count,
            'permissions': api_key.permissions or []
        }
    
    def _get_tier_quota(self, tier: str) -> int:
        """Get quota for tier"""
        quotas = {
            'free': 10000,
            'starter': 100000,
            'professional': 1000000,
            'enterprise': 10000000
        }
        return quotas.get(tier, 100000)
    
    # Fallback methods (in-memory storage)
    def _create_user_fallback(self, user_data: Dict) -> Dict:
        """Fallback user creation"""
        user_id = str(uuid.uuid4())
        password_hash = bcrypt.hashpw(user_data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        user = {
            'id': user_id,
            'email': user_data['email'],
            'name': user_data['name'],
            'password_hash': password_hash,
            'role': user_data.get('role', 'viewer'),
            'status': 'active',
            'tenant_id': user_data['tenant_id'],
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
            'last_login': None,
            'mfa_enabled': False,
            'sso_provider': user_data.get('sso_provider'),
            'sso_subject': user_data.get('sso_subject'),
            'attributes': user_data.get('attributes', {})
        }
        
        self.fallback_storage['users'][user_id] = user
        return {k: v for k, v in user.items() if k != 'password_hash'}
    
    def _get_user_by_email_fallback(self, email: str) -> Optional[Dict]:
        """Fallback get user by email"""
        for user in self.fallback_storage['users'].values():
            if user['email'] == email:
                return user
        return None
    
    def _get_user_by_id_fallback(self, user_id: str) -> Optional[Dict]:
        """Fallback get user by ID"""
        return self.fallback_storage['users'].get(user_id)
    
    def _update_user_fallback(self, user_id: str, updates: Dict) -> Optional[Dict]:
        """Fallback update user"""
        if user_id in self.fallback_storage['users']:
            user = self.fallback_storage['users'][user_id]
            user.update(updates)
            user['updated_at'] = datetime.utcnow().isoformat()
            return user
        return None
    
    def _list_users_fallback(self, tenant_id: str = None) -> List[Dict]:
        """Fallback list users"""
        users = list(self.fallback_storage['users'].values())
        if tenant_id:
            users = [u for u in users if u['tenant_id'] == tenant_id]
        return [{k: v for k, v in user.items() if k != 'password_hash'} for user in users]
    
    def _create_tenant_fallback(self, tenant_data: Dict) -> Dict:
        """Fallback tenant creation"""
        tenant_id = str(uuid.uuid4())
        tenant = {
            'id': tenant_id,
            'name': tenant_data['name'],
            'tier': tenant_data.get('tier', 'starter'),
            'status': 'active',
            'billing_email': tenant_data['billing_email'],
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
            'users_count': 0,
            'requests_count': 0,
            'quota': self._get_tier_quota(tenant_data.get('tier', 'starter')),
            'storage_used_gb': 0.0,
            'allowed_models': tenant_data.get('allowed_models', []),
            'policy_ids': tenant_data.get('policy_ids', []),
            'settings': tenant_data.get('settings', {})
        }
        
        self.fallback_storage['tenants'][tenant_id] = tenant
        return tenant
    
    def _get_tenant_by_id_fallback(self, tenant_id: str) -> Optional[Dict]:
        """Fallback get tenant by ID"""
        return self.fallback_storage['tenants'].get(tenant_id)
    
    def _list_tenants_fallback(self) -> List[Dict]:
        """Fallback list tenants"""
        return list(self.fallback_storage['tenants'].values())
    
    def _create_api_key_fallback(self, key_data: Dict) -> Dict:
        """Fallback API key creation"""
        key_id = str(uuid.uuid4())
        key_value = f"ag_{key_data.get('role', 'usr')[:3]}_{uuid.uuid4().hex[:16]}"
        
        api_key = {
            'id': key_id,
            'name': key_data['name'],
            'key': key_value,
            'key_prefix': key_value[:8],
            'user_id': key_data['user_id'],
            'tenant_id': key_data['tenant_id'],
            'status': 'active',
            'created_at': datetime.utcnow().isoformat(),
            'last_used': None,
            'requests_count': 0,
            'permissions': key_data.get('permissions', [])
        }
        
        self.fallback_storage['api_keys'][key_id] = api_key
        return api_key
    
    def _get_api_key_by_hash_fallback(self, key_value: str) -> Optional[Dict]:
        """Fallback get API key by value"""
        for api_key in self.fallback_storage['api_keys'].values():
            if api_key.get('key') == key_value and api_key['status'] == 'active':
                api_key['last_used'] = datetime.utcnow().isoformat()
                api_key['requests_count'] += 1
                return api_key
        return None
    
    def _list_api_keys_fallback(self, user_id: str) -> List[Dict]:
        """Fallback list API keys"""
        return [key for key in self.fallback_storage['api_keys'].values() if key['user_id'] == user_id]
    
    def _log_event_fallback(self, event_data: Dict):
        """Fallback event logging"""
        event = {
            'id': str(uuid.uuid4()),
            'timestamp': datetime.utcnow().isoformat(),
            **event_data
        }
        self.fallback_storage['audit_logs'].append(event)

# Global database instance
_db_manager = None

def get_database() -> DatabaseManager:
    """Get global database manager instance"""
    global _db_manager
    
    if _db_manager is None:
        _db_manager = DatabaseManager()
        
        # Create tables if connected
        if _db_manager.is_connected:
            _db_manager.create_tables()
    
    return _db_manager

def init_database(database_url: str = None) -> DatabaseManager:
    """Initialize database with custom URL"""
    global _db_manager
    _db_manager = DatabaseManager(database_url)
    
    if _db_manager.is_connected:
        _db_manager.create_tables()
    
    return _db_manager