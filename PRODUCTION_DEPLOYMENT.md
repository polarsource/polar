# AgentPay Production Deployment Guide

**Date**: 2025-11-17
**Goal**: Deploy AgentPay to production and onboard first merchant
**Time**: 2-3 hours

---

## Phase 1: Environment Setup (30 min)

### Step 1: API Keys

Create `.env.production` file:

```bash
cd server

# Copy template
cp .env.example .env.production

# Edit with production values
nano .env.production
```

**Required Environment Variables**:

```bash
# === Core Settings ===
ENV=production
SECRET=<generate-with: openssl rand -hex 32>
CORS_ORIGINS=https://your-domain.com,https://chat.your-domain.com

# === Database ===
DATABASE_URL=postgresql://user:pass@host:5432/agentpay
POSTGRES_USER=agentpay
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=agentpay

# === Redis ===
REDIS_URL=redis://localhost:6379/0

# === Stripe (from STRIPE_SETUP_GUIDE.md) ===
POLAR_STRIPE_SECRET_KEY=sk_live_...
POLAR_STRIPE_PUBLISHABLE_KEY=pk_live_...
POLAR_STRIPE_WEBHOOK_SECRET=whsec_live_...
POLAR_STRIPE_CONNECT_WEBHOOK_SECRET=whsec_live_...

# === LLM APIs (from LLM_COST_BENEFIT_ANALYSIS.md) ===
# Anthropic Claude (Primary)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (Embeddings + Fallback)
OPENAI_API_KEY=sk-...

# === AgentPay Configuration ===
AGENT_DEFAULT_MODEL=claude-3-5-sonnet-20241022
AGENT_INTENT_MODEL=claude-3-haiku-20240307
AGENT_EMBEDDING_MODEL=text-embedding-3-small
AGENT_MAX_TOKENS=1024
AGENT_TEMPERATURE=0.7

# === S3 (if using file storage) ===
S3_BUCKET_NAME=agentpay-production
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1

# === Email (for notifications) ===
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=...
EMAIL_FROM=noreply@agentpay.com

# === Monitoring ===
SENTRY_DSN=https://...@sentry.io/...
DATADOG_API_KEY=...

# === Security ===
ALLOWED_HOSTS=your-domain.com,api.your-domain.com
SECURE_COOKIES=true
CSRF_TRUSTED_ORIGINS=https://your-domain.com
```

### Step 2: Generate Secrets

```bash
# Generate SECRET
openssl rand -hex 32

# Generate POSTGRES_PASSWORD
openssl rand -base64 32

# Save to .env.production
```

### Step 3: Validate Configuration

```bash
# Test all environment variables are set
uv run python -c "
from polar.config import settings
print('✅ SECRET:', len(settings.SECRET), 'chars')
print('✅ DATABASE_URL:', settings.DATABASE_URL[:20] + '...')
print('✅ STRIPE_SECRET_KEY:', settings.STRIPE_SECRET_KEY[:7] + '...')
print('✅ ANTHROPIC_API_KEY:', getattr(settings, 'ANTHROPIC_API_KEY', 'NOT SET')[:7] + '...')
print('✅ OPENAI_API_KEY:', getattr(settings, 'OPENAI_API_KEY', 'NOT SET')[:7] + '...')
print('All required vars loaded!')
"
```

---

## Phase 2: Database Setup (15 min)

### Step 1: Provision PostgreSQL

**Option A: Managed Service (Recommended)**

```bash
# Render.com
# 1. Go to https://dashboard.render.com
# 2. New > PostgreSQL
# 3. Name: agentpay-db
# 4. Plan: Starter ($7/month) or higher
# 5. Copy DATABASE_URL

# Railway.app
# 1. Go to https://railway.app
# 2. New Project > PostgreSQL
# 3. Copy DATABASE_URL

# Supabase
# 1. Go to https://supabase.com
# 2. New Project
# 3. Settings > Database > Connection string
```

**Option B: Self-Hosted**

```bash
# Docker
docker run -d \
  --name agentpay-postgres \
  -e POSTGRES_USER=agentpay \
  -e POSTGRES_PASSWORD=<password> \
  -e POSTGRES_DB=agentpay \
  -p 5432:5432 \
  -v agentpay-db:/var/lib/postgresql/data \
  postgres:15-alpine

# Verify
docker logs agentpay-postgres
```

### Step 2: Enable pgvector Extension

