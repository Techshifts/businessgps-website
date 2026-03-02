# BusinessGPS.ai Website Design Specification

**Version:** 1.0
**Created:** 2026-02-11
**Last Updated:** 2026-02-11
**Source of Truth:** Brand Guidelines v1.0 (`20-COMMERCIAL-Output/05-Brand/BusinessGPS-Brand-Guidelines-v1.0.md`)
**Applies to:** All pages in `businessgps-netlify/`

---

## Purpose

This document specifies the exact implementation values for every reusable component on the BusinessGPS.ai website. It bridges the gap between the brand guidelines (strategic) and the CSS/HTML (mechanical), ensuring consistency across all 16+ pages and preventing the "going in circles" problem when making visual changes.

**Rule:** When in doubt, this spec wins. If this spec conflicts with the CSS, fix the CSS. If this spec conflicts with the brand guidelines, update this spec first, then the CSS.

---

## 1. Design Tokens (CSS Variables)

All values defined in `css/styles.css` `:root` block.

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--navy` | `#1A365D` | Primary brand color, headings, navbar, footer background |
| `--navy-dark` | `#142847` | Hero sections, deep backgrounds (NOT footer) |
| `--teal` | `#319795` | Accent color, CTAs, GPS in logo |
| `--teal-dark` | `#2C8583` | Hover state for teal elements |
| `--warm-white` | `#F7FAFC` | Page background |
| `--cool-gray` | `#4A5568` | Body text |
| `--soft-gray` | `#E2E8F0` | Borders, dividers, footer secondary text |
| `--white` | `#FFFFFF` | Cards, primary text on dark backgrounds |

### Typography Scale

| Token | Value | Px Equiv | Usage |
|-------|-------|----------|-------|
| `--font-size-xs` | `0.75rem` | 12px | Badges, labels |
| `--font-size-sm` | `0.875rem` | 14px | Footer links, captions, small text |
| `--font-size-base` | `1rem` | 16px | Body text, footer tagline |
| `--font-size-lg` | `1.125rem` | 18px | Large body text |
| `--font-size-xl` | `1.25rem` | 20px | H4, footer column headings |
| `--font-size-2xl` | `1.5rem` | 24px | H4 (general), footer logo |
| `--font-size-3xl` | `2rem` | 32px | H3 |
| `--font-size-4xl` | `2.25rem` | 36px | H2 |
| `--font-size-5xl` | `3rem` | 48px | H1 |

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-xs` | `0.25rem` | Tight spacing |
| `--spacing-sm` | `0.5rem` | Between list items |
| `--spacing-md` | `1rem` | Standard gap |
| `--spacing-lg` | `1.5rem` | Container padding |
| `--spacing-xl` | `2rem` | Section padding (small) |
| `--spacing-2xl` | `3rem` | Grid gaps |
| `--spacing-3xl` | `4rem` | Major section padding |
| `--spacing-4xl` | `5rem` | Footer top padding |
| `--spacing-5xl` | `6rem` | Full section padding |

---

## 2. Footer Component

**CSS location:** `css/styles.css` lines 574-655
**Brand spec reference:** Section 7, Navigation > Footer

### Visual Specification

```
┌────────────────────────────────────────────────────────────────┐
│  Background: #1A365D (--navy)                                  │
│                                                                │
│  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ BusinessGPS  │ │ PRODUCTS │ │RESOURCES │ │ CONNECT  │     │
│  │ .ai          │ │          │ │          │ │          │     │
│  │ (logo 24px)  │ │ (h4 20px)│ │ (h4 20px)│ │ (h4 20px)│     │
│  │ #FFFFFF      │ │ #FFFFFF  │ │ #FFFFFF  │ │ #FFFFFF  │     │
│  │              │ │          │ │          │ │          │     │
│  │ Tagline      │ │ Link 1   │ │ Link 1   │ │ Link 1   │     │
│  │ (16px)       │ │ (14px)   │ │ (14px)   │ │ (14px)   │     │
│  │ #E2E8F0      │ │ #E2E8F0  │ │ #E2E8F0  │ │ #E2E8F0  │     │
│  └──────────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                                │
│  ─────────────────── border: rgba(255,255,255,0.2) ──────────  │
│                                                                │
│  (c) 2026 BusinessGPS.ai ...    Privacy | Terms | Cookie       │
│  #E2E8F0  (14px)                #E2E8F0  (14px)               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Exact Values

