"""
Policy Management Router
Tenant-facing policy configuration
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, Dict, List
from datetime import datetime

from models.base import get_db
from models.policy_config import PolicyConfig
from .tenant_auth import get_current_tenant_user

router = APIRouter(prefix="/api/policies", tags=["Policies"])


# Pydantic Models
class UpdatePolicyRequest(BaseModel):
    enabled: bool
    config: Dict


class BulkUpdateRequest(BaseModel):
    updates: List[Dict]  # [{category, featureKey, enabled, config}]


# Default policy templates
DEFAULT_POLICIES = {
    "security": [
        {
            "featureKey": "prompt_injection",
            "featureName": "Prompt Injection Detection",
            "enabled": True,
            "config": {
                "threshold": 0.8,
                "model": "meta-llama/Prompt-Guard-86M",
                "blockOnDetection": True
            }
        },
        {
            "featureKey": "malicious_intent",
            "featureName": "Malicious Intent Detection",
            "enabled": True,
            "config": {
                "threshold": 0.75,
                "categories": ["social_engineering", "malware", "policy_bypass"]
            }
        },
        {
            "featureKey": "dos_protection",
            "featureName": "DoS Protection",
            "enabled": True,
            "config": {
                "maxComplexity": 1000,
                "maxTokens": 4096,
                "rateLimitPerMinute": 60
            }
        },
        {
            "featureKey": "adversarial_robustness",
            "featureName": "Adversarial Robustness",
            "enabled": True,
            "config": {
                "normalizeUnicode": True,
                "detectHomoglyphs": True,
                "stripInvisibleChars": True
            }
        },
        {
            "featureKey": "input_sanitization",
            "featureName": "Input Sanitization",
            "enabled": True,
            "config": {
                "stripHiddenChars": True,
                "stripNullBytes": True,
                "sanitizeMarkdown": True
            }
        }
    ],
    "ethical": [
        {
            "featureKey": "toxicity_filtering",
            "featureName": "HAP & Toxicity Filtering",
            "enabled": True,
            "config": {
                "model": "ibm-granite/granite-guardian-hap-38m",
                "threshold": 0.7,
                "categories": ["hate", "abuse", "profanity", "sexual"],
                "applyToInput": True,
                "applyToOutput": True
            }
        },
        {
            "featureKey": "bias_monitoring",
            "featureName": "Bias & Fairness Monitoring",
            "enabled": True,
            "config": {
                "library": "aif360",
                "metrics": ["demographic_parity", "equal_opportunity"],
                "sampleSize": 100,
                "alertThreshold": 0.2
            }
        },
        {
            "featureKey": "hallucination_guard",
            "featureName": "Hallucination Guard",
            "enabled": True,
            "config": {
                "model": "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli",
                "threshold": 0.8,
                "requireGrounding": True,
                "vectorSimilarityThreshold": 0.85
            }
        },
        {
            "featureKey": "brand_safety",
            "featureName": "Brand Safety",
            "enabled": True,
            "config": {
                "blockedCompetitors": [],
                "brandVoiceRules": [],
                "prohibitedDomains": []
            }
        },
        {
            "featureKey": "context_relevance",
            "featureName": "Relevant Context Checks",
            "enabled": True,
            "config": {
                "allowedTopics": [],
                "threshold": 0.7
            }
        }
    ],
    "privacy": [
        {
            "featureKey": "pii_detection",
            "featureName": "PII/PHI Detection & Redaction",
            "enabled": True,
            "config": {
                "library": "presidio",
                "entities": ["SSN", "CREDIT_CARD", "EMAIL", "PHONE", "ADDRESS", "MEDICAL_LICENSE"],
                "languages": ["en"],
                "redactionStrategy": "replace",
                "customRecognizers": []
            }
        },
        {
            "featureKey": "secrets_detection",
            "featureName": "Secrets Detection",
            "enabled": True,
            "config": {
                "library": "detect-secrets",
                "patterns": ["api_key", "ssh_key", "aws_key", "password", "token"],
                "blockOnDetection": True
            }
        },
        {
            "featureKey": "data_residency",
            "featureName": "Data Residency Enforcement",
            "enabled": False,
            "config": {
                "allowedRegions": ["us-east-1", "us-west-2"],
                "enforcementLevel": "strict"
            }
        }
    ],
    "integrity": [
        {
            "featureKey": "model_poisoning",
            "featureName": "Model Poisoning Protection",
            "enabled": True,
            "config": {
                "differentialPrivacy": True,
                "noiseLevel": 0.1,
                "byzantineResilient": True,
                "algorithm": "krum"
            }
        },
        {
            "featureKey": "watermarking",
            "featureName": "Inference Watermarking",
            "enabled": False,
            "config": {
                "enabled": True,
                "recoveryThreshold": 0.95
            }
        },
        {
            "featureKey": "model_signing",
            "featureName": "Cryptographic Model Signing",
            "enabled": True,
            "config": {
                "algorithm": "RSA-2048",
                "kmsProvider": "aws",
                "signOutputs": True
            }
        },
        {
            "featureKey": "response_attribution",
            "featureName": "Response Attribution",
            "enabled": True,
            "config": {
                "hashAlgorithm": "SHA-256",
                "timestampOutputs": True,
                "auditLedger": True
            }
        },
        {
            "featureKey": "chain_of_custody",
            "featureName": "Chain of Custody",
            "enabled": True,
            "config": {
                "provider": "aws-qldb",
                "trackTraining": True,
                "trackFineTuning": True,
                "trackDeployment": True
            }
        }
    ],
    "governance": [
        {
            "featureKey": "shadow_ai",
            "featureName": "Shadow AI Discovery",
            "enabled": True,
            "config": {
                "dpi": True,
                "behavioralAnalysis": True,
                "cloudLogIngestion": True,
                "accuracyTarget": 0.87
            }
        },
        {
            "featureKey": "cost_management",
            "featureName": "Cost & Token Management",
            "enabled": True,
            "config": {
                "trackTokens": True,
                "budgetAlerts": True,
                "autoThrottle": True,
                "forecastRolling": True
            }
        },
        {
            "featureKey": "audit_logs",
            "featureName": "Detailed Audit Logs",
            "enabled": True,
            "config": {
                "immutable": True,
                "hashChained": True,
                "retentionDays": 365,
                "includeMetadata": True
            }
        },
        {
            "featureKey": "policy_as_code",
            "featureName": "Policy-as-Code",
            "enabled": False,
            "config": {
                "language": "rego",
                "versionControl": True,
                "unitTesting": True
            }
        }
    ]
}


# Helper function to get tenant_id (simplified for now)
def get_tenant_id_from_user(user_id: str, db: Session) -> str:
    from models.tenant import Tenant
    tenant = db.query(Tenant).filter(Tenant.owner_id == user_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return str(tenant.id)


# Endpoints
@router.get("")
async def get_all_policies(
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get all policy configurations for the tenant
    """
    tenant_id = current_user["tenant_id"]
    
    policies = db.query(PolicyConfig).filter(
        PolicyConfig.tenant_id == tenant_id
    ).all()
    
    # If no policies exist, create defaults
    if not policies:
        for category, features in DEFAULT_POLICIES.items():
            for feature in features:
                policy = PolicyConfig(
                    tenant_id=tenant_id,
                    category=category,
                    feature_key=feature["featureKey"],
                    feature_name=feature["featureName"],
                    enabled=feature["enabled"],
                    config=feature["config"]
                )
                db.add(policy)
        db.commit()
        
        # Re-query
        policies = db.query(PolicyConfig).filter(
            PolicyConfig.tenant_id == tenant_id
        ).all()
    
    # Group by category
    result = {}
    for policy in policies:
        if policy.category not in result:
            result[policy.category] = []
        result[policy.category].append(policy.to_dict())
    
    return result


