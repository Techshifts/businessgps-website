#!/usr/bin/env bash
# BusinessGPS Checkout Integration Test Suite
# Tests staging environment for correct configuration

STAGING_URL="https://staging--businessgps.netlify.app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track results
TESTS_PASSED=0
TESTS_FAILED=0

echo "========================================"
echo "BusinessGPS Checkout Test Suite"
echo "========================================"
echo "Staging URL: $STAGING_URL"
echo "Testing at: $(date)"
echo ""

# Function to test a product
test_product() {
    local product=$1
    local expected_price_display=$2

    printf "  %-20s " "$product"

    # Call the checkout API
    response=$(curl -s -X POST "$STAGING_URL/.netlify/functions/create-checkout-session" \
        -H "Content-Type: application/json" \
        -d "{\"productId\":\"$product\"}" 2>&1)

    # Check for errors
    if echo "$response" | grep -q '"error"'; then
        error=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error','Unknown'))" 2>/dev/null || echo "Parse error")
        printf "${RED}FAIL${NC} - %s\n" "$error"
        ((TESTS_FAILED++))
        return 1
    fi

    # Check for sessionId
    if ! echo "$response" | grep -q '"sessionId"'; then
        printf "${RED}FAIL${NC} - No sessionId\n"
        ((TESTS_FAILED++))
        return 1
    fi

    # Extract session ID
    session_id=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sessionId',''))" 2>/dev/null)

    # Verify it's a test session
    if [[ "$session_id" != cs_test_* ]]; then
        printf "${YELLOW}WARN${NC} - Not test mode!\n"
        ((TESTS_FAILED++))
        return 1
    fi

    printf "${GREEN}PASS${NC} (expected: %s)\n" "$expected_price_display"
    ((TESTS_PASSED++))
    return 0
}

# Test endpoint exists
test_endpoint() {
    local name=$1
    local endpoint=$2
    local method=${3:-GET}

    printf "  %-30s " "$name"

    if [[ "$method" == "POST" ]]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$STAGING_URL$endpoint" -H "Content-Type: application/json" -d '{}')
    else
        status=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL$endpoint")
    fi

    if [[ "$status" -ge 200 ]] && [[ "$status" -lt 500 ]]; then
        printf "${GREEN}PASS${NC} (HTTP %s)\n" "$status"
        ((TESTS_PASSED++))
        return 0
    else
        printf "${RED}FAIL${NC} (HTTP %s)\n" "$status"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "--- Endpoint Tests ---"
test_endpoint "create-checkout-session" "/.netlify/functions/create-checkout-session" "POST"
test_endpoint "get-checkout-session" "/.netlify/functions/get-checkout-session"
test_endpoint "stripe-webhook" "/.netlify/functions/stripe-webhook"

echo ""
echo "--- Product Checkout Tests ---"
test_product "athena-standard" "£67"
test_product "athena-premium" "£297"
test_product "start-right-30" "£1,997"
test_product "throughput-90" "£5,997"
test_product "opsmax-360" "£15,000"

echo ""
echo "--- Environment Debug ---"
echo "Fetching environment config from function logs..."

# Make a request and parse any debug info
debug_response=$(curl -s -X POST "$STAGING_URL/.netlify/functions/create-checkout-session" \
    -H "Content-Type: application/json" \
    -d '{"productId":"athena-standard"}' 2>&1)

echo ""
echo "========================================"
echo "TEST SUMMARY"
echo "========================================"
printf "Passed: ${GREEN}%d${NC}\n" "$TESTS_PASSED"
printf "Failed: ${RED}%d${NC}\n" "$TESTS_FAILED"

echo ""
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All API tests passed!${NC}"
else
    echo -e "${RED}Some tests failed - see above${NC}"
fi

echo ""
echo "--- Manual Verification Required ---"
echo "1. Check Netlify → Functions → create-checkout-session → Logs"
echo "   Look for 'Redirect URL config' to see which URL is being used"
echo ""
echo "2. Complete a test checkout and verify:"
echo "   - Price shown matches expected"
echo "   - Thank-you page stays on staging (not capability.ai)"
echo ""

exit $TESTS_FAILED
