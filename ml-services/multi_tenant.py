"""
Multi-Tenant Support for AetherGuard AI
Provides tenant isolation, per-tenant policies, and usage tracking
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import hashlib
import json
from enum import Enum


class TenantTier(Enum):
    """Tenant subscription tiers"""
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


@dataclass
class TenantQuota:
    """Resource quotas for a tenant"""
    max_requests_per_day: int
    max_requests_per_hour: int
    max_concurrent_requests: int
    max_model_size_mb: int
    max_custom_models: int
    max_users: int
    max_policies: int
    storage_limit_gb: int
    
    @staticmethod
    def from_tier(tier: TenantTier) -> 'TenantQuota':
        """Get quota based on tier"""
        quotas = {
            TenantTier.FREE: TenantQuota(
                max_requests_per_day=1000,
                max_requests_per_hour=100,
                max_concurrent_requests=5,
                max_model_size_mb=500,
                max_custom_models=0,
                max_users=3,
                max_policies=5,
                storage_limit_gb=1,
            ),
            TenantTier.STARTER: TenantQuota(
                max_requests_per_day=10000,
                max_requests_per_hour=1000,
                max_concurrent_requests=20,
                max_model_size_mb=2000,
                max_custom_models=2,
                max_users=10,
                max_policies=20,
                storage_limit_gb=10,
            ),
            TenantTier.PROFESSIONAL: TenantQuota(
                max_requests_per_day=100000,
                max_requests_per_hour=10000,
                max_concurrent_requests=100,
                max_model_size_mb=10000,
                max_custom_models=10,
                max_users=50,
                max_policies=100,
                storage_limit_gb=100,
            ),
            TenantTier.ENTERPRISE: TenantQuota(
                max_requests_per_day=-1,  # Unlimited
                max_requests_per_hour=-1,
                max_concurrent_requests=1000,
                max_model_size_mb=50000,
                max_custom_models=-1,
                max_users=-1,
                max_policies=-1,
                storage_limit_gb=1000,
            ),
        }
        return quotas[tier]


@dataclass
class TenantUsage:
    """Track tenant resource usage"""
    tenant_id: str
    requests_today: int = 0
    requests_this_hour: int = 0
    concurrent_requests: int = 0
    storage_used_gb: float = 0.0
    custom_models_count: int = 0
    users_count: int = 0
    policies_count: int = 0
    last_reset_daily: datetime = field(default_factory=datetime.utcnow)
    last_reset_hourly: datetime = field(default_factory=datetime.utcnow)
    
    def reset_if_needed(self):
        """Reset counters if time period has elapsed"""
        now = datetime.utcnow()
        
        # Reset daily counter
        if now - self.last_reset_daily >= timedelta(days=1):
            self.requests_today = 0
            self.last_reset_daily = now
        
        # Reset hourly counter
        if now - self.last_reset_hourly >= timedelta(hours=1):
            self.requests_this_hour = 0
            self.last_reset_hourly = now


@dataclass
class Tenant:
    """Tenant configuration and metadata"""
    tenant_id: str
    name: str
    tier: TenantTier
    created_at: datetime
    updated_at: datetime
    status: str = "active"  # active, suspended, deleted
    quota: TenantQuota = field(default_factory=lambda: TenantQuota.from_tier(TenantTier.FREE))
    usage: TenantUsage = field(default_factory=lambda: TenantUsage(""))
    custom_config: Dict[str, Any] = field(default_factory=dict)
    allowed_models: List[str] = field(default_factory=list)
    policy_ids: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        """Initialize quota and usage based on tier"""
        if not self.quota or self.quota.max_requests_per_day == 0:
            self.quota = TenantQuota.from_tier(self.tier)
        if not self.usage.tenant_id:
            self.usage.tenant_id = self.tenant_id


class TenantManager:
    """Manage multi-tenant operations"""
    
    def __init__(self):
        self.tenants: Dict[str, Tenant] = {}
        self._load_tenants()
    
    def _load_tenants(self):
        """Load tenants from database (real implementation)"""
        try:
            from .database import get_database
            
            db = get_database()
            tenants_data = db.list_tenants()
            
            # Convert database records to Tenant objects
            for tenant_data in tenants_data:
                tenant = Tenant(
                    tenant_id=tenant_data['id'],
                    name=tenant_data['name'],
                    tier=TenantTier(tenant_data['tier']),
                    created_at=datetime.fromisoformat(tenant_data['created_at'].replace('Z', '+00:00')) if tenant_data['created_at'] else datetime.utcnow(),
                    updated_at=datetime.fromisoformat(tenant_data['updated_at'].replace('Z', '+00:00')) if tenant_data['updated_at'] else datetime.utcnow(),
                    allowed_models=tenant_data.get('allowed_models', []),
                    policy_ids=tenant_data.get('policy_ids', []),
                )
                self.tenants[tenant.tenant_id] = tenant
            
            logger.info(f"Loaded {len(self.tenants)} tenants from database")
            
            # If no tenants exist, create demo tenants
            if not self.tenants:
                self._create_demo_tenants(db)
                
        except ImportError:
            logger.warning("Database module not available, using demo tenants")
            self._create_demo_tenants_fallback()
        except Exception as e:
            logger.error(f"Failed to load tenants from database: {e}")
            self._create_demo_tenants_fallback()
    
    def _create_demo_tenants(self, db):
        """Create demo tenants in database"""
        demo_tenants_data = [
            {
                'name': 'Acme Corporation',
                'tier': 'enterprise',
                'billing_email': 'billing@acme.com',
                'allowed_models': ['llama_guard', 'granite_guardian', 'deberta_nli', 'bart_zeroshot'],
                'policy_ids': ['policy_strict', 'policy_enterprise'],
            },
            {
                'name': 'Startup Inc',
                'tier': 'professional',
                'billing_email': 'admin@startup.com',
                'allowed_models': ['llama_guard', 'granite_guardian'],
                'policy_ids': ['policy_default'],
            },
            {
                'name': 'Demo User',
                'tier': 'free',
                'billing_email': 'demo@example.com',
                'allowed_models': ['llama_guard'],
                'policy_ids': ['policy_permissive'],
            },
        ]
        
        for tenant_data in demo_tenants_data:
            try:
                created_tenant = db.create_tenant(tenant_data)
                
                tenant = Tenant(
                    tenant_id=created_tenant['id'],
                    name=created_tenant['name'],
                    tier=TenantTier(created_tenant['tier']),
                    created_at=datetime.fromisoformat(created_tenant['created_at'].replace('Z', '+00:00')),
                    updated_at=datetime.fromisoformat(created_tenant['updated_at'].replace('Z', '+00:00')),
                    allowed_models=created_tenant.get('allowed_models', []),
                    policy_ids=created_tenant.get('policy_ids', []),
                )
                
                self.tenants[tenant.tenant_id] = tenant
                logger.info(f"Created demo tenant: {tenant.name}")
                
            except Exception as e:
                logger.error(f"Failed to create demo tenant {tenant_data['name']}: {e}")
    
    def _create_demo_tenants_fallback(self):
        """Create demo tenants in memory (fallback)"""
        demo_tenants = [
            Tenant(
                tenant_id="tenant_acme",
                name="Acme Corporation",
                tier=TenantTier.ENTERPRISE,
                created_at=datetime.utcnow() - timedelta(days=90),
                updated_at=datetime.utcnow(),
                allowed_models=["llama_guard", "granite_guardian", "deberta_nli", "bart_zeroshot"],
                policy_ids=["policy_strict", "policy_enterprise"],
            ),
            Tenant(
                tenant_id="tenant_startup",
                name="Startup Inc",
                tier=TenantTier.PROFESSIONAL,
                created_at=datetime.utcnow() - timedelta(days=30),
                updated_at=datetime.utcnow(),
                allowed_models=["llama_guard", "granite_guardian"],
                policy_ids=["policy_default"],
            ),
            Tenant(
                tenant_id="tenant_demo",
                name="Demo User",
                tier=TenantTier.FREE,
                created_at=datetime.utcnow() - timedelta(days=7),
                updated_at=datetime.utcnow(),
                allowed_models=["llama_guard"],
                policy_ids=["policy_permissive"],
            ),
        ]
        
        for tenant in demo_tenants:
            self.tenants[tenant.tenant_id] = tenant
        
        logger.info(f"Created {len(demo_tenants)} demo tenants in memory")
    
    def get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        """Get tenant by ID"""
        return self.tenants.get(tenant_id)
    
    def create_tenant(self, name: str, tier: TenantTier) -> Tenant:
        """Create a new tenant"""
        tenant_id = f"tenant_{hashlib.sha256(name.encode()).hexdigest()[:12]}"
        
        tenant = Tenant(
            tenant_id=tenant_id,
            name=name,
            tier=tier,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        self.tenants[tenant_id] = tenant
        return tenant
    
    def update_tenant(self, tenant_id: str, **kwargs) -> Optional[Tenant]:
        """Update tenant configuration"""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return None
        
        for key, value in kwargs.items():
            if hasattr(tenant, key):
                setattr(tenant, key, value)
        
        tenant.updated_at = datetime.utcnow()
        return tenant
    
    def delete_tenant(self, tenant_id: str) -> bool:
        """Soft delete a tenant"""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return False
        
        tenant.status = "deleted"
        tenant.updated_at = datetime.utcnow()
        return True
    
    def check_quota(self, tenant_id: str, resource: str) -> tuple[bool, str]:
        """
        Check if tenant has quota for resource
        Returns (allowed, reason)
        """
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return False, "Tenant not found"
        
        if tenant.status != "active":
            return False, f"Tenant status: {tenant.status}"
        
        # Reset usage counters if needed
        tenant.usage.reset_if_needed()
        
        quota = tenant.quota
        usage = tenant.usage
        
        # Check specific resource quotas
        if resource == "request":
            # Check daily limit
            if quota.max_requests_per_day != -1 and usage.requests_today >= quota.max_requests_per_day:
                return False, "Daily request limit exceeded"
            
            # Check hourly limit
            if quota.max_requests_per_hour != -1 and usage.requests_this_hour >= quota.max_requests_per_hour:
                return False, "Hourly request limit exceeded"
            
            # Check concurrent limit
            if usage.concurrent_requests >= quota.max_concurrent_requests:
                return False, "Concurrent request limit exceeded"
        
        elif resource == "custom_model":
            if quota.max_custom_models != -1 and usage.custom_models_count >= quota.max_custom_models:
                return False, "Custom model limit exceeded"
        
        elif resource == "user":
            if quota.max_users != -1 and usage.users_count >= quota.max_users:
                return False, "User limit exceeded"
        
        elif resource == "policy":
            if quota.max_policies != -1 and usage.policies_count >= quota.max_policies:
                return False, "Policy limit exceeded"
        
        elif resource == "storage":
            if usage.storage_used_gb >= quota.storage_limit_gb:
                return False, "Storage limit exceeded"
        
        return True, "OK"
    
    def increment_usage(self, tenant_id: str, resource: str, amount: int = 1):
        """Increment usage counter for a resource"""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return
        
        usage = tenant.usage
        
        if resource == "request":
            usage.requests_today += amount
            usage.requests_this_hour += amount
        elif resource == "concurrent_request":
            usage.concurrent_requests += amount
        elif resource == "custom_model":
            usage.custom_models_count += amount
        elif resource == "user":
            usage.users_count += amount
        elif resource == "policy":
            usage.policies_count += amount
    
    def decrement_usage(self, tenant_id: str, resource: str, amount: int = 1):
        """Decrement usage counter for a resource"""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return
        
        usage = tenant.usage
        
        if resource == "concurrent_request":
            usage.concurrent_requests = max(0, usage.concurrent_requests - amount)
        elif resource == "custom_model":
            usage.custom_models_count = max(0, usage.custom_models_count - amount)
        elif resource == "user":
            usage.users_count = max(0, usage.users_count - amount)
        elif resource == "policy":
            usage.policies_count = max(0, usage.policies_count - amount)
    
    def get_usage_stats(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get usage statistics for a tenant"""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return None
        
        usage = tenant.usage
        quota = tenant.quota
        
        return {
            "tenant_id": tenant_id,
            "tier": tenant.tier.value,
            "usage": {
                "requests_today": usage.requests_today,
                "requests_this_hour": usage.requests_this_hour,
                "concurrent_requests": usage.concurrent_requests,
                "storage_used_gb": usage.storage_used_gb,
                "custom_models_count": usage.custom_models_count,
                "users_count": usage.users_count,
                "policies_count": usage.policies_count,
            },
            "quota": {
                "max_requests_per_day": quota.max_requests_per_day,
                "max_requests_per_hour": quota.max_requests_per_hour,
                "max_concurrent_requests": quota.max_concurrent_requests,
                "max_custom_models": quota.max_custom_models,
                "max_users": quota.max_users,
                "max_policies": quota.max_policies,
                "storage_limit_gb": quota.storage_limit_gb,
            },
            "utilization": {
                "requests_daily_pct": (usage.requests_today / quota.max_requests_per_day * 100) if quota.max_requests_per_day > 0 else 0,
                "requests_hourly_pct": (usage.requests_this_hour / quota.max_requests_per_hour * 100) if quota.max_requests_per_hour > 0 else 0,
                "storage_pct": (usage.storage_used_gb / quota.storage_limit_gb * 100) if quota.storage_limit_gb > 0 else 0,
            }
        }
    
    def list_tenants(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all tenants with optional status filter"""
        tenants = []
        
        for tenant in self.tenants.values():
            if status and tenant.status != status:
                continue
            
            tenants.append({
                "tenant_id": tenant.tenant_id,
                "name": tenant.name,
                "tier": tenant.tier.value,
                "status": tenant.status,
                "created_at": tenant.created_at.isoformat(),
                "updated_at": tenant.updated_at.isoformat(),
                "users_count": tenant.usage.users_count,
                "requests_today": tenant.usage.requests_today,
            })
        
        return tenants
    
    def is_model_allowed(self, tenant_id: str, model_id: str) -> bool:
        """Check if tenant is allowed to use a specific model"""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return False
        
        # Enterprise tier has access to all models
        if tenant.tier == TenantTier.ENTERPRISE:
            return True
        
        # Check allowed models list
        return model_id in tenant.allowed_models
    
    def get_tenant_policies(self, tenant_id: str) -> List[str]:
        """Get policy IDs for a tenant"""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return []
        
        return tenant.policy_ids


# Global tenant manager instance
_tenant_manager = None


def get_tenant_manager() -> TenantManager:
    """Get or create global tenant manager instance"""
    global _tenant_manager
    if _tenant_manager is None:
        _tenant_manager = TenantManager()
    return _tenant_manager


# Example usage
if __name__ == "__main__":
    manager = get_tenant_manager()
    
    # List all tenants
    print("All tenants:")
    for tenant in manager.list_tenants():
        print(f"  {tenant['name']} ({tenant['tier']}) - {tenant['requests_today']} requests today")
    
    # Check quota
    tenant_id = "tenant_demo"
    allowed, reason = manager.check_quota(tenant_id, "request")
    print(f"\nTenant {tenant_id} request allowed: {allowed} ({reason})")
    
    # Simulate request
    if allowed:
        manager.increment_usage(tenant_id, "request")
        manager.increment_usage(tenant_id, "concurrent_request")
        print(f"Request processed. New usage: {manager.get_usage_stats(tenant_id)['usage']}")
        manager.decrement_usage(tenant_id, "concurrent_request")
    
    # Get usage stats
    stats = manager.get_usage_stats(tenant_id)
    print(f"\nUsage stats for {tenant_id}:")
    print(json.dumps(stats, indent=2))
