/**
 * Debug Environment Variables (TEMPORARY - remove before going live)
 * Returns non-sensitive environment configuration for debugging
 */

exports.handler = async (event) => {
  // Only allow from staging
  const host = event.headers.host || '';
  if (!host.includes('staging')) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Debug only available on staging' }),
    };
  }

  const config = {
    // URL configuration
    urls: {
      URL: process.env.URL || '(not set)',
      DEPLOY_URL: process.env.DEPLOY_URL || '(not set)',
      DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL || '(not set)',
      computed_redirect: process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || process.env.URL || 'http://localhost:8888',
    },
    // Netlify context
    context: {
      CONTEXT: process.env.CONTEXT || '(not set)',
      BRANCH: process.env.BRANCH || '(not set)',
      HEAD: process.env.HEAD || '(not set)',
    },
    // Stripe config (just checking if set, not values)
    stripe: {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? `${process.env.STRIPE_SECRET_KEY.substring(0, 8)}...` : '(not set)',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? 'set' : '(not set)',
      STRIPE_PRICE_ATHENA_STD: process.env.STRIPE_PRICE_ATHENA_STD || '(not set)',
      STRIPE_PRICE_ATHENA_PREM: process.env.STRIPE_PRICE_ATHENA_PREM || '(not set)',
      STRIPE_PRICE_SR30: process.env.STRIPE_PRICE_SR30 || '(not set)',
      STRIPE_PRICE_TP90: process.env.STRIPE_PRICE_TP90 || '(not set)',
      STRIPE_PRICE_OPSMAX: process.env.STRIPE_PRICE_OPSMAX || '(not set)',
    },
    // Supabase (just checking if set)
    supabase: {
      SUPABASE_URL: process.env.SUPABASE_URL || '(not set)',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'set' : '(not set)',
    },
  };

  // Check for duplicate price IDs
  const priceIds = [
    process.env.STRIPE_PRICE_ATHENA_STD,
    process.env.STRIPE_PRICE_ATHENA_PREM,
    process.env.STRIPE_PRICE_SR30,
    process.env.STRIPE_PRICE_TP90,
    process.env.STRIPE_PRICE_OPSMAX,
  ].filter(Boolean);

  const uniquePriceIds = [...new Set(priceIds)];

  config.diagnostics = {
    total_price_ids: priceIds.length,
    unique_price_ids: uniquePriceIds.length,
    has_duplicates: priceIds.length !== uniquePriceIds.length,
    duplicate_warning: priceIds.length !== uniquePriceIds.length
      ? 'WARNING: Some products share the same price ID!'
      : 'OK: All price IDs are unique',
  };

  // Check if TP90 and OPSMAX are the same
  if (process.env.STRIPE_PRICE_TP90 === process.env.STRIPE_PRICE_OPSMAX) {
    config.diagnostics.opsmax_issue = 'ISSUE FOUND: STRIPE_PRICE_TP90 and STRIPE_PRICE_OPSMAX are the same!';
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config, null, 2),
  };
};
