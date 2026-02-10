const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// CONFIGURATION
// ============================================

const RAZORPAY_CONFIGS = {
  MY: {
    keyId: process.env.RAZORPAY_KEY_ID_MY || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET_MY || '',
    currency: 'MYR'
  },
  SG: {
    keyId: process.env.RAZORPAY_KEY_ID_SG || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET_SG || '',
    currency: 'SGD'
  },
  US: {
    keyId: process.env.RAZORPAY_KEY_ID_US || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET_US || '',
    currency: 'USD'
  },
  IN: {
    keyId: process.env.RAZORPAY_KEY_ID_IN || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET_IN || '',
    currency: 'INR'
  }
};

const API_BASE_URL = 'https://api.razorpay.com/v1';

// Validate configuration
Object.keys(RAZORPAY_CONFIGS).forEach(country => {
  if (!RAZORPAY_CONFIGS[country].keySecret) {
    console.warn(`⚠️  WARNING: RAZORPAY_KEY_SECRET_${country} not set!`);
  } else {
    console.log(`✅ ${country} keys configured`);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get Basic Auth header for Razorpay API
 */
function getAuthHeader(country = 'MY') {
  const config = RAZORPAY_CONFIGS[country];
  if (!config || !config.keySecret) {
    throw new Error(`Invalid or unconfigured country: ${country}`);
  }
  const credentials = Buffer.from(
    `${config.keyId}:${config.keySecret}`
  ).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Get Razorpay config for a country
 */
function getConfig(country = 'MY') {
  const config = RAZORPAY_CONFIGS[country];
  if (!config || !config.keySecret) {
    throw new Error(`Invalid or unconfigured country: ${country}`);
  }
  return config;
}

/**
 * Make authenticated request to Razorpay API
 */
async function callRazorpayAPI(endpoint, method = 'POST', body = null) {
  const url = `${API_BASE_URL}${endpoint}`;

  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader()
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  console.log(`📡 Razorpay API Call: ${method} ${endpoint}`);

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Razorpay API Error:', data);
    throw new Error(data.error?.description || 'Razorpay API request failed');
  }

  return data;
}

// ============================================
// ENDPOINT 1: CARD S2S PAYMENT
// ============================================

/**
 * Create a card payment using S2S integration
 *
 * POST /api/create-payment
 *
 * Request body:
 * {
 *   amount: number (in smallest currency unit - paise for INR, cents for USD, etc.)
 *   currency: string (INR, USD, SGD, etc.)
 *   method: "card"
 *   card: {
 *     number: string
 *     name: string
 *     expiry_month: string
 *     expiry_year: string
 *     cvv: string
 *   }
 *   contact: string
 *   email: string
 *   authentication: object (optional - for 3DS)
 *   browser: object (optional - browser fingerprint)
 *   device_fingerprint: object (optional - Shield session)
 * }
 */
app.post('/api/create-payment', async (req, res) => {
  console.log('💳 Card S2S Payment Request Received');

  try {
    const {
      amount,
      currency,
      country,
      contact,
      email,
      method,
      card,
      authentication,
      browser,
      ip,
      referer,
      user_agent,
      device_fingerprint
    } = req.body;

    // Validate required fields
    if (!amount || !currency || !method || !card || !country) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          description: 'Missing required fields: amount, currency, country, method, card'
        }
      });
    }

    console.log(`🌍 Using ${country} credentials`);

    // STEP 1: Create an Order first (required for S2S v2)
    console.log('📋 Step 1: Creating Razorpay Order...');

    const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(country)
      },
      body: JSON.stringify({
        amount: amount,
        currency: currency,
        receipt: 's2s_' + Date.now(),
        notes: {
          integration: 's2s_card'
        }
      })
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error('❌ Order creation failed:', orderData);
      return res.status(orderResponse.status).json(orderData);
    }

    console.log('✅ Order created:', orderData.id);

    // STEP 2: Create Payment with the order_id
    console.log('💳 Step 2: Creating Payment with order...');

    // Build payment request for Razorpay
    // Ensure expiry_year is 4 digits
    let expiryYear = card.expiry_year;
    if (expiryYear.length === 2) {
      expiryYear = '20' + expiryYear;
    }

    const paymentRequest = {
      amount: amount,
      currency: currency,
      order_id: orderData.id,  // IMPORTANT: Include order_id
      method: method,
      contact: contact,
      email: email,
      card: {
        number: card.number,
        name: card.name,
        expiry_month: card.expiry_month,
        expiry_year: expiryYear,
        cvv: card.cvv
      }
    };

    // Add authentication data if provided (for 3DS)
    if (authentication) {
      paymentRequest.authentication = authentication;
    }

    // Add browser fingerprint if provided
    if (browser) {
      paymentRequest.browser = browser;
    }

    // Add device fingerprint (Shield) if provided
    if (device_fingerprint) {
      paymentRequest.device_fingerprint = device_fingerprint;
      console.log('🛡️ Shield session included in payment');
    }

    // Add additional metadata
    if (ip) paymentRequest.ip = ip;
    if (referer) paymentRequest.referer = referer;
    if (user_agent) paymentRequest.user_agent = user_agent;

    console.log('📤 Sending card payment to Razorpay API...');
    console.log('Payment details:', {
      amount,
      currency,
      order_id: orderData.id,
      method,
      cardLast4: card.number.slice(-4),
      hasShield: !!device_fingerprint
    });

    // Make request to Razorpay S2S API (using /payments/create/json endpoint)
    const paymentResponse = await fetch(`${API_BASE_URL}/payments/create/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(country)
      },
      body: JSON.stringify(paymentRequest)
    });

    // Check content type before parsing
    const contentType = paymentResponse.headers.get('content-type');
    console.log('Response Status:', paymentResponse.status);
    console.log('Content-Type:', contentType);

    let paymentData;
    if (contentType && contentType.includes('application/json')) {
      paymentData = await paymentResponse.json();
    } else {
      // Got HTML response - this happens when 3DS/OTP is required
      const textResponse = await paymentResponse.text();
      console.log('HTML Response received (3DS authentication required)');

      // Extract the authentication URL from the HTML meta refresh tag
      const urlMatch = textResponse.match(/url=([^"]+)/);
      const authenticationUrl = urlMatch ? urlMatch[1] : null;

      // Extract payment ID from the URL
      const paymentIdMatch = authenticationUrl ? authenticationUrl.match(/payments\/([^/]+)/) : null;
      const paymentId = paymentIdMatch ? paymentIdMatch[1] : null;

      if (authenticationUrl) {
        console.log('🔐 3DS Authentication required');
        console.log('Payment ID:', paymentId);
        console.log('Authentication URL:', authenticationUrl);

        // Return success with authentication details
        return res.json({
          id: paymentId,
          status: 'authorized',
          order_id: orderData.id,
          authentication: {
            authentication_url: authenticationUrl
          },
          requires_3ds: true
        });
      } else {
        console.log('Non-JSON Response:', textResponse.substring(0, 500));
        return res.status(paymentResponse.status).json({
          error: {
            code: 'INVALID_RESPONSE',
            description: 'Received HTML response but could not extract authentication URL',
            details: textResponse.substring(0, 200)
          }
        });
      }
    }

    if (!paymentResponse.ok) {
      console.error('❌ Razorpay Payment Error (Status:', paymentResponse.status, '):', paymentData);

      // Return the error response with proper status code
      return res.status(paymentResponse.status).json(paymentData);
    }

    console.log('✅ Card payment created:', paymentData.id, '-', paymentData.status);

    // Log 3DS authentication URL if present
    if (paymentData.authentication && paymentData.authentication.authentication_url) {
      console.log('🔐 3DS Authentication required');
      console.log('Authentication URL:', paymentData.authentication.authentication_url);
    }

    // Return payment response (includes order details)
    res.json({
      ...paymentData,
      order: orderData
    });

  } catch (error) {
    console.error('❌ Card Payment Error:', error.message);
    res.status(500).json({
      error: {
        code: 'PAYMENT_FAILED',
        description: error.message
      }
    });
  }
});

// ============================================
// ENDPOINT 2: APPLE PAY MERCHANT VALIDATION
// ============================================

/**
 * Validate Apple Pay merchant session
 *
 * POST /api/validate-apple-merchant
 *
 * Request body:
 * {
 *   validationURL: string (URL from Apple Pay session)
 *   domain: string (your website domain)
 *   displayName: string (merchant display name)
 *   amount: number (payment amount in smallest currency unit)
 *   currency: string (currency code)
 * }
 */
app.post('/api/validate-apple-merchant', async (req, res) => {
  console.log('🍎 Apple Pay Merchant Validation Request Received');

  try {
    const {
      validationURL,
      domain,
      displayName,
      amount,
      currency
    } = req.body;

    // Validate required fields
    if (!validationURL || !domain || !amount || !currency) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          description: 'Missing required fields: validationURL, domain, amount, currency'
        }
      });
    }

    console.log('📋 Validation details:', {
      domain,
      displayName,
      amount,
      currency,
      validationURL: validationURL.substring(0, 50) + '...'
    });

    // Call Razorpay's Apple Pay create/ajax endpoint
    // This endpoint initiates the payment and returns the Apple Pay merchant session
    const validationRequest = {
      method: 'app',
      amount: amount,
      contact: '+910000000000', // Placeholder - will be updated with actual contact
      email: 'applepay@example.com', // Placeholder - will be updated with actual email
      currency: currency,
      app: {
        name: 'apple_pay'
      },
      initiative_context_url: domain,
      merchant_validation_url: validationURL,
      save: 0
    };

    console.log('📤 Requesting merchant session from Razorpay...');

    const response = await fetch(`${API_BASE_URL}/payments/create/ajax`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader()
      },
      body: JSON.stringify(validationRequest)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Razorpay validation error:', data);
      throw new Error(data.error?.description || 'Merchant validation failed');
    }

    // Extract merchant session from response
    // The session data is in data.data.session_data
    if (!data.data || !data.data.session_data) {
      console.error('❌ No merchant session in response:', data);
      throw new Error('No merchant session received from Razorpay');
    }

    console.log('✅ Merchant session obtained successfully');

    // Return the merchant session to the client
    // This will be passed to session.completeMerchantValidation()
    res.json(data.data.session_data);

  } catch (error) {
    console.error('❌ Merchant Validation Error:', error.message);
    res.status(500).json({
      error: {
        code: 'VALIDATION_FAILED',
        description: error.message
      }
    });
  }
});

// ============================================
// ENDPOINT 3: APPLE PAY S2S PAYMENT
// ============================================

/**
 * Process Apple Pay payment using S2S integration
 *
 * POST /api/create-applepay-payment
 *
 * Request body:
 * {
 *   amount: number (in smallest currency unit)
 *   currency: string
 *   token: object (Apple Pay payment token)
 *   contact: string (phone number)
 *   email: string
 *   billing_contact: object (Apple Pay billing contact)
 * }
 */
app.post('/api/create-applepay-payment', async (req, res) => {
  console.log('🍎 Apple Pay S2S Payment Request Received');

  try {
    const {
      amount,
      currency,
      country,
      contact,
      email
    } = req.body;

    // Validate required fields
    if (!amount || !currency || !country) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          description: 'Missing required fields: amount, currency, country'
        }
      });
    }

    console.log(`🌍 Using ${country} credentials`);
    console.log('📋 Apple Pay payment details:', {
      amount,
      currency,
      country,
      contact,
      email
    });

    // STEP 1: Create an Order first (required for S2S v2)
    console.log('📋 Step 1: Creating Razorpay Order for Apple Pay...');

    const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(country)
      },
      body: JSON.stringify({
        amount: amount,
        currency: currency,
        receipt: 's2s_applepay_' + Date.now(),
        notes: {
          integration: 's2s_applepay'
        }
      })
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error('❌ Order creation failed:', orderData);
      return res.status(orderResponse.status).json(orderData);
    }

    console.log('✅ Order created:', orderData.id);

    // STEP 2: Create Payment with Apple Pay
    // NO TOKEN NEEDED - Razorpay will handle Apple Pay on their hosted page
    console.log('🍎 Step 2: Creating Payment for Apple Pay (Razorpay hosted)...');

    const paymentRequest = {
      amount: amount,
      currency: currency,
      order_id: orderData.id,
      method: 'card',  // Use "card" for Apple Pay
      contact: contact || '+60123456789',
      email: email || 'applepay@example.com',
      app: {
        name: 'apple_pay'  // This tells Razorpay to show Apple Pay on hosted page
      }
    };

    console.log('📤 Sending Apple Pay payment request to Razorpay API...');
    console.log('Request body:', JSON.stringify(paymentRequest, null, 2));

    // Make request to Razorpay S2S API (using /payments/create/json endpoint)
    const paymentResponse = await fetch(`${API_BASE_URL}/payments/create/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(country)
      },
      body: JSON.stringify(paymentRequest)
    });

    // Check content type before parsing
    const contentType = paymentResponse.headers.get('content-type');
    console.log('Response Status:', paymentResponse.status);
    console.log('Content-Type:', contentType);

    let paymentResponseData;
    if (contentType && contentType.includes('application/json')) {
      paymentResponseData = await paymentResponse.json();

      // JSON response - extract redirect URL from next array
      if (paymentResponseData.next && Array.isArray(paymentResponseData.next)) {
        const redirectAction = paymentResponseData.next.find(action => action.action === 'redirect');
        if (redirectAction && redirectAction.url) {
          console.log('✅ Apple Pay redirect URL obtained from JSON');
          console.log('Payment ID:', paymentResponseData.razorpay_payment_id);
          console.log('Redirect URL:', redirectAction.url);

          return res.json({
            id: paymentResponseData.razorpay_payment_id,
            status: 'created',
            order_id: orderData.id,
            apple_pay_url: redirectAction.url,
            requires_apple_pay: true,
            message: 'Redirect user to apple_pay_url to complete payment'
          });
        }
      }

    } else {
      // Got HTML response - this is expected for Apple Pay (redirect to Razorpay hosted page)
      const textResponse = await paymentResponse.text();
      console.log('🍎 HTML Response received (Razorpay hosted Apple Pay page)');

      // Extract the Apple Pay hosted page URL from the HTML meta refresh tag
      const urlMatch = textResponse.match(/url=([^"]+)/);
      const applePayUrl = urlMatch ? urlMatch[1] : null;

      // Extract payment ID from the URL
      const paymentIdMatch = applePayUrl ? applePayUrl.match(/payments\/([^/]+)/) : null;
      const paymentId = paymentIdMatch ? paymentIdMatch[1] : null;

      if (applePayUrl) {
        console.log('✅ Apple Pay hosted page URL obtained from HTML');
        console.log('Payment ID:', paymentId);
        console.log('Apple Pay URL:', applePayUrl);

        // Return success with Apple Pay hosted page URL
        return res.json({
          id: paymentId,
          status: 'created',
          order_id: orderData.id,
          apple_pay_url: applePayUrl,
          requires_apple_pay: true,
          message: 'Redirect user to apple_pay_url to complete payment'
        });
      } else {
        console.log('Non-JSON Response:', textResponse.substring(0, 500));
        return res.status(paymentResponse.status).json({
          error: {
            code: 'INVALID_RESPONSE',
            description: 'Received HTML response but could not extract Apple Pay URL',
            details: textResponse.substring(0, 200)
          }
        });
      }
    }

    if (!paymentResponse.ok) {
      console.error('❌ Apple Pay Payment Error (Status:', paymentResponse.status, '):', paymentResponseData);
      return res.status(paymentResponse.status).json(paymentResponseData);
    }

    console.log('✅ Apple Pay payment created:', paymentResponseData.razorpay_payment_id, '-', paymentResponseData.status);

    // Return payment response (includes order details)
    res.json({
      ...paymentResponseData,
      order: orderData
    });

  } catch (error) {
    console.error('❌ Apple Pay Payment Error:', error.message);
    res.status(500).json({
      error: {
        code: 'PAYMENT_FAILED',
        description: error.message
      }
    });
  }
});

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get('/health', (req, res) => {
  const configuredCountries = {};
  Object.keys(RAZORPAY_CONFIGS).forEach(country => {
    configuredCountries[country] = {
      configured: !!RAZORPAY_CONFIGS[country].keySecret,
      keyId: RAZORPAY_CONFIGS[country].keyId,
      currency: RAZORPAY_CONFIGS[country].currency
    };
  });

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    countries: configuredCountries
  });
});

