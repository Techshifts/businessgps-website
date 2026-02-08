import { test, expect } from '@playwright/test';

/**
 * Integration E2E Tests
 *
 * Tests the full browser → API → third-party flow:
 * - TCM report form → HubSpot contact + AWeber subscriber
 * - Checkout page → Stripe redirect
 *
 * These tests hit REAL staging APIs (HubSpot sandbox, AWeber test lists).
 * They create real records — use unique emails per run.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://staging--businessgps.netlify.app';
const FUNCTIONS_URL = `${BASE_URL}/.netlify/functions`;

// Generate unique email per test run to avoid duplicates
const timestamp = Date.now();
const uniqueEmail = (prefix: string) => `${prefix}-${timestamp}@techshifts.io`;

// ═══════════════════════════════════════════════════════════════
// TCM Report Form → HubSpot + AWeber
// ═══════════════════════════════════════════════════════════════

test.describe('TCM Report Lead Capture', () => {

  test('form submits and redirects to thank-you page', async ({ page }) => {
    const email = uniqueEmail('e2e-tcm');

    // Navigate to report page
    await page.goto(`${BASE_URL}/pages/tcm-report`);
    await expect(page).toHaveTitle(/Transformation Capability Crisis/);

    // Fill the form (first form on page - the main one in the hero)
    const form = page.locator('#report-form');
    await form.locator('input[name="first_name"]').fill('E2E Test');
    await form.locator('input[name="email"]').fill(email);
    await form.locator('input[name="company"]').fill('E2E Test Corp');

    // Submit
    await form.locator('button[type="submit"]').click();

    // Button should show success state
    await expect(form.locator('button[type="submit"]')).toHaveText(/Success/i, { timeout: 5000 });

    // Should redirect to thank-you page
    await page.waitForURL(/tcm-report-thanks/, { timeout: 10000 });
    await expect(page.locator('#email-display')).toHaveText(email);
  });

  test('HubSpot contact created from form submission', async ({ request }) => {
    const email = uniqueEmail('e2e-hs-verify');

    // Simulate what the form does — call HubSpot function directly
    const response = await request.post(`${FUNCTIONS_URL}/hubspot-contact`, {
      data: {
        email,
        firstName: 'E2E Verify',
        company: 'E2E Test Corp',
        source: 'tcm-report',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.contactId).toBeTruthy();
  });

  test('AWeber subscriber created from form submission', async ({ request }) => {
    const email = uniqueEmail('e2e-aw-verify');

    // Simulate what the form does — call AWeber function directly
    const response = await request.post(`${FUNCTIONS_URL}/aweber-subscribe`, {
      data: {
        email,
        firstName: 'E2E Verify',
        listType: 'leads',
        tags: ['tcm_report', 'e2e_test'],
        source: 'tcm-report-page',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('form works without company (minimal required input)', async ({ page }) => {
    const email = uniqueEmail('e2e-minimal');

    await page.goto(`${BASE_URL}/pages/tcm-report`);

    const form = page.locator('#report-form');
    await form.locator('input[name="first_name"]').fill('Minimal');
    await form.locator('input[name="email"]').fill(email);
    // Skip company (optional)

    await form.locator('button[type="submit"]').click();

    // Should still redirect to thank-you
    await page.waitForURL(/tcm-report-thanks/, { timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// Checkout Flow → Stripe
// ═══════════════════════════════════════════════════════════════

test.describe('Checkout to Stripe', () => {

  const products = [
    { id: 'athena-standard', name: 'Athena', price: '67' },
    { id: 'athena-premium', name: 'Athena', price: '297' },
    { id: 'start-right-30', name: 'Start Right', price: '1,997' },
    { id: 'throughput-90', name: 'Throughput', price: '5,997' },
    { id: 'opsmax-360', name: 'OpsMax', price: '15,000' },
  ];

  for (const product of products) {
    test(`${product.id} creates Stripe session`, async ({ request }) => {
      const response = await request.post(`${FUNCTIONS_URL}/create-checkout-session`, {
        data: { productId: product.id },
      });

      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.sessionId).toBeTruthy();
      // Verify test mode
      expect(body.sessionId).toMatch(/^cs_test_/);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// HubSpot Deal Creation (purchase simulation)
// ═══════════════════════════════════════════════════════════════

test.describe('HubSpot Purchase Flow', () => {

  test('creates contact + deal for standard product', async ({ request }) => {
    const email = uniqueEmail('e2e-deal-std');

    const response = await request.post(`${FUNCTIONS_URL}/hubspot-contact`, {
      data: {
        email,
        firstName: 'E2E',
        lastName: 'DealTest',
        productPurchased: 'athena-standard',
        amount: 67,
        stripeCustomerId: 'cus_e2e_test',
        createDeal: true,
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.contactId).toBeTruthy();
    expect(body.dealId).toBeTruthy();
  });

  test('creates contact + deal for enterprise product', async ({ request }) => {
    const email = uniqueEmail('e2e-deal-ent');

    const response = await request.post(`${FUNCTIONS_URL}/hubspot-contact`, {
      data: {
        email,
        firstName: 'E2E',
        lastName: 'Enterprise',
        productPurchased: 'opsmax-360',
        amount: 15000,
        stripeCustomerId: 'cus_e2e_enterprise',
        createDeal: true,
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.contactId).toBeTruthy();
    expect(body.dealId).toBeTruthy();
  });

  test('contact without deal for lead capture', async ({ request }) => {
    const email = uniqueEmail('e2e-nodeal');

    const response = await request.post(`${FUNCTIONS_URL}/hubspot-contact`, {
      data: {
        email,
        firstName: 'E2E',
        source: 'tcm-report',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.contactId).toBeTruthy();
    expect(body.dealId).toBeNull();
  });
});
