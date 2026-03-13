#!/bin/bash

# AetherGuard - Credentials and Secrets Scanner
# Scans codebase for hardcoded credentials, API keys, and sensitive data

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         AetherGuard Credentials Security Scanner          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

ISSUES_FOUND=0
WARNINGS_FOUND=0

# Function to scan for pattern
scan_pattern() {
    local description=$1
    local pattern=$2
    local severity=$3
    local exclude_pattern=${4:-""}
    
    echo -e "\n${BLUE}Scanning: $description${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    local results
    if [ -n "$exclude_pattern" ]; then
        results=$(grep -r -n -E "$pattern" \
            --exclude-dir={node_modules,target,dist,build,.git,__pycache__,env,venv} \
            --exclude={"*.log","*.md","*.lock","*.json","*.toml","*.yml","*.yaml"} \
            . 2>/dev/null | grep -v -E "$exclude_pattern" || true)
    else
        results=$(grep -r -n -E "$pattern" \
            --exclude-dir={node_modules,target,dist,build,.git,__pycache__,env,venv} \
            --exclude={"*.log","*.md","*.lock","*.json","*.toml","*.yml","*.yaml"} \
            . 2>/dev/null || true)
    fi
    
    if [ -n "$results" ]; then
        if [ "$severity" = "HIGH" ]; then
            echo -e "${RED}✗ CRITICAL: Found potential issues${NC}"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        else
            echo -e "${YELLOW}⚠ WARNING: Found potential issues${NC}"
            WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
        fi
        echo "$results" | head -20
        local count=$(echo "$results" | wc -l)
        if [ $count -gt 20 ]; then
            echo -e "${YELLOW}... and $((count - 20)) more occurrences${NC}"
        fi
    else
        echo -e "${GREEN}✓ No issues found${NC}"
    fi
}

# 1. Scan for hardcoded API keys
scan_pattern \
    "Hardcoded API Keys (sk-, api_key, apiKey)" \
    "(sk-[a-zA-Z0-9]{32,}|['\"]api_key['\"]\\s*[:=]\\s*['\"][^'\"]+['\"]|apiKey\\s*=\\s*['\"][^'\"]+['\"])" \
    "HIGH" \
    "(validateApiKey|example|test|mock|placeholder)"

# 2. Scan for hardcoded passwords
scan_pattern \
    "Hardcoded Passwords" \
    "(password\\s*=\\s*['\"][^'\"]+['\"]|PASSWORD\\s*=\\s*['\"][^'\"]+['\"])" \
    "HIGH" \
    "(getenv|process\\.env|os\\.environ|example|test|placeholder|your-password)"

# 3. Scan for AWS credentials
scan_pattern \
    "AWS Access Keys" \
    "(AKIA[0-9A-Z]{16}|aws_access_key_id\\s*=\\s*['\"][^'\"]+['\"])" \
    "HIGH" \
    "(example|placeholder|your-aws)"

# 4. Scan for JWT secrets
scan_pattern \
    "JWT Secrets" \
    "(jwt_secret\\s*=\\s*['\"][^'\"]+['\"]|JWT_SECRET\\s*=\\s*['\"][^'\"]+['\"])" \
    "HIGH" \
    "(getenv|process\\.env|os\\.environ|example|your-jwt)"

# 5. Scan for database credentials
scan_pattern \
    "Database Connection Strings" \
    "(postgresql://[^\\s]+:[^\\s]+@|mysql://[^\\s]+:[^\\s]+@|mongodb://[^\\s]+:[^\\s]+@)" \
    "HIGH" \
    "(example|localhost|DATABASE_URL|getenv)"

# 6. Scan for private keys
scan_pattern \
    "Private Keys" \
    "(-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----)" \
    "HIGH" \
    ""

# 7. Scan for hardcoded tokens
scan_pattern \
    "Bearer Tokens" \
    "(Bearer [a-zA-Z0-9\\-._~+/]+=*)" \
    "MEDIUM" \
    "(example|test|mock|Authorization)"

