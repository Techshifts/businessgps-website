# BusinessGPS.ai - Production E-Commerce Platform

A Netlify-hosted e-commerce platform for BusinessGPS.ai's Transformation Capability Management products.

## Architecture

```
[Website - Netlify]
        │
        ├── Lead Capture ──→ [AWeber] ──→ PDF delivery
        │                         └──→ [HubSpot] Contact
        │
        ├── Purchase Flow ──→ [Stripe Checkout] ──→ [Webhook]
        │                                              │
        │                                              ├──→ [Supabase] Order record
        │                                              ├──→ [AWeber] Customer list
        │                                              └──→ [HubSpot] Contact + Deal
        │
        └── Analytics ──→ [GA4] Conversion tracking
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
│   ├── tcm-report.html          # Lead magnet page
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
│       ├── stripe-webhook.js            # Payment webhook handler
│       ├── aweber-subscribe.js          # Email list integration
│       ├── hubspot-contact.js           # CRM integration
│       └── lib/
│           └── supabase.js              # Database client
├── netlify.toml                  # Netlify configuration
├── package.json                  # Node dependencies
├── .env.example                  # Environment variable template
└── supabase-schema.sql           # Database schema
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
3. Run the contents of `supabase-schema.sql`
4. Copy your project URL and service role key from Settings > API

### 3. AWeber Setup

1. Get API credentials from your colleague
2. Create lists:
   - **Leads** - For TCM report downloads
   - **Customers** - For purchase confirmations
   - **Enterprise** - For OpsMax inquiries
3. Set up automation in AWeber to send TCM report PDF on subscription

### 4. HubSpot Setup

1. Go to Settings > Integrations > Private Apps
2. Create a private app with these scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.deals.read`
   - `crm.objects.deals.write`
3. Create custom properties:
   - `product_purchased` (single-line text)
   - `stripe_customer_id` (single-line text)
4. Create pipelines:
   - **Products** - For Athena/Start Right/Throughput purchases
   - **Enterprise** - For OpsMax-360 deals

### 5. Google Analytics 4 Setup

1. Create GA4 property at [Google Analytics](https://analytics.google.com)
2. Copy Measurement ID (starts with `G-`)
3. Search and replace `GA4_TRACKING_ID` with your ID in all HTML files

### 6. Netlify Environment Variables

Add these in Netlify Dashboard > Site settings > Environment variables:

```
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ATHENA_STD=price_xxx
STRIPE_PRICE_ATHENA_PREM=price_xxx
STRIPE_PRICE_SR30=price_xxx
STRIPE_PRICE_TP90=price_xxx
STRIPE_PRICE_OPSMAX=price_xxx

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx

# AWeber
AWEBER_ACCESS_TOKEN=xxx
AWEBER_ACCOUNT_ID=xxx
AWEBER_LIST_ID_LEADS=xxx
AWEBER_LIST_ID_CUSTOMERS=xxx
AWEBER_LIST_ID_ENTERPRISE=xxx

# HubSpot
HUBSPOT_API_KEY=xxx
```

### 7. Stripe Webhook

1. In Stripe Dashboard, go to Developers > Webhooks
2. Add endpoint: `https://your-site.netlify.app/.netlify/functions/stripe-webhook`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

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

### Production (main branch)

```bash
git push origin main
```

Automatic deployment on push.

### Staging (staging branch)

```bash
git checkout -b staging
git push origin staging
```

Access at: `staging--your-site.netlify.app`

Configure staging-specific environment variables in Netlify:
- Use `sk_test_` keys for Stripe test mode
- Same Supabase/AWeber/HubSpot (or create test instances)

---

## Testing

### Stripe Test Mode

Use test cards:
- **Success:** `4242 4242 4242 4242`
- **Declined:** `4000 0000 0000 0002`
- **3D Secure:** `4000 0027 6000 3184`

Any future expiry date, any 3-digit CVC.

### Complete Test Flow

1. Visit `/checkout?product=athena-standard`
2. Click "Proceed to Secure Checkout"
3. Use test card `4242 4242 4242 4242`
4. Complete checkout
5. Verify thank-you page shows order details
6. Check Supabase for order record
7. Check AWeber for customer subscription
8. Check HubSpot for contact

---

## Local Development

```bash
# Install dependencies
npm install

# Install Netlify CLI
npm install -g netlify-cli

# Run locally
netlify dev
```

Requires `.env` file with all environment variables.

---

## Monitoring

- **Stripe:** Dashboard > Payments
- **Supabase:** Table Editor > orders
- **AWeber:** Subscribers list
- **HubSpot:** Contacts + Deals
- **GA4:** Reports > Conversions

---

## Rollback

If something goes wrong:

1. Go to Netlify Dashboard > Deploys
2. Find last working deploy
3. Click "Publish deploy"

Instant rollback, no code changes needed.

---

## Support

- Stripe issues: Check webhook logs in Stripe Dashboard
- Database issues: Check Supabase logs
- Email issues: Check AWeber delivery reports
- CRM issues: Check HubSpot activity log

---

Built with Netlify Functions, Stripe Checkout, Supabase, AWeber, HubSpot, and GA4.

