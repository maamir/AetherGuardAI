#!/bin/bash

# AetherGuard AI - Complete System Startup Script

set -e

echo "🚀 Starting AetherGuard AI Complete System"
echo "=========================================="

# Function to check if a port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is already in use"
        return 1
    fi
    return 0
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$url" > /dev/null 2>&1; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to start within timeout"
    return 1
}

# Check required ports
echo "🔍 Checking required ports..."
ports=(3000 8080 8001 8082 5433)
for port in "${ports[@]}"; do
    if ! check_port $port; then
        echo "❌ Port $port is in use. Please free it and try again."
        echo "   You can kill processes using: lsof -ti:$port | xargs kill -9"
        exit 1
    fi
done
echo "✅ All required ports are available"

# Option 1: Docker Compose (Recommended)
if command -v docker-compose >/dev/null 2>&1 || command -v docker >/dev/null 2>&1; then
    echo ""
    echo "🐳 Starting with Docker Compose..."
    
    # Build and start all services
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose down --remove-orphans 2>/dev/null || true
        docker-compose build
        docker-compose up -d
    else
        docker compose down --remove-orphans 2>/dev/null || true
        docker compose build
        docker compose up -d
    fi
    
    # Wait for services to be ready
    #wait_for_service "http://localhost:5433" "PostgreSQL" || true
    wait_for_service "http://localhost:8080/health" "Backend API"
    wait_for_service "http://localhost:8001/health" "ML Services"
    wait_for_service "http://localhost:8082/health" "Proxy Engine"
    wait_for_service "http://localhost:3000" "Web Portal"
    
    echo ""
    echo "🎉 All services are running!"
    echo ""
    echo "📋 Service URLs:"
    echo "   🌐 Web Portal:    http://localhost:3000"
    echo "   🔧 Backend API:   http://localhost:8080"
    echo "   🤖 ML Services:   http://localhost:8001"
    echo "   🛡️  Proxy Engine:  http://localhost:8082"
    echo "   🗄️  Database:     localhost:5433"
    echo ""
    echo "🔐 Demo Login:"
    echo "   Email:    admin@acme.com"
    echo "   Password: password123"
    echo ""
    echo "📊 To view logs: docker-compose logs -f [service-name]"
    echo "🛑 To stop all:  docker-compose down"
    
else
    echo ""
    echo "📦 Starting with manual setup..."
    
    # Start PostgreSQL (if available)
    if command -v pg_ctl >/dev/null 2>&1; then
        echo "🗄️  Starting PostgreSQL..."
        pg_ctl -D /usr/local/var/postgres start 2>/dev/null || true
        sleep 2
        
        # Create database if it doesn't exist
        createdb aetherguard 2>/dev/null || true
        psql -d aetherguard -f init.sql 2>/dev/null || true
    else
        echo "⚠️  PostgreSQL not found, services will use in-memory storage"
    fi
    
    # Start Backend API
    echo "🔧 Starting Backend API..."
    cd backend-api
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install -r requirements.txt >/dev/null 2>&1
    export DATABASE_URL="postgresql://aetherguard:password@localhost:5433/aetherguard"
    python main.py &
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to start
    wait_for_service "http://localhost:8080/health" "Backend API"
    
    # Start ML Services
    echo "🤖 Starting ML Services..."
    cd ml-services
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install -r requirements.txt >/dev/null 2>&1
    python main.py &
    ML_PID=$!
    cd ..
    
    # Wait for ML services to start
    wait_for_service "http://localhost:8001/health" "ML Services"
    
    # Start Proxy Engine
    echo "🛡️  Starting Proxy Engine..."
    cd proxy-engine
    export ML_SERVICE_URL="http://localhost:8001"
    export BACKEND_API_URL="http://localhost:8080"
    cargo run --release &
    PROXY_PID=$!
    cd ..
    
    # Wait for proxy engine to start
    wait_for_service "http://localhost:8082/health" "Proxy Engine"
    
    echo "🌐 Starting Web Portal..."
    cd web-portal
    
    # Check for rollup issue and fix if needed
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
        echo "📦 Installing web portal dependencies..."
        
        # Try to fix rollup issue
        if [ -f "fix-rollup-issue.sh" ]; then
            chmod +x fix-rollup-issue.sh
            ./fix-rollup-issue.sh
        else
            rm -rf node_modules package-lock.json
            npm cache clean --force
            npm config set optional false
            npm install --no-optional --legacy-peer-deps >/dev/null 2>&1
        fi
    fi
    
    export REACT_APP_API_URL="http://localhost:8080"
    export VITE_API_URL="http://localhost:8080"
    npm run dev &
    PORTAL_PID=$!
    cd ..
    
    # Wait for web portal to start
    wait_for_service "http://localhost:3000" "Web Portal"
    
    echo ""
    echo "🎉 All services are running!"
    echo ""
    echo "📋 Service URLs:"
    echo "   🌐 Web Portal:    http://localhost:3000"
    echo "   🔧 Backend API:   http://localhost:8080"
    echo "   🤖 ML Services:   http://localhost:8001"
    echo "   🛡️  Proxy Engine:  http://localhost:8082"
    echo ""
    echo "🔐 Demo Login:"
    echo "   Email:    admin@acme.com"
    echo "   Password: password123"
    echo ""
    echo "🛑 To stop all services:"
    echo "   kill $BACKEND_PID $ML_PID $PROXY_PID $PORTAL_PID"
    
    # Create stop script
    cat > stop-all-services.sh << EOF
#!/bin/bash
echo "🛑 Stopping all AetherGuard services..."
kill $BACKEND_PID $ML_PID $PROXY_PID $PORTAL_PID 2>/dev/null || true
echo "✅ All services stopped"
EOF
    chmod +x stop-all-services.sh
    
    echo "   Or run: ./stop-all-services.sh"
fi

echo ""
echo "🧪 Quick Test Commands:"
echo "   curl http://localhost:8080/health"
echo "   curl http://localhost:8001/health"
echo "   curl http://localhost:8082/health"
echo ""
echo "✅ AetherGuard AI is ready for use!"