const RAZORPAY_API_BASE = 'https://api.razorpay.com';

const RAZORPAY_CONFIGS = {
  MY: {
    keyId: process.env.RAZORPAY_KEY_ID_MY,
    keySecret: process.env.RAZORPAY_KEY_SECRET_MY,
    currency: 'MYR'
  },
  SG: {
    keyId: process.env.RAZORPAY_KEY_ID_SG,
    keySecret: process.env.RAZORPAY_KEY_SECRET_SG,
    currency: 'SGD'
  },
  US: {
    keyId: process.env.RAZORPAY_KEY_ID_US,
    keySecret: process.env.RAZORPAY_KEY_SECRET_US,
    currency: 'USD'
  },
  IN: {
    keyId: process.env.RAZORPAY_KEY_ID_IN,
    keySecret: process.env.RAZORPAY_KEY_SECRET_IN,
    currency: 'INR'
  }
};

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency, country, contact, email } = req.body;

    const config = RAZORPAY_CONFIGS[country];
    if (!config || !config.keyId || !config.keySecret) {
      return res.status(400).json({ error: { description: 'Invalid country or missing credentials' } });
    }

    const credentials = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');

    // Step 1: Create Order
    const orderPayload = {
      amount,
      currency,
      payment_capture: 1
    };

    const orderResponse = await fetch(`${RAZORPAY_API_BASE}/v1/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      return res.status(orderResponse.status).json(orderData);
    }

    // Step 2: Create Apple Pay Payment
    const paymentPayload = {
      amount,
      currency,
      order_id: orderData.id,
      method: 'card',
      app: {
        name: 'apple_pay'
      },
      contact,
      email
    };

    const paymentResponse = await fetch(`${RAZORPAY_API_BASE}/v1/payments/create/json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentPayload)
    });

    const contentType = paymentResponse.headers.get('content-type');
    let paymentResponseData;

    if (contentType && contentType.includes('application/json')) {
      paymentResponseData = await paymentResponse.json();

      // JSON response - extract redirect URL from next array
      if (paymentResponseData.next && Array.isArray(paymentResponseData.next)) {
        const redirectAction = paymentResponseData.next.find(action => action.action === 'redirect');
        if (redirectAction && redirectAction.url) {
          return res.status(200).json({
            id: paymentResponseData.razorpay_payment_id,
            apple_pay_url: redirectAction.url,
            requires_apple_pay: true
          });
        }
      }

      // Payment completed without redirect
      return res.status(200).json(paymentResponseData);
    } else {
      // Handle HTML response (legacy)
      const htmlText = await paymentResponse.text();
      const urlMatch = htmlText.match(/url=([^"]+)"/);

      if (urlMatch && urlMatch[1]) {
        const applePayUrl = urlMatch[1];
        const paymentIdMatch = htmlText.match(/razorpay_payment_id[=:]([a-zA-Z0-9_]+)/);

        return res.status(200).json({
          id: paymentIdMatch ? paymentIdMatch[1] : 'unknown',
          apple_pay_url: applePayUrl,
          requires_apple_pay: true
        });
      }

      return res.status(500).json({ error: { description: 'Failed to parse Apple Pay response' } });
    }
  } catch (error) {
    console.error('Apple Pay creation error:', error);
    return res.status(500).json({ error: { description: error.message } });
  }
};
