# Razorpay Payment Integration Demo

Premium payment experience with multi-geography support for Razorpay integrations.

## Features

- 🎨 Premium Apple-inspired black UI with glassmorphic design
- 🌍 Multi-geography support (Malaysia, Singapore, USA, India)
- 💳 Standard Checkout integration
- 🔐 Server-to-Server integrations:
  - Apple Pay S2S
  - Card payments with 3DS/OTP authentication
- 🛡️ Razorpay Shield integration for fraud detection
- 📱 Responsive design for all devices

## Live Demo

- GitHub Pages: https://shashwatgupta23.github.io/razorpay-demo/
- Vercel (with S2S): [Coming soon]

## Local Development

1. Clone the repository:
```bash
git clone https://github.com/shashwatgupta23/razorpay-demo.git
cd razorpay-demo
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Add your Razorpay API credentials to `.env`

5. Start the server:
```bash
node server.js
```

6. Open `index.html` in your browser or visit `http://localhost:3000`

## Deploy to Vercel

### Option 1: Using Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Set environment variables in Vercel dashboard:
   - Go to your project settings
   - Add all `RAZORPAY_*` variables from `.env.example`

### Option 2: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Add environment variables in project settings
5. Deploy

## Environment Variables

Required environment variables (see `.env.example`):

```
RAZORPAY_KEY_ID_MY=your_malaysia_key_id
RAZORPAY_KEY_SECRET_MY=your_malaysia_key_secret
RAZORPAY_KEY_ID_SG=your_singapore_key_id
RAZORPAY_KEY_SECRET_SG=your_singapore_key_secret
RAZORPAY_KEY_ID_US=your_usa_key_id
RAZORPAY_KEY_SECRET_US=your_usa_key_secret
RAZORPAY_KEY_ID_IN=your_india_key_id
RAZORPAY_KEY_SECRET_IN=your_india_key_secret
PORT=3000
```

## API Endpoints

- `POST /api/create-payment` - Create card payment (S2S)
- `POST /api/create-applepay-payment` - Create Apple Pay payment (S2S)
- `POST /api/validate-apple-merchant` - Validate Apple merchant
- `GET /health` - Health check

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Payment Gateway: Razorpay
- Deployment: Vercel, GitHub Pages

## License

MIT
