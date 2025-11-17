# AgentPay Production Deployment Checklist

**Status**: Ready for production deployment
**Last Updated**: 2025-11-17
**Estimated Time**: 2-3 hours for complete setup

---

## Pre-Deployment Checklist

### 1. Environment Setup ⏱️ 15 minutes

- [ ] Clone repository to production server
- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Generate strong `POLAR_SECRET` (min 32 characters)
  ```bash
  openssl rand -hex 32
  ```
- [ ] Set `POLAR_ENV=production`
- [ ] Configure `POLAR_BASE_URL` (e.g., https://api.agentpay.com)
- [ ] Configure `POLAR_CORS_ORIGINS` (comma-separated merchant domains)

### 2. LLM Provider Setup ⏱️ 10 minutes

#### Anthropic (Primary LLM)
- [ ] Create account at https://console.anthropic.com/
- [ ] Generate API key
- [ ] Add to `.env.production`: `ANTHROPIC_API_KEY=sk-ant-api03-...`
- [ ] Set `ANTHROPIC_MODEL=claude-3-5-sonnet-20241022`
- [ ] Set `ANTHROPIC_INTENT_MODEL=claude-3-haiku-20240307`
- [ ] Enable prompt caching: `ANTHROPIC_ENABLE_CACHING=true`
- [ ] Verify $5 initial credit

#### OpenAI (Embeddings + Fallback)
- [ ] Create account at https://platform.openai.com/
- [ ] Generate API key
- [ ] Add to `.env.production`: `OPENAI_API_KEY=sk-proj-...`
- [ ] Set `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`
- [ ] Add initial credit ($5-10 recommended)

### 3. Stripe Payment Setup ⏱️ 30 minutes

See detailed guide: [STRIPE_SETUP_GUIDE.md](./STRIPE_SETUP_GUIDE.md)

- [ ] Create Stripe account at https://dashboard.stripe.com/
- [ ] Activate live mode
- [ ] Get API keys from https://dashboard.stripe.com/apikeys
  - [ ] `POLAR_STRIPE_SECRET_KEY=sk_live_...`
  - [ ] `POLAR_STRIPE_PUBLISHABLE_KEY=pk_live_...`
- [ ] Configure webhooks (after deployment):
  - [ ] Direct webhook endpoint: `https://YOUR-DOMAIN/api/v1/integrations/stripe/webhook`
  - [ ] Connect webhook endpoint: `https://YOUR-DOMAIN/api/v1/integrations/stripe/webhook/connect`
  - [ ] Copy webhook secrets to `.env.production`
- [ ] Enable Stripe Connect for multi-merchant support
- [ ] Complete business verification (for live payments)

### 4. Database Setup ⏱️ 20 minutes

#### Option A: Managed PostgreSQL (Recommended)
- [ ] Choose provider: Render, Neon, Supabase, Railway, AWS RDS
- [ ] Create PostgreSQL 15+ database
- [ ] Enable pgvector extension:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- [ ] Verify extension: `\dx` should show `vector`
- [ ] Get connection string
- [ ] Add to `.env.production`: `POLAR_POSTGRES_DSN=postgresql+asyncpg://...`
- [ ] Configure connection pool:
  - [ ] `POLAR_POSTGRES_POOL_SIZE=20`
  - [ ] `POLAR_POSTGRES_MAX_OVERFLOW=10`

#### Option B: Self-Hosted PostgreSQL
- [ ] Install PostgreSQL 15+
- [ ] Install pgvector extension
- [ ] Create database: `agentpay_production`
- [ ] Create user with password
- [ ] Grant permissions
- [ ] Configure connection string

### 5. Redis Setup ⏱️ 10 minutes

#### Option A: Managed Redis (Recommended)
- [ ] Choose provider: Upstash, Redis Cloud, AWS ElastiCache
- [ ] Create Redis instance (256MB minimum)
- [ ] Set eviction policy: `allkeys-lru`
- [ ] Get connection string
- [ ] Add to `.env.production`: `POLAR_REDIS_URL=redis://...`

#### Option B: Self-Hosted Redis
- [ ] Install Redis 7+
- [ ] Configure maxmemory: `256mb`
- [ ] Set eviction policy: `allkeys-lru`
- [ ] Enable persistence (optional)

### 6. S3 Storage Setup ⏱️ 15 minutes

#### Option A: AWS S3
- [ ] Create S3 bucket (e.g., `agentpay-production`)
- [ ] Configure bucket policy (private)
- [ ] Create IAM user with S3 access
- [ ] Generate access keys
- [ ] Add to `.env.production`:
  - [ ] `S3_ENDPOINT_URL=https://s3.amazonaws.com`
  - [ ] `S3_ACCESS_KEY_ID=...`
  - [ ] `S3_SECRET_ACCESS_KEY=...`
  - [ ] `S3_BUCKET_NAME=agentpay-production`
  - [ ] `S3_REGION=us-east-1`

#### Option B: Cloudflare R2 (Cheaper)
- [ ] Create R2 bucket
- [ ] Generate API tokens
- [ ] Configure S3-compatible endpoint

#### Option C: Self-Hosted Minio
- [ ] Deploy Minio container
- [ ] Create bucket
- [ ] Generate access keys

---

## Deployment Process

### 7. Choose Deployment Method

Select ONE of the following:

#### Option A: Render.com (Easiest) ⏱️ 30 minutes

- [ ] Create Render account: https://render.com/
- [ ] Connect GitHub repository
- [ ] Go to Dashboard → New → Blueprint
- [ ] Select `render.agentpay.yaml`
- [ ] Click "Apply"
- [ ] Wait for services to deploy (5-10 minutes)
- [ ] Set environment variables in Render dashboard:
  - [ ] All API keys (Anthropic, OpenAI, Stripe)
  - [ ] S3 credentials
  - [ ] CORS origins
- [ ] Verify deployment: Check logs and health endpoint

**Cost**: ~$28/month (starter plans) or ~$85/month (standard plans)

#### Option B: Docker (Self-Hosted) ⏱️ 45 minutes

- [ ] Install Docker and Docker Compose
- [ ] Review `docker-compose.prod.yml`
- [ ] Build images:
  ```bash
  docker-compose -f docker-compose.prod.yml build --no-cache
  ```
- [ ] Start services:
  ```bash
  docker-compose -f docker-compose.prod.yml up -d
  ```
- [ ] Check logs:
  ```bash
  docker-compose -f docker-compose.prod.yml logs -f
  ```
- [ ] Verify health:
  ```bash
  curl http://localhost:8000/healthz
  ```

#### Option C: Manual (Bare Metal/VPS) ⏱️ 60 minutes

- [ ] Install Python 3.12+
- [ ] Install uv:
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```
- [ ] Install dependencies:
  ```bash
  cd server && uv sync
  ```
- [ ] Build email templates:
  ```bash
  uv run task emails
  ```
- [ ] Set up systemd services for API and worker
- [ ] Configure Nginx reverse proxy
- [ ] Set up SSL with Let's Encrypt

---

## Post-Deployment

### 8. Database Migrations ⏱️ 5 minutes

- [ ] Run migrations:
  ```bash
  # Render: Runs automatically on startup
  # Docker: docker-compose -f docker-compose.prod.yml exec api uv run alembic upgrade head
  # Manual: cd server && uv run alembic upgrade head
  ```
- [ ] Verify migrations completed successfully
- [ ] Check `alembic_version` table

### 9. Configure Stripe Webhooks ⏱️ 10 minutes

- [ ] Get webhook URL: `https://YOUR-DOMAIN/api/v1/integrations/stripe/webhook`
- [ ] Go to Stripe Dashboard → Webhooks
- [ ] Add endpoint
- [ ] Select events:
  - [ ] `payment_intent.succeeded`
  - [ ] `payment_intent.payment_failed`
  - [ ] `customer.created`
  - [ ] `customer.updated`
  - [ ] `subscription.created`
  - [ ] `subscription.updated`
  - [ ] `subscription.deleted`
- [ ] Copy webhook secret
- [ ] Add to `.env.production`: `POLAR_STRIPE_WEBHOOK_SECRET=whsec_live_...`
- [ ] Restart services
- [ ] Test webhook: Send test event from Stripe

### 10. SSL/TLS Configuration ⏱️ 15 minutes

#### Render.com
- [ ] SSL automatically provisioned ✅

#### Docker/Manual
- [ ] Install Certbot
- [ ] Generate certificates:
  ```bash
  certbot certonly --standalone -d api.yourdomain.com
  ```
- [ ] Configure Nginx with SSL
- [ ] Set up auto-renewal cron job
- [ ] Test SSL: https://www.ssllabs.com/ssltest/

### 11. DNS Configuration ⏱️ 10 minutes

- [ ] Add A record: `api.yourdomain.com → SERVER_IP`
- [ ] Add CNAME (if using Render): `api.yourdomain.com → your-app.onrender.com`
- [ ] Verify DNS propagation: `dig api.yourdomain.com`
- [ ] Test HTTPS: `curl https://api.yourdomain.com/healthz`

---

## First-Time Setup

### 12. Create Organization & Agent ⏱️ 10 minutes

- [ ] Access API endpoint
- [ ] Create organization:
  ```bash
  curl -X POST https://api.yourdomain.com/api/v1/organizations \
    -H "Content-Type: application/json" \
    -d '{"name": "Test Merchant", "slug": "test-merchant"}'
  ```
- [ ] Create agent:
  ```bash
  curl -X POST https://api.yourdomain.com/api/v1/agents \
    -H "Content-Type: application/json" \
    -d '{
      "organization_id": "org_...",
      "name": "Sales Agent",
      "personality": "friendly and helpful",
      "type": "sales"
    }'
  ```
- [ ] Note organization ID and agent ID

### 13. Index Products for RAG ⏱️ 5-10 minutes

- [ ] Add products via API or database
- [ ] Trigger indexing:
  ```bash
  # Docker
  docker-compose -f docker-compose.prod.yml exec worker uv run python -m polar.scripts.index_products

  # Manual
  cd server && uv run python -m polar.scripts.index_products
  ```
- [ ] Verify embeddings in `product_embeddings` table
- [ ] Test RAG query:
  ```bash
  curl -X POST https://api.yourdomain.com/api/v1/agent/conversations \
    -H "Content-Type: application/json" \
    -d '{
      "organization_id": "org_...",
      "message": "I need running shoes"
    }'
  ```

---

## Testing & Validation

### 14. Health Checks ⏱️ 10 minutes

- [ ] Run health check script:
  ```bash
  ./scripts/healthcheck.sh https://api.yourdomain.com
  ```
- [ ] Verify all checks pass:
  - [ ] API responding (200 OK)
  - [ ] Database connectivity
  - [ ] Redis connectivity
  - [ ] Agent endpoints available
  - [ ] WebSocket support
  - [ ] CORS configured
  - [ ] SSL/TLS valid
  - [ ] Response time <500ms
- [ ] Fix any failing checks

### 15. End-to-End Testing ⏱️ 20 minutes

- [ ] Create test conversation
- [ ] Send messages with different intents:
  - [ ] Greeting: "Hello"
  - [ ] Product query: "I need running shoes"
  - [ ] Price negotiation: "Can you do better on price?"
  - [ ] Purchase: "I want to buy it"
  - [ ] Checkout: "Ready to checkout"
- [ ] Verify responses are appropriate
- [ ] Check conversation state transitions
- [ ] Test streaming responses (if enabled)
- [ ] Verify WebSocket connection
- [ ] Test checkout flow with Stripe

### 16. Chat Widget Integration ⏱️ 15 minutes

- [ ] Install chat widget on test site:
  ```html
  <script type="module">
    import { AgentPayChat } from '@agentpay/chat';
    import { createRoot } from 'react-dom/client';
    import { createElement } from 'react';

    const root = createRoot(document.getElementById('chat'));
    root.render(
      createElement(AgentPayChat, {
        organizationId: 'org_...',
        agentType: 'sales',
        apiEndpoint: 'https://api.yourdomain.com/api/v1/agent',
        primaryColor: '#10b981',
      })
    );
  </script>
  ```
- [ ] Test chat functionality
- [ ] Verify WebSocket connection
- [ ] Test on mobile device
- [ ] Verify CORS working

---

## Monitoring & Observability

### 17. Error Tracking ⏱️ 10 minutes

- [ ] Create Sentry account: https://sentry.io/
- [ ] Create new project
- [ ] Get DSN
- [ ] Add to `.env.production`: `SENTRY_DSN=https://...`
- [ ] Restart services
- [ ] Trigger test error
- [ ] Verify error appears in Sentry

### 18. Logging ⏱️ 5 minutes

- [ ] Set log level: `LOG_LEVEL=INFO`
- [ ] Configure log aggregation (optional):
  - [ ] CloudWatch (AWS)
  - [ ] Datadog
  - [ ] Logtail
- [ ] Test log output
- [ ] Set up log retention policy

### 19. Metrics & Dashboards ⏱️ 15 minutes

- [ ] Set up Prometheus (optional)
- [ ] Configure Grafana dashboards (optional)
- [ ] Monitor key metrics:
  - [ ] API response time
  - [ ] LLM request latency
  - [ ] Database query time
  - [ ] Error rate
  - [ ] Active conversations
  - [ ] Message throughput
- [ ] Set up alerts for critical metrics

### 20. Uptime Monitoring ⏱️ 5 minutes

- [ ] Choose monitoring service:
  - [ ] UptimeRobot (free)
  - [ ] Pingdom
  - [ ] Better Uptime
- [ ] Monitor `/healthz` endpoint
- [ ] Set check interval: 5 minutes
- [ ] Configure alerts (email, SMS, Slack)
- [ ] Test alert notifications

---

## Security Hardening

### 21. Security Checklist ⏱️ 20 minutes

- [ ] Change all default passwords
- [ ] Use strong `POLAR_SECRET` (32+ characters)
- [ ] Enable HTTPS only: `FORCE_HTTPS=true`
- [ ] Configure CORS properly (specific origins, not `*`)
- [ ] Enable rate limiting:
  - [ ] `RATE_LIMIT_PER_MINUTE=60`
  - [ ] `CHAT_RATE_LIMIT_PER_MINUTE=10`
- [ ] Enable CSRF protection: `CSRF_ENABLED=true`
- [ ] Configure secure cookies:
  - [ ] `SESSION_COOKIE_SECURE=true`
  - [ ] `SESSION_COOKIE_HTTPONLY=true`
  - [ ] `SESSION_COOKIE_SAMESITE=lax`
- [ ] Set up firewall (allow only 80, 443)
- [ ] Disable database external access (if possible)
- [ ] Use read-only database replicas for queries (optional)
- [ ] Enable database backup encryption
- [ ] Review API authentication scopes

### 22. Compliance ⏱️ 10 minutes

- [ ] Add privacy policy URL
- [ ] Add terms of service URL
- [ ] Configure GDPR compliance (if EU users):
  - [ ] Data retention policies
  - [ ] Right to deletion
  - [ ] Data export
- [ ] Configure PCI DSS (Stripe handles this)
- [ ] Set up audit logging for sensitive operations

---

## Performance Optimization

### 23. Performance Tuning ⏱️ 15 minutes

- [ ] Enable LLM prompt caching: `ANTHROPIC_ENABLE_CACHING=true`
- [ ] Configure Redis caching:
  - [ ] `AGENTPAY_EMBEDDING_CACHE_TTL=3600`
- [ ] Optimize RAG settings:
  - [ ] `AGENTPAY_RAG_SIMILARITY_THRESHOLD=0.75`
  - [ ] `AGENTPAY_RAG_MAX_RESULTS=5`
- [ ] Configure database connection pool:
  - [ ] `POLAR_POSTGRES_POOL_SIZE=20`
  - [ ] `POLAR_POSTGRES_MAX_OVERFLOW=10`
- [ ] Set worker concurrency:
  - [ ] `WORKER_THREADS=4`
  - [ ] `WORKER_CONCURRENCY=10`
- [ ] Configure timeouts:
  - [ ] `DB_QUERY_TIMEOUT=30`
  - [ ] `LLM_REQUEST_TIMEOUT=60`
  - [ ] `HTTP_CLIENT_TIMEOUT=30`

### 24. Database Optimization ⏱️ 10 minutes

- [ ] Create pgvector ivfflat index:
  ```sql
  CREATE INDEX idx_product_embeddings_vector
    ON product_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
  ```
- [ ] Analyze query performance
- [ ] Add indexes on frequently queried columns
- [ ] Configure autovacuum
- [ ] Set up query logging for slow queries (>1s)

---

## Backup & Disaster Recovery

### 25. Backup Configuration ⏱️ 15 minutes

- [ ] Configure automated backups:
  ```bash
  # Daily backup cron job
  0 2 * * * /path/to/scripts/backup.sh
  ```
- [ ] Set retention policy: `RETENTION_DAYS=30`
- [ ] Configure backup storage (S3 recommended)
- [ ] Test backup process:
  ```bash
  ./scripts/backup.sh
  ```
- [ ] Verify backup file created
- [ ] Test restore process
- [ ] Document restore procedure

### 26. Disaster Recovery Plan ⏱️ 10 minutes

- [ ] Document recovery procedures
- [ ] Set recovery time objective (RTO): 2-4 hours
- [ ] Set recovery point objective (RPO): 24 hours
- [ ] Create runbook for common failures:
  - [ ] Database failure
  - [ ] API server crash
  - [ ] Redis failure
  - [ ] LLM provider outage
- [ ] Test failover procedures
- [ ] Set up database replication (optional)

---

## Go Live!

### 27. Final Pre-Launch Checks ⏱️ 10 minutes

- [ ] All environment variables set correctly
- [ ] All API keys valid and funded
- [ ] Database migrations complete
- [ ] Products indexed for RAG
- [ ] Stripe webhooks configured and tested
- [ ] SSL/TLS certificate valid
- [ ] Health checks passing
- [ ] Error tracking working
- [ ] Monitoring active
- [ ] Backups configured
- [ ] Documentation complete

### 28. Launch ⏱️ 5 minutes

- [ ] Enable widget on first merchant site
- [ ] Monitor logs in real-time
- [ ] Test first conversation
- [ ] Verify Stripe payment works
- [ ] Check error rates
- [ ] Monitor API response times
- [ ] Celebrate! 🎉

### 29. Post-Launch Monitoring ⏱️ Ongoing

First 24 hours:
- [ ] Monitor error rates every hour
- [ ] Check API response times
- [ ] Verify LLM costs within budget
- [ ] Review conversation quality
- [ ] Check database performance
- [ ] Monitor Redis memory usage
- [ ] Verify backups running

First week:
- [ ] Daily error rate review
- [ ] Weekly cost analysis (LLM, infrastructure)
- [ ] Conversation quality audit
- [ ] User feedback collection
- [ ] Performance optimization based on metrics

---

## Merchant Onboarding

### 30. First Merchant Setup ⏱️ 30 minutes

- [ ] Create merchant organization
- [ ] Import product catalog
- [ ] Index products for RAG
- [ ] Create sales agent
- [ ] Configure agent personality
- [ ] Set up Stripe Connect account
- [ ] Add merchant domain to CORS
- [ ] Generate widget embed code
- [ ] Test widget on merchant site
- [ ] Train merchant on dashboard
- [ ] Monitor first conversations

---

## Cost Monitoring

### 31. Budget Tracking ⏱️ 5 minutes

Expected monthly costs:
- [ ] Infrastructure: $28-85 (Render) or custom (self-hosted)
- [ ] LLM (Claude): ~$13 per 1,000 conversations
- [ ] Embeddings (OpenAI): ~$0.02 per 1M tokens
- [ ] Stripe fees: 2.9% + $0.30 per transaction
- [ ] Monitoring (Sentry, etc.): $0-29/month

- [ ] Set up cost alerts
- [ ] Monitor LLM usage daily
- [ ] Review Stripe fees weekly
- [ ] Optimize costs based on usage

---

## Checklist Summary

**Total estimated time**: 2-3 hours (Render) or 4-5 hours (Docker/Manual)

**Critical items** (must complete):
- Environment setup
- LLM provider setup (Anthropic + OpenAI)
- Stripe payment setup
- Database with pgvector
- Redis
- S3 storage
- Deployment
- SSL/TLS
- Stripe webhooks
- Health checks

**Recommended items**:
- Error tracking (Sentry)
- Uptime monitoring
- Automated backups
- Performance optimization

**Optional items**:
- Advanced monitoring (Prometheus, Grafana)
- Database replication
- Multi-region deployment

---

## Support & Troubleshooting

Common issues:
- **Migration failures**: Check database connectivity and pgvector extension
- **LLM errors**: Verify API keys and account credits
- **Stripe webhook failures**: Check webhook URL and secret
- **CORS errors**: Add merchant domain to `POLAR_CORS_ORIGINS`
- **Slow responses**: Enable prompt caching, optimize RAG settings
- **High costs**: Review LLM usage, enable caching, use Haiku for intent classification

For more help:
- Review logs: Check API and worker logs for errors
- Health check: `./scripts/healthcheck.sh https://api.yourdomain.com`
- Documentation: See `PRODUCTION_DEPLOYMENT.md` for detailed guides
- Community: GitHub issues, Discord, or support email

---

**Status**: Ready for production deployment ✅
**Next**: Choose deployment method (Render recommended) and follow checklist sequentially