@router.put("/{category}/{feature_key}")
async def update_policy(
    category: str,
    feature_key: str,
    request: UpdatePolicyRequest,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Update a specific policy configuration
    """
    tenant_id = current_user["tenant_id"]
    
    policy = db.query(PolicyConfig).filter(
        PolicyConfig.tenant_id == tenant_id,
        PolicyConfig.category == category,
        PolicyConfig.feature_key == feature_key
    ).first()
    
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    # Update policy
    policy.enabled = request.enabled
    policy.config = request.config
    policy.version += 1
    policy.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(policy)
    
    return policy.to_dict()


@router.post("/bulk-update")
async def bulk_update_policies(
    request: BulkUpdateRequest,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Bulk update multiple policies
    """
    tenant_id = current_user["tenant_id"]
    
    updated_count = 0
    
    for update in request.updates:
        policy = db.query(PolicyConfig).filter(
            PolicyConfig.tenant_id == tenant_id,
            PolicyConfig.category == update.get("category"),
            PolicyConfig.feature_key == update.get("featureKey")
        ).first()
        
        if policy:
            policy.enabled = update.get("enabled", policy.enabled)
            policy.config = update.get("config", policy.config)
            policy.version += 1
            policy.updated_at = datetime.utcnow()
            updated_count += 1
    
    db.commit()
    
    return {"message": f"Updated {updated_count} policies"}


@router.get("/defaults")
async def get_default_policies():
    """
    Get default policy templates
    """
    return DEFAULT_POLICIES
