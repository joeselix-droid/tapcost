const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  const upsertSub = async (userId, plan, customerId, subscriptionId, status) => {
    const { error } = await sb.from('subscriptions').upsert({
      user_id: userId,
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) console.error('Supabase upsert error:', error);
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const plan   = session.metadata?.plan || 'starter';
      if (userId) {
        await upsertSub(
          userId, plan,
          session.customer,
          session.subscription,
          'active'
        );
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const userId = sub.metadata?.userId;
      if (userId) {
        await upsertSub(
          userId,
          sub.metadata?.plan || 'starter',
          sub.customer,
          sub.id,
          sub.status
        );
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const userId = sub.metadata?.userId;
      if (userId) {
        await upsertSub(userId, 'free', sub.customer, sub.id, 'cancelled');
      }
      break;
    }
    default:
      break;
  }

  res.status(200).json({ received: true });
};
