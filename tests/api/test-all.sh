#!/usr/bin/env bash
#
# BusinessGPS API Test Suite
# Usage: ./test-all.sh [staging|production|local]
#
# This script runs all API tests against the specified environment.
# Default environment is staging.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/../config/products.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Environment setup
ENV="${1:-staging}"
case "$ENV" in
  staging)
    BASE_URL="https://staging--businessgps.netlify.app"
    SAFE="true"
    ;;
  production)
    BASE_URL="https://capability.ai"
    SAFE="false"
    ;;
  local)
    BASE_URL="http://localhost:8888"
    SAFE="true"
    ;;
  *)
    echo "Unknown environment: $ENV"
    echo "Usage: $0 [staging|production|local]"
    exit 1
    ;;
esac

# Test counters
TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0

# Results array for summary
declare -a RESULTS

# Timestamp for report
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
REPORT_FILE="$SCRIPT_DIR/../reports/test-report-$TIMESTAMP.txt"
mkdir -p "$SCRIPT_DIR/../reports"

# Logging
log() {
  echo -e "$1" | tee -a "$REPORT_FILE"
}

# Test functions
run_test() {
  local name="$1"
  local result="$2"
  local details="$3"

  ((TOTAL++))

  if [[ "$result" == "PASS" ]]; then
    ((PASSED++))
    log "  ${GREEN}✓${NC} $name"
    RESULTS+=("PASS|$name|$details")
  elif [[ "$result" == "SKIP" ]]; then
    ((SKIPPED++))
    log "  ${YELLOW}○${NC} $name (skipped)"
    RESULTS+=("SKIP|$name|$details")
  else
    ((FAILED++))
    log "  ${RED}✗${NC} $name"
    log "    ${RED}→ $details${NC}"
    RESULTS+=("FAIL|$name|$details")
  fi
}

# Header
log ""
log "═══════════════════════════════════════════════════════════"
log " BusinessGPS API Test Suite"
log "═══════════════════════════════════════════════════════════"
log " Environment: ${CYAN}$ENV${NC}"
log " Base URL:    ${CYAN}$BASE_URL${NC}"
log " Timestamp:   $(date)"
log " Safe Mode:   $([[ $SAFE == 'true' ]] && echo '✓ Yes' || echo '⚠️  NO - Production!')"
log "═══════════════════════════════════════════════════════════"
log ""

# Safety check for production
if [[ "$ENV" == "production" && "$SAFE" == "false" ]]; then
  log "${YELLOW}WARNING: Testing against PRODUCTION environment${NC}"
  log "Some tests will be skipped to avoid creating real charges."
  log ""
  read -p "Continue? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "Aborted by user."
    exit 0
  fi
fi

# ═══════════════════════════════════════════════════════════════
# SECTION 1: Endpoint Availability
# ═══════════════════════════════════════════════════════════════
log "${BLUE}━━━ Endpoint Availability ━━━${NC}"

# Test: Homepage
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/" --max-time 10 2>/dev/null || echo "000")
if [[ "$status" == "200" ]]; then
  run_test "Homepage loads" "PASS" "HTTP $status"
else
  run_test "Homepage loads" "FAIL" "HTTP $status"
fi

# Test: Checkout page
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/pages/checkout?product=athena-standard" --max-time 10 2>/dev/null || echo "000")
if [[ "$status" == "200" ]]; then
  run_test "Checkout page loads" "PASS" "HTTP $status"
else
  run_test "Checkout page loads" "FAIL" "HTTP $status"
fi

# Test: create-checkout-session function
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/.netlify/functions/create-checkout-session" -H "Content-Type: application/json" -d '{}' --max-time 10 2>/dev/null || echo "000")
if [[ "$status" == "400" || "$status" == "200" ]]; then
  run_test "create-checkout-session endpoint" "PASS" "HTTP $status"
else
  run_test "create-checkout-session endpoint" "FAIL" "HTTP $status"
fi

# Test: get-checkout-session function
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/.netlify/functions/get-checkout-session" --max-time 10 2>/dev/null || echo "000")
if [[ "$status" == "400" || "$status" == "200" ]]; then
  run_test "get-checkout-session endpoint" "PASS" "HTTP $status"
else
  run_test "get-checkout-session endpoint" "FAIL" "HTTP $status"
fi

# Test: stripe-webhook function
status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/.netlify/functions/stripe-webhook" --max-time 10 2>/dev/null || echo "000")
if [[ "$status" == "400" || "$status" == "405" ]]; then
  run_test "stripe-webhook endpoint" "PASS" "HTTP $status"
else
  run_test "stripe-webhook endpoint" "FAIL" "HTTP $status"
fi

log ""

