# BusinessGPS Test Suite

## Overview

Automated test infrastructure for the BusinessGPS e-commerce platform covering Stripe checkout, HubSpot CRM, and AWeber email marketing integrations.

## Test Coverage (305 tests)

| Layer | Tool | Tests | Time | What It Checks |
|-------|------|-------|------|----------------|
| API Integration | Bash/curl | 30 | ~30s | Endpoints, products, HubSpot, AWeber, env config |
| E2E Browser — Integrations | Playwright | 12 | ~7s | Forms, redirects, API integration, Stripe sessions |
| E2E Browser — Frontend Compliance | Playwright | 263 | ~55s | SOP-WEB-005 standards across all 18 pages |
| **Total** | | **305** | **~90s** | |

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

### Frontend Compliance Sections (frontend-compliance.spec.ts)

Validates SOP-WEB-005 standards across all 18 pages. Run after any HTML/CSS change.

| Section | Tests | Coverage |
|---------|-------|----------|
| Document Structure | 54 | Skip link, `<main id="main-content">`, `lang="en"` |
| Head Section — Meta Tags | 54 | Meta description, OG tags (title/desc/type/url), Twitter Card |
| Head Section — Canonical URLs | 17 | Canonical URL present, points to capability.ai |
| Accessibility — Images | 36 | Alt text, width/height attributes on all images |
| Accessibility — Form Labels | 2 | TCM Report + Contact form input labels |
| Accessibility — Navigation | 36 | Nav toggle aria-expanded + aria-label |
| Semantic HTML | 36 | Single h1, nav/main/footer landmarks |
| Performance — CSS Cache Busting | 18 | `styles.css?v=` parameter present |
| SEO — Site-level Files | 2 | robots.txt + sitemap.xml exist and reference capability.ai |
| SEO — JSON-LD | 5 | Organization on homepage, Product on 4 product pages |
| Security | 1 | SEC-01 regression — email not leaked in URL |
| Footer Social Links | 1 | Aria-labels on social links |
| Build System | 1 | GA4 script tag present on homepage |

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
│   ├── playwright.config.ts            # Playwright configuration
│   ├── checkout.spec.ts                # Checkout flow tests (Stripe redirect)
│   ├── frontend-compliance.spec.ts     # SOP-WEB-005 compliance (263 tests)
│   ├── integrations.spec.ts            # HubSpot + AWeber + form E2E tests
│   └── package.json                    # E2E dependencies
├── fixtures/
│   └── test-cards.json         # Stripe test card numbers
└── reports/                    # Test run reports (auto-generated)
```

## Quick Start

```bash
# API tests only (fast, ~30s)
./tests/api/test-all.sh staging

# E2E integration tests (~7s)
cd tests/e2e && npm install && npx playwright test integrations.spec.ts --project=chromium

# Frontend compliance tests (~55s)
cd tests/e2e && npx playwright test frontend-compliance.spec.ts --project=chromium

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

## Visual QA Protocol (Browser Computed-Style Verification)

### Purpose

Validates that deployed CSS changes actually render correctly in the browser by inspecting computed styles via Playwright automation. This catches issues that file-level inspection misses: CDN caching, CSS specificity conflicts, and cascade inheritance problems.

### When to Run

- After any CSS change that affects colors, typography, or spacing
- After changing `netlify.toml` caching headers
- When a user reports "it still looks the same" after a CSS deploy
- Before signing off any visual component as complete

### Test Method: Computed Style Inspection

Uses Playwright `browser_evaluate` with `getComputedStyle()` to read the actual rendered values from the browser DOM.

```javascript
// Example: Footer visual verification
() => {
  const results = {};
  const footer = document.querySelector('.footer');
  results.footerBg = getComputedStyle(footer).backgroundColor;

  const logo = document.querySelector('.footer .navbar-logo');
  results.logoColor = getComputedStyle(logo).color;
  results.logoFontSize = getComputedStyle(logo).fontSize;

  const h4 = document.querySelector('.footer-col h4');
  results.headingColor = getComputedStyle(h4).color;
  results.headingFontSize = getComputedStyle(h4).fontSize;

  const link = document.querySelector('.footer-links a');
  results.linkColor = getComputedStyle(link).color;

  const copyright = document.querySelector('.footer-bottom p');
  results.copyrightColor = getComputedStyle(copyright).color;

  const legal = document.querySelector('.footer-legal a');
  results.legalColor = getComputedStyle(legal).color;

  return results;
}
```

