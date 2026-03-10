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

# Set environment variables
export JWT_SECRET="aetherguard-jwt-secret-change-in-production"
export DATABASE_URL="sqlite:///aetherguard.db"

# Start the server
echo "🚀 Starting server on http://localhost:8080"
python main.py