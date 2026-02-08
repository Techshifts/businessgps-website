# BusinessGPS Test Suite

## Overview

Automated test infrastructure for the BusinessGPS e-commerce platform covering Stripe checkout, HubSpot CRM, and AWeber email marketing integrations.

## Test Coverage (42 tests)

| Layer | Tool | Tests | Time | What It Checks |
|-------|------|-------|------|----------------|
| API Integration | Bash/curl | 30 | ~30s | Endpoints, products, HubSpot, AWeber, env config |
| E2E Browser | Playwright | 12 | ~7s | Forms, redirects, API integration, Stripe sessions |
| **Total** | | **42 (41 pass, 1 skip)** | **~40s** | GA4 skipped (awaiting property ID) |

### API Test Sections (test-all.sh)

| Section | Tests | Coverage |
|---------|-------|----------|
| Endpoint Availability | 5 | Homepage, checkout, functions respond |
| Product Checkout API | 5 | All 5 products create Stripe sessions |
| Error Handling | 3 | Invalid/missing product ID, bad JSON |
| HubSpot Integration | 4 | Endpoint, lead contact, deal creation, validation |
| AWeber Integration | 5 | Endpoint, leads list, customers list, validation |
| Environment Config | 8 | Stripe test mode, price IDs, Supabase, HubSpot, AWeber config |

### E2E Test Sections (integrations.spec.ts)

| Section | Tests | Coverage |
|---------|-------|----------|
| TCM Report Lead Capture | 4 | Form submit + redirect, HubSpot contact, AWeber subscriber, minimal input |
| Checkout to Stripe | 5 | All 5 products create `cs_test_*` sessions |
| HubSpot Purchase Flow | 3 | Standard deal, enterprise deal, lead-only contact |

## Test Environments

| Environment | URL | Stripe | Database | Safe to Test? |
|-------------|-----|--------|----------|---------------|
| Staging | staging--businessgps.netlify.app | Test mode | businessgps-test | Yes |
| Production | capability.ai | Live mode | businessgps (live) | Careful |

## Directory Structure

```
tests/
├── README.md                    # This file
├── config/
│   └── products.json           # Product definitions (prices, IDs)
├── api/
│   └── test-all.sh             # Full API test suite (30 tests)
├── e2e/
│   ├── playwright.config.ts    # Playwright configuration
│   ├── checkout.spec.ts        # Checkout flow tests (Stripe redirect)
│   ├── integrations.spec.ts    # HubSpot + AWeber + form E2E tests
│   └── package.json            # E2E dependencies
├── fixtures/
│   └── test-cards.json         # Stripe test card numbers
└── reports/                    # Test run reports (auto-generated)
```

## Quick Start

```bash
# API tests only (fast, ~30s)
./tests/api/test-all.sh staging

# E2E browser tests (~7s)
cd tests/e2e && npm install && npx playwright test integrations.spec.ts --project=chromium

# Full deployment pipeline (API + E2E + merge to production)
./scripts/deploy-to-prod.sh

# Dry run (tests only, no merge)
./scripts/deploy-to-prod.sh --dry-run

# API tests only pipeline (skip E2E, faster)
./scripts/deploy-to-prod.sh --api-only
```

## Test Cards

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Declined |
| 4000 0027 6000 3184 | 3D Secure required |

Any future expiry date, any 3-digit CVC.

## Debug Endpoint (Staging Only)

```
https://staging--businessgps.netlify.app/.netlify/functions/debug-env
```

Shows all configured environment variables (redacted). Blocked on production.

---

## Troubleshooting Guide

### Common Issues & Solutions

#### 1. "The price specified is inactive"

**Cause:** Stripe price ID has been archived (happens when you "change" a price — Stripe archives old, creates new).

**Fix:** Copy the active price ID from Stripe Dashboard, update Netlify env var, redeploy.

#### 2. Environment variable changes not taking effect

**Cause:** Netlify functions load env vars at deploy time only.

**Fix:** Trigger a redeploy after changing any env var (push a commit, or Netlify Dashboard > Deploys > Trigger deploy).

#### 3. Live mode vs Test mode price mismatch

**Cause:** Price ID from wrong Stripe mode.

**Fix:** Staging uses `sk_test_*` key + test mode price IDs. Production uses `sk_live_*` + live mode price IDs. They're different IDs.

#### 4. Redirect goes to production instead of staging

**Cause:** `process.env.URL` resolves to capability.ai even on staging.

**Fix:** Code uses `Host` header from request. Check `create-checkout-session.js` and `stripe-webhook.js` use `event.headers.host`.

#### 5. Webhook signature verification failed

**Cause:** Missing `stripe-signature` header or wrong `STRIPE_WEBHOOK_SECRET`.

**Fix:** Each environment needs its own webhook endpoint in Stripe with its own signing secret.

#### 6. HubSpot pipeline/stage errors

**Cause:** HubSpot uses auto-generated numeric IDs that differ per account (sandbox vs production).

**Fix:** Check env vars `HUBSPOT_PIPELINE_PRODUCTS`, `HUBSPOT_PIPELINE_ENTERPRISE`, `HUBSPOT_STAGE_CLOSEDWON_PRODUCTS`, `HUBSPOT_STAGE_CLOSEDWON_ENTERPRISE`. Use debug endpoint to verify runtime values.

#### 7. AWeber 401 errors

**Cause:** OAuth token expired (tokens last 2 hours).

**Fix:** The auto-refresh mechanism in `aweber-subscribe.js` handles this automatically. If it fails, check the `api_tokens` table in production Supabase has a valid refresh token, and that `AWEBER_TOKEN_STORE_URL` / `AWEBER_TOKEN_STORE_KEY` are set correctly.

---

## Lessons Learned

### From 2026-02-04 (Initial Stripe Setup)

1. **Netlify env vars require redeploy** — not dynamic
2. **Use Host header** for URL detection — `DEPLOY_PRIME_URL` not available at runtime
3. **Stripe archives old prices** — must update env vars with new price IDs
4. **Test mode isolation** — verify `cs_test_*` session IDs on staging

### From 2026-02-08 (HubSpot + AWeber Integration)

5. **HubSpot IDs are numeric** — pipeline and stage IDs are auto-generated numbers, not string names
6. **HubSpot properties are object-specific** — `product_purchased` exists on contacts, not deals
7. **AWeber tokens expire every 2 hours** — must auto-refresh, not static env vars
8. **Shared token store** — staging and production share AWeber tokens via production Supabase
9. **Non-blocking form submissions** — integration failures must never block user redirect
10. **Host-header routing** — internal function-to-function calls must use Host header, not `process.env.URL`

---

## Pre-Deployment Checklist

Before merging staging to production:

- [ ] All API tests pass (`./tests/api/test-all.sh staging`)
- [ ] All E2E tests pass (`cd tests/e2e && npx playwright test integrations.spec.ts --project=chromium`)
- [ ] Or run full pipeline: `./scripts/deploy-to-prod.sh --dry-run`
- [ ] Thank-you page stays on correct domain
- [ ] Order appears in test Supabase database
- [ ] Webhook delivery successful in Stripe Dashboard
- [ ] Remove `detail: error.message` from `hubspot-contact.js` error responses
- [ ] Verify `debug-env.js` blocked on production
- [ ] Production env vars set: Stripe (live keys), HubSpot (Jeremy's account), AWeber (production lists)
- [ ] Production webhook endpoint configured with live signing secret
