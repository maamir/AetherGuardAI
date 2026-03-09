#!/bin/bash

echo "=========================================="
echo "AetherGuard AI - Quick Start"
echo "=========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi
echo "✅ Docker found"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker Compose first."
    exit 1
fi
echo "✅ Docker Compose found"

echo ""
echo "=========================================="
echo "Starting AetherGuard AI Services"
echo "=========================================="
echo ""
echo "This will:"
echo "  1. Build Docker images"
echo "  2. Download ML models (~3GB)"
echo "  3. Start all services"
echo ""
echo "First run may take 10-15 minutes..."
echo ""

# Start services
docker-compose up --build -d

echo ""
echo "=========================================="
echo "Waiting for services to be ready..."
echo "=========================================="
echo ""

# Wait for ML services
echo "Waiting for ML services..."
for i in {1..60}; do
    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        echo "✅ ML Services ready!"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for proxy
echo ""
echo "Waiting for Proxy Engine..."
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Proxy Engine ready!"
        break
    fi
    echo -n "."
    sleep 2
done

echo ""
echo "=========================================="
echo "✅ AetherGuard AI is ready!"
echo "=========================================="
echo ""
echo "Services:"
echo "  - Proxy Engine: http://localhost:8080"
echo "  - ML Services:  http://localhost:8001"
echo ""
echo "Test the installation:"
echo "  curl http://localhost:8001/health"
echo ""
echo "View logs:"
echo "  docker-compose logs -f"
echo ""
echo "Stop services:"
echo "  docker-compose down"
echo ""
echo "See SETUP_GUIDE.md for more information."
echo ""
