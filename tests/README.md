1# BusinessGPS Test Suite

## Overview

This directory contains automated tests for the BusinessGPS e-commerce platform. Tests are designed to be:
- **Repeatable** - Run consistently across environments
- **Extensible** - Easy to add new products/prices
- **Environment-aware** - Separate staging vs production testing

## Test Strategy

### Test Pyramid

```
                    ┌─────────────┐
                    │   E2E/UI    │  ← Playwright (browser automation)
                    │   Tests     │     Full user journeys
                   ┌┴─────────────┴┐
                   │  Integration  │  ← API + Webhook tests
                   │    Tests      │     Stripe, Supabase, etc.
                  ┌┴───────────────┴┐
                  │    API Tests    │  ← Bash/curl scripts
                  │  (Unit-like)    │     Fast, isolated endpoint tests
                 ┌┴─────────────────┴┐
                 │   Configuration   │  ← Environment validation
                 │     Checks        │     Env vars, URLs, etc.
                 └───────────────────┘
```

### Test Environments

| Environment | URL | Stripe | Database | Safe to Test? |
|-------------|-----|--------|----------|---------------|
| Staging | staging--businessgps.netlify.app | Test mode | businessgps-test | ✅ Yes |
| Production | capability.ai | Live mode | businessgps (live) | ⚠️ Careful |
| Local | localhost:8888 | Test mode | Test DB | ✅ Yes |

## Directory Structure

```
tests/
├── README.md                    # This file
├── config/
│   ├── products.json           # Product definitions (prices, IDs)
│   ├── staging.env             # Staging environment config
│   └── production.env          # Production environment config
├── api/
│   ├── test-checkout.sh        # API endpoint tests
│   ├── test-webhook.sh         # Webhook tests
│   └── test-all.sh             # Run all API tests
├── e2e/
│   ├── playwright.config.ts    # Playwright configuration
│   ├── checkout.spec.ts        # Full checkout flow tests
│   └── pages/                  # Page object models
├── fixtures/
│   └── test-cards.json         # Stripe test card numbers
└── reports/
    └── .gitkeep                # Test reports output
```

## Quick Start

### Run API Tests (Fast)
```bash
./tests/api/test-all.sh staging
```

### Run E2E Tests (Full browser)
```bash
cd tests/e2e
npx playwright test
```

### Run Specific Product Test
```bash
./tests/api/test-checkout.sh staging athena-standard
```

## Adding New Products

1. Add product to `config/products.json`
2. Set price ID in Netlify environment variables
3. Run tests to verify

## Test Cards

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Declined |
| 4000 0027 6000 3184 | 3D Secure required |

See `fixtures/test-cards.json` for full list.

---

## Troubleshooting Guide

### Common Issues & Solutions

#### 1. "The price specified is inactive"

**Symptom:** Checkout API returns error about inactive price.

**Cause:** The Stripe price ID in Netlify env vars has been deactivated/archived in Stripe (often when creating a new price for the same product).

**Solution:**
1. Go to Stripe Dashboard → Products → Find the product
2. Copy the **active** price ID (not the archived one)
3. Update the env var in Netlify
4. **Trigger a redeploy** (see below)

#### 2. Environment variable changes not taking effect

**Symptom:** You updated an env var in Netlify but the old value is still being used.

**Cause:** Netlify functions only load environment variables **at deploy time**, not dynamically.

**Solution:**
```bash
# Option 1: Push any commit to trigger redeploy
git commit --allow-empty -m "Trigger redeploy for env var update"
git push

# Option 2: Manual redeploy via Netlify Dashboard
# Deploys → Trigger deploy → Deploy site
```

**Key Learning:** Always redeploy after changing environment variables!

#### 3. "No such price" - Live mode vs Test mode mismatch

**Symptom:** Error says price exists in live mode but test key was used.

**Cause:** Price ID was created in Stripe **live mode** but the `STRIPE_SECRET_KEY` is a test key (or vice versa).

**Solution:**
- For staging: Use test mode prices (`sk_test_*` key + test mode price IDs)
- For production: Use live mode prices (`sk_live_*` key + live mode price IDs)
- Price IDs are different between modes - you need both sets

#### 4. Redirect goes to wrong URL (e.g., production instead of staging)

**Symptom:** After checkout, thank-you page loads on capability.ai instead of staging.

**Cause:** Netlify's `DEPLOY_PRIME_URL` is not available to functions at runtime.

**Solution:** The code uses `Host` header from the request. If still broken, check:
- `create-checkout-session.js` uses `event.headers.host`
- Not hardcoded URLs in the function

#### 5. Webhook signature verification failed

**Symptom:** Webhook returns "No stripe-signature header" or signature error.

**Cause:**
- Missing `stripe-signature` header (normal for manual tests)
- Wrong `STRIPE_WEBHOOK_SECRET` for the environment

**Solution:**
- Each environment (staging/production) needs its own webhook endpoint in Stripe
- Each webhook has its own signing secret
- Match the signing secret to the correct Netlify deploy context

---

## Lessons Learned

### From 2026-02-04 Testing Session

1. **Netlify env vars require redeploy**
   - Environment variable changes do NOT take effect immediately
   - Functions load env vars only at deploy/build time
   - Always trigger a redeploy after changing env vars

2. **Netlify deploy context variables**
   - `DEPLOY_PRIME_URL` and `DEPLOY_URL` are NOT available at runtime in functions
   - Use request `Host` header instead for dynamic URL detection
   - This ensures staging stays on staging, production on production

3. **Stripe price lifecycle**
   - When you "change" a price in Stripe, it archives the old and creates new
   - The old price ID becomes inactive
   - You must update env vars with the new price ID

4. **Test mode isolation**
   - Always verify session IDs start with `cs_test_` on staging
   - Keep test and live Stripe products/prices completely separate
   - Use different Supabase projects for test vs production data

5. **Debug endpoint value**
   - The `debug-env.js` endpoint was invaluable for diagnosing issues
   - Consider keeping it (restricted to staging) for future debugging
   - Shows actual runtime values, not what you think is configured

---

## Pre-Deployment Checklist

Before merging staging → production:

- [ ] All API tests pass (`./tests/api/test-all.sh staging`)
- [ ] Manual checkout test completed successfully
- [ ] Thank-you page stays on correct domain
- [ ] Order appears in test Supabase database
- [ ] Webhook shows successful delivery in Stripe Dashboard
- [ ] Remove or restrict `debug-env.js` for production
- [ ] Verify production env vars have LIVE Stripe keys and price IDs
- [ ] Production webhook endpoint configured with live signing secret
