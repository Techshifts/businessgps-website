# BusinessGPS.ai - Production E-Commerce Platform

A Netlify-hosted e-commerce platform for BusinessGPS.ai's Transformation Capability Management products.

## Architecture

```
[Website - Netlify]
        │
        ├── Lead Capture ──→ [AWeber] ──→ PDF delivery (leads list)
        │                         └──→ [HubSpot] Contact (lead status: NEW)
        │
        ├── Purchase Flow ──→ [Stripe Checkout] ──→ [Webhook]
        │                                              │
        │                                              ├──→ [Supabase] Order record
        │                                              ├──→ [AWeber] Customer list
        │                                              └──→ [HubSpot] Contact + Deal
        │
        ├── Token Management ──→ [Supabase] api_tokens table
        │                          (AWeber OAuth auto-refresh)
        │
        └── Analytics ──→ [GA4] Conversion tracking (pending)
```

## Products

| Product | Price | Type |
|---------|-------|------|
| Athena Standard | £67 | Self-service |
| Athena Premium | £297 | Self-service + session |
| Start Right 30 | £1,997 | Cohort programme |
| Throughput-90 | £5,997 | Guided programme |
| OpsMax-360 | £15,000 | Enterprise transformation |

## Directory Structure

```
businessgps-netlify/
├── index.html                    # Homepage
├── pages/
│   ├── athena.html              # Athena product page
│   ├── start-right-30.html      # Start Right 30 product page
│   ├── throughput-90.html       # Throughput-90 product page
│   ├── opsmax-360.html          # OpsMax-360 product page
│   ├── tcm-report.html          # Lead magnet page (→ AWeber + HubSpot)
│   ├── tcm-report-thanks.html   # Lead magnet thank you
│   ├── checkout.html            # Pre-checkout confirmation
│   └── thank-you.html           # Post-purchase confirmation
├── css/
│   └── styles.css               # Main stylesheet
├── images/                       # Image assets
├── netlify/
│   └── functions/
│       ├── create-checkout-session.js   # Stripe session creation
│       ├── get-checkout-session.js      # Session retrieval
│       ├── stripe-webhook.js            # Payment webhook → Supabase + AWeber + HubSpot
│       ├── aweber-subscribe.js          # Email list integration (auto-refresh tokens)
│       ├── hubspot-contact.js           # CRM integration (contacts + deals)
│       ├── debug-env.js                 # Environment debug (staging only)
│       └── lib/
│           └── supabase.js              # Database client
├── scripts/
│   ├── deploy-to-prod.sh         # Deployment pipeline (test → merge)
│   └── test-checkout.sh          # Legacy checkout test
├── tests/
│   ├── README.md                 # Test strategy documentation
│   ├── config/products.json      # Product definitions
│   ├── api/test-all.sh           # API test suite (30 tests)
│   ├── e2e/
│   │   ├── playwright.config.ts  # Browser test config
│   │   ├── checkout.spec.ts      # Checkout flow tests
│   │   ├── integrations.spec.ts  # HubSpot + AWeber + form E2E tests
│   │   └── package.json          # E2E dependencies
│   ├── fixtures/test-cards.json  # Stripe test cards
│   └── reports/                  # Test run reports
├── netlify.toml                  # Netlify configuration
├── package.json                  # Node dependencies
├── .env.example                  # Environment variable template
└── supabase-schema.sql           # Database schema (incl. api_tokens)
```

## Design System

Based on BusinessGPS Brand Guidelines v1.0:

### Colors
- **Navy (Primary):** #1A365D
- **Teal (Accent):** #319795
- **Warm White (Background):** #F7FAFC
- **Cool Gray (Text):** #4A5568

### Typography
- **Font:** Inter (Google Fonts)
- **Weights:** 400, 500, 600, 700

---

## Setup Instructions

### 1. Stripe Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create 5 products with the following prices:
   - Athena Standard: £67 one-time
   - Athena Premium: £297 one-time
   - Start Right 30: £1,997 one-time
   - Throughput-90: £5,997 one-time
   - OpsMax-360: £15,000 one-time
3. Copy each price ID (starts with `price_`)
4. Enable automatic tax collection for UK VAT

### 2. Supabase Setup

