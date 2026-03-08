#!/bin/bash

echo "=========================================="
echo "AetherGuard AI - ML Services Startup"
echo "=========================================="

# Check if models should be downloaded
if [ "$DOWNLOAD_MODELS" = "true" ]; then
    echo "Downloading ML models..."
    python -c "from models.model_loader import initialize_models; initialize_models()"
fi

# Start the service
echo "Starting FastAPI service..."
uvicorn main:app --host 0.0.0.0 --port 8001 --log-level info
