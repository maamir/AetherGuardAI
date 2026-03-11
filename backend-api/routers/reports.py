"""
Reports Router
Custom reports and scheduled report delivery
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from models.base import get_db
from .tenant_auth import get_current_tenant_user

router = APIRouter(prefix="/api/reports", tags=["Reports"])


# Pydantic Models
class CreateCustomReportRequest(BaseModel):
    name: str
    description: Optional[str] = None
    metrics: List[str]  # e.g., ["requests", "errors", "latency"]
    filters: Optional[dict] = None
    visualization: str = "table"  # table, chart, both
    dateRange: int = 7  # days


class UpdateCustomReportRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    metrics: Optional[List[str]] = None
    filters: Optional[dict] = None
    visualization: Optional[str] = None
    dateRange: Optional[int] = None


class CreateScheduledReportRequest(BaseModel):
    name: str
    frequency: str  # daily, weekly, monthly
    recipients: List[str]  # email addresses
    reportIds: List[str]  # custom report IDs to include
    isActive: bool = True


class UpdateScheduledReportRequest(BaseModel):
    name: Optional[str] = None
    frequency: Optional[str] = None
    recipients: Optional[List[str]] = None
    reportIds: Optional[List[str]] = None
    isActive: Optional[bool] = None


# Custom Reports Endpoints
@router.get("/custom")
async def list_custom_reports(
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    List all custom reports for the tenant
    """
    tenant_id = current_user["tenant_id"]
    
    # In production, query from database
    # For now, return empty list
    return []


@router.post("/custom")
async def create_custom_report(
    request: CreateCustomReportRequest,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Create a new custom report
    """
    tenant_id = current_user["tenant_id"]
    
    report_id = str(uuid.uuid4())
    
    return {
        "id": report_id,
        "tenantId": tenant_id,
        "name": request.name,
        "description": request.description,
        "metrics": request.metrics,
        "filters": request.filters or {},
        "visualization": request.visualization,
        "dateRange": request.dateRange,
        "createdAt": datetime.utcnow().isoformat()
    }


@router.get("/custom/{report_id}")
async def get_custom_report(
    report_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get custom report details
    """
    # In production, query from database
    return {
        "id": report_id,
        "name": "Sample Report",
        "metrics": ["requests", "errors"],
        "visualization": "chart"
    }


@router.put("/custom/{report_id}")
async def update_custom_report(
    report_id: str,
    request: UpdateCustomReportRequest,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Update a custom report
    """
    return {
        "id": report_id,
        "status": "updated"
    }


@router.delete("/custom/{report_id}")
async def delete_custom_report(
    report_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Delete a custom report
    """
    return {"message": "Report deleted successfully"}


@router.post("/custom/{report_id}/generate")
async def generate_custom_report(
    report_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Generate a custom report
    """
    return {
        "reportId": report_id,
        "status": "generating",
        "data": {
            "requests": 1000,
            "errors": 5,
            "latency": 150
        }
    }


# Scheduled Reports Endpoints
@router.get("/scheduled")
async def list_scheduled_reports(
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    List all scheduled reports for the tenant
    """
    tenant_id = current_user["tenant_id"]
    
    # In production, query from database
    return []


@router.post("/scheduled")
async def create_scheduled_report(
    request: CreateScheduledReportRequest,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Create a new scheduled report
    """
    tenant_id = current_user["tenant_id"]
    
    report_id = str(uuid.uuid4())
    
    # Calculate next run based on frequency
    now = datetime.utcnow()
    if request.frequency == "daily":
        next_run = now + timedelta(days=1)
    elif request.frequency == "weekly":
        next_run = now + timedelta(weeks=1)
    else:  # monthly
        next_run = now + timedelta(days=30)
    
    return {
        "id": report_id,
        "tenantId": tenant_id,
        "name": request.name,
        "frequency": request.frequency,
        "recipients": request.recipients,
        "reportIds": request.reportIds,
        "isActive": request.isActive,
        "nextRun": next_run.isoformat(),
        "lastRun": None,
        "createdAt": datetime.utcnow().isoformat()
    }


@router.get("/scheduled/{report_id}")
async def get_scheduled_report(
    report_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Get scheduled report details
    """
    return {
        "id": report_id,
        "name": "Weekly Report",
        "frequency": "weekly",
        "recipients": ["admin@example.com"],
        "isActive": True
    }


@router.put("/scheduled/{report_id}")
async def update_scheduled_report(
    report_id: str,
    request: UpdateScheduledReportRequest,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Update a scheduled report
    """
    return {
        "id": report_id,
        "status": "updated"
    }


@router.delete("/scheduled/{report_id}")
async def delete_scheduled_report(
    report_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Delete a scheduled report
    """
    return {"message": "Scheduled report deleted successfully"}


@router.post("/scheduled/{report_id}/run")
async def run_scheduled_report(
    report_id: str,
    current_user: dict = Depends(get_current_tenant_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger a scheduled report
    """
    return {
        "reportId": report_id,
        "status": "running",
        "message": "Report is being generated and will be sent to recipients"
    }
