/**
 * Stripe Webhook Handler
 * Handles payment events from Stripe and syncs to Supabase, AWeber, and HubSpot
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getSupabase } = require('./lib/supabase');

// Helper to call AWeber subscribe function
async function subscribeToAweber(email, firstName, lastName, productId, tags) {
  try {
    // Internal function call to AWeber subscriber
    const response = await fetch(`${process.env.URL}/.netlify/functions/aweber-subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        listType: 'customers',
        tags,
        source: `purchase-${productId}`,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('AWeber sync error:', error);
    return false;
  }
}

// Helper to sync to HubSpot
async function syncToHubspot(email, firstName, lastName, productId, amount, stripeCustomerId) {
  try {
    const response = await fetch(`${process.env.URL}/.netlify/functions/hubspot-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        productPurchased: productId,
        amount,
        stripeCustomerId,
        createDeal: ['start-right-30', 'throughput-90', 'opsmax-360'].includes(productId),
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('HubSpot sync error:', error);
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Handle the event
  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const session = stripeEvent.data.object;

      console.log('Checkout session completed:', session.id);

      // Extract customer details
      const customerEmail = session.customer_details?.email;
      const customerName = session.customer_details?.name || '';
      const [firstName, ...lastNameParts] = customerName.split(' ');
      const lastName = lastNameParts.join(' ');
      const productId = session.metadata?.product_id;
      const amountPaid = session.amount_total;
      const stripeCustomerId = session.customer;

      // 1. Save order to Supabase
      try {
        const supabase = getSupabase();

        // Create order record
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            stripe_session_id: session.id,
            stripe_customer_id: stripeCustomerId,
            email: customerEmail,
            first_name: firstName,
            last_name: lastName,
            product_id: productId,
            amount_gbp: amountPaid,
            status: 'completed',
          })
          .select()
          .single();

        if (orderError) {
          console.error('Supabase order insert error:', orderError);
        } else {
          console.log('Order saved to Supabase:', order.id);

          // Create product access record
          const { error: accessError } = await supabase
            .from('product_access')
            .insert({
              email: customerEmail,
              product_id: productId,
              order_id: order.id,
              // Set expiry for time-limited products if needed
              expires_at: null,
            });

          if (accessError) {
            console.error('Supabase product access error:', accessError);
          }
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }

      // 2. Add to AWeber customers list with product tag
      const productTag = productId.replace(/-/g, '_');
      await subscribeToAweber(customerEmail, firstName, lastName, productId, [productTag, 'customer']);

      // 3. Sync to HubSpot
      await syncToHubspot(
        customerEmail,
        firstName,
        lastName,
        productId,
        amountPaid / 100, // Convert from pence to pounds
        stripeCustomerId
      );

      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = stripeEvent.data.object;
      console.log('Payment failed:', paymentIntent.id);
      // Could trigger abandoned cart email here
      break;
    }

    default:
      console.log(`Unhandled event type: ${stripeEvent.type}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