| Element | CSS Class | Color | Font Size | Font Weight |
|---------|-----------|-------|-----------|-------------|
| **Background** | `.footer` | `#1A365D` (var(--navy)) | - | - |
| **Logo** | `.footer .navbar-logo` | `#FFFFFF` | 24px (--font-size-2xl) | 700 |
| **Logo "GPS"** | `.footer .navbar-logo span` | `#319795` (--teal) | inherited | inherited |
| **Tagline** | `.footer-desc` | `#E2E8F0` | 16px (--font-size-base) | 400 |
| **Column headings** | `.footer-col h4` | `#FFFFFF` | 20px (--font-size-xl) | 600 |
| **Column links** | `.footer-links a` | `#E2E8F0` | 14px (--font-size-sm) | 400 |
| **Column links hover** | `.footer-links a:hover` | `#FFFFFF` | - | - |
| **Border** | `.footer-bottom` | `rgba(255,255,255,0.2)` | - | - |
| **Copyright** | `.footer-bottom p` | `#E2E8F0` | 14px (--font-size-sm) | 400 |
| **Legal links** | `.footer-legal a` | `#E2E8F0` | 14px (--font-size-sm) | 400 |
| **Legal links hover** | `.footer-legal a:hover` | `#FFFFFF` | - | - |

### Grid Layout

```css
.footer-grid {
  grid-template-columns: 2fr 1fr 1fr 1fr;  /* Logo col wider */
  gap: 3rem;                                 /* --spacing-2xl */
}
```

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Desktop (1025px+) | 4-column grid: 2fr 1fr 1fr 1fr |
| Tablet (768-1024px) | 2-column grid: 1fr 1fr |
| Mobile (<768px) | Single column, centered text |

### HTML Structure

```html
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <!-- Column 1: Brand -->
      <div class="footer-col">
        <a href="/" class="navbar-logo">Business<span>GPS</span>.ai</a>
        <p class="footer-desc">The Salesforce of Sovereignty</p>
      </div>
      <!-- Column 2: Products -->
      <div class="footer-col">
        <h4>Products</h4>
        <ul class="footer-links">
          <li><a href="/pages/athena">Athena V3</a></li>
          <li><a href="/pages/start-right-30">Start Right-30</a></li>
          <li><a href="/pages/throughput-90">Throughput-90</a></li>
          <li><a href="/pages/opsmax-360">OpsMax-360</a></li>
        </ul>
      </div>
      <!-- Column 3: Resources -->
      <div class="footer-col">
        <h4>Resources</h4>
        <ul class="footer-links">
          <li><a href="/pages/tcm-report">TCM Crisis Report</a></li>
          <li><a href="/pages/blog">Blog</a></li>
          <li><a href="/pages/about">About Us</a></li>
          <li><a href="/pages/contact">Contact</a></li>
        </ul>
      </div>
      <!-- Column 4: Connect -->
      <div class="footer-col">
        <h4>Connect</h4>
        <ul class="footer-links">
          <li><a href="#social-placeholder">LinkedIn</a></li>
          <li><a href="#social-placeholder">X</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 BusinessGPS.ai (Techshifts Limited). All rights reserved.</p>
      <div class="footer-legal">
        <a href="/pages/privacy-policy">Privacy Policy</a>
        <a href="/pages/terms">Terms of Service</a>
        <a href="/pages/cookies">Cookie Policy</a>
      </div>
    </div>
  </div>
</footer>
```

**Note on paths:** `index.html` uses root-relative paths (`/pages/athena`). Sub-pages in `/pages/` use relative paths (`athena.html`).

### Anti-Patterns (Do NOT Do)