// ============================================
// ROOT ENDPOINT
// ============================================

app.get('/', (req, res) => {
  res.json({
    name: 'Razorpay S2S Payment Server',
    version: '1.0.0',
    endpoints: {
      card: 'POST /api/create-payment',
      applePay: 'POST /api/create-applepay-payment',
      merchantValidation: 'POST /api/validate-apple-merchant',
      health: 'GET /health'
    },
    docs: 'https://razorpay.com/docs/payments/'
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      description: `Endpoint ${req.method} ${req.path} not found`
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      description: err.message
    }
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '127.0.0.1', () => {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   Razorpay S2S Payment Server                      ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log(`   POST http://localhost:${PORT}/api/create-payment`);
  console.log(`   POST http://localhost:${PORT}/api/create-applepay-payment`);
  console.log(`   POST http://localhost:${PORT}/api/validate-apple-merchant`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log('');
  console.log('🔑 Configured Geographies:');
  Object.keys(RAZORPAY_CONFIGS).forEach(country => {
    const status = RAZORPAY_CONFIGS[country].keySecret ? '✅' : '❌';
    console.log(`   ${country}: ${status} ${RAZORPAY_CONFIGS[country].currency}`);
  });
  console.log('');
  console.log('════════════════════════════════════════════════════');
});

module.exports = app;
