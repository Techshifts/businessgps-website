import { test, expect, Page } from '@playwright/test';

/**
 * Frontend Compliance Tests — SOP-WEB-005
 *
 * Validates all pages against the frontend compliance specification
 * derived from the 37-finding remediation on 2026-02-17.
 *
 * Categories:
 * - Document structure (skip link, <main>, lang)
 * - Head section (meta, canonical, OG, Twitter Card)
 * - Accessibility (alt text, form labels, aria, focus, contrast)
 * - Semantic HTML (heading hierarchy, landmarks)
 * - Performance (image dimensions, lazy loading)
 * - SEO (robots.txt, sitemap.xml, JSON-LD)
 * - Navigation (mobile toggle, aria-expanded)
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://staging--businessgps.netlify.app';

// All pages to test (path relative to base URL)
const ALL_PAGES = [
  { path: '/', name: 'Homepage' },
  { path: '/pages/athena.html', name: 'Athena' },
  { path: '/pages/start-right-30.html', name: 'Start Right 30' },
  { path: '/pages/throughput-90.html', name: 'Throughput 90' },
  { path: '/pages/opsmax-360.html', name: 'OpsMax 360' },
  { path: '/pages/tcm-report.html', name: 'TCM Report' },
  { path: '/pages/contact.html', name: 'Contact' },
  { path: '/pages/about.html', name: 'About' },
  { path: '/pages/blog.html', name: 'Blog' },
  { path: '/pages/checkout.html', name: 'Checkout' },
  { path: '/pages/team-packages.html', name: 'Team Packages' },
  { path: '/pages/privacy-policy.html', name: 'Privacy Policy' },
  { path: '/pages/terms.html', name: 'Terms' },
  { path: '/pages/cookies.html', name: 'Cookies' },
  { path: '/pages/thank-you.html', name: 'Thank You' },
  { path: '/pages/tcm-report-thanks.html', name: 'TCM Report Thanks' },
  { path: '/pages/sap-transformation.html', name: 'SAP Transformation' },
  { path: '/pages/athena-intro.html', name: 'Athena Intro' },
];

// Pages that should have JSON-LD structured data
const JSONLD_PAGES = [
  { path: '/', type: 'Organization' },
  { path: '/pages/athena.html', type: 'Product' },
  { path: '/pages/start-right-30.html', type: 'Product' },
  { path: '/pages/throughput-90.html', type: 'Product' },
  { path: '/pages/opsmax-360.html', type: 'Product' },
];

// Pages excluded from canonical URL checks (noindex pages)
const NOINDEX_PAGES = ['/pages/tcm-report-thanks.html'];

// ═══════════════════════════════════════════════════════════════
// 1. Document Structure (SOP-WEB-005 §1)
// ═══════════════════════════════════════════════════════════════

test.describe('Document Structure', () => {
  for (const page of ALL_PAGES) {
    test(`${page.name}: has skip link`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const skipLink = p.locator('a.skip-link');
      await expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    test(`${page.name}: has <main id="main-content">`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const main = p.locator('main#main-content');
      await expect(main).toHaveCount(1);
    });

    test(`${page.name}: has lang="en"`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const lang = await p.locator('html').getAttribute('lang');
      expect(lang).toBe('en');
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 2. Head Section (SOP-WEB-005 §2)
// ═══════════════════════════════════════════════════════════════

test.describe('Head Section — Meta Tags', () => {
  for (const page of ALL_PAGES) {
    test(`${page.name}: has meta description`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const desc = p.locator('meta[name="description"]');
      await expect(desc).toHaveCount(1);
      const content = await desc.getAttribute('content');
      expect(content).toBeTruthy();
      expect(content!.length).toBeGreaterThan(20);
    });

    test(`${page.name}: has OG tags`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      await expect(p.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(p.locator('meta[property="og:description"]')).toHaveCount(1);
      await expect(p.locator('meta[property="og:type"]')).toHaveCount(1);
      await expect(p.locator('meta[property="og:url"]')).toHaveCount(1);
    });

    test(`${page.name}: has Twitter Card tags`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      await expect(p.locator('meta[name="twitter:card"]')).toHaveCount(1);
      await expect(p.locator('meta[name="twitter:title"]')).toHaveCount(1);
      await expect(p.locator('meta[name="twitter:description"]')).toHaveCount(1);
    });
  }
});

test.describe('Head Section — Canonical URLs', () => {
  for (const page of ALL_PAGES.filter(p => !NOINDEX_PAGES.includes(p.path))) {
    test(`${page.name}: has canonical URL`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const canonical = p.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      const href = await canonical.getAttribute('href');
      expect(href).toMatch(/^https:\/\/capability\.ai/);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 3. Accessibility (SOP-WEB-005 §3)
// ═══════════════════════════════════════════════════════════════

test.describe('Accessibility — Images', () => {
  for (const page of ALL_PAGES) {
    test(`${page.name}: all images have alt text`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const images = await p.locator('img').all();
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        expect(alt, `Image missing alt: ${await img.getAttribute('src')}`).not.toBeNull();
      }
    });

    test(`${page.name}: all images have width and height`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const images = await p.locator('img').all();
      for (const img of images) {
        const width = await img.getAttribute('width');
        const height = await img.getAttribute('height');
        const src = await img.getAttribute('src');
        expect(width, `Image missing width: ${src}`).toBeTruthy();
        expect(height, `Image missing height: ${src}`).toBeTruthy();
      }
    });
  }
});

test.describe('Accessibility — Form Labels', () => {
  test('TCM Report: all inputs have labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/tcm-report.html`);
    const inputs = await page.locator('input:not([type="hidden"]):not([type="submit"])').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const count = await label.count();
        expect(count, `Input "${name || id}" has no label`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('Contact: all inputs have labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/contact.html`);
    const inputs = await page.locator('input:not([type="hidden"]):not([type="submit"])').all();
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const count = await label.count();
        expect(count, `Input "${name || id}" has no label`).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

test.describe('Accessibility — Navigation', () => {
  for (const page of ALL_PAGES) {
    test(`${page.name}: nav toggle has aria-expanded`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const toggle = p.locator('.navbar-toggle');
      const count = await toggle.count();
      if (count > 0) {
        const expanded = await toggle.getAttribute('aria-expanded');
        expect(expanded).toBe('false');
      }
    });

    test(`${page.name}: nav toggle has aria-label`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const toggle = p.locator('.navbar-toggle');
      const count = await toggle.count();
      if (count > 0) {
        const label = await toggle.getAttribute('aria-label');
        expect(label).toBeTruthy();
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 4. Semantic HTML (SOP-WEB-005 §4)
// ═══════════════════════════════════════════════════════════════

test.describe('Semantic HTML', () => {
  for (const page of ALL_PAGES) {
    test(`${page.name}: has exactly one h1`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const h1Count = await p.locator('h1').count();
      expect(h1Count).toBe(1);
    });

    test(`${page.name}: has nav, main, footer landmarks`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      await expect(p.locator('nav')).toHaveCount(1);
      await expect(p.locator('main')).toHaveCount(1);
      await expect(p.locator('footer')).toHaveCount(1);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. Performance (SOP-WEB-005 §5)
// ═══════════════════════════════════════════════════════════════

test.describe('Performance — CSS Cache Busting', () => {
  for (const page of ALL_PAGES) {
    test(`${page.name}: stylesheet has cache-bust parameter`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const stylesheet = p.locator('link[rel="stylesheet"][href*="styles.css"]');
      const count = await stylesheet.count();
      if (count > 0) {
        const href = await stylesheet.getAttribute('href');
        expect(href).toMatch(/styles\.css\?v=/);
      }
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6. SEO (SOP-WEB-005 §9)
// ═══════════════════════════════════════════════════════════════

test.describe('SEO — Site-level Files', () => {
  test('robots.txt exists and has sitemap reference', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/robots.txt`);
    expect(response.ok()).toBeTruthy();
    const body = await response.text();
    expect(body).toContain('Sitemap:');
    expect(body).toContain('capability.ai');
  });

  test('sitemap.xml exists and is valid XML', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/sitemap.xml`);
    expect(response.ok()).toBeTruthy();
    const body = await response.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('<url>');
    expect(body).toContain('capability.ai');
  });
});

test.describe('SEO — JSON-LD Structured Data', () => {
  for (const page of JSONLD_PAGES) {
    test(`${page.path}: has JSON-LD ${page.type} schema`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`);
      const scripts = await p.locator('script[type="application/ld+json"]').all();
      expect(scripts.length).toBeGreaterThanOrEqual(1);

      let foundType = false;
      for (const script of scripts) {
        const content = await script.textContent();
        if (content && content.includes(`"@type":"${page.type}"`)) {
          foundType = true;
          break;
        }
        // Also check with spaces around colon
        if (content && content.includes(`"@type": "${page.type}"`)) {
          foundType = true;
          break;
        }
      }
      expect(foundType, `No JSON-LD with @type="${page.type}" found`).toBe(true);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 7. Security (SEC-01 regression)
// ═══════════════════════════════════════════════════════════════

test.describe('Security', () => {
  test('TCM report form does not put email in URL', async ({ page }) => {
    await page.goto(`${BASE_URL}/pages/tcm-report.html`);

    // Fill form
    const form = page.locator('#report-form');
    const emailInput = form.locator('input[name="email"]');
    const nameInput = form.locator('input[name="first_name"]');

    // Only test if the form exists and is interactive
    if (await emailInput.count() > 0 && await nameInput.count() > 0) {
      await nameInput.fill('SEC01 Test');
      await emailInput.fill('sec01-test@techshifts.io');

      // Submit
      await form.locator('button[type="submit"]').click();

      // Wait for redirect
      await page.waitForURL(/tcm-report-thanks/, { timeout: 10000 });

      // Verify email is NOT in the URL (SEC-01 fix)
      expect(page.url()).not.toContain('email=');
      expect(page.url()).not.toContain('sec01-test');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. Social Links (footer)
// ═══════════════════════════════════════════════════════════════

test.describe('Footer Social Links', () => {
  test('social links have aria-labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const socialLinks = await page.locator('footer a[aria-label*="coming soon"]').all();
    // We should have social links with "coming soon" labels
    expect(socialLinks.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. Build System Files
// ═══════════════════════════════════════════════════════════════

test.describe('Build System', () => {
  test('GA4 snippet present on homepage (placeholder OK)', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    const ga4Script = page.locator('script[src*="googletagmanager"]');
    await expect(ga4Script).toHaveCount(1);
  });
});