### Expected Values (Footer)

Per DESIGN-SPEC.md and Brand Guidelines v1.0:

| Element | CSS Selector | Expected Computed Value |
|---------|-------------|------------------------|
| Footer background | `.footer` | `rgb(26, 54, 93)` = `#1A365D` |
| Logo color | `.footer .navbar-logo` | `rgb(255, 255, 255)` = `#FFFFFF` |
| Logo font-size | `.footer .navbar-logo` | `24px` |
| Column heading color | `.footer-col h4` | `rgb(255, 255, 255)` = `#FFFFFF` |
| Column heading size | `.footer-col h4` | `20px` |
| Link color | `.footer-links a` | `rgb(226, 232, 240)` = `#E2E8F0` |
| Copyright color | `.footer-bottom p` | `rgb(226, 232, 240)` = `#E2E8F0` |
| Legal link color | `.footer-legal a` | `rgb(226, 232, 240)` = `#E2E8F0` |
| Tagline color | `.footer-desc` | `rgb(226, 232, 240)` = `#E2E8F0` |
| Tagline font-size | `.footer-desc` | `16px` |

### Troubleshooting: Computed Styles Don't Match CSS File

If the deployed CSS file shows correct values but `getComputedStyle()` returns old values:

1. **Check CSS caching** — `netlify.toml` may have aggressive cache headers (e.g., `immutable, max-age=31536000`). Fix: use `max-age=3600` for CSS files without content-hash filenames.
2. **Check cache-buster version** — HTML files should reference `styles.css?v=YYYYMMDD`. Update the version param after CSS changes.
3. **Check CSS specificity** — A more specific selector may override the footer rule. Use `browser_evaluate` to read `cssRules` from the stylesheet object.
4. **Check for inline styles** — Query `element.getAttribute('style')` and `document.querySelectorAll('style')` for inline overrides.
5. **Close and reopen browser** — Playwright may cache across navigations within the same session.

### Test Evidence: Footer Verification (2026-02-11)

**Test performed:** Playwright browser automation on `staging--businessgps.netlify.app`

**Issues found and resolved:**
1. CSS `Cache-Control: immutable, max-age=31536000` on `/css/*` prevented browsers from ever re-fetching updated CSS files. Fixed by changing to `max-age=3600` and adding `?v=20260211` cache-buster to all 16 HTML files.
2. Footer background was `#142847` (navy-dark) instead of brand-spec `#1A365D` (navy). Fixed in CSS.
3. Secondary text was `#CBD5E0` (too muted on dark background). Changed to `#E2E8F0` for better contrast.
4. Logo was 20px, should be 24px. Column headings were 18px, should be 20px per brand H4 spec.

**Final verified values (all PASS):**
```
footerBg:       rgb(26, 54, 93)   = #1A365D  ✓
logoColor:      rgb(255, 255, 255) = #FFFFFF  ✓
logoFontSize:   24px                          ✓
headingColor:   rgb(255, 255, 255) = #FFFFFF  ✓
headingFontSize: 20px                         ✓
linkColor:      rgb(226, 232, 240) = #E2E8F0  ✓
copyrightColor: rgb(226, 232, 240) = #E2E8F0  ✓
legalColor:     rgb(226, 232, 240) = #E2E8F0  ✓
taglineColor:   rgb(226, 232, 240) = #E2E8F0  ✓
taglineFontSize: 16px                         ✓
```

---

## Pre-Deployment Checklist

Before merging staging to production:

- [ ] All API tests pass (`./tests/api/test-all.sh staging`)
- [ ] All E2E integration tests pass (`cd tests/e2e && npx playwright test integrations.spec.ts --project=chromium`)
- [ ] All frontend compliance tests pass (`cd tests/e2e && npx playwright test frontend-compliance.spec.ts --project=chromium`)
- [ ] Or run full pipeline: `./scripts/deploy-to-prod.sh --dry-run`
- [ ] Thank-you page stays on correct domain
- [ ] Order appears in test Supabase database
- [ ] Webhook delivery successful in Stripe Dashboard
- [ ] Remove `detail: error.message` from `hubspot-contact.js` error responses
- [ ] Verify `debug-env.js` blocked on production
- [ ] Production env vars set: Stripe (live keys), HubSpot (Jeremy's account), AWeber (production lists)
- [ ] Production webhook endpoint configured with live signing secret