```bash
# Connect to database
psql $DATABASE_URL

# Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

# Verify
\dx vector

# Expected output:
# vector | 0.5.0 | public | vector data type and ivfflat access method

# Exit
\q
```

### Step 3: Run Migrations

```bash
cd server

# Run all migrations
uv run alembic upgrade head

# Verify
uv run python -c "
from polar.postgres import async_session_maker
from sqlalchemy import text
import asyncio

async def check_tables():
    async with async_session_maker() as session:
        result = await session.execute(
            text(\"SELECT tablename FROM pg_tables WHERE schemaname='public'\")
        )
        tables = [row[0] for row in result.fetchall()]
        print(f'✅ {len(tables)} tables created')
        assert 'agents' in tables
        assert 'conversations' in tables
        assert 'messages' in tables
        print('✅ AgentPay tables verified')

asyncio.run(check_tables())
"
```

### Step 4: Create Product Embeddings Table

```bash
# Run SQL from migration template
psql $DATABASE_URL < migrations/versions/TEMPLATE_product_embeddings.sql

# Or create migration
uv run alembic revision -m "add product_embeddings for RAG"

# Edit generated migration file to match template

# Run migration
uv run alembic upgrade head
```

---

## Phase 3: Deploy Backend (45 min)

### Option A: Deploy to Render.com (Easiest)

**1. Create `render.yaml`**:

```yaml
services:
  # API Server
  - type: web
    name: agentpay-api
    env: python
    region: oregon
    plan: starter  # $7/month
    buildCommand: cd server && uv sync
    startCommand: cd server && uv run uvicorn polar.app:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: agentpay-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: agentpay-redis
          type: redis
          property: connectionString
      - key: ENV
        value: production
      # Add all other env vars from .env.production
    healthCheckPath: /v1/health

  # Background Worker
  - type: worker
    name: agentpay-worker
    env: python
    region: oregon
    plan: starter
    buildCommand: cd server && uv sync
    startCommand: cd server && uv run dramatiq polar.worker
    envVars:
      # Same as API

databases:
  - name: agentpay-db
    databaseName: agentpay
    user: agentpay
    plan: starter  # $7/month

services:
  - type: redis
    name: agentpay-redis
    region: oregon
    plan: starter  # $1/month
```

**2. Deploy**:

```bash
# Install Render CLI
brew install render  # macOS
# or download from https://render.com/docs/cli

# Login
render login

# Deploy
render deploy
```

**3. Set Environment Variables**:

```bash
# Via Render Dashboard
# 1. Go to agentpay-api service
# 2. Environment tab
# 3. Add all vars from .env.production
```

### Option B: Deploy to Railway.app

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Link to GitHub repo
railway link

# Deploy
railway up

# Set environment variables
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set OPENAI_API_KEY=sk-...
# ... (all vars from .env.production)
```

### Option C: Deploy with Docker

**1. Create `Dockerfile`**:

```dockerfile
FROM python:3.12-slim

# Install uv
RUN pip install uv

# Set working directory
WORKDIR /app

# Copy server code
COPY server/ /app/

# Install dependencies
RUN uv sync

# Expose port
EXPOSE 8000

# Run migrations and start server
CMD uv run alembic upgrade head && \
    uv run uvicorn polar.app:app --host 0.0.0.0 --port 8000
```

**2. Create `docker-compose.production.yml`**:

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    env_file:
      - server/.env.production
    depends_on:
      - postgres
      - redis
    restart: always

  worker:
    build: .
    command: uv run dramatiq polar.worker
    env_file:
      - server/.env.production
    depends_on:
      - postgres
      - redis
    restart: always

  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_USER: agentpay
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: agentpay
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
    restart: always

volumes:
  postgres-data:
  redis-data:
```

**3. Deploy**:

```bash
# Build and start
docker-compose -f docker-compose.production.yml up -d

# Check logs
docker-compose logs -f api

# Check health
curl http://localhost:8000/v1/health
```

---

## Phase 4: Configure Domain & SSL (15 min)

### Step 1: Point Domain to Server

**If using Render/Railway**:
- Automatically handles SSL with Let's Encrypt
- Just add custom domain in dashboard

**If self-hosted**:

```bash
# Point DNS A record to your server IP
# api.your-domain.com -> 1.2.3.4

# Wait for DNS propagation (5-30 minutes)
dig api.your-domain.com
```

### Step 2: Set up SSL with Certbot

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.your-domain.com

