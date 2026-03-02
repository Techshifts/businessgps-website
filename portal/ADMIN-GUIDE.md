# Portal Admin Guide

**Last updated:** 2026-02-18
**Branch:** staging (deploy to staging--businessgps.netlify.app)

---

## Quick Reference

| Action | Command |
|--------|---------|
| Invite user (Athena) | `curl -X POST https://staging--businessgps.netlify.app/api/portal-invite -H "Content-Type: application/json" -H "x-admin-key: YOUR_ADMIN_KEY" -d '{"email":"user@company.com","first_name":"Alice","product_id":"athena"}'` |
| Invite user (SR30) | `curl -X POST https://staging--businessgps.netlify.app/api/portal-invite -H "Content-Type: application/json" -H "x-admin-key: YOUR_ADMIN_KEY" -d '{"email":"user@company.com","first_name":"Alice","product_id":"sr30","cohort_id":"SR30-2026-Q1"}'` |
| List members | `curl https://staging--businessgps.netlify.app/api/portal-members -H "x-admin-key: YOUR_ADMIN_KEY"` |
| Revoke access | `curl -X POST https://staging--businessgps.netlify.app/api/portal-revoke -H "Content-Type: application/json" -H "x-admin-key: YOUR_ADMIN_KEY" -d '{"email":"user@company.com","product_id":"sr30"}'` |

**Replace `YOUR_ADMIN_KEY`** with the value you set in Netlify > Site Configuration > Environment Variables as `PORTAL_ADMIN_KEY`.

**For production**, replace `staging--businessgps.netlify.app` with `businessgps.ai` (or `capability.ai` when active).

---

## Architecture Overview

```
User's Browser                    Netlify CDN              Supabase
    |                                 |                       |
    |-- GET /portal/ --------------->| login page             |
    |-- Magic link sign-in ---------------------------------->| Auth
    |<-- JWT session ------------------------------------------|
    |                                 |                       |
    |-- GET /portal/dashboard.html ->| page (hidden content)  |
    |   JS checks session            |                       |
    |   JS queries product_access --------------------------->| DB (RLS)
    |<-- [{product_id: "athena"}, ...] ------------------------|
    |   JS shows content + sidebar   |                       |
```

**Key concepts:**
- **Magic link auth** — Users click a link in their email. No password needed.
- **Product gating** — `product_access` table controls which portal sections each user sees.
- **Client-side rendering** — Content starts hidden, JS verifies auth and product access, then reveals.
- **Two Supabase databases** — Staging uses test DB (`vidgzttbfzschuhmibhg`), production uses production DB (`rqffoadqydlebipkeckw`).

---

## Inviting a New Client

### 1. Athena (Free Tier)

Creates a Supabase auth account and grants Athena workspace access.

```bash
curl -X POST https://staging--businessgps.netlify.app/api/portal-invite \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -d '{
    "email": "alice@company.com",
    "first_name": "Alice",
    "product_id": "athena"
  }'
```

**What happens:**
1. Supabase creates an auth user (sends invite email with magic link)
2. A `product_access` row is inserted: `email=alice, product_id=athena, status=active`
3. When Alice clicks the link, she lands on `/portal/dashboard.html`
4. She sees: Athena workspace + Throughput-90/OpsMax-360 teasers (locked)

### 2. Start Right-30 (Paid Tier)

```bash
curl -X POST https://staging--businessgps.netlify.app/api/portal-invite \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -d '{
    "email": "bob@company.com",
    "first_name": "Bob",
    "product_id": "sr30",
    "cohort_id": "SR30-2026-Q1"
  }'
```

**What happens:**
1. Supabase creates auth user (invite email sent)
2. A `product_access` row is inserted: `email=bob, product_id=sr30, cohort_id=SR30-2026-Q1, status=active`
3. Bob sees: Athena workspace + SR30 programme (sessions, materials, prompts, resources, contact) + T90/OpsMax teasers
4. **SR30 users automatically get Athena access** (handled in portal-auth.js)

### 3. Upgrading an Existing User

If Alice already has Athena access and buys SR30, just invite again with `product_id=sr30`:

```bash
curl -X POST https://staging--businessgps.netlify.app/api/portal-invite \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -d '{
    "email": "alice@company.com",
    "first_name": "Alice",
    "product_id": "sr30",
    "cohort_id": "SR30-2026-Q1"
  }'
```

The auth user already exists, so Supabase skips creation. A new `product_access` row is added for SR30. Alice now sees both workspaces.

---

## Managing Members

### List All Members

```bash
curl https://staging--businessgps.netlify.app/api/portal-members \
  -H "x-admin-key: YOUR_ADMIN_KEY"
```

Returns JSON with all portal members, their product access, and status.

### Revoke Access

Remove a specific product from a user:

```bash
curl -X POST https://staging--businessgps.netlify.app/api/portal-revoke \
  -H "Content-Type: application/json" \
  -H "x-admin-key: YOUR_ADMIN_KEY" \
  -d '{
    "email": "alice@company.com",
    "product_id": "sr30"
  }'
```

Sets the `product_access` row status to `revoked`. Alice loses SR30 access but keeps Athena.

---

## Adding Content

### Session Recordings (SR30)

Edit `portal/sr30/sessions.html`. Each session is a `.portal-card`:

```html
<div class="portal-card">
    <div class="portal-video-embed">
        <iframe src="https://www.youtube.com/embed/VIDEO_ID"
                title="Session 1: Foundations"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen></iframe>
    </div>
    <h2>Session 1: Foundations &amp; Assessment</h2>
    <p class="portal-meta">Recorded: March 2026</p>
    <p>Description of the session content.</p>
    <span class="badge badge-teal">Week 1</span>
</div>
```

