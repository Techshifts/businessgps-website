/**
 * Get Stripe Checkout Session
 * Retrieves session details for the thank-you page
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const sessionId = event.queryStringParameters?.session_id;

  if (!sessionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing session_id parameter' }),
    };
  }

  try {
    // Retrieve the session with expanded line items
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'customer'],
    });

    // Only return safe data to the client
    const safeData = {
      customerEmail: session.customer_details?.email,
      customerName: session.customer_details?.name,
      productId: session.metadata?.product_id,
      productName: session.metadata?.product_name,
      amountTotal: session.amount_total,
      currency: session.currency,
      paymentStatus: session.payment_status,
      // Generate order number from session ID
      orderNumber: `BGPS-${session.id.slice(-8).toUpperCase()}`,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify(safeData),
    };
  } catch (error) {
    console.error('Error retrieving session:', error);

    if (error.code === 'resource_missing') {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Session not found' }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to retrieve session details' }),
    };
  }
};
