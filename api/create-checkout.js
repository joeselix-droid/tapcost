const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro:     process.env.STRIPE_PRICE_PRO,
  multi:   process.env.STRIPE_PRICE_MULTI,
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { plan, userId, email, successUrl, cancelUrl } = req.body;

  if (!plan || !PLANS[plan]) {
    res.status(400).json({ error: 'Invalid plan. Must be: starter, pro, or multi' });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: PLANS[plan], quantity: 1 }],
      success_url: successUrl || `${process.env.APP_URL}?checkout=success`,
      cancel_url:  cancelUrl  || `${process.env.APP_URL}?checkout=cancelled`,
      metadata: { userId, plan },
      subscription_data: { metadata: { userId, plan } },
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
