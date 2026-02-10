#!/bin/bash

# Razorpay Demo - Vercel Deployment Script
# This script deploys the application to Vercel

echo "🚀 Deploying Razorpay Demo to Vercel..."
echo ""

# Check if logged in
if ! npx vercel@latest whoami > /dev/null 2>&1; then
  echo "❌ Not logged in to Vercel"
  echo "Please run: npx vercel login"
  exit 1
fi

echo "✅ Authenticated with Vercel"
echo ""

# Deploy to production
echo "📦 Deploying to production..."
npx vercel@latest --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Visit your Vercel dashboard to see the deployment"
echo "2. Make sure environment variables are set in Vercel project settings"
echo "3. Test the S2S payments on your live URL"
