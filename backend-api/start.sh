#!/bin/bash

# AetherGuard Backend API - Startup Script

echo "🚀 Starting AetherGuard Backend API..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Set environment variables (use .env file or system environment in production)
export JWT_SECRET="${JWT_SECRET:-aetherguard-jwt-secret-change-in-production}"
export DATABASE_URL="${DATABASE_URL:-sqlite:///aetherguard.db}"

# Start the server
PORT=${PORT:-8081}
echo "🚀 Starting server on http://localhost:${PORT}"
python main.py