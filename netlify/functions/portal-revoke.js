/**
 * Portal Revoke Function
 * Revokes a user's access to a specific product.
 *
 * POST /api/portal-revoke
 * Headers: x-admin-key: <PORTAL_ADMIN_KEY>
 * Body: { email, product_id }
 *
 * Env vars needed:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   PORTAL_ADMIN_KEY
 */

const { createClient } = require('@supabase/supabase-js');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Verify admin key
  const adminKey = process.env.PORTAL_ADMIN_KEY;
  const providedKey = event.headers['x-admin-key'];

  if (!adminKey || providedKey !== adminKey) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    const { email, product_id } = JSON.parse(event.body);

    if (!email || !product_id) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'email and product_id are required' }),
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabase
      .from('product_access')
      .update({ status: 'revoked' })
      .eq('email', email.toLowerCase())
      .eq('product_id', product_id)
      .select();

    if (error) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Revoke error: ' + error.message }),
      };
    }

    if (!data || data.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'No access record found for this email/product combination' }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        message: `Access revoked: ${email} -> ${product_id}`,
      }),
    };
  } catch (error) {
    console.error('portal-revoke error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal error: ' + error.message }),
    };
  }
};
