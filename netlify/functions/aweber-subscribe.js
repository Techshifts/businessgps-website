/**
 * AWeber Subscribe Function
 * Adds subscribers to AWeber lists with appropriate tags
 */

// AWeber API base URL
const AWEBER_API_BASE = 'https://api.aweber.com/1.0';

// List type to ID mapping (set in environment variables)
const LIST_IDS = {
  leads: process.env.AWEBER_LIST_ID_LEADS,
  customers: process.env.AWEBER_LIST_ID_CUSTOMERS,
  enterprise: process.env.AWEBER_LIST_ID_ENTERPRISE,
};

// Helper to make AWeber API requests
async function aweberRequest(endpoint, method = 'GET', body = null) {
  const accessToken = process.env.AWEBER_ACCESS_TOKEN;
  const accountId = process.env.AWEBER_ACCOUNT_ID;

  if (!accessToken || !accountId) {
    throw new Error('AWeber credentials not configured');
  }

  const url = `${AWEBER_API_BASE}/accounts/${accountId}${endpoint}`;

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AWeber API error: ${response.status} - ${errorText}`);
  }

  // Some endpoints return 201 with no body
  if (response.status === 201 || response.status === 204) {
    return { success: true };
  }

  return response.json();
}

exports.handler = async (event) => {
  // Allow POST only
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // CORS headers for form submissions
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const { email, firstName, lastName, company, listType, tags, source } = JSON.parse(event.body);

    // Validate required fields
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

    // Add custom fields if provided
    if (company) {
      subscriberData.custom_fields.company = company;
    }
    if (source) {
      subscriberData.custom_fields.source = source;
    }
    if (firstName) {
      subscriberData.custom_fields.first_name = firstName;
    }

    // Add tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      subscriberData.tags = tags;
    }

    // Subscribe to the list
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

    // Handle duplicate subscriber (already subscribed)
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
      body: JSON.stringify({ error: 'Failed to subscribe' }),
    };
  }
};
