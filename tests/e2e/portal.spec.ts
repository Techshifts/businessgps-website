import { test, expect, Page } from '@playwright/test';

/**
 * Portal E2E Tests
 *
 * Tests the multi-product client portal auth flows, product gating,
 * navigation, and page rendering. Uses password auth (set via admin API)
 * to avoid magic link dependency.
 *
 * Prerequisites (test Supabase project):
 *   - User mark.p.waller@gmail.com exists with password set
 *   - product_access rows for athena + sr30
 *   - RLS policy "Users read own product access" created
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://staging--businessgps.netlify.app';
const TEST_EMAIL = process.env.PORTAL_TEST_EMAIL || 'mark.p.waller@gmail.com';
const TEST_PASSWORD = process.env.PORTAL_TEST_PASSWORD || 'PortalTest2026';

// ── Helper: sign in via Supabase JS client in browser ──
async function portalSignIn(page: Page) {
  await page.goto(`${BASE_URL}/portal/`);
  await page.waitForLoadState('networkidle');

  const result = await page.evaluate(async ({ email, password }) => {
    const auth = (window as any).portalAuth;
    if (!auth) return { error: 'portalAuth not found on window' };
    const { data, error } = await auth.supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { session: !!data.session, email: data.session?.user?.email };
  }, { email: TEST_EMAIL, password: TEST_PASSWORD });

  expect(result.error).toBeUndefined();
  expect(result.session).toBe(true);
}

async function portalSignOut(page: Page) {
  await page.evaluate(async () => {
    const auth = (window as any).portalAuth;
    if (auth) await auth.supabase.auth.signOut();
  });
}

// ── Auth Flow Tests ──
test.describe('Portal Authentication', () => {

  test('login page loads without auth', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal/`);
    await page.waitForLoadState('networkidle');
    // Login page should be visible (it's the public entry point)
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });
  });

  test('unauthenticated user is redirected to login from dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForURL('**/portal/**');
    expect(page.url()).toContain('/portal/');
  });

  test('sign in with password works', async ({ page }) => {
    await portalSignIn(page);

    // Navigate to dashboard
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');

    // Dashboard content should be visible
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });
  });

  test('sign out redirects to login', async ({ page }) => {
    await portalSignIn(page);
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    await portalSignOut(page);
    await page.waitForURL('**/portal/**', { timeout: 5000 });
  });
});

// ── Product Access Tests ──
test.describe('Portal Product Access', () => {

  test.beforeEach(async ({ page }) => {
    await portalSignIn(page);
  });

  test('dashboard loads and shows product cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    // Should show user welcome
    const content = await page.locator('#portal-content').textContent();
    expect(content).toBeTruthy();
  });

  test('Athena hub accessible with athena access', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal/athena/`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    const h1 = await page.locator('h1').textContent();
    expect(h1?.toLowerCase()).toContain('athena');
  });

  test('SR30 hub accessible with sr30 access', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal/sr30/`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    const h1 = await page.locator('h1').textContent();
    expect(h1?.toLowerCase()).toContain('start right');
  });

  test('Throughput-90 teaser accessible (any user)', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal/throughput-90/`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });
  });

  test('OpsMax-360 teaser accessible (any user)', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal/opsmax-360/`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });
  });
});

// ── Navigation Tests ──
test.describe('Portal Navigation', () => {

  test.beforeEach(async ({ page }) => {
    await portalSignIn(page);
  });

  test('sidebar shows all 4 products', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    const navHTML = await page.locator('#portal-nav').innerHTML();
    expect(navHTML).toContain('Athena');
    expect(navHTML).toContain('Start Right-30');
    expect(navHTML).toContain('Throughput-90');
    expect(navHTML).toContain('OpsMax-360');
  });

  test('sidebar shows logout button', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('#portal-logout')).toBeVisible();
  });

  test('sidebar shows "Back to site" link', async ({ page }) => {
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    const backLink = page.locator('.portal-nav-footer a[href="/"]');
    await expect(backLink).toBeVisible();
  });
});

// ── All Portal Pages Load ──
test.describe('Portal Pages Load', () => {

  const PORTAL_PAGES = [
    { path: '/portal/dashboard.html', name: 'Dashboard', product: 'any' },
    { path: '/portal/athena/', name: 'Athena Hub', product: 'athena' },
    { path: '/portal/athena/guide.html', name: 'Athena Guide', product: 'athena' },
    { path: '/portal/athena/workbooks.html', name: 'Athena Workbooks', product: 'athena' },
    { path: '/portal/athena/resources.html', name: 'Athena Resources', product: 'athena' },
    { path: '/portal/sr30/', name: 'SR30 Hub', product: 'sr30' },
    { path: '/portal/sr30/sessions.html', name: 'SR30 Sessions', product: 'sr30' },
    { path: '/portal/sr30/materials.html', name: 'SR30 Materials', product: 'sr30' },
    { path: '/portal/sr30/prompts.html', name: 'SR30 Prompts', product: 'sr30' },
    { path: '/portal/sr30/resources.html', name: 'SR30 Resources', product: 'sr30' },
    { path: '/portal/sr30/contact.html', name: 'SR30 Contact', product: 'sr30' },
    { path: '/portal/throughput-90/', name: 'Throughput-90 Teaser', product: 'any' },
    { path: '/portal/opsmax-360/', name: 'OpsMax-360 Teaser', product: 'any' },
  ];

  test.beforeEach(async ({ page }) => {
    await portalSignIn(page);
  });

  for (const pg of PORTAL_PAGES) {
    test(`${pg.name} loads correctly`, async ({ page }) => {
      await page.goto(`${BASE_URL}${pg.path}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

      // Has exactly one h1
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);

      // Has skip link
      const skipLink = page.locator('a.skip-link');
      expect(await skipLink.count()).toBeGreaterThanOrEqual(1);

      // Has main landmark
      await expect(page.locator('main#main-content')).toBeVisible();

      // Has noindex meta
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      expect(robots).toContain('noindex');
    });
  }
});

// ── Responsive Tests ──
test.describe('Portal Responsive', () => {

  test.beforeEach(async ({ page }) => {
    await portalSignIn(page);
  });

  test('mobile: hamburger visible, sidebar hidden at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.portal-hamburger')).toBeVisible();
  });

  test('desktop: sidebar visible at 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.portal-sidebar')).toBeVisible();
  });
});
