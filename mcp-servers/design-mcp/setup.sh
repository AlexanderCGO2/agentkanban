#!/bin/bash

# Design MCP Server Setup Script
# This script helps set up the MCP server for Cloudflare Workers deployment

set -e

echo "🎨 Design MCP Server Setup"
echo "=========================="
echo ""

# Check if wrangler is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if logged in to Cloudflare
echo ""
echo "🔐 Checking Cloudflare authentication..."
if ! npx wrangler whoami &> /dev/null; then
    echo "Not logged in to Cloudflare. Starting login..."
    npx wrangler login
fi

# Create KV namespaces
echo ""
echo "📁 Creating KV namespaces..."

echo "Creating production KV namespace..."
PROD_OUTPUT=$(npx wrangler kv:namespace create CANVAS_KV 2>&1) || true
PROD_ID=$(echo "$PROD_OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)

echo "Creating preview KV namespace..."
PREVIEW_OUTPUT=$(npx wrangler kv:namespace create CANVAS_KV --preview 2>&1) || true
PREVIEW_ID=$(echo "$PREVIEW_OUTPUT" | grep -o 'preview_id = "[^"]*"' | cut -d'"' -f2)

if [ -n "$PROD_ID" ] || [ -n "$PREVIEW_ID" ]; then
    echo ""
    echo "✅ KV namespaces created!"
    echo ""
    echo "Please update wrangler.toml with these IDs:"
    echo ""
    echo "[[kv_namespaces]]"
    echo "binding = \"CANVAS_KV\""
    [ -n "$PROD_ID" ] && echo "id = \"$PROD_ID\""
    [ -n "$PREVIEW_ID" ] && echo "preview_id = \"$PREVIEW_ID\""
    echo ""
else
    echo "⚠️  KV namespaces may already exist. Check the output above."
fi

# Prompt for deployment
echo ""
read -p "Do you want to deploy now? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying to Cloudflare Workers..."
    npm run deploy
    echo ""
    echo "✅ Deployment complete!"
else
    echo ""
    echo "To deploy later, run:"
    echo "  npm run deploy"
fi

echo ""
echo "📚 Next steps:"
echo "  1. Update wrangler.toml with the KV namespace IDs"
echo "  2. Run 'npm run dev' for local development"
echo "  3. Run 'npm run deploy' to deploy"
echo ""
echo "🎉 Setup complete!"