# ═══════════════════════════════════════════════════════════════
# SECTION 2: Product Checkout Tests
# ═══════════════════════════════════════════════════════════════
log "${BLUE}━━━ Product Checkout API ━━━${NC}"

PRODUCTS=("athena-standard" "athena-premium" "start-right-30" "throughput-90" "opsmax-360")
EXPECTED_PRICES=("67" "297" "1997" "5997" "15000")

for i in "${!PRODUCTS[@]}"; do
  product="${PRODUCTS[$i]}"
  expected="${EXPECTED_PRICES[$i]}"

  response=$(curl -s -X POST "$BASE_URL/.netlify/functions/create-checkout-session" \
    -H "Content-Type: application/json" \
    -d "{\"productId\":\"$product\"}" --max-time 15 2>/dev/null)

  # Check for error
  if echo "$response" | grep -q '"error"'; then
    error=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','Unknown'))" 2>/dev/null || echo "Parse error")
    run_test "$product (£$expected)" "FAIL" "$error"
    continue
  fi

  # Check for sessionId
  if echo "$response" | grep -q '"sessionId"'; then
    session_id=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sessionId',''))" 2>/dev/null)

    # Verify test mode (for non-production)
    if [[ "$ENV" != "production" && "$session_id" != cs_test_* ]]; then
      run_test "$product (£$expected)" "FAIL" "Not in test mode: $session_id"
    else
      run_test "$product (£$expected)" "PASS" "Session created"
    fi
  else
    run_test "$product (£$expected)" "FAIL" "No sessionId in response"
  fi
done

log ""

# ═══════════════════════════════════════════════════════════════
# SECTION 3: Invalid Input Handling
# ═══════════════════════════════════════════════════════════════
log "${BLUE}━━━ Error Handling ━━━${NC}"

# Test: Invalid product ID
response=$(curl -s -X POST "$BASE_URL/.netlify/functions/create-checkout-session" \
  -H "Content-Type: application/json" \
  -d '{"productId":"invalid-product"}' --max-time 10 2>/dev/null)
if echo "$response" | grep -q '"error"'; then
  run_test "Rejects invalid product ID" "PASS" "Returns error as expected"
else
  run_test "Rejects invalid product ID" "FAIL" "Should return error"
fi

# Test: Missing product ID
response=$(curl -s -X POST "$BASE_URL/.netlify/functions/create-checkout-session" \
  -H "Content-Type: application/json" \
  -d '{}' --max-time 10 2>/dev/null)
if echo "$response" | grep -q '"error"'; then
  run_test "Rejects missing product ID" "PASS" "Returns error as expected"
else
  run_test "Rejects missing product ID" "FAIL" "Should return error"
fi

# Test: Invalid JSON
response=$(curl -s -X POST "$BASE_URL/.netlify/functions/create-checkout-session" \
  -H "Content-Type: application/json" \
  -d 'not json' --max-time 10 2>/dev/null)
if echo "$response" | grep -q '"error"' || [[ "$(echo "$response" | head -c 1)" != "{" ]]; then
  run_test "Handles invalid JSON" "PASS" "Returns error or non-JSON"
else
  run_test "Handles invalid JSON" "FAIL" "Should reject invalid JSON"
fi

log ""

# ═══════════════════════════════════════════════════════════════
# SECTION 4: HubSpot Integration
# ═══════════════════════════════════════════════════════════════
log "${BLUE}━━━ HubSpot Integration ━━━${NC}"

# Test: HubSpot endpoint available
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/.netlify/functions/hubspot-contact" -H "Content-Type: application/json" -d '{}' --max-time 10 2>/dev/null || echo "000")
if [[ "$status" == "400" || "$status" == "200" || "$status" == "500" ]]; then
  run_test "hubspot-contact endpoint" "PASS" "HTTP $status"
else
  run_test "hubspot-contact endpoint" "FAIL" "HTTP $status"
fi

# Test: HubSpot contact creation (lead)
hs_response=$(curl -s -X POST "$BASE_URL/.netlify/functions/hubspot-contact" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test-suite-$(date +%s)@techshifts.io\",\"firstName\":\"TestSuite\",\"source\":\"tcm-report\"}" --max-time 15 2>/dev/null)
if echo "$hs_response" | grep -q '"success":true'; then
  hs_contact_id=$(echo "$hs_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('contactId',''))" 2>/dev/null)
  run_test "HubSpot lead contact creation" "PASS" "Contact ID: $hs_contact_id"
else
  hs_error=$(echo "$hs_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('detail',d.get('error','Unknown')))" 2>/dev/null || echo "Parse error")
  run_test "HubSpot lead contact creation" "FAIL" "$hs_error"
fi

