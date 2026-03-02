import { test, expect, Page } from '@playwright/test';

/**
 * Portal Frontend Compliance Tests — WEB-004 Extension
 *
 * Validates all portal pages against the portal-specific compliance spec
 * from the PRD Part 2. Tests document structure, accessibility, brand,
 * portal-specific elements, responsive layout, and performance.
 *
 * Uses password auth to avoid magic link dependency.
 *
 * Prerequisites (test Supabase project):
 *   - User mark.p.waller@gmail.com exists with password set
 *   - product_access rows for athena + sr30
 *   - RLS policy "Users read own product access" created
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://staging--businessgps.netlify.app';
const TEST_EMAIL = process.env.PORTAL_TEST_EMAIL || 'mark.p.waller@gmail.com';
const TEST_PASSWORD = process.env.PORTAL_TEST_PASSWORD || 'PortalTest2026';

// ── Portal pages ──
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

// Login page tested separately (no auth required)
const LOGIN_PAGE = { path: '/portal/', name: 'Portal Login' };

// ── Helper: sign in via Supabase JS client in browser ──
async function portalSignIn(page: Page) {
  await page.goto(`${BASE_URL}/portal/`);
  await page.waitForLoadState('networkidle');

  const result = await page.evaluate(async ({ email, password }) => {
    const auth = (window as any).portalAuth;
    if (!auth) return { error: 'portalAuth not found on window' };
    const { data, error } = await auth.supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { session: !!data.session };
  }, { email: TEST_EMAIL, password: TEST_PASSWORD });

  expect(result.error).toBeUndefined();
  expect(result.session).toBe(true);
}

// ═══════════════════════════════════════════════════════════════
// 1. Document Structure (all portal pages including login)
// ═══════════════════════════════════════════════════════════════

test.describe('Portal Document Structure', () => {

  // Login page (no auth needed)
  test('Login: has skip link', async ({ page }) => {
    await page.goto(`${BASE_URL}${LOGIN_PAGE.path}`);
    const skipLink = page.locator('a.skip-link');
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  test('Login: has <main id="main-content">', async ({ page }) => {
    await page.goto(`${BASE_URL}${LOGIN_PAGE.path}`);
    await expect(page.locator('main#main-content')).toHaveCount(1);
  });

  test('Login: has lang="en"', async ({ page }) => {
    await page.goto(`${BASE_URL}${LOGIN_PAGE.path}`);
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });

  test('Login: has exactly one h1', async ({ page }) => {
    await page.goto(`${BASE_URL}${LOGIN_PAGE.path}`);
    expect(await page.locator('h1').count()).toBe(1);
  });

  test('Login: has noindex robots meta', async ({ page }) => {
    await page.goto(`${BASE_URL}${LOGIN_PAGE.path}`);
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('noindex');
  });

  // Protected pages (need auth)
  for (const pg of PORTAL_PAGES) {
    test(`${pg.name}: has skip link`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      await page.waitForLoadState('networkidle');
      const skipLink = page.locator('a.skip-link');
      await expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    test(`${pg.name}: has <main id="main-content">`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main#main-content')).toHaveCount(1);
    });

    test(`${pg.name}: has lang="en"`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBe('en');
    });

    test(`${pg.name}: has exactly one h1`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });
      expect(await page.locator('h1').count()).toBe(1);
    });

    test(`${pg.name}: has noindex robots meta`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      const robots = await page.locator('meta[name="robots"]').getAttribute('content');
      expect(robots).toContain('noindex');
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 2. Head Section — Meta Tags
// ═══════════════════════════════════════════════════════════════

test.describe('Portal Head Section', () => {

  // Login page has full OG/Twitter (it's the public entry point)
  test('Login: has OG tags', async ({ page }) => {
    await page.goto(`${BASE_URL}${LOGIN_PAGE.path}`);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:type"]')).toHaveCount(1);
  });

  test('Login: has Twitter Card tags', async ({ page }) => {
    await page.goto(`${BASE_URL}${LOGIN_PAGE.path}`);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveCount(1);
  });

  // All portal pages must have meta description
  for (const pg of PORTAL_PAGES) {
    test(`${pg.name}: has meta description`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      const desc = page.locator('meta[name="description"]');
      await expect(desc).toHaveCount(1);
      const content = await desc.getAttribute('content');
      expect(content).toBeTruthy();
      expect(content!.length).toBeGreaterThan(10);
    });
  }

  // Portal pages must NOT have canonical URLs (they're noindex)
  for (const pg of PORTAL_PAGES) {
    test(`${pg.name}: no canonical URL (noindex page)`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      const canonical = page.locator('link[rel="canonical"]');
      expect(await canonical.count()).toBe(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 3. Portal-Specific Elements
// ═══════════════════════════════════════════════════════════════

test.describe('Portal-Specific Elements', () => {

  for (const pg of PORTAL_PAGES) {
    test(`${pg.name}: has data-required-product attribute`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      await page.waitForLoadState('networkidle');
      const attr = await page.locator('#portal-content').getAttribute('data-required-product');
      expect(attr).toBeTruthy();
    });

    test(`${pg.name}: loads supabase.min.js`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      const supabaseScript = page.locator('script[src*="supabase.min.js"]');
      expect(await supabaseScript.count()).toBeGreaterThanOrEqual(1);
    });

    test(`${pg.name}: loads portal-auth.js`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      const authScript = page.locator('script[src*="portal-auth.js"]');
      expect(await authScript.count()).toBeGreaterThanOrEqual(1);
    });

    test(`${pg.name}: has portal-loading indicator`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      const loading = page.locator('#portal-loading');
      expect(await loading.count()).toBe(1);
    });

    test(`${pg.name}: sidebar renders with all 4 products`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

      const navHTML = await page.locator('#portal-nav').innerHTML();
      expect(navHTML).toContain('Athena');
      expect(navHTML).toContain('Start Right-30');
      expect(navHTML).toContain('Throughput-90');
      expect(navHTML).toContain('OpsMax-360');
    });

    test(`${pg.name}: has logout button`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#portal-logout')).toBeVisible();
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 4. Accessibility — Images
// ═══════════════════════════════════════════════════════════════

test.describe('Portal Accessibility — Images', () => {
  for (const pg of PORTAL_PAGES) {
    test(`${pg.name}: all images have alt text`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

      const images = await page.locator('img').all();
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        expect(alt, `Image missing alt: ${await img.getAttribute('src')}`).not.toBeNull();
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. Accessibility — Form Labels (login + contact pages)
// ═══════════════════════════════════════════════════════════════

test.describe('Portal Accessibility — Form Labels', () => {
  test('Login: all inputs have labels', async ({ page }) => {
    await page.goto(`${BASE_URL}${LOGIN_PAGE.path}`);
    const inputs = await page.locator('input:not([type="hidden"]):not([type="submit"])').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        expect(await label.count(), `Input "${id}" has no label`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('SR30 Contact: all inputs have labels', async ({ page }) => {
    await portalSignIn(page);
    await page.goto(`${BASE_URL}/portal/sr30/contact.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    const inputs = await page.locator('input:not([type="hidden"]):not([type="submit"])').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        expect(await label.count(), `Input "${id}" has no label`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. Performance — CSS & Scripts
// ═══════════════════════════════════════════════════════════════

test.describe('Portal Performance', () => {
  for (const pg of PORTAL_PAGES) {
    test(`${pg.name}: stylesheet has cache-bust parameter`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      const stylesheet = page.locator('link[rel="stylesheet"][href*="styles.css"]');
      const count = await stylesheet.count();
      if (count > 0) {
        const href = await stylesheet.getAttribute('href');
        expect(href).toMatch(/styles\.css\?v=/);
      }
    });

    test(`${pg.name}: scripts at bottom of body (not in head)`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);

      // supabase.min.js and portal-auth.js should be in body, not head
      const headScripts = await page.locator('head script[src*="supabase.min.js"]').count();
      const headAuthScripts = await page.locator('head script[src*="portal-auth.js"]').count();
      expect(headScripts).toBe(0);
      expect(headAuthScripts).toBe(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 7. Brand Compliance
// ═══════════════════════════════════════════════════════════════

test.describe('Portal Brand Compliance', () => {

  // Title format
  for (const pg of [...PORTAL_PAGES, LOGIN_PAGE]) {
    test(`${pg.name}: title ends with "| BusinessGPS.ai"`, async ({ page }) => {
      if (pg === LOGIN_PAGE) {
        await page.goto(`${BASE_URL}${pg.path}`);
      } else {
        await portalSignIn(page);
        await page.goto(`${BASE_URL}${pg.path}`);
      }
      const title = await page.title();
      expect(title).toMatch(/\| BusinessGPS\.ai$/);
    });
  }

  // Font loading
  test('Login: loads Inter font', async ({ page }) => {
    await page.goto(`${BASE_URL}${LOGIN_PAGE.path}`);
    const fontLink = page.locator('link[href*="fonts.googleapis.com"][href*="Inter"]');
    expect(await fontLink.count()).toBeGreaterThanOrEqual(1);
  });

  // No inline style attributes (except display:none on portal-content — that's required)
  for (const pg of PORTAL_PAGES) {
    test(`${pg.name}: no unauthorised inline styles`, async ({ page }) => {
      await portalSignIn(page);
      await page.goto(`${BASE_URL}${pg.path}`);
      await page.waitForLoadState('networkidle');

      // Get all elements with style attribute, excluding the authorised portal-content display:none
      const styledElements = await page.locator('[style]').all();
      for (const el of styledElements) {
        const id = await el.getAttribute('id');
        const style = await el.getAttribute('style');
        // portal-content display:none is authorised (required for auth guard)
        if (id === 'portal-content' && style?.includes('display: none') || style?.includes('display:none')) {
          continue;
        }
        // access-denied display:none is authorised
        if (id === 'access-denied' && style?.includes('display: none') || style?.includes('display:none')) {
          continue;
        }
        // login-success hidden display is authorised
        if (id === 'login-success') {
          continue;
        }
        // Fail on any other inline styles
        const tag = await el.evaluate(e => e.tagName.toLowerCase());
        expect(style, `Unauthorised inline style on <${tag} id="${id}">`).toBeNull();
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 8. Responsive Layout
// ═══════════════════════════════════════════════════════════════

test.describe('Portal Responsive', () => {

  test('mobile 375px: hamburger visible', async ({ page }) => {
    await portalSignIn(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.portal-hamburger')).toBeVisible();
  });

  test('mobile 375px: sidebar hidden by default', async ({ page }) => {
    await portalSignIn(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    // Sidebar should not have the open class
    const sidebar = page.locator('.portal-sidebar');
    const hasOpenClass = await sidebar.evaluate(el => el.classList.contains('portal-sidebar-open'));
    expect(hasOpenClass).toBe(false);
  });

  test('mobile 375px: hamburger opens sidebar', async ({ page }) => {
    await portalSignIn(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });

    await page.locator('.portal-hamburger').click();
    const sidebar = page.locator('.portal-sidebar');
    const hasOpenClass = await sidebar.evaluate(el => el.classList.contains('portal-sidebar-open'));
    expect(hasOpenClass).toBe(true);
  });

  test('desktop 1024px: sidebar visible', async ({ page }) => {
    await portalSignIn(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.portal-sidebar')).toBeVisible();
  });

  test('desktop 1024px: hamburger hidden', async ({ page }) => {
    await portalSignIn(page);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#portal-content')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.portal-hamburger')).toBeHidden();
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. Security
// ═══════════════════════════════════════════════════════════════

test.describe('Portal Security', () => {

  test('portal pages not in sitemap.xml', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`);
    const body = await response.text();
    expect(body).not.toContain('/portal/');
  });

  test('robots.txt blocks portal', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/robots.txt`);
    const body = await response.text();
    expect(body).toContain('Disallow: /portal/');
  });

  test('no PII in URL after login', async ({ page }) => {
    await portalSignIn(page);
    await page.goto(`${BASE_URL}/portal/dashboard.html`);
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('email=');
    expect(page.url()).not.toContain(TEST_EMAIL);
  });
});
