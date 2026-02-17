/**
 * Portal Auth Module — Multi-Product Aware
 * Shared auth logic for all protected portal pages.
 *
 * Usage: Include supabase.min.js before this script.
 * Set data-required-product on #portal-content to gate by product.
 * Set data-required-product="any" for pages visible to any logged-in user.
 */

(function () {
  'use strict';

  // ── Config ──
  var SUPABASE_URL = 'https://rqffoadqydlebipkeckw.supabase.co';
  var SUPABASE_ANON_KEY = '';

  // Allow config override from global
  if (window.PORTAL_SUPABASE_ANON_KEY) {
    SUPABASE_ANON_KEY = window.PORTAL_SUPABASE_ANON_KEY;
  }

  var LOGIN_PATH = '/portal/';
  var DASHBOARD_PATH = '/portal/dashboard.html';

  // ── Supabase Client ──
  if (!window.supabase) {
    console.error('portal-auth: supabase.min.js must be loaded first');
    return;
  }

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ── DOM References ──
  var portalContent = document.getElementById('portal-content');
  var portalLoading = document.getElementById('portal-loading');
  var portalNav = document.getElementById('portal-nav');

  // ── Product Definitions ──
  var PRODUCTS = [
    {
      id: 'athena',
      name: 'Athena',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
      links: [
        { label: 'Workspace', href: '/portal/athena/' },
        { label: 'Guide', href: '/portal/athena/guide.html' },
        { label: 'Workbooks', href: '/portal/athena/workbooks.html' },
        { label: 'Resources', href: '/portal/athena/resources.html' }
      ]
    },
    {
      id: 'sr30',
      name: 'Start Right-30',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      links: [
        { label: 'Programme Hub', href: '/portal/sr30/' },
        { label: 'Sessions', href: '/portal/sr30/sessions.html' },
        { label: 'Materials', href: '/portal/sr30/materials.html' },
        { label: 'Prompts', href: '/portal/sr30/prompts.html' },
        { label: 'Resources', href: '/portal/sr30/resources.html' },
        { label: 'Contact', href: '/portal/sr30/contact.html' }
      ]
    },
    {
      id: 'throughput-90',
      name: 'Throughput-90',
      locked: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
      links: [
        { label: 'Overview', href: '/portal/throughput-90/' }
      ]
    },
    {
      id: 'opsmax-360',
      name: 'OpsMax-360',
      locked: true,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
      links: [
        { label: 'Overview', href: '/portal/opsmax-360/' }
      ]
    }
  ];

  // ── Helpers ──
  function currentPath() {
    return window.location.pathname;
  }

  function redirectTo(path) {
    window.location.href = path;
  }

  function showContent() {
    if (portalContent) portalContent.style.display = '';
    if (portalLoading) portalLoading.style.display = 'none';
  }

  function hideLoading() {
    if (portalLoading) portalLoading.style.display = 'none';
  }

  // ── Fetch User Product Access ──
  async function getUserProducts(email) {
    var result = await sb
      .from('product_access')
      .select('product_id, status, expires_at')
      .eq('email', email)
      .eq('status', 'active');

    if (result.error) {
      console.error('portal-auth: product access query failed', result.error);
      return [];
    }

    var now = new Date().toISOString();
    return (result.data || [])
      .filter(function (row) {
        return !row.expires_at || row.expires_at > now;
      })
      .map(function (row) {
        return row.product_id;
      });
  }

  // ── Render Sidebar Navigation ──
  function renderNav(userProducts, userEmail) {
    if (!portalNav) return;

    var path = currentPath();
    var html = '';

    html += '<div class="portal-sidebar">';
    html += '<div class="portal-sidebar-header">';
    html += '<a href="/portal/dashboard.html" class="portal-logo">Business<span>GPS</span>.ai</a>';
    html += '<button class="portal-nav-close" aria-label="Close navigation">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    html += '</button>';
    html += '</div>';

    // Dashboard link
    var dashActive = path.indexOf('/portal/dashboard') !== -1 ? ' portal-nav-active' : '';
    html += '<a href="/portal/dashboard.html" class="portal-nav-link' + dashActive + '">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
    html += ' Dashboard</a>';

    // Product sections
    PRODUCTS.forEach(function (product) {
      var hasAccess = userProducts.indexOf(product.id) !== -1;
      // SR30 users also get athena access
      if (product.id === 'athena' && !hasAccess && userProducts.indexOf('sr30') !== -1) {
        hasAccess = true;
      }
      var isLocked = product.locked && !hasAccess;
      var showSection = hasAccess || product.locked;

      if (!showSection) return;

      html += '<div class="portal-nav-section">';
      html += '<div class="portal-nav-section-title">';
      html += product.icon + ' ' + product.name;
      if (isLocked) {
        html += ' <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="portal-lock-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      }
      html += '</div>';

      product.links.forEach(function (link, idx) {
        if (isLocked && idx > 0) return;
        var linkActive = path === link.href || path === link.href.replace('.html', '') || path === link.href.replace('/index.html', '/') ? ' portal-nav-active' : '';
        html += '<a href="' + link.href + '" class="portal-nav-link portal-nav-sublink' + linkActive;
        if (isLocked) html += ' portal-nav-locked';
        html += '">' + link.label + '</a>';
      });

      html += '</div>';
    });

    // Upsell for Athena-only users
    if (userProducts.indexOf('sr30') === -1 && (userProducts.indexOf('athena') !== -1)) {
      html += '<div class="portal-nav-upsell">';
      html += '<a href="/start-right-30" class="btn btn-primary btn-sm btn-full">Upgrade to Start Right-30</a>';
      html += '</div>';
    }

    // Footer links
    html += '<div class="portal-nav-footer">';
    html += '<a href="/" class="portal-nav-link">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M15 18l-6-6 6-6"/></svg>';
    html += ' Back to site</a>';
    html += '<a href="#" class="portal-nav-link" id="portal-logout">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
    html += ' Log out</a>';
    html += '</div>';

    html += '</div>';

    // Mobile hamburger
    html += '<button class="portal-hamburger" aria-label="Open navigation" aria-expanded="false">';
    html += '<span></span><span></span><span></span>';
    html += '</button>';

    portalNav.innerHTML = html;

    // Bind logout
    var logoutBtn = document.getElementById('portal-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function (e) {
        e.preventDefault();
        sb.auth.signOut().then(function () {
          redirectTo(LOGIN_PATH);
        });
      });
    }

    // Bind hamburger
    var hamburger = portalNav.querySelector('.portal-hamburger');
    var sidebar = portalNav.querySelector('.portal-sidebar');
    if (hamburger && sidebar) {
      hamburger.addEventListener('click', function () {
        sidebar.classList.toggle('portal-sidebar-open');
        hamburger.setAttribute('aria-expanded', sidebar.classList.contains('portal-sidebar-open'));
      });
    }

    var closeBtn = portalNav.querySelector('.portal-nav-close');
    if (closeBtn && sidebar) {
      closeBtn.addEventListener('click', function () {
        sidebar.classList.remove('portal-sidebar-open');
        if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
      });
    }
  }

  // ── Main Init ──
  async function init() {
    var sessionResult = await sb.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;

    if (!session) {
      // Not logged in — allow login page, redirect all others
      var path = currentPath();
      if (path === '/portal/' || path === '/portal' || path.indexOf('/portal/index.html') !== -1) {
        hideLoading();
        if (portalContent) portalContent.style.display = '';
      } else {
        redirectTo(LOGIN_PATH);
      }
      return;
    }

    var user = session.user;
    var email = user.email;

    // On login page with valid session — go to dashboard
    var path = currentPath();
    if (path === '/portal/' || path === '/portal' || path.indexOf('/portal/index.html') !== -1) {
      redirectTo(DASHBOARD_PATH);
      return;
    }

    // Fetch product access
    var userProducts = await getUserProducts(email);

    // Check page-level product requirement
    var requiredProduct = portalContent ? portalContent.getAttribute('data-required-product') : null;

    if (requiredProduct && requiredProduct !== 'any') {
      var effectiveProducts = userProducts.slice();
      // SR30 users also get Athena
      if (effectiveProducts.indexOf('sr30') !== -1 && effectiveProducts.indexOf('athena') === -1) {
        effectiveProducts.push('athena');
      }

      if (effectiveProducts.indexOf(requiredProduct) === -1) {
        sessionStorage.setItem('portal_access_denied', requiredProduct);
        redirectTo(DASHBOARD_PATH);
        return;
      }
    }

    // Render nav and show content
    renderNav(userProducts, email);
    showContent();

    // Store user info
    window.portalUser = {
      email: email,
      products: userProducts,
      name: user.user_metadata && user.user_metadata.first_name ? user.user_metadata.first_name : email.split('@')[0]
    };

    // Dispatch ready event
    document.dispatchEvent(new CustomEvent('portal-ready', { detail: window.portalUser }));
  }

  // ── Auth State Listener ──
  sb.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_OUT') {
      redirectTo(LOGIN_PATH);
    }
  });

  // ── Expose for login page ──
  window.portalAuth = {
    supabase: sb,
    signInWithOtp: function (email) {
      return sb.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: window.location.origin + DASHBOARD_PATH
        }
      });
    },
    signOut: function () {
      return sb.auth.signOut();
    }
  };

  // ── Run ──
  init();
})();