Replace `VIDEO_ID` with the YouTube or Vimeo video ID. Use unlisted videos for privacy.

### File Downloads (Athena or SR30)

1. Add PDF/file to `portal/files/athena/` or `portal/files/sr30/`
2. Edit the relevant page (e.g., `portal/athena/workbooks.html` or `portal/sr30/materials.html`)
3. Add a download card:

```html
<div class="portal-card portal-download-card">
    <div class="portal-download-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
    </div>
    <div>
        <h3>Workbook Title</h3>
        <p>Brief description of what this workbook covers.</p>
        <a href="/portal/files/athena/workbook-title.pdf" class="btn btn-primary btn-sm" download>Download PDF</a>
    </div>
</div>
```

### Prompts (SR30)

Edit `portal/sr30/prompts.html`. Each prompt is a `.prompt-card`:

```html
<div class="prompt-card">
    <div class="prompt-card-header">
        <h3>Prompt Title</h3>
        <button class="btn btn-sm portal-copy-btn" data-copy="prompt-1">Copy</button>
    </div>
    <pre class="prompt-text" id="prompt-1">Your prompt text goes here.

Include any variables or placeholders in [brackets].</pre>
    <span class="badge badge-teal">Category</span>
</div>
```

---

## Environment Configuration

### Netlify Environment Variables

| Variable | Staging | Production | Notes |
|----------|---------|------------|-------|
| `SUPABASE_URL` | `https://vidgzttbfzschuhmibhg.supabase.co` | `https://rqffoadqydlebipkeckw.supabase.co` | Set per deploy context |
| `SUPABASE_SERVICE_KEY` | Test service key | Production service key | Used by Netlify Functions |
| `SUPABASE_ANON_KEY` | Test anon key | Production anon key | Used by Netlify Functions |
| `PORTAL_ADMIN_KEY` | Your chosen secret | Your chosen secret | Protects admin API endpoints |

**Note:** `portal-auth.js` detects the environment automatically via hostname — no env var needed for client-side config.

### Supabase Configuration

Both test and production databases need:

1. **Auth > Providers > Email:** Enabled with magic link
2. **Auth > URL Configuration:** Add `https://staging--businessgps.netlify.app/portal/dashboard.html` (staging) and `https://businessgps.ai/portal/dashboard.html` (production) to redirect URLs
3. **RLS Policy on `product_access`:**

```sql
CREATE POLICY "Users read own product access"
ON product_access FOR SELECT
TO authenticated
USING (email = auth.jwt()->>'email');
```

4. **Test data (staging only):**

```sql
INSERT INTO product_access (email, product_id, status)
VALUES
  ('mark.p.waller@gmail.com', 'athena', 'active'),
  ('mark.p.waller@gmail.com', 'sr30', 'active');
```

---

## Testing

### Automated Tests

From `tests/e2e/`:

```bash
# All portal tests (auth + compliance = 133 tests)
npx playwright test portal.spec.ts portal-compliance.spec.ts --project=chromium

# Just auth/navigation (27 tests)
npx playwright test portal.spec.ts --project=chromium

# Just compliance (106 tests)
npx playwright test portal-compliance.spec.ts --project=chromium

# Full site compliance (public + portal)
npx playwright test --project=chromium
```

### Manual Testing Checklist

- [ ] Visit `/portal/` > enter email > receive magic link > click > land on dashboard
- [ ] Athena-only user: sees Athena section, no SR30
- [ ] SR30 user: sees both Athena and SR30
- [ ] Unauthenticated: `/portal/dashboard.html` redirects to `/portal/`
- [ ] Athena user visiting `/portal/sr30/` redirects to dashboard with notice
- [ ] Mobile: sidebar collapses, hamburger works
- [ ] Logout: session cleared, back to login

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Check your email" but no email arrives | Supabase rate limit (3-4/hour per email) | Wait 1 hour, or use a different email |
| Dashboard loads but shows "no access" | No `product_access` rows for this user | Run invite curl command |
| Portal-content stays hidden (spinner) | CSP blocking Supabase connection | Check netlify.toml `connect-src` includes both Supabase URLs |
| Empty product list after login | RLS policy missing | Run the SQL policy in Supabase SQL Editor |
| Admin API returns 401 | Wrong `x-admin-key` header | Check `PORTAL_ADMIN_KEY` in Netlify env vars |
| Password auth doesn't work | Password not set on user | Set via Supabase dashboard > Authentication > Users > Edit |

---

## File Structure

```
portal/
  index.html              Login page (public)
  dashboard.html          Dashboard (auth: any)
  ADMIN-GUIDE.md          This file
  athena/
    index.html            Athena hub (auth: athena)
    guide.html            Getting started (auth: athena)
    workbooks.html        Downloads (auth: athena)
    resources.html        Tools & references (auth: athena)
  sr30/
    index.html            Programme hub (auth: sr30)
    sessions.html         Video library (auth: sr30)
    materials.html        File downloads (auth: sr30)
    prompts.html          Prompt workspace (auth: sr30)
    resources.html        References (auth: sr30)
    contact.html          Contact + Calendly (auth: sr30)
  throughput-90/
    index.html            Teaser page (auth: any)
  opsmax-360/
    index.html            Teaser page (auth: any)
  files/
    athena/               Athena workbooks & templates
    sr30/                 SR30 programme materials

js/
  supabase.min.js         Supabase JS SDK (local bundle)
  portal-auth.js          Shared auth module (multi-product aware)

netlify/functions/
  portal-invite.js        POST /api/portal-invite
  portal-members.js       GET /api/portal-members
  portal-revoke.js        POST /api/portal-revoke
```
