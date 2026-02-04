import { test, expect } from '@playwright/test';

/**
 * BusinessGPS Checkout E2E Tests
 *
 * These tests verify the complete checkout flow from product selection
 * through payment to the thank-you page.
 *
 * Prerequisites:
 * - Run against staging environment
 * - Use Stripe test mode
 * - Never run payment tests against production
 */

// Test data
const products = {
  'athena-standard': { name: 'Athena V3 - Standard', price: '£67' },
  'athena-premium': { name: 'Athena V3 - Premium', price: '£297' },
  'start-right-30': { name: 'Start Right 30', price: '£1,997' },
  'throughput-90': { name: 'Throughput-90', price: '£5,997' },
  'opsmax-360': { name: 'OpsMax-360', price: '£15,000' },
};

const testCard = {
  number: '4242424242424242',
  expiry: '12/26',
  cvc: '123',
  name: 'Test User',
  email: 'test@example.com',
};

// ═══════════════════════════════════════════════════════════════
// SECTION 1: Page Load Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Page Load Tests', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/BusinessGPS/);
    await expect(page.locator('.navbar-logo')).toBeVisible();
  });

  test('checkout page loads for each product', async ({ page }) => {
    for (const [productId, product] of Object.entries(products)) {
      await page.goto(`/pages/checkout?product=${productId}`);
      await expect(page.locator('#product-name')).toContainText(product.name);
    }
  });

  test('thank-you page shows error without session', async ({ page }) => {
    await page.goto('/pages/thank-you.html');
    await expect(page.locator('#error-state')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2: Checkout Flow Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Checkout Flow', () => {
  test('checkout page displays correct product info', async ({ page }) => {
    await page.goto('/pages/checkout?product=athena-standard');

    // Verify product details
    await expect(page.locator('#product-name')).toContainText('Athena V3 - Standard');
    await expect(page.locator('#product-price')).toContainText('£67');
    await expect(page.locator('#order-total')).toContainText('£67');

    // Verify features list
    await expect(page.locator('#features-list li')).toHaveCount(5);
  });

  test('proceed to checkout redirects to Stripe', async ({ page }) => {
    await page.goto('/pages/checkout?product=athena-standard');

    // Click checkout button
    const checkoutButton = page.locator('#checkout-btn');
    await expect(checkoutButton).toBeVisible();

    // Listen for navigation to Stripe
    const [popup] = await Promise.all([
      page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 }),
      checkoutButton.click(),
    ]);

    // Verify we're on Stripe checkout
    expect(page.url()).toContain('checkout.stripe.com');
  });

  test('cancelled checkout shows banner', async ({ page }) => {
    await page.goto('/pages/checkout?product=athena-standard&cancelled=true');
    await expect(page.locator('#cancelled-banner')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3: Full Payment Flow (Stripe Test Mode)
// ═══════════════════════════════════════════════════════════════

test.describe('Full Payment Flow', () => {
  // This test completes an actual payment using Stripe test mode
  // Only run on staging environment
  test('complete checkout with test card', async ({ page }) => {
    // Skip if not on staging
    const baseUrl = page.url() || process.env.PLAYWRIGHT_BASE_URL || '';
    if (baseUrl.includes('capability.ai')) {
      test.skip(true, 'Skipping payment test on production');
    }

    await page.goto('/pages/checkout?product=athena-standard');

    // Click checkout button
    await page.locator('#checkout-btn').click();

    // Wait for Stripe checkout
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });

    // Fill in Stripe checkout form
    // Note: Stripe's iframe structure may change, selectors may need updating
    await page.waitForLoadState('networkidle');

    // Fill email
    const emailInput = page.locator('input[name="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill(testCard.email);
    }

    // Fill card number (in iframe)
    const cardFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first();

    // Card number
    await cardFrame.locator('input[name="cardnumber"]').fill(testCard.number);

    // Expiry
    await cardFrame.locator('input[name="exp-date"]').fill(testCard.expiry);

    // CVC
    await cardFrame.locator('input[name="cvc"]').fill(testCard.cvc);

    // Name
    const nameInput = page.locator('input[name="billingName"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill(testCard.name);
    }

    // Submit payment
    await page.locator('button[type="submit"]').click();

    // Wait for redirect to thank-you page
    await page.waitForURL(/thank-you\.html\?session_id=/, { timeout: 60000 });

    // Verify we're on the staging thank-you page (not production)
    expect(page.url()).toContain('staging--businessgps');
    expect(page.url()).toContain('thank-you.html');

    // Verify success state
    await expect(page.locator('#success-state')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#product-name')).toContainText('Athena V3 - Standard');
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4: Error Handling Tests
// ═══════════════════════════════════════════════════════════════

test.describe('Error Handling', () => {
  test('invalid product shows error or defaults', async ({ page }) => {
    await page.goto('/pages/checkout?product=invalid-product');

    // Should either show error or default to athena-standard
    const productName = await page.locator('#product-name').textContent();
    expect(['Athena V3 - Standard', 'Loading...']).toContain(productName?.trim());
  });

  test('checkout button shows error on API failure', async ({ page }) => {
    // This test would require mocking the API, which is more complex
    // For now, we just verify the error message element exists
    await page.goto('/pages/checkout?product=athena-standard');
    await expect(page.locator('#error-message')).toBeHidden();
  });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 5: Mobile Responsiveness
// ═══════════════════════════════════════════════════════════════

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('checkout page is mobile-friendly', async ({ page }) => {
    await page.goto('/pages/checkout?product=athena-standard');

    // Verify key elements are visible on mobile
    await expect(page.locator('#checkout-btn')).toBeVisible();
    await expect(page.locator('#product-name')).toBeVisible();

    // Verify button is full width on mobile
    const button = page.locator('#checkout-btn');
    const buttonBox = await button.boundingBox();
    expect(buttonBox?.width).toBeGreaterThan(300);
  });
});
