#!/bin/bash

# AetherGuard Backend API - Comprehensive Test Script
# Tests all admin and tenant endpoints

set -e

API_URL="http://localhost:8081"
ADMIN_EMAIL="admin@aetherguard.ai"
ADMIN_PASSWORD="admin123"
TENANT_EMAIL="test@aetherguard.ai"
TENANT_PASSWORD="testpass123"

echo "🧪 AetherGuard Backend API - Comprehensive Test Suite"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Helper function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local token=$5
    local expected_status=${6:-200}
    
    echo -n "Testing: $name... "
    
    if [ -z "$token" ]; then
        if [ -z "$data" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data")
        fi
    else
        if [ -z "$data" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
                -H "Authorization: Bearer $token")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data")
        fi
    fi
    
    status_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $status_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        echo "Response: $body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "📋 Phase 1: Health Checks"
echo "-------------------------"
test_endpoint "Health Check" "GET" "/health"
test_endpoint "Root Endpoint" "GET" "/"
echo ""

echo "🔐 Phase 2: Admin Authentication"
echo "--------------------------------"
# Admin Login
echo -n "Admin Login... "
admin_response=$(curl -s -X POST "$API_URL/api/admin/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

ADMIN_TOKEN=$(echo $admin_response | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null || echo "")

if [ -n "$ADMIN_TOKEN" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Response: $admin_response"
    FAILED=$((FAILED + 1))
fi

test_endpoint "Get Admin Info" "GET" "/api/admin/auth/me" "" "$ADMIN_TOKEN"
echo ""

echo "👥 Phase 3: Admin - Tenant Management"
echo "-------------------------------------"
test_endpoint "List Tenants" "GET" "/api/admin/tenants" "" "$ADMIN_TOKEN"
test_endpoint "List Tenants (Page 1)" "GET" "/api/admin/tenants?page=1&page_size=10" "" "$ADMIN_TOKEN"
echo ""

echo "📊 Phase 4: Admin - System Analytics"
echo "------------------------------------"
test_endpoint "System Overview" "GET" "/api/admin/analytics/overview" "" "$ADMIN_TOKEN"
test_endpoint "System Usage" "GET" "/api/admin/analytics/usage?days=7" "" "$ADMIN_TOKEN"
test_endpoint "System Security" "GET" "/api/admin/analytics/security?days=7" "" "$ADMIN_TOKEN"
test_endpoint "Top Tenants" "GET" "/api/admin/analytics/tenants/top?metric=requests&limit=10" "" "$ADMIN_TOKEN"
echo ""

echo "🔑 Phase 5: Admin - API Keys Management"
echo "---------------------------------------"
test_endpoint "List All API Keys" "GET" "/api/admin/api-keys" "" "$ADMIN_TOKEN"
echo ""

echo "🔐 Phase 6: Tenant Authentication"
echo "---------------------------------"
# Try tenant login (may fail if user doesn't exist)
echo -n "Tenant Login... "
tenant_response=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TENANT_EMAIL\",\"password\":\"$TENANT_PASSWORD\"}")

TENANT_TOKEN=$(echo $tenant_response | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null || echo "")

if [ -n "$TENANT_TOKEN" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    PASSED=$((PASSED + 1))
    
    test_endpoint "Get Tenant Info" "GET" "/api/auth/me" "" "$TENANT_TOKEN"
    echo ""
    
    echo "🔧 Phase 7: LLM Providers"
    echo "------------------------"
    test_endpoint "List LLM Providers" "GET" "/api/llm-providers" "" "$TENANT_TOKEN"
    test_endpoint "Get Default Policies" "GET" "/api/policies/defaults" "" "$TENANT_TOKEN"
    echo ""
    
    echo "📋 Phase 8: Policies"
    echo "-------------------"
    test_endpoint "Get All Policies" "GET" "/api/policies" "" "$TENANT_TOKEN"
    echo ""
    
    echo "📊 Phase 9: Analytics"
    echo "--------------------"
    test_endpoint "Usage Analytics" "GET" "/api/analytics/usage?days=7" "" "$TENANT_TOKEN"
    test_endpoint "Security Analytics" "GET" "/api/analytics/security?days=7" "" "$TENANT_TOKEN"
    test_endpoint "Cost Analytics" "GET" "/api/analytics/costs?days=30" "" "$TENANT_TOKEN"
    echo ""
    
    echo "🔑 Phase 10: API Keys"
    echo "--------------------"
    test_endpoint "List API Keys" "GET" "/api/api-keys" "" "$TENANT_TOKEN"
    echo ""
else
    echo -e "${YELLOW}⚠ SKIP${NC} (Tenant user not configured)"
    echo "Response: $tenant_response"
    echo ""
    echo -e "${YELLOW}Skipping tenant endpoint tests...${NC}"
    echo ""
fi

echo "🔒 Phase 11: Authorization Tests"
echo "--------------------------------"
# FastAPI returns 403 for missing auth, which is acceptable
test_endpoint "Policies without auth" "GET" "/api/policies" "" "" 403
test_endpoint "LLM Providers without auth" "GET" "/api/llm-providers" "" "" 403
test_endpoint "Analytics without auth" "GET" "/api/analytics/usage" "" "" 403
echo ""

echo "=================================================="
echo "📊 Test Results Summary"
echo "=================================================="
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
