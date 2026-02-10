module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const configs = {
    MY: !!process.env.RAZORPAY_KEY_ID_MY && !!process.env.RAZORPAY_KEY_SECRET_MY,
    SG: !!process.env.RAZORPAY_KEY_ID_SG && !!process.env.RAZORPAY_KEY_SECRET_SG,
    US: !!process.env.RAZORPAY_KEY_ID_US && !!process.env.RAZORPAY_KEY_SECRET_US,
    IN: !!process.env.RAZORPAY_KEY_ID_IN && !!process.env.RAZORPAY_KEY_SECRET_IN
  };

  res.status(200).json({
    status: 'ok',
    message: 'Razorpay S2S Payment API',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'local',
    configured_geographies: configs
  });
};
