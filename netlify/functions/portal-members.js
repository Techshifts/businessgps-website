/**
 * Portal Members Function
 * Lists portal members with their product access.
 *
 * GET /api/portal-members
 * Headers: x-admin-key: <PORTAL_ADMIN_KEY>
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
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
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
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Get all product access records
    const { data: accessData, error: accessError } = await supabase
      .from('product_access')
      .select('email, product_id, cohort_id, status, granted_at, expires_at')
      .order('granted_at', { ascending: false });

    if (accessError) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Query error: ' + accessError.message }),
      };
    }

    // Get auth users for last sign-in info
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const userMap = {};
    if (usersData && usersData.users) {
      usersData.users.forEach(function (u) {
        userMap[u.email.toLowerCase()] = {
          last_sign_in: u.last_sign_in_at,
          created_at: u.created_at,
          first_name: u.user_metadata && u.user_metadata.first_name,
        };
      });
    }

    // Merge access data with auth info
    const members = (accessData || []).map(function (row) {
      var auth = userMap[row.email.toLowerCase()] || {};
      return {
        email: row.email,
        first_name: auth.first_name || null,
        product_id: row.product_id,
        cohort_id: row.cohort_id,
        status: row.status,
        granted_at: row.granted_at,
        expires_at: row.expires_at,
        last_sign_in: auth.last_sign_in || null,
      };
    });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ members, count: members.length }),
    };
  } catch (error) {
    console.error('portal-members error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal error: ' + error.message }),
    };
  }
};
