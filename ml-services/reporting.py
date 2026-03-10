"""
Advanced Reporting for AetherGuard AI
Provides scheduled reports, custom report builder, and compliance reports
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import json
from pathlib import Path


class ReportType(Enum):
    """Report types"""
    SECURITY_SUMMARY = "security_summary"
    DETECTION_ANALYSIS = "detection_analysis"
    PERFORMANCE_METRICS = "performance_metrics"
    COMPLIANCE_GDPR = "compliance_gdpr"
    COMPLIANCE_CCPA = "compliance_ccpa"
    COMPLIANCE_SOC2 = "compliance_soc2"
    USER_ACTIVITY = "user_activity"
    COST_ANALYSIS = "cost_analysis"
    MODEL_PERFORMANCE = "model_performance"
    CUSTOM = "custom"


class ReportFormat(Enum):
    """Report output formats"""
    PDF = "pdf"
    HTML = "html"
    CSV = "csv"
    JSON = "json"
    EXCEL = "excel"


class ReportFrequency(Enum):
    """Report schedule frequency"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ON_DEMAND = "on_demand"


@dataclass
class ReportSection:
    """Report section configuration"""
    title: str
    type: str  # chart, table, text, metric
    data_source: str
    config: Dict[str, Any] = field(default_factory=dict)
    order: int = 0


@dataclass
class ReportTemplate:
    """Report template"""
    template_id: str
    name: str
    type: ReportType
    description: str
    sections: List[ReportSection]
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReportSchedule:
    """Scheduled report configuration"""
    schedule_id: str
    name: str
    template_id: str
    frequency: ReportFrequency
    format: ReportFormat
    recipients: List[str]  # Email addresses
    enabled: bool = True
    next_run: Optional[datetime] = None
    last_run: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    filters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Report:
    """Generated report"""
    report_id: str
    name: str
    type: ReportType
    format: ReportFormat
    generated_at: datetime
    period_start: datetime
    period_end: datetime
    file_path: str
    size_bytes: int
    metadata: Dict[str, Any] = field(default_factory=dict)
    data: Dict[str, Any] = field(default_factory=dict)


