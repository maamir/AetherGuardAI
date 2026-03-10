"""
Custom Model Fine-Tuning for AetherGuard AI
Provides fine-tuning pipeline, dataset management, and training scheduler
"""

from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import json
import hashlib
from pathlib import Path


class DatasetType(Enum):
    """Dataset types"""
    INJECTION = "injection"
    TOXICITY = "toxicity"
    HALLUCINATION = "hallucination"
    BRAND_SAFETY = "brand_safety"
    PII = "pii"
    CUSTOM = "custom"


class TrainingStatus(Enum):
    """Training job status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Dataset:
    """Training dataset"""
    dataset_id: str
    name: str
    type: DatasetType
    description: str
    size: int  # Number of samples
    created_at: datetime
    updated_at: datetime
    file_path: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    validation_split: float = 0.2
    test_split: float = 0.1
    
    def get_splits(self) -> Dict[str, int]:
        """Calculate dataset splits"""
        train_size = int(self.size * (1 - self.validation_split - self.test_split))
        val_size = int(self.size * self.validation_split)
        test_size = self.size - train_size - val_size
        
        return {
            "train": train_size,
            "validation": val_size,
            "test": test_size,
        }


@dataclass
class TrainingConfig:
    """Training configuration"""
    model_name: str
    base_model: str  # Base model to fine-tune from
    learning_rate: float = 2e-5
    batch_size: int = 16
    num_epochs: int = 3
    warmup_steps: int = 500
    weight_decay: float = 0.01
    max_seq_length: int = 512
    gradient_accumulation_steps: int = 1
    fp16: bool = True  # Mixed precision training
    early_stopping_patience: int = 3
    save_steps: int = 500
    eval_steps: int = 500
    logging_steps: int = 100
    seed: int = 42
    custom_params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrainingMetrics:
    """Training metrics"""
    epoch: int
    step: int
    train_loss: float
    eval_loss: Optional[float] = None
    eval_accuracy: Optional[float] = None
    eval_f1: Optional[float] = None
    eval_precision: Optional[float] = None
    eval_recall: Optional[float] = None
    learning_rate: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class TrainingJob:
    """Training job"""
    job_id: str
    name: str
    dataset_id: str
    config: TrainingConfig
    status: TrainingStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress: float = 0.0  # 0.0 to 1.0
    current_epoch: int = 0
    total_epochs: int = 0
    metrics: List[TrainingMetrics] = field(default_factory=list)
    output_model_path: Optional[str] = None
    error_message: Optional[str] = None
    logs: List[str] = field(default_factory=list)
    
    def add_log(self, message: str):
        """Add log message"""
        timestamp = datetime.utcnow().isoformat()
        self.logs.append(f"[{timestamp}] {message}")
    
    def update_metrics(self, metrics: TrainingMetrics):
        """Update training metrics"""
        self.metrics.append(metrics)
        self.current_epoch = metrics.epoch
        self.progress = metrics.epoch / self.total_epochs if self.total_epochs > 0 else 0.0
    
    def get_best_metrics(self) -> Optional[TrainingMetrics]:
        """Get best metrics based on eval_loss"""
        if not self.metrics:
            return None
        
        eval_metrics = [m for m in self.metrics if m.eval_loss is not None]
        if not eval_metrics:
            return None
        
        return min(eval_metrics, key=lambda m: m.eval_loss)


class DatasetManager:
    """Manage training datasets"""
    
    def __init__(self, storage_path: str = "./datasets"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.datasets: Dict[str, Dataset] = {}
        self._load_datasets()
    
    def _load_datasets(self):
        """Load datasets from database storage"""
        try:
            from .database import get_database
            
            db = get_database()
            
            # In production, load datasets from database
            # For now, create demo datasets if none exist
            demo_datasets = [
                Dataset(
                    dataset_id="ds_injection_001",
                    name="Prompt Injection Dataset",
                    type=DatasetType.INJECTION,
                    description="10,000 labeled prompt injection examples",
                    size=10000,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    file_path=str(self.storage_path / "injection_10k.jsonl"),
                ),
                Dataset(
                    dataset_id="ds_toxicity_001",
                    name="Toxicity Detection Dataset",
                    type=DatasetType.TOXICITY,
                    description="50,000 labeled toxic/non-toxic examples",
                    size=50000,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    file_path=str(self.storage_path / "toxicity_50k.jsonl"),
                ),
            ]
            
            for dataset in demo_datasets:
                self.datasets[dataset.dataset_id] = dataset
            
            logger.info(f"Loaded {len(self.datasets)} datasets")
            
        except ImportError:
            logger.warning("Database module not available, using demo datasets")
            self._load_demo_datasets()
        except Exception as e:
            logger.error(f"Failed to load datasets from database: {e}")
            self._load_demo_datasets()
    
    def _load_demo_datasets(self):
        """Load demo datasets (fallback)"""
        demo_datasets = [
            Dataset(
                dataset_id="ds_injection_001",
                name="Prompt Injection Dataset",
                type=DatasetType.INJECTION,
                description="10,000 labeled prompt injection examples",
                size=10000,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                file_path=str(self.storage_path / "injection_10k.jsonl"),
            ),
            Dataset(
                dataset_id="ds_toxicity_001",
                name="Toxicity Detection Dataset",
                type=DatasetType.TOXICITY,
                description="50,000 labeled toxic/non-toxic examples",
                size=50000,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                file_path=str(self.storage_path / "toxicity_50k.jsonl"),
            ),
        ]
        
        for dataset in demo_datasets:
            self.datasets[dataset.dataset_id] = dataset
    
    def create_dataset(
        self,
        name: str,
        type: DatasetType,
        description: str,
        file_path: str,
        size: int,
    ) -> Dataset:
        """Create a new dataset"""
        dataset_id = f"ds_{hashlib.sha256(name.encode()).hexdigest()[:12]}"
        
        dataset = Dataset(
            dataset_id=dataset_id,
            name=name,
            type=type,
            description=description,
            size=size,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            file_path=file_path,
        )
        
        self.datasets[dataset_id] = dataset
        return dataset
    
    def get_dataset(self, dataset_id: str) -> Optional[Dataset]:
        """Get dataset by ID"""
        return self.datasets.get(dataset_id)
    
    def list_datasets(self, type: Optional[DatasetType] = None) -> List[Dict[str, Any]]:
        """List datasets with optional type filter"""
        datasets = []
        
        for dataset in self.datasets.values():
            if type and dataset.type != type:
                continue
            
            splits = dataset.get_splits()
            datasets.append({
                "dataset_id": dataset.dataset_id,
                "name": dataset.name,
                "type": dataset.type.value,
                "description": dataset.description,
                "size": dataset.size,
                "splits": splits,
                "created_at": dataset.created_at.isoformat(),
            })
        
        return datasets
    
    def delete_dataset(self, dataset_id: str) -> bool:
        """Delete dataset"""
        if dataset_id in self.datasets:
            del self.datasets[dataset_id]
            return True
        return False


class TrainingScheduler:
    """Schedule and manage training jobs"""
    
    def __init__(self, dataset_manager: DatasetManager):
        self.dataset_manager = dataset_manager
        self.jobs: Dict[str, TrainingJob] = {}
        self.queue: List[str] = []  # Job IDs in queue
    
    def create_job(
        self,
        name: str,
        dataset_id: str,
        config: TrainingConfig,
    ) -> TrainingJob:
        """Create a new training job"""
        job_id = f"job_{hashlib.sha256(name.encode()).hexdigest()[:12]}"
        
        job = TrainingJob(
            job_id=job_id,
            name=name,
            dataset_id=dataset_id,
            config=config,
            status=TrainingStatus.PENDING,
            created_at=datetime.utcnow(),
            total_epochs=config.num_epochs,
        )
        
        self.jobs[job_id] = job
        self.queue.append(job_id)
        
        job.add_log(f"Job created: {name}")
        job.add_log(f"Dataset: {dataset_id}")
        job.add_log(f"Base model: {config.base_model}")
        
        return job
    
    def start_job(self, job_id: str) -> bool:
        """Start a training job"""
        job = self.jobs.get(job_id)
        if not job or job.status != TrainingStatus.PENDING:
            return False
        
        job.status = TrainingStatus.RUNNING
        job.started_at = datetime.utcnow()
        job.add_log("Training started")
        
        # Remove from queue
        if job_id in self.queue:
            self.queue.remove(job_id)
        
        # In production, this would start actual training
        # For now, simulate training progress
        self._simulate_training(job)
        
        return True
    
    def _simulate_training(self, job: TrainingJob):
        """Simulate training progress (mock implementation)"""
        import random
        
        # Simulate training metrics
        for epoch in range(1, job.total_epochs + 1):
            for step in range(1, 11):  # 10 steps per epoch
                metrics = TrainingMetrics(
                    epoch=epoch,
                    step=(epoch - 1) * 10 + step,
                    train_loss=2.0 - (epoch * 0.3) + random.uniform(-0.1, 0.1),
                    eval_loss=2.1 - (epoch * 0.3) + random.uniform(-0.1, 0.1) if step == 10 else None,
                    eval_accuracy=0.7 + (epoch * 0.05) + random.uniform(-0.02, 0.02) if step == 10 else None,
                    eval_f1=0.68 + (epoch * 0.05) + random.uniform(-0.02, 0.02) if step == 10 else None,
                    learning_rate=job.config.learning_rate * (1 - epoch / job.total_epochs),
                )
                
                job.update_metrics(metrics)
                
                if step == 10:
                    job.add_log(f"Epoch {epoch}/{job.total_epochs} - Loss: {metrics.train_loss:.4f}, Acc: {metrics.eval_accuracy:.4f}")
        
        # Complete job
        job.status = TrainingStatus.COMPLETED
        job.completed_at = datetime.utcnow()
        job.output_model_path = f"./models/{job.config.model_name}"
        job.add_log("Training completed successfully")
        
        best_metrics = job.get_best_metrics()
        if best_metrics:
            job.add_log(f"Best validation loss: {best_metrics.eval_loss:.4f}")
            job.add_log(f"Best accuracy: {best_metrics.eval_accuracy:.4f}")
    
    def cancel_job(self, job_id: str) -> bool:
        """Cancel a training job"""
        job = self.jobs.get(job_id)
        if not job:
            return False
        
        if job.status in [TrainingStatus.PENDING, TrainingStatus.RUNNING]:
            job.status = TrainingStatus.CANCELLED
            job.completed_at = datetime.utcnow()
            job.add_log("Training cancelled by user")
            
            # Remove from queue
            if job_id in self.queue:
                self.queue.remove(job_id)
            
            return True
        
        return False
    
    def get_job(self, job_id: str) -> Optional[TrainingJob]:
        """Get training job by ID"""
        return self.jobs.get(job_id)
    
    def list_jobs(self, status: Optional[TrainingStatus] = None) -> List[Dict[str, Any]]:
        """List training jobs with optional status filter"""
        jobs = []
        
        for job in self.jobs.values():
            if status and job.status != status:
                continue
            
            best_metrics = job.get_best_metrics()
            
            jobs.append({
                "job_id": job.job_id,
                "name": job.name,
                "dataset_id": job.dataset_id,
                "status": job.status.value,
                "progress": job.progress,
                "current_epoch": job.current_epoch,
                "total_epochs": job.total_epochs,
                "created_at": job.created_at.isoformat(),
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "best_metrics": {
                    "eval_loss": best_metrics.eval_loss,
                    "eval_accuracy": best_metrics.eval_accuracy,
                    "eval_f1": best_metrics.eval_f1,
                } if best_metrics else None,
                "output_model_path": job.output_model_path,
            })
        
        return jobs
    
    def get_job_logs(self, job_id: str) -> List[str]:
        """Get training job logs"""
        job = self.jobs.get(job_id)
        if not job:
            return []
        
        return job.logs
    
    def get_job_metrics(self, job_id: str) -> List[Dict[str, Any]]:
        """Get training job metrics"""
        job = self.jobs.get(job_id)
        if not job:
            return []
        
        return [
            {
                "epoch": m.epoch,
                "step": m.step,
                "train_loss": m.train_loss,
                "eval_loss": m.eval_loss,
                "eval_accuracy": m.eval_accuracy,
                "eval_f1": m.eval_f1,
                "learning_rate": m.learning_rate,
                "timestamp": m.timestamp.isoformat(),
            }
            for m in job.metrics
        ]


class FineTuningPipeline:
    """Complete fine-tuning pipeline"""
    
    def __init__(self):
        self.dataset_manager = DatasetManager()
        self.scheduler = TrainingScheduler(self.dataset_manager)
    
    def fine_tune(
        self,
        name: str,
        dataset_id: str,
        base_model: str,
        config: Optional[TrainingConfig] = None,
    ) -> TrainingJob:
        """Start fine-tuning a model"""
        # Validate dataset exists
        dataset = self.dataset_manager.get_dataset(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset not found: {dataset_id}")
        
        # Use default config if not provided
        if config is None:
            config = TrainingConfig(
                model_name=name,
                base_model=base_model,
            )
        else:
            config.model_name = name
            config.base_model = base_model
        
        # Create and start job
        job = self.scheduler.create_job(name, dataset_id, config)
        self.scheduler.start_job(job.job_id)
        
        return job
    
    def evaluate_model(self, model_path: str, dataset_id: str) -> Dict[str, float]:
        """Evaluate a fine-tuned model"""
        # Mock implementation
        # In production, load model and run evaluation
        
        return {
            "accuracy": 0.92,
            "precision": 0.91,
            "recall": 0.93,
            "f1": 0.92,
            "loss": 0.25,
        }
    
    def deploy_model(self, job_id: str, deployment_name: str) -> Dict[str, Any]:
        """Deploy a fine-tuned model"""
        job = self.scheduler.get_job(job_id)
        if not job or job.status != TrainingStatus.COMPLETED:
            raise ValueError("Job not completed or not found")
        
        # Mock deployment
        # In production, copy model to deployment location, update model registry
        
        return {
            "deployment_id": f"deploy_{hashlib.sha256(deployment_name.encode()).hexdigest()[:12]}",
            "name": deployment_name,
            "model_path": job.output_model_path,
            "status": "active",
            "deployed_at": datetime.utcnow().isoformat(),
        }


# Global pipeline instance
_pipeline = None


def get_fine_tuning_pipeline() -> FineTuningPipeline:
    """Get or create global fine-tuning pipeline instance"""
    global _pipeline
    if _pipeline is None:
        _pipeline = FineTuningPipeline()
    return _pipeline


# Example usage
if __name__ == "__main__":
    pipeline = get_fine_tuning_pipeline()
    
    # List datasets
    print("Available datasets:")
    for dataset in pipeline.dataset_manager.list_datasets():
        print(f"  {dataset['name']} ({dataset['type']}) - {dataset['size']} samples")
    
    # Start fine-tuning
    print("\nStarting fine-tuning job...")
    job = pipeline.fine_tune(
        name="custom_injection_detector",
        dataset_id="ds_injection_001",
        base_model="meta-llama/Prompt-Guard-86M",
        config=TrainingConfig(
            model_name="custom_injection_detector",
            base_model="meta-llama/Prompt-Guard-86M",
            num_epochs=3,
            batch_size=16,
        ),
    )
    
    print(f"Job created: {job.job_id}")
    print(f"Status: {job.status.value}")
    print(f"Progress: {job.progress * 100:.1f}%")
    
    # Get job metrics
    print("\nTraining metrics:")
    metrics = pipeline.scheduler.get_job_metrics(job.job_id)
    for m in metrics[-5:]:  # Last 5 metrics
        print(f"  Epoch {m['epoch']}, Step {m['step']}: Loss={m['train_loss']:.4f}")
    
    # Get logs
    print("\nTraining logs:")
    for log in pipeline.scheduler.get_job_logs(job.job_id)[-5:]:
        print(f"  {log}")
