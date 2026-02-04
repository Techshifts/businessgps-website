/**
 * Create Stripe Checkout Session
 * Creates a Stripe checkout session for product purchases
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Product price mapping
const PRICE_MAP = {
  'athena-standard': process.env.STRIPE_PRICE_ATHENA_STD,
  'athena-premium': process.env.STRIPE_PRICE_ATHENA_PREM,
  'start-right-30': process.env.STRIPE_PRICE_SR30,
  'throughput-90': process.env.STRIPE_PRICE_TP90,
  'opsmax-360': process.env.STRIPE_PRICE_OPSMAX,
};

// Product metadata for display
const PRODUCT_INFO = {
  'athena-standard': {
    name: 'Athena V3 - Standard',
    description: 'AI-guided strategy assessment (Steps 1-9)',
  },
  'athena-premium': {
    name: 'Athena V3 - Premium',
    description: 'Full assessment + 1:1 strategy session',
  },
  'start-right-30': {
    name: 'Start Right 30',
    description: '30-day leadership cohort programme (Steps 1-3)',
  },
  'throughput-90': {
    name: 'Throughput-90',
    description: 'Complete strategy assessment (Steps 4-9)',
  },
  'opsmax-360': {
    name: 'OpsMax-360',
    description: 'Full 360-day transformation programme',
  },
};

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { productId, successUrl, cancelUrl } = JSON.parse(event.body);

    // Validate product
    if (!productId || !PRICE_MAP[productId]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid product ID' }),
      };
    }

    const priceId = PRICE_MAP[productId];
    if (!priceId) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Price not configured for this product' }),
      };
    }

    // Get the site URL for redirects
    // Use DEPLOY_PRIME_URL for branch deploys (staging), fall back to URL for production
    const siteUrl = process.env.DEPLOY_PRIME_URL || process.env.URL || 'http://localhost:8888';
    const finalSuccessUrl = successUrl || `${siteUrl}/pages/thank-you.html?session_id={CHECKOUT_SESSION_ID}`;
    const finalCancelUrl = cancelUrl || `${siteUrl}/pages/checkout.html?product=${productId}&cancelled=true`;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      metadata: {
        product_id: productId,
        product_name: PRODUCT_INFO[productId]?.name || productId,
      },
      // Collect billing address for VAT
      billing_address_collection: 'required',
      // Allow promotion codes
      allow_promotion_codes: true,
      // Automatic tax calculation for UK VAT
      automatic_tax: {
        enabled: true,
      },
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
    };
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