# 8. Scan for hardcoded model names
scan_pattern \
    "Hardcoded Model Names" \
    "(model['\"]?\\s*[:=]\\s*['\"]gpt-[34]|model['\"]?\\s*[:=]\\s*['\"]claude-[23])" \
    "LOW" \
    "(DEFAULT_MODEL|process\\.env|os\\.getenv|example|test)"

# 9. Scan for email credentials
scan_pattern \
    "SMTP Credentials" \
    "(smtp_password\\s*=\\s*['\"][^'\"]+['\"]|SMTP_PASSWORD\\s*=\\s*['\"][^'\"]+['\"])" \
    "MEDIUM" \
    "(getenv|process\\.env|os\\.environ|example|your-app-password)"

# 10. Scan for encryption keys
scan_pattern \
    "Encryption Keys" \
    "(encryption_key\\s*=\\s*['\"][^'\"]+['\"]|ENCRYPTION_KEY\\s*=\\s*['\"][^'\"]+['\"])" \
    "HIGH" \
    "(getenv|process\\.env|os\\.environ|example|your-encryption)"

# Check environment files
echo -e "\n${BLUE}Checking Environment Files${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env file exists (should be in .gitignore)${NC}"
    if git check-ignore .env > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ .env is properly ignored by git${NC}"
    else
        echo -e "${RED}  ✗ .env is NOT ignored by git!${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    echo -e "${GREEN}✓ No .env file in root (good)${NC}"
fi

if [ -f ".env.example" ]; then
    echo -e "${GREEN}✓ .env.example exists (good for documentation)${NC}"
    
    # Check if .env.example contains actual secrets
    if grep -q -E "(sk-[a-zA-Z0-9]{32,}|AKIA[0-9A-Z]{16})" .env.example; then
        echo -e "${RED}  ✗ .env.example contains actual secrets!${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "${GREEN}  ✓ .env.example contains only placeholders${NC}"
    fi
fi

if [ -f ".env.test" ]; then
    echo -e "${GREEN}✓ .env.test exists${NC}"
    if git check-ignore .env.test > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ .env.test is properly ignored by git${NC}"
    else
        echo -e "${YELLOW}  ⚠ .env.test is NOT ignored by git${NC}"
        WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
    fi
fi

# Check for exposed secrets in git history
echo -e "\n${BLUE}Checking Git History${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Scanning git history for potential secrets..."
    
    # Check for .env files in history
    if git log --all --full-history -- ".env" | grep -q "commit"; then
        echo -e "${YELLOW}⚠ .env file found in git history${NC}"
        echo "  Consider using git-filter-branch or BFG Repo-Cleaner to remove it"
        WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
    else
        echo -e "${GREEN}✓ No .env file in git history${NC}"
    fi
    
    # Check for potential API keys in commits
    if git log --all -p | grep -q -E "(sk-[a-zA-Z0-9]{32,}|AKIA[0-9A-Z]{16})"; then
        echo -e "${RED}✗ Potential API keys found in git history!${NC}"
        echo "  This is a CRITICAL security issue"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "${GREEN}✓ No obvious API keys in git history${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Not a git repository${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Scan Results Summary                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Critical Issues:  ${RED}$ISSUES_FOUND${NC}"
echo -e "Warnings:         ${YELLOW}$WARNINGS_FOUND${NC}"
echo ""

if [ $ISSUES_FOUND -eq 0 ] && [ $WARNINGS_FOUND -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              ✓ NO SECURITY ISSUES FOUND!                   ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Your codebase appears to be secure. All credentials are properly"
    echo "externalized to environment variables."
    exit 0
elif [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║            ⚠ WARNINGS FOUND - REVIEW NEEDED                ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Some potential issues were found. Please review the warnings above."
    echo "These are typically low-risk items but should be addressed."
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║          ✗ CRITICAL ISSUES FOUND - ACTION REQUIRED         ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "CRITICAL security issues were found in your codebase!"
    echo "Please review and fix the issues above immediately."
    echo ""
    echo "Recommendations:"
    echo "1. Remove any hardcoded credentials from source code"
    echo "2. Use environment variables for all sensitive data"
    echo "3. Rotate any exposed credentials immediately"
    echo "4. Review git history and remove exposed secrets"
    echo "5. Run this scan regularly as part of CI/CD"
    exit 1
fi
