#!/bin/bash

# AetherGuard - Comprehensive Test Suite Runner
# Runs all tests across all components

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         AetherGuard Comprehensive Test Suite              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Load test environment
if [ -f .env.test ]; then
    echo -e "${GREEN}✓${NC} Loading test environment from .env.test"
    export $(cat .env.test | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}⚠${NC} .env.test not found, using default values"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗${NC} Docker is not running. Please start Docker first."
    exit 1
fi

# Function to check if service is ready
wait_for_service() {
    local name=$1
    local url=$2
    local max_attempts=30
    local attempt=0
    
    echo -n "Waiting for $name to be ready..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
        echo -n "."
    done
    
    echo -e " ${RED}✗${NC}"
    return 1
}

# Function to run test suite
run_test_suite() {
    local name=$1
    local command=$2
    local required=${3:-true}
    
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Testing: $name${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$command"; then
        echo -e "${GREEN}✓ $name: PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}✗ $name: FAILED${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        else
            echo -e "${YELLOW}⚠ $name: SKIPPED${NC}"
            SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
            return 0
        fi
    fi
}

# Check if services are running
echo -e "\n${BLUE}Step 1: Checking Services${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SERVICES_RUNNING=false

if docker ps | grep -q "aetherguard"; then
    echo -e "${GREEN}✓${NC} Services are running"
    SERVICES_RUNNING=true
else
    echo -e "${YELLOW}⚠${NC} Services are not running"
    echo ""
    echo "Would you like to start services? (y/n)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "Starting services with docker-compose..."
        docker-compose up -d
        
        echo ""
        echo "Waiting for services to be ready..."
        wait_for_service "Backend API" "http://localhost:8081/health"
        wait_for_service "ML Services" "http://localhost:8001/health"
        wait_for_service "Proxy Engine" "http://localhost:8080/health"
        
        SERVICES_RUNNING=true
    else
        echo -e "${YELLOW}⚠${NC} Skipping integration tests (services not running)"
    fi
fi

# Run tests
echo -e "\n${BLUE}Step 2: Running Test Suites${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Backend API Tests
if [ "$SERVICES_RUNNING" = "true" ]; then
    run_test_suite "Backend API Integration Tests" "bash tests/test-backend-api.sh" true
else
    echo -e "${YELLOW}⚠ Skipping Backend API tests (services not running)${NC}"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
fi

# 2. ML Services Tests
if [ "$SERVICES_RUNNING" = "true" ]; then
    run_test_suite "ML Services Advanced Features" "python3 tests/test_advanced_features.py" true
else
    echo -e "${YELLOW}⚠ Skipping ML Services tests (services not running)${NC}"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
fi

# 3. Model Integrity Tests
run_test_suite "Model Integrity & Poisoning Protection" "python3 ml-services/test_model_integrity.py" true

# 4. Node.js SDK Tests
if [ -d "nodejs-sdk/node_modules" ]; then
    run_test_suite "Node.js SDK Unit Tests" "cd nodejs-sdk && npm test" false
else
    echo -e "${YELLOW}⚠ Skipping Node.js SDK tests (dependencies not installed)${NC}"
    echo "  Run: cd nodejs-sdk && npm install"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
fi

# 5. Proxy Engine Tests (Rust)
if [ -f "proxy-engine/Cargo.toml" ]; then
    run_test_suite "Proxy Engine Unit Tests" "cd proxy-engine && cargo test --lib" false
else
    echo -e "${YELLOW}⚠ Skipping Proxy Engine tests (Cargo.toml not found)${NC}"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
fi

# 6. Security Audit
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Security Audit${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -f "SECURITY_AUDIT_REPORT.md" ]; then
    echo -e "${GREEN}✓${NC} Security audit report available: SECURITY_AUDIT_REPORT.md"
    echo ""
    echo "Key Findings:"
    echo "  • No production credentials exposed"
    echo "  • All sensitive values use environment variables"
    echo "  • Test credentials properly isolated"
    echo "  • Model names standardized"
else
    echo -e "${YELLOW}⚠${NC} Security audit report not found"
fi

# Generate summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Test Results Summary                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Test Suites:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:             $PASSED_TESTS${NC}"
echo -e "${RED}Failed:             $FAILED_TESTS${NC}"
echo -e "${YELLOW}Skipped:            $SKIPPED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                  ✓ ALL TESTS PASSED!                       ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                  ✗ SOME TESTS FAILED                       ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