# Auto-renewal (cron)
sudo certbot renew --dry-run
```

### Step 3: Update CORS

```bash
# In .env.production
CORS_ORIGINS=https://your-domain.com,https://api.your-domain.com
```

---

## Phase 5: Configure Stripe Webhooks (10 min)

### Update Webhook Endpoints

```bash
# 1. Go to https://dashboard.stripe.com/webhooks
# 2. Click existing test webhook
# 3. Update URL to production:
#    https://api.your-domain.com/v1/integrations/stripe/webhook
# 4. Save
# 5. Copy signing secret
# 6. Update POLAR_STRIPE_WEBHOOK_SECRET in .env.production
```

### Test Webhook

```bash
# Trigger test payment
stripe trigger payment_intent.succeeded --api-key sk_live_...

# Check logs
curl https://api.your-domain.com/logs | grep stripe

# Or check Render/Railway logs dashboard
```

---

## Phase 6: Index Products (15 min)

### Step 1: Create Test Organization

```bash
# Via API or Django admin
curl -X POST https://api.your-domain.com/v1/organizations \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Shop",
    "slug": "test-shop"
  }'

# Save organization_id
ORG_ID=<from-response>
```

### Step 2: Create Products

```bash
# Create products via API
curl -X POST https://api.your-domain.com/v1/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "'$ORG_ID'",
    "name": "Premium Running Shoes",
    "description": "High-quality trail running shoes with excellent grip",
    "prices": [{
      "price_amount": 15000,
      "price_currency": "usd"
    }]
  }'
```

### Step 3: Index Products for RAG

```bash
# Trigger background indexing
curl -X POST https://api.your-domain.com/v1/agent/knowledge/index \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "'$ORG_ID'"
  }'

# Or run via Python
uv run python -c "
from polar.agent_knowledge.tasks import agent_knowledge_index_organization_products
agent_knowledge_index_organization_products.send(organization_id='$ORG_ID')
"

# Check logs
# Expected: "Batch indexing complete: X products indexed"
```

### Step 4: Verify RAG Working

```bash
# Test semantic search
curl -X POST https://api.your-domain.com/v1/agent/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "shoes for trail running",
    "organization_id": "'$ORG_ID'",
    "limit": 5
  }'

# Expected: Returns products with relevance scores
```

---

## Phase 7: Deploy Chat Widget (20 min)

### Step 1: Build Widget

```bash
cd clients/packages/agentpay-chat

# Install dependencies
pnpm install

# Build for production
pnpm build

# Output: dist/index.js, dist/index.mjs, dist/index.d.ts
```

### Step 2: Publish to npm

```bash
# Login to npm
npm login

# Publish package
npm publish --access public

# Or publish to private registry
npm publish --registry https://npm.your-company.com
```

### Step 3: Deploy to CDN (Alternative)

```bash
# Upload to CDN (AWS S3, Cloudflare, etc.)
aws s3 sync dist/ s3://your-cdn-bucket/agentpay-chat/v0.1.0/ --acl public-read

# CDN URL:
# https://cdn.your-domain.com/agentpay-chat/v0.1.0/index.js
```

### Step 4: Create Demo Page

```html
<!-- demo.html -->
<!DOCTYPE html>
<html>
<head>
  <title>AgentPay Demo</title>
  <script type="module">
    import { createRoot } from 'https://esm.sh/react-dom@18/client';
    import { createElement } from 'https://esm.sh/react@18';
    import { AgentPayChat } from 'https://cdn.your-domain.com/agentpay-chat/v0.1.0/index.js';

    const root = createRoot(document.getElementById('chat'));
    root.render(
      createElement(AgentPayChat, {
        organizationId: 'ORG_ID',
        agentType: 'sales',
        apiEndpoint: 'https://api.your-domain.com/v1/agent',
        primaryColor: '#3b82f6',
        enableStreaming: true,
      })
    );
  </script>
</head>
<body>
  <h1>AgentPay Demo</h1>
  <div id="chat"></div>
</body>
</html>
```

---

## Phase 8: Test End-to-End (15 min)

### Test Checklist

```bash
# ✅ 1. API Health
curl https://api.your-domain.com/v1/health
# Expected: {"status": "ok"}

# ✅ 2. Create Conversation
curl -X POST https://api.your-domain.com/v1/agent/conversations \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test_123", "organization_id": "'$ORG_ID'"}'
# Save conversation_id