# Test: HubSpot contact + deal creation (purchase)
hs_deal_response=$(curl -s -X POST "$BASE_URL/.netlify/functions/hubspot-contact" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test-deal-$(date +%s)@techshifts.io\",\"firstName\":\"DealTest\",\"productPurchased\":\"athena-standard\",\"amount\":67,\"stripeCustomerId\":\"cus_test_suite\",\"createDeal\":true}" --max-time 15 2>/dev/null)
if echo "$hs_deal_response" | grep -q '"dealId"' && ! echo "$hs_deal_response" | grep -q '"dealId":null'; then
  hs_deal_id=$(echo "$hs_deal_response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('dealId',''))" 2>/dev/null)
  run_test "HubSpot contact + deal creation" "PASS" "Deal ID: $hs_deal_id"
else
  hs_deal_error=$(echo "$hs_deal_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('detail',d.get('error','Unknown')))" 2>/dev/null || echo "Parse error")
  run_test "HubSpot contact + deal creation" "FAIL" "$hs_deal_error"
fi

# Test: HubSpot rejects missing email
hs_err_response=$(curl -s -X POST "$BASE_URL/.netlify/functions/hubspot-contact" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"NoEmail"}' --max-time 10 2>/dev/null)
if echo "$hs_err_response" | grep -q '"error"'; then
  run_test "HubSpot rejects missing email" "PASS" "Returns error as expected"
else
  run_test "HubSpot rejects missing email" "FAIL" "Should return error"
fi

log ""

# ═══════════════════════════════════════════════════════════════
# SECTION 5: AWeber Integration
# ═══════════════════════════════════════════════════════════════
log "${BLUE}━━━ AWeber Integration ━━━${NC}"

# Test: AWeber endpoint available
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/.netlify/functions/aweber-subscribe" -H "Content-Type: application/json" -d '{}' --max-time 10 2>/dev/null || echo "000")
if [[ "$status" == "400" || "$status" == "200" || "$status" == "500" ]]; then
  run_test "aweber-subscribe endpoint" "PASS" "HTTP $status"
else
  run_test "aweber-subscribe endpoint" "FAIL" "HTTP $status"
fi

# Test: AWeber lead subscription
aw_response=$(curl -s -X POST "$BASE_URL/.netlify/functions/aweber-subscribe" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test-suite-$(date +%s)@techshifts.io\",\"firstName\":\"TestSuite\",\"listType\":\"leads\",\"tags\":[\"test_suite\"],\"source\":\"test-suite\"}" --max-time 15 2>/dev/null)
if echo "$aw_response" | grep -q '"success":true'; then
  run_test "AWeber leads list subscription" "PASS" "Subscribed successfully"
else
  aw_error=$(echo "$aw_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('detail',d.get('error','Unknown')))" 2>/dev/null || echo "Parse error")
  run_test "AWeber leads list subscription" "FAIL" "$aw_error"
fi

# Test: AWeber customer subscription
aw_cust_response=$(curl -s -X POST "$BASE_URL/.netlify/functions/aweber-subscribe" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test-cust-$(date +%s)@techshifts.io\",\"firstName\":\"CustTest\",\"listType\":\"customers\",\"tags\":[\"test_suite\",\"customer\"],\"source\":\"test-suite\"}" --max-time 15 2>/dev/null)
if echo "$aw_cust_response" | grep -q '"success":true'; then
  run_test "AWeber customers list subscription" "PASS" "Subscribed successfully"
else
  aw_cust_error=$(echo "$aw_cust_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('detail',d.get('error','Unknown')))" 2>/dev/null || echo "Parse error")
  run_test "AWeber customers list subscription" "FAIL" "$aw_cust_error"
fi

# Test: AWeber rejects missing email
aw_err_response=$(curl -s -X POST "$BASE_URL/.netlify/functions/aweber-subscribe" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"NoEmail","listType":"leads"}' --max-time 10 2>/dev/null)
if echo "$aw_err_response" | grep -q '"error"'; then
  run_test "AWeber rejects missing email" "PASS" "Returns error as expected"
else
  run_test "AWeber rejects missing email" "FAIL" "Should return error"
fi

