#!/bin/bash
# ============================================================================
# AgentPay Health Check Script
# ============================================================================
# Comprehensive health check for all AgentPay services
# Usage: ./scripts/healthcheck.sh [api_url]
# Example: ./scripts/healthcheck.sh https://api.yourdomain.com
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
API_URL="${1:-http://localhost:8000}"
TIMEOUT=10

# ============================================================================
# Helper functions
# ============================================================================
pass() {
    echo -e "${GREEN}✓${NC} $1"
}

fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=1
}

warn() {
    echo -e "${YELLOW}!${NC} $1"
}

check_http() {
    local url=$1
    local expected_status=${2:-200}

    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")

    if [ "$status" = "$expected_status" ]; then
        return 0
    else
        return 1
    fi
}

check_json() {
    local url=$1
    local field=$2
    local expected=$3

    response=$(curl -s --max-time $TIMEOUT "$url" 2>/dev/null || echo "{}")
    actual=$(echo "$response" | jq -r ".$field" 2>/dev/null || echo "null")

    if [ "$actual" = "$expected" ]; then
        return 0
    else
        return 1
    fi
}

# ============================================================================
# Health checks
# ============================================================================
FAILED=0

echo "============================================================================"
echo "AgentPay Health Check"
echo "============================================================================"
echo "API URL: $API_URL"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Check 1: API Health Endpoint
echo "1. API Health Endpoint"
if check_http "$API_URL/healthz" 200; then
    pass "API is responding (200 OK)"
else
    fail "API health check failed"
fi
echo ""

# Check 2: API Version
echo "2. API Version"
if check_http "$API_URL/api" 200; then
    pass "API base endpoint accessible"
    version=$(curl -s "$API_URL/api" | jq -r '.version' 2>/dev/null || echo "unknown")
    echo "   Version: $version"
else
    fail "API base endpoint not accessible"
fi
echo ""

# Check 3: Database Connectivity
echo "3. Database Connectivity"
if check_json "$API_URL/healthz" "database" "ok"; then
    pass "Database connection OK"
else
    warn "Database health check not implemented or failing"
fi
echo ""

# Check 4: Redis Connectivity
echo "4. Redis Connectivity"
if check_json "$API_URL/healthz" "redis" "ok"; then
    pass "Redis connection OK"
else
    warn "Redis health check not implemented or failing"
fi
echo ""

# Check 5: Agent Endpoints
echo "5. Agent Endpoints"
if check_http "$API_URL/api/v1/agent/health" 200; then
    pass "Agent endpoints available"
else
    warn "Agent endpoints not available (may require authentication)"
fi
echo ""

# Check 6: WebSocket Support
echo "6. WebSocket Support"
# WebSocket check is complex, just verify endpoint exists
if curl -s --max-time $TIMEOUT -I "$API_URL/api/v1/agent/conversations/test/ws" 2>/dev/null | grep -q "426"; then
    pass "WebSocket upgrade endpoint available (426 Upgrade Required)"
else
    warn "WebSocket endpoint check inconclusive"
fi
echo ""

# Check 7: CORS Headers
echo "7. CORS Configuration"
cors_origin=$(curl -s -I "$API_URL/healthz" | grep -i "access-control-allow-origin" | cut -d' ' -f2- | tr -d '\r\n' || echo "none")
if [ "$cors_origin" != "none" ]; then
    pass "CORS headers configured"
    echo "   Origin: $cors_origin"
else
    warn "CORS headers not found (may be endpoint-specific)"
fi
echo ""

# Check 8: SSL/TLS (if HTTPS)
echo "8. SSL/TLS Configuration"
if [[ $API_URL == https* ]]; then
    if curl -s --max-time $TIMEOUT "$API_URL/healthz" > /dev/null 2>&1; then
        pass "SSL/TLS certificate valid"

        # Check certificate expiry
        expiry=$(echo | openssl s_client -servername "$(echo $API_URL | cut -d'/' -f3)" -connect "$(echo $API_URL | cut -d'/' -f3):443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d'=' -f2)
        if [ -n "$expiry" ]; then
            echo "   Expires: $expiry"
        fi
    else
        fail "SSL/TLS certificate invalid or expired"
    fi
else
    warn "API not using HTTPS (not recommended for production)"
fi
echo ""

# Check 9: Response Time
echo "9. Response Time"
start_time=$(date +%s%N)
curl -s --max-time $TIMEOUT "$API_URL/healthz" > /dev/null 2>&1
end_time=$(date +%s%N)
response_time=$(( (end_time - start_time) / 1000000 ))

if [ $response_time -lt 500 ]; then
    pass "Response time: ${response_time}ms (excellent)"
elif [ $response_time -lt 1000 ]; then
    pass "Response time: ${response_time}ms (good)"
elif [ $response_time -lt 2000 ]; then
    warn "Response time: ${response_time}ms (acceptable)"
else
    fail "Response time: ${response_time}ms (too slow)"
fi
echo ""

# Check 10: Rate Limiting
echo "10. Rate Limiting"
rate_limit=$(curl -s -I "$API_URL/healthz" | grep -i "x-ratelimit-limit" | cut -d' ' -f2- | tr -d '\r\n' || echo "none")
if [ "$rate_limit" != "none" ]; then
    pass "Rate limiting configured"
    echo "   Limit: $rate_limit"
else
    warn "Rate limiting headers not found (may not be implemented)"
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "============================================================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All health checks passed${NC}"
    echo "============================================================================"
    exit 0
else
    echo -e "${RED}✗ Some health checks failed${NC}"
    echo "============================================================================"
    exit 1
fi