# ✅ 3. Send Message
curl -X POST https://api.your-domain.com/v1/agent/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"content": "I need running shoes under $150"}'
# Expected: Agent response with product recommendations

# ✅ 4. Test Streaming
curl -X POST https://api.your-domain.com/v1/agent/conversations/$CONV_ID/messages/stream \
  -H "Content-Type: application/json" \
  -d '{"content": "Tell me more"}' \
  --no-buffer
# Expected: SSE stream with progressive response

# ✅ 5. Test WebSocket
# Use websocat or browser
ws://api.your-domain.com/v1/agent/conversations/$CONV_ID/ws

# ✅ 6. Test RAG
# Send product query and verify RAG context in response

# ✅ 7. Test Checkout Flow
# Send "I want to buy" and verify checkout link generated

# ✅ 8. Test Stripe Webhook
# Make test payment and verify order marked as paid
```

---

## Phase 9: Monitoring Setup (10 min)

### Set up Sentry (Error Tracking)

```bash
# Install
pip install sentry-sdk

# Configure in polar/app.py
import sentry_sdk

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment="production",
    traces_sample_rate=0.1,
)
```

### Set up Datadog (APM)

```bash
# Install
pip install ddtrace

# Run with Datadog
DD_SERVICE=agentpay \
DD_ENV=production \
ddtrace-run uvicorn polar.app:app
```

### Set up Uptime Monitoring

```bash
# Use UptimeRobot, Pingdom, or similar
# Monitor endpoints:
# - https://api.your-domain.com/v1/health
# - Alert if down for >2 minutes
```

---

## Phase 10: Go Live! (5 min)

### Launch Checklist

- [x] ✅ Environment variables set
- [x] ✅ Database migrated
- [x] ✅ pgvector extension enabled
- [x] ✅ Stripe configured (live keys)
- [x] ✅ Webhooks configured (production URLs)
- [x] ✅ LLM API keys added (Anthropic + OpenAI)
- [x] ✅ Products indexed for RAG
- [x] ✅ Chat widget deployed
- [x] ✅ SSL certificate configured
- [x] ✅ Monitoring enabled
- [x] ✅ End-to-end tests passing

### First Merchant Onboarding

1. **Create merchant account**:
```bash
curl -X POST https://api.your-domain.com/v1/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "First Merchant",
    "slug": "first-merchant"
  }'
```

2. **Send embed code**:
```html
<script type="module">
  import { AgentPayChat } from '@agentpay/chat';
  import { createRoot } from 'react-dom/client';

  const root = createRoot(document.getElementById('agentpay'));
  root.render(
    AgentPayChat({
      organizationId: 'MERCHANT_ORG_ID',
      apiEndpoint: 'https://api.your-domain.com/v1/agent'
    })
  );
</script>
<div id="agentpay"></div>
```

3. **Test on merchant site**:
   - Visit merchant website
   - Click chat button
   - Test conversation flow
   - Test checkout

### 🎉 **PRODUCTION LAUNCHED!**

---

## Next Steps

### Week 1: Monitor & Optimize
- Monitor error rates daily
- Track conversation → sale conversion
- Optimize LLM prompts based on feedback
- Fix any bugs discovered

### Week 2: Onboard More Merchants
- Create merchant dashboard
- Add self-service onboarding
- Build analytics dashboard

### Week 3: Scale
- Optimize database queries
- Add caching layer
- Scale infrastructure as needed

---

## Support & Troubleshooting

### Common Issues

**Issue**: "Agent not responding"
- Check: Anthropic API key valid
- Check: API logs for errors
- Check: WebSocket connection established

**Issue**: "Products not found in RAG"
- Check: Products indexed (`agent_knowledge_index_organization_products`)
- Check: pgvector extension enabled
- Check: OpenAI API key valid

**Issue**: "Stripe webhook not working"
- Check: Webhook URL correct
- Check: Signing secret matches
- Check: Stripe logs in dashboard

### Get Help

- Documentation: `/home/user/flowpay/README_AGENTPAY.md`
- Stripe Setup: `/home/user/flowpay/STRIPE_SETUP_GUIDE.md`
- LLM Costs: `/home/user/flowpay/LLM_COST_BENEFIT_ANALYSIS.md`

---

## Deployment Complete! 🚀

Your AgentPay system is now:
- ✅ Running in production
- ✅ Processing payments via Stripe
- ✅ Responding with Claude AI
- ✅ Searching products with RAG
- ✅ Serving chat widget to merchants

**Time to make money!** 💰
