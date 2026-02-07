/**
 * HubSpot Contact Integration
 * Creates or updates contacts and deals in HubSpot CRM
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com';

// Pipeline and stage config (IDs set via environment variables - differ per HubSpot account)
const PIPELINES = {
  products: {
    id: process.env.HUBSPOT_PIPELINE_PRODUCTS,
    closedWonStage: process.env.HUBSPOT_STAGE_CLOSEDWON_PRODUCTS,
  },
  enterprise: {
    id: process.env.HUBSPOT_PIPELINE_ENTERPRISE,
    closedWonStage: process.env.HUBSPOT_STAGE_CLOSEDWON_ENTERPRISE,
  },
};

const PRODUCT_PIPELINE_KEY = {
  'athena-standard': 'products',
  'athena-premium': 'products',
  'start-right-30': 'products',
  'throughput-90': 'products',
  'opsmax-360': 'enterprise',
};

// Helper to make HubSpot API requests
async function hubspotRequest(endpoint, method = 'GET', body = null) {
  const apiKey = process.env.HUBSPOT_API_KEY;

  if (!apiKey) {
    throw new Error('HubSpot API key not configured');
  }

  const url = `${HUBSPOT_API_BASE}${endpoint}`;

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
  }

  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

// Search for existing contact by email
async function findContactByEmail(email) {
  try {
    const result = await hubspotRequest('/crm/v3/objects/contacts/search', 'POST', {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'email',
              operator: 'EQ',
              value: email,
            },
          ],
        },
      ],
    });
    return result.results?.[0] || null;
  } catch (error) {
    console.error('Contact search error:', error);
    return null;
  }
}

// Create or update contact
async function upsertContact(email, properties) {
  const existingContact = await findContactByEmail(email);

  if (existingContact) {
    // Update existing contact
    return hubspotRequest(`/crm/v3/objects/contacts/${existingContact.id}`, 'PATCH', {
      properties,
    });
  } else {
    // Create new contact
    return hubspotRequest('/crm/v3/objects/contacts', 'POST', {
      properties: {
        email,
        ...properties,
      },
    });
  }
}

// Create a deal associated with a contact
async function createDeal(contactId, dealName, amount, productId, pipelineKey) {
  const pipelineConfig = PIPELINES[pipelineKey];
  if (!pipelineConfig?.id || !pipelineConfig?.closedWonStage) {
    throw new Error(`Pipeline config missing for: ${pipelineKey}`);
  }

  // Create the deal
  const deal = await hubspotRequest('/crm/v3/objects/deals', 'POST', {
    properties: {
      dealname: dealName,
      amount: amount.toString(),
      pipeline: pipelineConfig.id,
      dealstage: pipelineConfig.closedWonStage,
      closedate: new Date().toISOString(),
    },
  });

  // Associate deal with contact
  if (deal?.id && contactId) {
    await hubspotRequest(`/crm/v3/objects/deals/${deal.id}/associations/contacts/${contactId}/deal_to_contact`, 'PUT');
  }

  return deal;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const {
      email,
      firstName,
      lastName,
      company,
      productPurchased,
      amount,
      stripeCustomerId,
      createDeal: shouldCreateDeal,
      source,
    } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' }),
      };
    }

    // Build contact properties
    const contactProperties = {
      firstname: firstName || undefined,
      lastname: lastName || undefined,
      company: company || undefined,
    };

    // Add custom properties if we have product info
    if (productPurchased) {
      contactProperties.product_purchased = productPurchased;
    }
    if (stripeCustomerId) {
      contactProperties.stripe_customer_id = stripeCustomerId;
    }
    if (source) {
      contactProperties.hs_lead_status = source === 'tcm-report' ? 'NEW' : 'OPEN_DEAL';
    } else if (productPurchased) {
      contactProperties.hs_lead_status = 'OPEN_DEAL';
    }

    // Remove undefined values
    Object.keys(contactProperties).forEach(
      (key) => contactProperties[key] === undefined && delete contactProperties[key]
    );

    // Create or update contact
    const contact = await upsertContact(email, contactProperties);
    const contactId = contact?.id;

    // Create deal if requested and we have product info
    let deal = null;
    if (shouldCreateDeal && productPurchased && amount && contactId) {
      const pipelineKey = PRODUCT_PIPELINE_KEY[productPurchased] || 'products';
      const productNames = {
        'athena-standard': 'Athena V3 Standard',
        'athena-premium': 'Athena V3 Premium',
        'start-right-30': 'Start Right 30',
        'throughput-90': 'Throughput-90',
        'opsmax-360': 'OpsMax-360',
      };
      const dealName = `${productNames[productPurchased] || productPurchased} - ${firstName || email}`;
      deal = await createDeal(contactId, dealName, amount, productPurchased, pipelineKey);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        contactId,
        dealId: deal?.id || null,
      }),
    };
  } catch (error) {
    console.error('HubSpot integration error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to sync with HubSpot', detail: error.message }),
    };
  }
};
