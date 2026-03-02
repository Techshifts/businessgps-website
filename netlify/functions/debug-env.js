/**
 * Debug Environment Variables (TEMPORARY - remove before going live)
 * Returns only set/not-set status for environment variables.
 * NO secret values, prefixes, or IDs are exposed.
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

  // Helper: returns 'set' or '(not set)' — never leaks values
  const check = (envVar) => process.env[envVar] ? 'set' : '(not set)';

  const config = {
    // URL configuration (non-sensitive)
    urls: {
      URL: process.env.URL || '(not set)',
      DEPLOY_URL: process.env.DEPLOY_URL || '(not set)',
      DEPLOY_PRIME_URL: process.env.DEPLOY_PRIME_URL || '(not set)',
    },
    // Netlify context (non-sensitive)
    context: {
      CONTEXT: process.env.CONTEXT || '(not set)',
      BRANCH: process.env.BRANCH || '(not set)',
    },
    // Stripe config — set/not-set only
    stripe: {
      STRIPE_SECRET_KEY: check('STRIPE_SECRET_KEY'),
      STRIPE_WEBHOOK_SECRET: check('STRIPE_WEBHOOK_SECRET'),
      STRIPE_PRICE_ATHENA_STD: check('STRIPE_PRICE_ATHENA_STD'),
      STRIPE_PRICE_ATHENA_PREM: check('STRIPE_PRICE_ATHENA_PREM'),
      STRIPE_PRICE_SR30: check('STRIPE_PRICE_SR30'),
      STRIPE_PRICE_TP90: check('STRIPE_PRICE_TP90'),
      STRIPE_PRICE_OPSMAX: check('STRIPE_PRICE_OPSMAX'),
    },
    // Supabase — set/not-set only
    supabase: {
      SUPABASE_URL: check('SUPABASE_URL'),
      SUPABASE_SERVICE_KEY: check('SUPABASE_SERVICE_KEY'),
    },
    // HubSpot — set/not-set only
    hubspot: {
      HUBSPOT_API_KEY: check('HUBSPOT_API_KEY'),
      HUBSPOT_PIPELINE_PRODUCTS: check('HUBSPOT_PIPELINE_PRODUCTS'),
      HUBSPOT_PIPELINE_ENTERPRISE: check('HUBSPOT_PIPELINE_ENTERPRISE'),
      HUBSPOT_STAGE_CLOSEDWON_PRODUCTS: check('HUBSPOT_STAGE_CLOSEDWON_PRODUCTS'),
      HUBSPOT_STAGE_CLOSEDWON_ENTERPRISE: check('HUBSPOT_STAGE_CLOSEDWON_ENTERPRISE'),
    },
    // AWeber — set/not-set only
    aweber: {
      AWEBER_ACCESS_TOKEN: check('AWEBER_ACCESS_TOKEN'),
      AWEBER_ACCOUNT_ID: check('AWEBER_ACCOUNT_ID'),
      AWEBER_LIST_ID_LEADS: check('AWEBER_LIST_ID_LEADS'),
      AWEBER_LIST_ID_CUSTOMERS: check('AWEBER_LIST_ID_CUSTOMERS'),
      AWEBER_LIST_ID_ENTERPRISE: check('AWEBER_LIST_ID_ENTERPRISE'),
    },
  };

  // Diagnostics: check for duplicate price IDs without revealing them
  const priceIds = [
    process.env.STRIPE_PRICE_ATHENA_STD,
    process.env.STRIPE_PRICE_ATHENA_PREM,
    process.env.STRIPE_PRICE_SR30,
    process.env.STRIPE_PRICE_TP90,
    process.env.STRIPE_PRICE_OPSMAX,
  ].filter(Boolean);

  const uniquePriceIds = [...new Set(priceIds)];

  config.diagnostics = {
    total_price_ids_configured: priceIds.length,
    unique_price_ids: uniquePriceIds.length,
    has_duplicates: priceIds.length !== uniquePriceIds.length,
    status: priceIds.length !== uniquePriceIds.length
      ? 'WARNING: Some products share the same price ID!'
      : 'OK: All price IDs are unique',
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config, null, 2),
  };
};
