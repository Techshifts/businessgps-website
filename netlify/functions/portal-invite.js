/**
 * Portal Invite Function
 * Creates a Supabase Auth user and grants product access.
 *
 * POST /api/portal-invite
 * Headers: x-admin-key: <PORTAL_ADMIN_KEY>
 * Body: { email, first_name, product_id, cohort_id? }
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
    const { email, first_name, product_id, cohort_id } = JSON.parse(event.body);

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

    // Create or get auth user (inviteUserByEmail sends magic link)
    const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { first_name: first_name || '' },
    });

    // User may already exist — that's fine
    if (authError && !authError.message.includes('already been registered')) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Auth error: ' + authError.message }),
      };
    }

    // Grant product access (upsert to handle existing records)
    const accessRecord = {
      email: email.toLowerCase(),
      product_id,
      status: 'active',
      granted_at: new Date().toISOString(),
    };

    if (cohort_id) {
      accessRecord.cohort_id = cohort_id;
    }

    const { error: accessError } = await supabase
      .from('product_access')
      .upsert(accessRecord, { onConflict: 'email,product_id' });

    if (accessError) {
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Access grant error: ' + accessError.message }),
      };
    }

    // If cohort specified, increment participant count
    if (cohort_id) {
      await supabase.rpc('increment_cohort_participants', { p_cohort_id: cohort_id });
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        message: `Portal access granted: ${email} -> ${product_id}`,
        user_existed: authError ? true : false,
      }),
    };
  } catch (error) {
    console.error('portal-invite error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal error: ' + error.message }),
    };
  }
};