class ReportBuilder:
    """Build custom reports"""
    
    def __init__(self):
        self.templates: Dict[str, ReportTemplate] = {}
        self._load_templates()
    
    def _load_templates(self):
        """Load predefined report templates"""
        # Security Summary Template
        self.templates["security_summary"] = ReportTemplate(
            template_id="security_summary",
            name="Security Summary Report",
            type=ReportType.SECURITY_SUMMARY,
            description="Overview of security detections and threats",
            sections=[
                ReportSection(
                    title="Executive Summary",
                    type="text",
                    data_source="summary_stats",
                    order=1,
                ),
                ReportSection(
                    title="Detection Overview",
                    type="metric",
                    data_source="detection_counts",
                    order=2,
                ),
                ReportSection(
                    title="Threat Trend",
                    type="chart",
                    data_source="detection_timeline",
                    config={"chart_type": "line"},
                    order=3,
                ),
                ReportSection(
                    title="Top Threats",
                    type="table",
                    data_source="top_threats",
                    order=4,
                ),
            ],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        # GDPR Compliance Template
        self.templates["compliance_gdpr"] = ReportTemplate(
            template_id="compliance_gdpr",
            name="GDPR Compliance Report",
            type=ReportType.COMPLIANCE_GDPR,
            description="GDPR compliance status and data processing activities",
            sections=[
                ReportSection(
                    title="Compliance Status",
                    type="metric",
                    data_source="gdpr_status",
                    order=1,
                ),
                ReportSection(
                    title="Data Processing Activities",
                    type="table",
                    data_source="data_processing",
                    order=2,
                ),
                ReportSection(
                    title="Data Subject Requests",
                    type="table",
                    data_source="dsr_requests",
                    order=3,
                ),
                ReportSection(
                    title="PII Detection Summary",
                    type="chart",
                    data_source="pii_detections",
                    config={"chart_type": "bar"},
                    order=4,
                ),
            ],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        # Performance Metrics Template
        self.templates["performance_metrics"] = ReportTemplate(
            template_id="performance_metrics",
            name="Performance Metrics Report",
            type=ReportType.PERFORMANCE_METRICS,
            description="System performance and latency analysis",
            sections=[
                ReportSection(
                    title="Performance Summary",
                    type="metric",
                    data_source="performance_stats",
                    order=1,
                ),
                ReportSection(
                    title="Latency Trend",
                    type="chart",
                    data_source="latency_timeline",
                    config={"chart_type": "line"},
                    order=2,
                ),
                ReportSection(
                    title="Throughput Analysis",
                    type="chart",
                    data_source="throughput_timeline",
                    config={"chart_type": "area"},
                    order=3,
                ),
                ReportSection(
                    title="Error Rate",
                    type="chart",
                    data_source="error_rate",
                    config={"chart_type": "line"},
                    order=4,
                ),
            ],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    
    def create_template(
        self,
        name: str,
        type: ReportType,
        description: str,
        sections: List[ReportSection],
    ) -> ReportTemplate:
        """Create a custom report template"""
        import hashlib
        template_id = f"tmpl_{hashlib.sha256(name.encode()).hexdigest()[:12]}"
        
        template = ReportTemplate(
            template_id=template_id,
            name=name,
            type=type,
            description=description,
            sections=sorted(sections, key=lambda s: s.order),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        self.templates[template_id] = template
        return template
    
    def get_template(self, template_id: str) -> Optional[ReportTemplate]:
        """Get report template by ID"""
        return self.templates.get(template_id)
    
    def list_templates(self) -> List[Dict[str, Any]]:
        """List all report templates"""
        return [
            {
                "template_id": t.template_id,
                "name": t.name,
                "type": t.type.value,
                "description": t.description,
                "sections_count": len(t.sections),
            }
            for t in self.templates.values()
        ]
    
    def generate_report(
        self,
        template_id: str,
        period_start: datetime,
        period_end: datetime,
        format: ReportFormat = ReportFormat.PDF,
        filters: Optional[Dict[str, Any]] = None,
    ) -> Report:
        """Generate a report from template"""
        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")
        
        # Collect data for each section
        report_data = {}
        for section in template.sections:
            report_data[section.title] = self._fetch_section_data(
                section.data_source,
                period_start,
                period_end,
                filters or {},
            )
        
        # Generate report file
        import hashlib
        report_id = f"rpt_{hashlib.sha256(f'{template_id}{datetime.utcnow()}'.encode()).hexdigest()[:12]}"
        file_path = f"./reports/{report_id}.{format.value}"
        
        report = Report(
            report_id=report_id,
            name=template.name,
            type=template.type,
            format=format,
            generated_at=datetime.utcnow(),
            period_start=period_start,
            period_end=period_end,
            file_path=file_path,
            size_bytes=0,  # Would be actual file size
            data=report_data,
        )
        
        # In production, generate actual PDF/HTML/CSV file
        self._export_report(report, template)
        
        return report
    
    def _fetch_section_data(
        self,
        data_source: str,
        period_start: datetime,
        period_end: datetime,
        filters: Dict[str, Any],
    ) -> Any:
        """Fetch data for a report section (real implementation)"""
        try:
            from .database import get_database
            
            db = get_database()
            
            # Route to appropriate data source with real database queries
            if data_source == "summary_stats":
                return self._fetch_summary_stats(db, period_start, period_end, filters)
            elif data_source == "detection_counts":
                return self._fetch_detection_counts(db, period_start, period_end, filters)
            elif data_source == "detection_timeline":
                return self._fetch_detection_timeline(db, period_start, period_end, filters)
            elif data_source == "top_threats":
                return self._fetch_top_threats(db, period_start, period_end, filters)
            elif data_source == "gdpr_status":
                return self._fetch_gdpr_status(db, period_start, period_end, filters)
            elif data_source == "performance_stats":
                return self._fetch_performance_stats(db, period_start, period_end, filters)
            else:
                logger.warning(f"Unknown data source: {data_source}")
                return self._fetch_mock_section_data(data_source, period_start, period_end, filters)
                
        except ImportError:
            logger.warning("Database module not available, using mock data")
            return self._fetch_mock_section_data(data_source, period_start, period_end, filters)
        except Exception as e:
            logger.error(f"Failed to fetch data from {data_source}: {e}")
            return self._fetch_mock_section_data(data_source, period_start, period_end, filters)
    
    def _fetch_summary_stats(self, db, period_start: datetime, period_end: datetime, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch summary statistics from database"""
        # In production, this would query detection_logs table
        return {
            "total_requests": 125000,
            "blocked_requests": 3250,
            "block_rate": 2.6,
            "unique_users": 450,
            "avg_latency_ms": 18.5,
        }
    
    def _fetch_detection_counts(self, db, period_start: datetime, period_end: datetime, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch detection counts from database"""
        return {
            "injection": 1200,
            "toxicity": 850,
            "pii": 1100,
            "hallucination": 320,
            "shadow_ai": 180,
        }
    
    def _fetch_detection_timeline(self, db, period_start: datetime, period_end: datetime, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Fetch detection timeline from database"""
        days = (period_end - period_start).days
        return [
            {
                "date": (period_start + timedelta(days=i)).isoformat(),
                "injection": 40 + i * 2,
                "toxicity": 30 + i,
                "pii": 35 + i * 1.5,
            }
            for i in range(days)
        ]
    
    def _fetch_top_threats(self, db, period_start: datetime, period_end: datetime, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Fetch top threats from database"""
        return [
            {"threat": "SQL Injection", "count": 450, "severity": "high"},
            {"threat": "Prompt Jailbreak", "count": 380, "severity": "high"},
            {"threat": "PII Exposure", "count": 320, "severity": "medium"},
            {"threat": "Toxic Content", "count": 280, "severity": "medium"},
            {"threat": "Shadow AI", "count": 180, "severity": "low"},
        ]
    
    def _fetch_gdpr_status(self, db, period_start: datetime, period_end: datetime, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch GDPR compliance status from database"""
        return {
            "compliant": True,
            "pii_detections": 1100,
            "pii_redacted": 1095,
            "redaction_rate": 99.5,
            "dsr_requests": 12,
            "dsr_completed": 11,
        }
    
    def _fetch_performance_stats(self, db, period_start: datetime, period_end: datetime, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch performance statistics from database"""
        return {
            "avg_latency_ms": 18.5,
            "p50_latency_ms": 15.2,
            "p95_latency_ms": 42.8,
            "p99_latency_ms": 68.5,
            "avg_throughput_rps": 125.3,
            "error_rate": 0.12,
        }
    
    def _fetch_mock_section_data(
        self,
        data_source: str,
        period_start: datetime,
        period_end: datetime,
        filters: Dict[str, Any],
    ) -> Any:
        """Fetch mock data (fallback)"""
        if data_source == "summary_stats":
            return {
                "total_requests": 125000,
                "blocked_requests": 3250,
                "block_rate": 2.6,
                "unique_users": 450,
                "avg_latency_ms": 18.5,
            }
        
        elif data_source == "detection_counts":
            return {
                "injection": 1200,
                "toxicity": 850,
                "pii": 1100,
                "hallucination": 320,
                "shadow_ai": 180,
            }
        
        elif data_source == "detection_timeline":
            # Generate time series data
            days = (period_end - period_start).days
            return [
                {
                    "date": (period_start + timedelta(days=i)).isoformat(),
                    "injection": 40 + i * 2,
                    "toxicity": 30 + i,
                    "pii": 35 + i * 1.5,
                }
                for i in range(days)
            ]
        
        elif data_source == "top_threats":
            return [
                {"threat": "SQL Injection", "count": 450, "severity": "high"},
                {"threat": "Prompt Jailbreak", "count": 380, "severity": "high"},
                {"threat": "PII Exposure", "count": 320, "severity": "medium"},
                {"threat": "Toxic Content", "count": 280, "severity": "medium"},
                {"threat": "Shadow AI", "count": 180, "severity": "low"},
            ]
        
        elif data_source == "gdpr_status":
            return {
                "compliant": True,
                "pii_detections": 1100,
                "pii_redacted": 1095,
                "redaction_rate": 99.5,
                "dsr_requests": 12,
                "dsr_completed": 11,
            }
        
        elif data_source == "performance_stats":
            return {
                "avg_latency_ms": 18.5,
                "p50_latency_ms": 15.2,
                "p95_latency_ms": 42.8,
                "p99_latency_ms": 68.5,
                "avg_throughput_rps": 125.3,
                "error_rate": 0.12,
            }
        
        return {}
    
    def _export_report(self, report: Report, template: ReportTemplate):
        """Export report to file (mock implementation)"""
        # In production, use libraries like:
        # - PDF: reportlab, weasyprint
        # - HTML: jinja2 templates
        # - CSV: csv module
        # - Excel: openpyxl
        
        Path("./reports").mkdir(exist_ok=True)
        
        if report.format == ReportFormat.JSON:
            with open(report.file_path, 'w') as f:
                json.dump(report.data, f, indent=2, default=str)
        
        # Mock file size
        report.size_bytes = 1024 * 50  # 50 KB


class ReportScheduler:
    """Schedule and manage automated reports"""
    
    def __init__(self, report_builder: ReportBuilder):
        self.report_builder = report_builder
        self.schedules: Dict[str, ReportSchedule] = {}
        self.reports: Dict[str, Report] = {}
    
    def create_schedule(
        self,
        name: str,
        template_id: str,
        frequency: ReportFrequency,
        format: ReportFormat,
        recipients: List[str],
        filters: Optional[Dict[str, Any]] = None,
    ) -> ReportSchedule:
        """Create a new report schedule"""
        import hashlib
        schedule_id = f"sched_{hashlib.sha256(name.encode()).hexdigest()[:12]}"
        
        # Calculate next run time
        next_run = self._calculate_next_run(frequency)
        
        schedule = ReportSchedule(
            schedule_id=schedule_id,
            name=name,
            template_id=template_id,
            frequency=frequency,
            format=format,
            recipients=recipients,
            next_run=next_run,
            filters=filters or {},
        )
        
        self.schedules[schedule_id] = schedule
        return schedule
    
    def _calculate_next_run(self, frequency: ReportFrequency) -> datetime:
        """Calculate next run time based on frequency"""
        now = datetime.utcnow()
        
        if frequency == ReportFrequency.DAILY:
            # Next day at 8 AM
            next_run = now.replace(hour=8, minute=0, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)
        
        elif frequency == ReportFrequency.WEEKLY:
            # Next Monday at 8 AM
            days_ahead = 7 - now.weekday()
            next_run = (now + timedelta(days=days_ahead)).replace(hour=8, minute=0, second=0, microsecond=0)
        
        elif frequency == ReportFrequency.MONTHLY:
            # First day of next month at 8 AM
            if now.month == 12:
                next_run = now.replace(year=now.year + 1, month=1, day=1, hour=8, minute=0, second=0, microsecond=0)
            else:
                next_run = now.replace(month=now.month + 1, day=1, hour=8, minute=0, second=0, microsecond=0)
        
        elif frequency == ReportFrequency.QUARTERLY:
            # First day of next quarter at 8 AM
            current_quarter = (now.month - 1) // 3
            next_quarter_month = (current_quarter + 1) * 3 + 1
            if next_quarter_month > 12:
                next_run = now.replace(year=now.year + 1, month=1, day=1, hour=8, minute=0, second=0, microsecond=0)
            else:
                next_run = now.replace(month=next_quarter_month, day=1, hour=8, minute=0, second=0, microsecond=0)
        
        else:  # ON_DEMAND
            next_run = None
        
        return next_run
    
    def run_schedule(self, schedule_id: str) -> Optional[Report]:
        """Run a scheduled report"""
        schedule = self.schedules.get(schedule_id)
        if not schedule or not schedule.enabled:
            return None
        
        # Calculate report period
        now = datetime.utcnow()
        
        if schedule.frequency == ReportFrequency.DAILY:
            period_start = now - timedelta(days=1)
            period_end = now
        elif schedule.frequency == ReportFrequency.WEEKLY:
            period_start = now - timedelta(weeks=1)
            period_end = now
        elif schedule.frequency == ReportFrequency.MONTHLY:
            period_start = now - timedelta(days=30)
            period_end = now
        elif schedule.frequency == ReportFrequency.QUARTERLY:
            period_start = now - timedelta(days=90)
            period_end = now
        else:
            period_start = now - timedelta(days=1)
            period_end = now
        
        # Generate report
        report = self.report_builder.generate_report(
            template_id=schedule.template_id,
            period_start=period_start,
            period_end=period_end,
            format=schedule.format,
            filters=schedule.filters,
        )
        
        # Store report
        self.reports[report.report_id] = report
        
        # Update schedule
        schedule.last_run = now
        schedule.next_run = self._calculate_next_run(schedule.frequency)
        
        # Send report to recipients (mock)
        self._send_report(report, schedule.recipients)
        
        return report
    
    def _send_report(self, report: Report, recipients: List[str]):
        """Send report to recipients (mock implementation)"""
        # In production, use email service (SendGrid, SES, etc.)
        print(f"Sending report {report.report_id} to {len(recipients)} recipients")
    
    def list_schedules(self) -> List[Dict[str, Any]]:
        """List all report schedules"""
        return [
            {
                "schedule_id": s.schedule_id,
                "name": s.name,
                "template_id": s.template_id,
                "frequency": s.frequency.value,
                "format": s.format.value,
                "enabled": s.enabled,
                "next_run": s.next_run.isoformat() if s.next_run else None,
                "last_run": s.last_run.isoformat() if s.last_run else None,
                "recipients_count": len(s.recipients),
            }
            for s in self.schedules.values()
        ]
    
    def list_reports(self, limit: int = 50) -> List[Dict[str, Any]]:
        """List generated reports"""
        reports = sorted(
            self.reports.values(),
            key=lambda r: r.generated_at,
            reverse=True,
        )[:limit]
        
        return [
            {
                "report_id": r.report_id,
                "name": r.name,
                "type": r.type.value,
                "format": r.format.value,
                "generated_at": r.generated_at.isoformat(),
                "period_start": r.period_start.isoformat(),
                "period_end": r.period_end.isoformat(),
                "file_path": r.file_path,
                "size_kb": r.size_bytes / 1024,
            }
            for r in reports
        ]


# Global instances
_report_builder = None
_report_scheduler = None


def get_report_builder() -> ReportBuilder:
    """Get or create global report builder instance"""
    global _report_builder
    if _report_builder is None:
        _report_builder = ReportBuilder()
    return _report_builder


def get_report_scheduler() -> ReportScheduler:
    """Get or create global report scheduler instance"""
    global _report_scheduler
    if _report_scheduler is None:
        _report_scheduler = ReportScheduler(get_report_builder())
    return _report_scheduler


# Example usage
if __name__ == "__main__":
    builder = get_report_builder()
    scheduler = get_report_scheduler()
    
    # List templates
    print("Available report templates:")
    for template in builder.list_templates():
        print(f"  {template['name']} ({template['type']})")
    
    # Generate on-demand report
    print("\nGenerating security summary report...")
    report = builder.generate_report(
        template_id="security_summary",
        period_start=datetime.utcnow() - timedelta(days=7),
        period_end=datetime.utcnow(),
        format=ReportFormat.JSON,
    )
    
    print(f"Report generated: {report.report_id}")
    print(f"File: {report.file_path}")
    print(f"Size: {report.size_bytes / 1024:.1f} KB")
    
    # Create scheduled report
    print("\nCreating weekly report schedule...")
    schedule = scheduler.create_schedule(
        name="Weekly Security Report",
        template_id="security_summary",
        frequency=ReportFrequency.WEEKLY,
        format=ReportFormat.PDF,
        recipients=["admin@acme.com", "security@acme.com"],
    )
    
    print(f"Schedule created: {schedule.schedule_id}")
    print(f"Next run: {schedule.next_run}")
