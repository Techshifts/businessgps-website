#!/usr/bin/env bash
#
# BusinessGPS Deployment Pipeline
# ================================
# Runs full test suite against staging, then merges to production.
#
# Usage:
#   ./scripts/deploy-to-prod.sh              # Full pipeline: API tests + E2E + merge
#   ./scripts/deploy-to-prod.sh --api-only   # API tests only, then merge
#   ./scripts/deploy-to-prod.sh --dry-run    # Run tests but don't merge
#
# Flow:
#   1. Verify we're on staging branch
#   2. Run API test suite (bash/curl - fast, ~30s)
#   3. Run E2E integration tests (Playwright - ~60s)
#   4. If all pass, merge staging → main
#   5. Netlify auto-deploys main to production
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Parse flags
API_ONLY=false
DRY_RUN=false
for arg in "$@"; do
  case $arg in
    --api-only) API_ONLY=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD} BusinessGPS Deployment Pipeline${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e " Mode:      $([[ $DRY_RUN == 'true' ]] && echo '🔍 Dry Run (test only)' || echo '🚀 Full Deploy')"
echo -e " Tests:     $([[ $API_ONLY == 'true' ]] && echo 'API only' || echo 'API + E2E')"
echo -e " Timestamp: $(date)"
echo -e "═══════════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────────
# Step 1: Verify branch
# ─────────────────────────────────────────────────────────────
echo -e "${BLUE}Step 1: Verifying branch...${NC}"

cd "$PROJECT_DIR"
CURRENT_BRANCH=$(git branch --show-current)

if [[ "$CURRENT_BRANCH" != "staging" ]]; then
  echo -e "${RED}ERROR: Must be on 'staging' branch (currently on '$CURRENT_BRANCH')${NC}"
  echo "Run: git checkout staging"
  exit 1
fi

# Check for uncommitted changes
if ! git diff --quiet HEAD 2>/dev/null; then
  echo -e "${YELLOW}WARNING: Uncommitted changes detected${NC}"
  git status --short
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

echo -e "${GREEN}  ✓ On staging branch${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# Step 2: Wait for staging deploy
# ─────────────────────────────────────────────────────────────
echo -e "${BLUE}Step 2: Checking staging deployment...${NC}"

# Quick smoke test - can we reach staging?
status=$(curl -s -o /dev/null -w "%{http_code}" "https://staging--businessgps.netlify.app/" --max-time 10 2>/dev/null || echo "000")
if [[ "$status" != "200" ]]; then
  echo -e "${RED}ERROR: Staging not reachable (HTTP $status)${NC}"
  echo "Check: https://staging--businessgps.netlify.app/"
  exit 1
fi

echo -e "${GREEN}  ✓ Staging is live${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# Step 3: Run API Tests
# ─────────────────────────────────────────────────────────────
echo -e "${BLUE}Step 3: Running API tests...${NC}"
echo ""

if ! bash "$PROJECT_DIR/tests/api/test-all.sh" staging; then
  echo ""
  echo -e "${RED}═══ API TESTS FAILED — DEPLOYMENT BLOCKED ═══${NC}"
  echo "Fix the failing tests before deploying to production."
  exit 1
fi

echo ""
echo -e "${GREEN}  ✓ API tests passed${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# Step 4: Run E2E Tests (unless --api-only)
# ─────────────────────────────────────────────────────────────
if [[ "$API_ONLY" == "false" ]]; then
  echo -e "${BLUE}Step 4: Running E2E integration tests...${NC}"
  echo ""

  cd "$PROJECT_DIR/tests/e2e"

  # Check if node_modules exists
  if [[ ! -d "node_modules" ]]; then
    echo "Installing E2E dependencies..."
    npm install --silent 2>/dev/null
  fi

  # Run only the integration tests (not the full checkout spec which needs Stripe)
  if npx playwright test integrations.spec.ts --project=chromium --reporter=list 2>&1; then
    echo ""
    echo -e "${GREEN}  ✓ E2E tests passed${NC}"
  else
    echo ""
    echo -e "${RED}═══ E2E TESTS FAILED — DEPLOYMENT BLOCKED ═══${NC}"
    echo "Fix the failing tests before deploying to production."
    echo "Run with --headed to debug: npx playwright test integrations.spec.ts --headed"
    exit 1
  fi

  cd "$PROJECT_DIR"
  echo ""
else
  echo -e "${YELLOW}Step 4: E2E tests skipped (--api-only)${NC}"
  echo ""
fi

# ─────────────────────────────────────────────────────────────
# Step 5: Merge to production (unless --dry-run)
# ─────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN} ALL TESTS PASSED — DRY RUN COMPLETE${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "To deploy for real, run without --dry-run:"
  echo "  ./scripts/deploy-to-prod.sh"
  exit 0
fi

echo -e "${BLUE}Step 5: Merging staging → main...${NC}"
echo ""

# Show what will be merged
COMMITS_AHEAD=$(git log main..staging --oneline 2>/dev/null | wc -l | tr -d ' ')
echo "  Commits to merge: $COMMITS_AHEAD"
echo ""
git log main..staging --oneline 2>/dev/null | head -10
echo ""

read -p "Merge these commits to production? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted. Tests passed — you can merge manually when ready."
  exit 0
fi

# Merge
git checkout main
git merge staging --no-edit
git push origin main

# Switch back to staging for continued development
git checkout staging

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN} DEPLOYMENT COMPLETE${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Netlify will auto-deploy main to production."
echo "  Monitor: https://app.netlify.com"
echo "  Production: https://capability.ai"
echo ""
echo "  You're back on the staging branch for continued development."
echo ""