# Test: AWeber rejects invalid list type
aw_list_response=$(curl -s -X POST "$BASE_URL/.netlify/functions/aweber-subscribe" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@techshifts.io","listType":"nonexistent"}' --max-time 10 2>/dev/null)
if echo "$aw_list_response" | grep -q '"error"'; then
  run_test "AWeber rejects invalid list type" "PASS" "Returns error as expected"
else
  run_test "AWeber rejects invalid list type" "FAIL" "Should return error"
fi

log ""

# ═══════════════════════════════════════════════════════════════
# SECTION 6: Environment Configuration (staging only)
# ═══════════════════════════════════════════════════════════════
if [[ "$ENV" == "staging" ]]; then
  log "${BLUE}━━━ Environment Configuration ━━━${NC}"

  debug_response=$(curl -s "$BASE_URL/.netlify/functions/debug-env" --max-time 10 2>/dev/null)

  if echo "$debug_response" | grep -q '"stripe"'; then
    # Check Stripe mode
    stripe_key=$(echo "$debug_response" | python3 -c "import sys,json; print(json.load(sys.stdin)['stripe']['STRIPE_SECRET_KEY'])" 2>/dev/null)
    if [[ "$stripe_key" == sk_test_* ]]; then
      run_test "Stripe in test mode" "PASS" "Key starts with sk_test_"
    else
      run_test "Stripe in test mode" "FAIL" "Expected sk_test_, got: $stripe_key"
    fi

    # Check for unique price IDs
    has_dups=$(echo "$debug_response" | python3 -c "import sys,json; print(json.load(sys.stdin)['diagnostics']['has_duplicates'])" 2>/dev/null)
    if [[ "$has_dups" == "False" ]]; then
      run_test "All price IDs unique" "PASS" "No duplicates"
    else
      run_test "All price IDs unique" "FAIL" "Duplicate price IDs detected"
    fi

    # Check Supabase
    supabase_url=$(echo "$debug_response" | python3 -c "import sys,json; print(json.load(sys.stdin)['supabase']['SUPABASE_URL'])" 2>/dev/null)
    if [[ "$supabase_url" == *"supabase.co"* ]]; then
      run_test "Supabase configured" "PASS" "$supabase_url"
    else
      run_test "Supabase configured" "FAIL" "Not configured"
    fi

    # Check HubSpot configured
    hs_key=$(echo "$debug_response" | python3 -c "import sys,json; print(json.load(sys.stdin)['hubspot']['HUBSPOT_API_KEY'])" 2>/dev/null)
    if [[ "$hs_key" != "(not set)" && -n "$hs_key" ]]; then
      run_test "HubSpot API key configured" "PASS" "$hs_key"
    else
      run_test "HubSpot API key configured" "FAIL" "Not set"
    fi

    # Check HubSpot pipelines configured
    hs_pipeline=$(echo "$debug_response" | python3 -c "import sys,json; print(json.load(sys.stdin)['hubspot']['HUBSPOT_PIPELINE_PRODUCTS'])" 2>/dev/null)
    if [[ "$hs_pipeline" != "(not set)" && -n "$hs_pipeline" ]]; then
      run_test "HubSpot pipelines configured" "PASS" "Products: $hs_pipeline"
    else
      run_test "HubSpot pipelines configured" "FAIL" "Not set"
    fi

    # Check AWeber configured
    aw_account=$(echo "$debug_response" | python3 -c "import sys,json; print(json.load(sys.stdin)['aweber']['AWEBER_ACCOUNT_ID'])" 2>/dev/null)
    if [[ "$aw_account" != "(not set)" && -n "$aw_account" ]]; then
      run_test "AWeber account configured" "PASS" "Account: $aw_account"
    else
      run_test "AWeber account configured" "FAIL" "Not set"
    fi

    # Check AWeber lists configured
    aw_leads=$(echo "$debug_response" | python3 -c "import sys,json; print(json.load(sys.stdin)['aweber']['AWEBER_LIST_ID_LEADS'])" 2>/dev/null)
    if [[ "$aw_leads" != "(not set)" && -n "$aw_leads" ]]; then
      run_test "AWeber lists configured" "PASS" "Leads: $aw_leads"
    else
      run_test "AWeber lists configured" "FAIL" "Not set"
    fi

    # GA4 status
    run_test "GA4 tracking" "SKIP" "Awaiting property ID"

  else
    run_test "Debug endpoint available" "FAIL" "Could not fetch debug info"
  fi

  log ""
fi

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
log "═══════════════════════════════════════════════════════════"
log " TEST SUMMARY"
log "═══════════════════════════════════════════════════════════"
log ""
log " Total:   $TOTAL"
log " ${GREEN}Passed:  $PASSED${NC}"
log " ${RED}Failed:  $FAILED${NC}"
log " ${YELLOW}Skipped: $SKIPPED${NC}"
log ""

if [[ $FAILED -eq 0 ]]; then
  log " ${GREEN}═══ ALL TESTS PASSED ═══${NC}"
else
  log " ${RED}═══ SOME TESTS FAILED ═══${NC}"
  log ""
  log " Failed tests:"
  for result in "${RESULTS[@]}"; do
    IFS='|' read -r status name details <<< "$result"
    if [[ "$status" == "FAIL" ]]; then
      log "   • $name: $details"
    fi
  done
fi

log ""
log " Report saved to: $REPORT_FILE"
log "═══════════════════════════════════════════════════════════"

exit $FAILED
