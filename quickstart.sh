#!/bin/bash

# AetherGuard AI Gateway - Production Quickstart Script
# This script sets up AetherGuard with production AetherSign capabilities

set -e

echo "🚀 AetherGuard AI Gateway - Production Setup"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
echo "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_status "Docker is installed"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
print_status "Docker Compose is installed"

# Check available memory
AVAILABLE_MEMORY=$(free -g | awk '/^Mem:/{print $7}')
if [ "$AVAILABLE_MEMORY" -lt 6 ]; then
    print_warning "Available memory is ${AVAILABLE_MEMORY}GB. Recommended: 8GB+ for optimal performance."
else
    print_status "Sufficient memory available: ${AVAILABLE_MEMORY}GB"
fi

# Check available disk space
AVAILABLE_DISK=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
if [ "$AVAILABLE_DISK" -lt 15 ]; then
    print_warning "Available disk space is ${AVAILABLE_DISK}GB. Recommended: 20GB+ for ML models."
else
    print_status "Sufficient disk space available: ${AVAILABLE_DISK}GB"
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    print_info "Creating .env file from template..."
    cp .env.example .env
    print_warning "Please edit .env file with your configuration before running in production!"
    print_info "For development, default values will work with local-only features."
fi

# Choose deployment mode
echo ""
echo "Choose deployment mode:"
echo "1) Development (local keys, no AWS)"
echo "2) Production (AWS KMS + QLDB)"
echo "3) AWS Production (with IAM roles)"
read -p "Enter choice (1-3): " DEPLOY_MODE

case $DEPLOY_MODE in
    1)
        COMPOSE_FILE="docker-compose.yml"
        print_info "Using development mode with local cryptographic keys"
        ;;
    2)
        COMPOSE_FILE="docker-compose.prod.yml"
        print_info "Using production mode - ensure AWS credentials are configured"
        print_warning "Make sure to set AWS_KMS_KEY_ID and QLDB_LEDGER_NAME in .env"
        ;;
    3)
        COMPOSE_FILE="docker-compose.aws.yml"
        print_info "Using AWS production mode with IAM roles"
        print_warning "Ensure your EC2 instance has proper IAM roles attached"
        ;;
    *)
        print_error "Invalid choice. Using development mode."
        COMPOSE_FILE="docker-compose.yml"
        ;;
esac

# Build and start services
echo ""
print_info "Building and starting AetherGuard services..."
print_info "This may take 10-15 minutes on first run (downloading ML models)..."

# Use docker-compose or docker compose based on availability
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

# Build services
print_info "Building Docker images..."
$DOCKER_COMPOSE -f $COMPOSE_FILE build

# Start services
print_info "Starting services..."
$DOCKER_COMPOSE -f $COMPOSE_FILE up -d

# Wait for services to be ready
echo ""
print_info "Waiting for services to start..."
sleep 10

# Health checks
echo ""
print_info "Performing health checks..."

# Check Proxy Engine
if curl -f http://localhost:8080/health &> /dev/null; then
    print_status "Proxy Engine (AetherSign) is healthy"
else
    print_error "Proxy Engine is not responding"
fi

# Check ML Services
if curl -f http://localhost:8001/health &> /dev/null; then
    print_status "ML Services are healthy"
else
    print_error "ML Services are not responding"
fi

# Check Backend API
if curl -f http://localhost:8081/health &> /dev/null; then
    print_status "Backend API is healthy"
else
    print_error "Backend API is not responding"
fi

# Check Web Portal
if curl -f http://localhost:3000 &> /dev/null; then
    print_status "Web Portal is accessible"
else
    print_warning "Web Portal may still be starting up"
fi

# Display service information
echo ""
echo "🎉 AetherGuard AI Gateway is running!"
echo "====================================="
echo ""
echo "📊 Service Endpoints:"
echo "  • Proxy Engine (AI Gateway):  http://localhost:8080"
echo "  • ML Services:                http://localhost:8001"
echo "  • Backend API:                 http://localhost:8081"
echo "  • Web Portal:                  http://localhost:3000"
echo "  • Admin Portal:                http://localhost:3001"
if [ "$DEPLOY_MODE" = "3" ]; then
echo "  • Prometheus Metrics:          http://localhost:9091"
echo "  • Grafana Dashboard:           http://localhost:3002"
fi
echo ""
echo "🔐 AetherSign Features:"
case $DEPLOY_MODE in
    1)
        echo "  • Cryptographic Signing:       ✅ Local RSA/ECDSA keys"
        echo "  • Chain of Custody:            ✅ In-memory storage"
        echo "  • AWS KMS Integration:          ❌ Development mode"
        echo "  • AWS QLDB Storage:             ❌ Development mode"
        ;;
    2|3)
        echo "  • Cryptographic Signing:       ✅ AWS KMS with RSA/ECDSA"
        echo "  • Chain of Custody:            ✅ AWS QLDB immutable storage"
        echo "  • Key Rotation:                ✅ Automatic rotation"
        echo "  • Watermark Integration:       ✅ Full watermarking support"
        echo "  • Cross-Model Verification:    ✅ Model relationship tracking"
        ;;
esac
echo ""
echo "🧪 Test the API:"
echo "curl -X POST http://localhost:8080/v1/chat/completions \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer your-api-key\" \\"
echo "  -d '{\"model\": \"gpt-3.5-turbo\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello!\"}]}'"
echo ""
echo "📚 Documentation:"
echo "  • Main README:                 README.md"
echo "  • AetherSign Documentation:    AETHERSIGN_PRODUCTION_COMPLETE.md"
echo "  • Node.js SDK:                 nodejs-sdk/README.md"
echo ""
echo "🛠️  Management Commands:"
echo "  • View logs:                   $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo "  • Stop services:               $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo "  • Restart services:            $DOCKER_COMPOSE -f $COMPOSE_FILE restart"
echo "  • Update services:             $DOCKER_COMPOSE -f $COMPOSE_FILE pull && $DOCKER_COMPOSE -f $COMPOSE_FILE up -d"
echo ""

if [ "$DEPLOY_MODE" != "1" ]; then
    print_warning "Production Checklist:"
    echo "  □ Configure AWS credentials and KMS key"
    echo "  □ Set up QLDB ledger for provenance tracking"
    echo "  □ Configure LLM provider API keys"
    echo "  □ Set up SSL certificates for HTTPS"
    echo "  □ Configure monitoring and alerting"
    echo "  □ Review security settings in .env file"
    echo ""
fi

print_status "AetherGuard AI Gateway setup complete!"
print_info "Check the logs if any services are not responding: $DOCKER_COMPOSE -f $COMPOSE_FILE logs"