1. Create a new project at [Supabase](https://supabase.com)
2. Go to SQL Editor
3. Run the contents of `supabase-schema.sql` (includes orders, product_access, leads, api_tokens tables)
4. Copy your project URL and service role key from Settings > API

**Important:** The `api_tokens` table stores AWeber OAuth tokens and must exist in the **production** Supabase project. Both staging and production read/write tokens from this shared table.

### 3. AWeber Setup

AWeber tokens expire every 2 hours. The system auto-refreshes them using Supabase as a token store.

1. Create an OAuth app at [labs.aweber.com/apps](https://labs.aweber.com/apps)
2. Generate an initial access token via the OAuth flow
3. Seed the token in Supabase:
   ```sql
   INSERT INTO api_tokens (service, access_token, refresh_token)
   VALUES ('aweber', '<access_token>', '<refresh_token>');
   ```
4. Create lists (separate test and production lists):
   - **Leads** - For TCM report downloads
   - **Customers** - For purchase confirmations
   - **Enterprise** - For OpsMax inquiries
5. Set up automation in AWeber to send TCM report PDF on subscription

**Note:** Same AWeber account for staging and production, separated by list IDs. Token store is shared (production Supabase) because tokens are per-OAuth-app, not per-list.

### 4. HubSpot Setup

Use a **developer sandbox** for staging, production account for live.

1. Go to Settings > Integrations > Private Apps
2. Create a private app with these scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
3. Create custom **contact** properties:
   - `product_purchased` (single-line text)
   - `stripe_customer_id` (single-line text)
4. Create deal pipelines and note their **numeric IDs** (HubSpot auto-generates these):
   - **Products** - For Athena/Start Right/Throughput purchases
   - **Enterprise** - For OpsMax-360 deals
5. Note the **Closed Won stage ID** for each pipeline (also numeric)

**Important:** Pipeline IDs and stage IDs are set via environment variables because they differ between HubSpot accounts (sandbox vs production).

### 5. Google Analytics 4 Setup

1. Create GA4 property at [Google Analytics](https://analytics.google.com)
2. Copy Measurement ID (starts with `G-`)
3. Search and replace `GA4_TRACKING_ID` with your ID in all HTML files

### 6. Netlify Environment Variables

Add these in Netlify Dashboard > Site settings > Environment variables.
Use "Different value for each deploy context" where staging and production differ.

```
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx              # sk_test_ for staging
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ATHENA_STD=price_xxx
STRIPE_PRICE_ATHENA_PREM=price_xxx
STRIPE_PRICE_SR30=price_xxx
STRIPE_PRICE_TP90=price_xxx
STRIPE_PRICE_OPSMAX=price_xxx

# Supabase (different per environment)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx

# AWeber - OAuth credentials (same for both environments)
AWEBER_ACCOUNT_ID=xxx
AWEBER_CLIENT_ID=xxx
AWEBER_CLIENT_SECRET=xxx

# AWeber - Token store (MUST point to production Supabase, shared)
AWEBER_TOKEN_STORE_URL=https://rqffoadqydlebipkeckw.supabase.co
AWEBER_TOKEN_STORE_KEY=xxx

# AWeber - List IDs (different per environment: test lists vs production lists)
AWEBER_LIST_ID_LEADS=xxx
AWEBER_LIST_ID_CUSTOMERS=xxx
AWEBER_LIST_ID_ENTERPRISE=xxx

# HubSpot (different per environment: sandbox vs production account)
HUBSPOT_API_KEY=xxx
HUBSPOT_PIPELINE_PRODUCTS=xxx
HUBSPOT_PIPELINE_ENTERPRISE=xxx
HUBSPOT_STAGE_CLOSEDWON_PRODUCTS=xxx
HUBSPOT_STAGE_CLOSEDWON_ENTERPRISE=xxx
```

### 7. Stripe Webhook

1. In Stripe Dashboard, go to Developers > Webhooks
2. Add endpoint: `https://your-site.netlify.app/.netlify/functions/stripe-webhook`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

**Note:** Create separate webhooks for staging and production URLs.

### 8. Domain Setup

1. In Netlify > Domain settings > Add domain
2. Add `capability.ai` (or your chosen domain)
3. Configure DNS at your registrar:
   ```
   A     @     → 75.2.60.5
   CNAME www   → your-site.netlify.app
   ```
4. Wait for SSL certificate (automatic)

---

## Deployment

### Iteration Workflow (Recommended)

```bash
# 1. Make changes on staging branch
git checkout staging
# ... make changes ...
git add <files> && git commit -m "description"
git push origin staging              # Netlify auto-deploys staging

# 2. Run full test suite and deploy to production
./scripts/deploy-to-prod.sh          # Tests → confirms → merges to main

# Options:
./scripts/deploy-to-prod.sh --dry-run    # Test only, don't merge
./scripts/deploy-to-prod.sh --api-only   # Skip E2E, faster
```

### Manual Deployment

```bash
# Production (main branch)
git push origin main                 # Auto-deploys to capability.ai

# Staging (staging branch)
git push origin staging              # Auto-deploys to staging--businessgps.netlify.app
```

---

## Testing

### Test Coverage (41 tests)

| Layer | Tool | Tests | Time | What It Checks |
|-------|------|-------|------|----------------|
| API Integration | Bash/curl | 30 | ~30s | Endpoints, products, HubSpot, AWeber, env config |
| E2E Browser | Playwright | 12 | ~7s | Forms, redirects, API integration, Stripe sessions |
| **Total** | | **41 pass, 1 skip** | **~40s** | GA4 skipped (awaiting property ID) |

### Run Tests

```bash
# API tests only (fast)
./tests/api/test-all.sh staging

# E2E browser tests
cd tests/e2e && npm install && npx playwright test integrations.spec.ts --project=chromium

# Full deployment pipeline (API + E2E + merge)
./scripts/deploy-to-prod.sh
```

### Stripe Test Cards

- **Success:** `4242 4242 4242 4242`
- **Declined:** `4000 0000 0000 0002`
- **3D Secure:** `4000 0027 6000 3184`

Any future expiry date, any 3-digit CVC.

### Debug Endpoint (Staging Only)

```
https://staging--businessgps.netlify.app/.netlify/functions/debug-env
```

Shows all configured environment variables (redacted). Blocked on production.

---

## Key Technical Decisions

### AWeber Token Auto-Refresh
AWeber OAuth tokens expire every 2 hours. Rather than static env vars, tokens are stored in Supabase's `api_tokens` table. On every API call, the function reads the current token, and if it gets a 401, automatically refreshes and retries. Both staging and production share the same token store (production Supabase) since they use the same AWeber account.

### HubSpot Pipeline IDs as Env Vars
HubSpot generates numeric IDs for pipelines and deal stages that differ per account. Since staging uses a developer sandbox and production uses the real account, these are set via environment variables rather than hardcoded.

### Webhook Host Header Routing
Netlify's `process.env.URL` always resolves to the production domain, even on staging deploys. Internal function calls (webhook → AWeber/HubSpot) use the request's `Host` header instead, ensuring staging calls stay on staging.

### Non-Blocking Form Submissions
The TCM report form fires AWeber and HubSpot calls as non-blocking fire-and-forget requests. This ensures the user always reaches the thank-you page even if one integration is temporarily down.

---

## Monitoring

- **Stripe:** Dashboard > Payments
- **Supabase:** Table Editor > orders / api_tokens
- **AWeber:** Subscribers list (check Test lists for staging)
- **HubSpot:** Contacts + Deals (sandbox for staging, production for live)
- **GA4:** Reports > Conversions (pending setup)

---

## Rollback

If something goes wrong:

1. Go to Netlify Dashboard > Deploys
2. Find last working deploy
3. Click "Publish deploy"

Instant rollback, no code changes needed.

---

## Accounts & Access

| Service | Staging Account | Production Account |
|---------|----------------|-------------------|
| Stripe | Test mode (same account) | Live mode (same account) |
| Supabase | businessgps-test | businessgps (rqffoadqydlebipkeckw) |
| AWeber | Same account, test lists | Same account, production lists |
| HubSpot | Developer sandbox (Mark) | jeremy.white@techshifts.io |
| GA4 | Pending | Pending |

---

Built with Netlify Functions, Stripe Checkout, Supabase, AWeber, HubSpot, and GA4.