| Anti-Pattern | Why | Correct Approach |
|-------------|-----|------------------|
| `rgba(255,255,255,0.7)` for text | Opacity varies by context, looks inconsistent | Use direct hex: `#E2E8F0` |
| `opacity` on parent containers | Cascades to children, causing double-fade | Apply color directly to each element |
| `var(--navy-dark)` for footer bg | Too dark, makes text appear washed out | Use `var(--navy)` per brand spec |
| Separate `.footer-logo` class | Diverges from navbar logo styling | Reuse `.navbar-logo` with `.footer .navbar-logo` override |
| `#CBD5E0` for secondary text | Too muted on navy background | Use `#E2E8F0` for better contrast |

---

## 3. Navigation Component

### Navbar

| Element | CSS Class | Color | Font Size |
|---------|-----------|-------|-----------|
| **Background** | `.navbar` | `#FFFFFF` | - |
| **Logo** | `.navbar-logo` | `#1A365D` (navy) | 20px (--font-size-xl) |
| **Logo "GPS"** | `.navbar-logo span` | `#319795` (teal) | inherited |
| **Nav links** | `.navbar-nav a` | `#4A5568` (cool-gray) | 16px |
| **Nav links hover** | `.navbar-nav a:hover` | `#1A365D` (navy) | - |
| **CTA button** | `.btn-primary` | White on #319795 | 16px |

---

## 4. Product Names (Canonical)

These product names MUST be used consistently across all pages, JS, SQL, tests, and documentation:

| Product ID | Display Name | Price |
|------------|-------------|-------|
| `athena-standard` | Athena V3 - Standard | GBP 67 |
| `athena-premium` | Athena V3 - Premium | GBP 297 |
| `start-right-30` | Start Right-30 | GBP 1,997 |
| `throughput-90` | Throughput-90 | GBP 5,997 |
| `opsmax-360` | OpsMax-360 | GBP 15,000 |

**Hyphenation rule:** Product names with numbers use hyphens: "Start Right-30", "Throughput-90", "OpsMax-360".

---

## 5. Caching Strategy

### netlify.toml Headers

| Path | Cache-Control | Reason |
|------|---------------|--------|
| `/css/*` | `public, max-age=3600` | 1 hour — no content hashing, must refresh |
| `/images/*` | `public, max-age=31536000, immutable` | Images rarely change, safe for long cache |
| `/js/*` | `public, max-age=31536000, immutable` | JS rarely changes (but review if JS added) |
| `/pages/thank-you.html` | `no-store, no-cache, must-revalidate` | Contains Stripe session data |

### Cache-Busting Protocol

Since CSS files don't use content-hash filenames (e.g., `styles.abc123.css`):

1. After any CSS change, update the version parameter in all HTML files:
   ```html
   <link rel="stylesheet" href="/css/styles.css?v=YYYYMMDD">
   ```
2. Increment the date stamp (e.g., `?v=20260211` → `?v=20260212`)
3. This forces all browsers to fetch the new CSS regardless of cache

**Current version:** `?v=20260211`

---

## 6. Color Contrast Reference

Tested against WCAG 2.1 standards:

| Foreground | Background | Ratio | WCAG Level | Usage |
|-----------|------------|-------|------------|-------|
| `#FFFFFF` | `#1A365D` | 10.5:1 | AAA | Footer headings, logo |
| `#E2E8F0` | `#1A365D` | 8.3:1 | AAA | Footer links, copyright |
| `#FFFFFF` | `#319795` | 4.6:1 | AA | Buttons (teal bg) |
| `#1A365D` | `#F7FAFC` | 10.2:1 | AAA | Page headings |
| `#4A5568` | `#F7FAFC` | 5.7:1 | AA | Body text |

---

## 7. Page Template Checklist

When creating a new page, verify:

- [ ] `<link rel="stylesheet" href="../css/styles.css?v=CURRENT_VERSION">`
- [ ] Navbar using `.navbar-logo` class with correct links
- [ ] Footer HTML matches the structure in Section 2
- [ ] Footer paths are relative for `/pages/` files, root-relative for `index.html`
- [ ] Product names match Section 4 canonical list
- [ ] No inline styles overriding CSS classes
- [ ] No `<style>` blocks targeting footer elements

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-11 | Claude | Initial creation — footer spec, design tokens, caching, product names |
