"""
AetherGuard Backend API - Routers
API endpoint routers
"""

from .admin_auth import router as admin_auth_router
from .admin_tenants import router as admin_tenants_router
from .admin_analytics import router as admin_analytics_router
from .admin_api_keys import router as admin_api_keys_router
from .tenant_auth import router as tenant_auth_router
from .llm_providers import router as llm_providers_router
from .policies import router as policies_router
from .analytics import router as analytics_router
from .api_keys import router as api_keys_router
from .provider_health import router as provider_health_router
from .reports import router as reports_router

__all__ = [
    "admin_auth_router",
    "admin_tenants_router",
    "admin_analytics_router",
    "admin_api_keys_router",
    "tenant_auth_router",
    "llm_providers_router",
    "policies_router",
    "analytics_router",
    "api_keys_router",
    "provider_health_router",
    "reports_router",
]
