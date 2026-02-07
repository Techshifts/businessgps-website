/**
 * AWeber Subscribe Function
 * Adds subscribers to AWeber lists with appropriate tags
 *
 * Token Management:
 * AWeber OAuth tokens expire every 2 hours. This function stores tokens
 * in Supabase (production instance, shared across environments) and
 * auto-refreshes when they expire.
 *
 * Env vars needed:
 *   AWEBER_ACCOUNT_ID          - AWeber account ID
 *   AWEBER_CLIENT_ID           - OAuth app client ID
 *   AWEBER_CLIENT_SECRET       - OAuth app client secret
 *   AWEBER_TOKEN_STORE_URL     - Production Supabase URL (shared)
 *   AWEBER_TOKEN_STORE_KEY     - Production Supabase service key (shared)
 *   AWEBER_LIST_ID_LEADS       - List ID for leads
 *   AWEBER_LIST_ID_CUSTOMERS   - List ID for customers
 *   AWEBER_LIST_ID_ENTERPRISE  - List ID for enterprise
 */

const { createClient } = require('@supabase/supabase-js');

const AWEBER_API_BASE = 'https://api.aweber.com/1.0';
const AWEBER_TOKEN_URL = 'https://auth.aweber.com/oauth2/token';

// List type to ID mapping (set in environment variables)
const LIST_IDS = {
  leads: process.env.AWEBER_LIST_ID_LEADS,
  customers: process.env.AWEBER_LIST_ID_CUSTOMERS,
  enterprise: process.env.AWEBER_LIST_ID_ENTERPRISE,
};

// Get Supabase client for token store (production instance, shared)
function getTokenStore() {
  const url = process.env.AWEBER_TOKEN_STORE_URL;
  const key = process.env.AWEBER_TOKEN_STORE_KEY;
  if (!url || !key) {
    throw new Error('AWeber token store not configured (AWEBER_TOKEN_STORE_URL / AWEBER_TOKEN_STORE_KEY)');
  }
  return createClient(url, key);
}

// Read current tokens from Supabase
async function getTokens() {
  const supabase = getTokenStore();
  const { data, error } = await supabase
    .from('api_tokens')
    .select('access_token, refresh_token')
    .eq('service', 'aweber')
    .single();

  if (error || !data) {
    throw new Error('Failed to read AWeber tokens from Supabase: ' + (error?.message || 'no data'));
  }
  return data;
}

// Save refreshed tokens to Supabase
async function saveTokens(accessToken, refreshToken) {
  const supabase = getTokenStore();
  const { error } = await supabase
    .from('api_tokens')
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      updated_at: new Date().toISOString(),
    })
    .eq('service', 'aweber');

  if (error) {
    console.error('Failed to save refreshed AWeber tokens:', error);
  }
}

// Refresh the access token using the refresh token
async function refreshAccessToken(currentRefreshToken) {
  const clientId = process.env.AWEBER_CLIENT_ID;
  const clientSecret = process.env.AWEBER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('AWeber client credentials not configured');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(AWEBER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(currentRefreshToken)}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AWeber token refresh failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

// Make AWeber API request with auto-refresh on 401
async function aweberRequest(endpoint, method = 'GET', body = null) {
  const accountId = process.env.AWEBER_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('AWEBER_ACCOUNT_ID not configured');
  }

  const tokens = await getTokens();
  const url = `${AWEBER_API_BASE}/accounts/${accountId}${endpoint}`;

  // First attempt with current token
  let response = await makeRequest(url, method, body, tokens.access_token);

  // If 401, refresh token and retry once
  if (response.status === 401) {
    console.log('AWeber token expired, refreshing...');
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    await saveTokens(newTokens.accessToken, newTokens.refreshToken);
    response = await makeRequest(url, method, body, newTokens.accessToken);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AWeber API error: ${response.status} - ${errorText}`);
  }

  if (response.status === 201 || response.status === 204) {
    return { success: true };
  }

  return response.json();
}

// Raw HTTP request helper
async function makeRequest(url, method, body, accessToken) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(url, options);
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { email, firstName, lastName, company, listType, tags, source } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    // Determine which list to use (default to leads)
    const targetListType = listType || 'leads';
    const listId = LIST_IDS[targetListType];

    if (!listId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Invalid list type: ${targetListType}` }),
      };
    }

    // Build subscriber data
    const subscriberData = {
      email,
      name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
      custom_fields: {},
    };

    if (company) {
      subscriberData.custom_fields.company = company;
    }
    if (source) {
      subscriberData.custom_fields.source = source;
    }
    if (firstName) {
      subscriberData.custom_fields.first_name = firstName;
    }

    if (tags && Array.isArray(tags) && tags.length > 0) {
      subscriberData.tags = tags;
    }

    // Subscribe to the list (auto-refreshes token if expired)
    await aweberRequest(`/lists/${listId}/subscribers`, 'POST', subscriberData);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Subscribed successfully',
      }),
    };
  } catch (error) {
    console.error('AWeber subscribe error:', error);

    // Handle duplicate subscriber
    if (error.message.includes('already subscribed')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Already subscribed',
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to subscribe', detail: error.message }),
    };
  }
};
