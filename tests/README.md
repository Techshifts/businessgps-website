# BusinessGPS Test Suite

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
