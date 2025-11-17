# AgentPay Business Model & Deployment Options

**Date**: 2025-11-17
**Status**: Strategic Planning Document
**Purpose**: Define business model, pricing tiers, and deployment architecture

---

## Table of Contents

1. [Business Model Overview](#business-model-overview)
2. [Pricing Tiers](#pricing-tiers)
3. [Deployment Options (5+)](#deployment-options)
4. [Technical Architecture by Tier](#technical-architecture-by-tier)
5. [Revenue Analysis](#revenue-analysis)
6. [Implementation Roadmap](#implementation-roadmap)

---

## Business Model Overview

### Core Question: Who Provides What?

**Two critical decisions**:
1. **LLM API**: AgentPay provides vs. Merchant brings their own
2. **Payment Processing**: AgentPay provides vs. Merchant brings their own

### Recommended: **Hybrid SaaS Model**

Different tiers offer different levels of control and integration:

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENTPAY PLATFORM                         │
├─────────────┬──────────────┬──────────────┬─────────────────┤
│  STANDARD   │     PRO      │  ENTERPRISE  │  SELF-HOSTED    │
│             │              │              │                 │
│ We provide  │ Your choice  │ Your APIs    │ You deploy      │
│ everything  │ (Ours/Yours) │ + platform   │ + your APIs     │
└─────────────┴──────────────┴──────────────┴─────────────────┘
```

**Why Hybrid?**
- **Standard**: Easiest onboarding, fastest time-to-value
- **Pro**: Flexibility for growing businesses
- **Enterprise**: Maximum control for large merchants
- **Self-Hosted**: Full ownership for regulated industries

---

## Pricing Tiers

### **Tier 1: STANDARD** 💼

**Price**: **$29/month**

**What's Included**:
- ✅ AgentPay provides LLM (Claude)
- ✅ AgentPay provides payment processing (Stripe)
- ✅ Hosted on AgentPay infrastructure
- ✅ Up to 1,000 conversations/month (included)
- ✅ Chat widget (React, Astro, HTML)
- ✅ Basic analytics dashboard
- ✅ Email support (48-hour response)
- ✅ Standard uptime (99.5%)

**Transaction Fees**:
- **3.5% + $0.40** per successful transaction
- Covers: Stripe fees (2.9% + $0.30) + AgentPay margin (0.6% + $0.10)

**Overage Pricing**:
- $0.02 per conversation over 1,000/month
- Estimated: $20 for 2,000 conversations

**LLM Usage**:
- Included in base price (fair use: ~1,000 conversations)
- We absorb LLM costs (~$13/1K conversations)
- Overages charged at $0.015 per conversation (slightly above cost)

**Best For**:
- Small merchants (1-50 transactions/day)
- Testing and validation
- Quick setup, minimal technical knowledge
- Budget-conscious businesses

**Revenue Model** (for AgentPay):
- Base: $29/month
- Transaction margin: 0.6% + $0.10
- Example: 100 transactions @ $50 = $5,000 volume
  - Transaction revenue: $40 (0.6% + $10)
  - Total: $69/month per merchant

---

### **Tier 2: PRO** 🚀

**Price**: **$99/month**

**What's Included**:
- ✅ **Choice**: Use AgentPay's LLM OR bring your own API keys
- ✅ **Choice**: Use AgentPay's Stripe OR connect your own Stripe account
- ✅ Hosted on AgentPay infrastructure (dedicated instances)
- ✅ Up to 5,000 conversations/month (included)
- ✅ Advanced chat widget (customizable)
- ✅ Advanced analytics + conversation insights
- ✅ Priority email + chat support (24-hour response)
- ✅ Enhanced uptime (99.9%)
- ✅ Custom agent personality tuning
- ✅ A/B testing capabilities

**Transaction Fees**:

**Option A: Using AgentPay's Payment Processing**
- **2.5% + $0.40** per successful transaction
- Lower fee than Standard tier

**Option B: Using Your Own Stripe Account**
- **Your Stripe fees** (2.9% + $0.30) **+ $0.40 AgentPay fee**
- You keep direct relationship with Stripe
- Faster payouts (direct to your account)
- AgentPay charges flat $0.40 per transaction

**LLM Pricing**:

**Option A: Using AgentPay's LLM**
- Up to 5,000 conversations included
- Overage: $0.015 per conversation
- We manage API keys, optimization, fallbacks

**Option B: Bring Your Own LLM Keys**
- **No LLM charges from AgentPay**
- You provide Anthropic + OpenAI API keys
- You pay providers directly
- You control costs and models
- AgentPay provides optimization guidance

**Best For**:
- Growing merchants (50-200 transactions/day)
- Businesses wanting cost control
- Companies with existing Stripe accounts
- Teams with technical resources
- Merchants wanting data ownership

**Revenue Model** (for AgentPay):
- Base: $99/month
- **Option A** (our processing): 0.4% + $0.10 margin per transaction
- **Option B** (their processing): $0.40 flat per transaction
- Example: 500 transactions @ $50 = $25,000 volume
  - Option A revenue: $199 + transaction margin ($110) = $309/month
  - Option B revenue: $99 + ($0.40 × 500) = $299/month

---

### **Tier 3: ENTERPRISE** 🏢

**Price**: **Custom** (starting at $499/month)

**What's Included**:
- ✅ Bring your own LLM API keys (required)
- ✅ Bring your own payment provider (Stripe, Braintree, Adyen, etc.)
- ✅ **Choice**: Hosted by AgentPay OR self-hosted on your infrastructure
- ✅ Unlimited conversations
- ✅ White-label option (remove AgentPay branding)
- ✅ Custom agent development
- ✅ Multi-agent routing (sales, support, payment agents)
- ✅ Dedicated account manager
- ✅ Phone + Slack support (4-hour response)
- ✅ 99.99% uptime SLA
- ✅ Custom integrations (ERPs, CRMs, etc.)
- ✅ Advanced security (SSO, SAML, audit logs)
- ✅ Dedicated infrastructure
- ✅ Custom SLA and contracts

**Transaction Fees**:
- **$0.25 per transaction** (flat fee only)
- You pay your payment provider directly
- We only charge platform fee

**LLM Costs**:
- You provide your own API keys
- You pay providers directly
- We provide optimization and caching strategies
- Estimated: $13/1K conversations with our optimizations

**Best For**:
- Enterprise merchants (200+ transactions/day)
- Regulated industries (finance, healthcare)
- Companies requiring data sovereignty
- Multi-brand organizations
- Custom integration requirements

**Revenue Model** (for AgentPay):
- Base: $499-2,499/month (based on features)
- Transaction fee: $0.25 flat
- Example: 5,000 transactions/month
  - Revenue: $499 + ($0.25 × 5,000) = $1,749/month
- High volume (50,000 transactions/month):
  - Revenue: $2,499 + ($0.25 × 50,000) = $14,999/month

---

### **Tier 4: SELF-HOSTED** 🔧

**Price**: **$199/month** (license fee)

**What's Included**:
- ✅ Full source code access
- ✅ Deploy on your own infrastructure
- ✅ Bring your own LLM API keys (required)
- ✅ Bring your own payment provider (required)
- ✅ Unlimited conversations (you pay infrastructure)
- ✅ White-label (full customization)
- ✅ Priority support for deployment issues
- ✅ Quarterly updates
- ✅ Security patches

**Transaction Fees**:
- **$0 per transaction** (you pay your providers)
- Optional: Connect to AgentPay analytics ($49/month)

**Your Costs**:
- Infrastructure: $28-200/month (Render, AWS, etc.)
- LLM: ~$13/1K conversations
- Payment provider: Their fees (e.g., Stripe 2.9% + $0.30)

**Best For**:
- Very high volume (5,000+ transactions/day)
- Regulated industries requiring on-premise
- Cost optimization at scale
- Full customization needs
- Companies with DevOps teams

**Revenue Model** (for AgentPay):
- License: $199/month (recurring)
- Optional analytics: $49/month
- Support upgrades: $299-999/month (optional)
- Example: $199-1,447/month per customer

---

## Deployment Options

### **Option 1: Vercel** ⚡ (NEW)

**Best For**: Widget deployment + serverless functions

**Limitations**:
- ❌ WebSocket not supported on serverless
- ❌ 60-second timeout (Pro plan) - may cut off long LLM responses
- ❌ Not ideal for full backend deployment

**Recommended Architecture**:
```
┌─────────────────────────────────────────────────┐
│  VERCEL (Frontend + API Routes)                 │
│  - Chat widget (React/Astro)                    │
│  - Edge functions for auth                      │
│  - Static assets (CDN)                          │
└────────────────┬────────────────────────────────┘
                 │
                 │ API calls
                 ▼
┌─────────────────────────────────────────────────┐
│  RENDER/RAILWAY (Backend)                       │
│  - FastAPI server                               │
│  - WebSocket support                            │
│  - Worker processes                             │
│  - PostgreSQL + Redis                           │
└─────────────────────────────────────────────────┘
```

**Deployment**:
```bash
# Frontend on Vercel
vercel --prod

# Backend on Render
# Use existing render.agentpay.yaml
```

**Cost**:
- Vercel Pro: $20/month (for custom domains)
- Render Backend: $28-85/month
- **Total**: $48-105/month

**Pros**:
- ✅ Lightning-fast widget delivery (Edge CDN)
- ✅ Automatic preview deployments
- ✅ Great DX for frontend teams

**Cons**:
- ❌ Requires two platforms (Vercel + Render)
- ❌ More complex architecture
- ❌ Higher cost than single platform

---

### **Option 2: Railway.app** 🚄 (NEW - RECOMMENDED FOR PRO)

**Best For**: Full-stack deployment with excellent DX

**Features**:
- ✅ Similar to Render but better pricing
- ✅ PostgreSQL with pgvector support
- ✅ Redis included
- ✅ Excellent CLI and dashboard
- ✅ Pay-per-use pricing (no fixed plans)
- ✅ WebSocket support
- ✅ Auto-deploy from Git

**Architecture**:
```
┌─────────────────────────────────────────────────┐
│  RAILWAY (All-in-One)                           │
│  ├── API Server (FastAPI)                       │
│  ├── Worker (Dramatiq)                          │
│  ├── PostgreSQL 15 (with pgvector)              │
│  ├── Redis                                      │
│  └── Static files (widget)                      │
└─────────────────────────────────────────────────┘
```

**Deployment**:
```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Create project
railway init

# 4. Deploy
railway up
```

**railway.json**:
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd server && uv sync && uv run task emails"
  },
  "deploy": {
    "startCommand": "cd server && uv run uvicorn polar.app:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/healthz",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

**Cost** (pay-per-use):
- Estimated: $20-40/month for starter
- Estimated: $60-100/month for production
- **No fixed plans** - pay only for resources used

**Pros**:
- ✅ **Best pricing** for small-medium scale
- ✅ Excellent developer experience
- ✅ Simple, clean dashboard
- ✅ Great for startups

**Cons**:
- ❌ Smaller company (vs. Render/Vercel)
- ❌ Less proven at massive scale

---

### **Option 3: AWS (ECS + RDS)** ☁️ (NEW - FOR ENTERPRISE)

**Best For**: Enterprise deployments, full control, compliance

**Architecture**:
```
┌─────────────────────────────────────────────────┐
│  AWS ARCHITECTURE                               │
│                                                 │
│  CloudFront (CDN)                               │
│       │                                         │
│       ▼                                         │
│  Application Load Balancer                      │
│       │                                         │
│       ├─► ECS (API Servers) - Auto-scaling     │
│       └─► ECS (Workers) - Auto-scaling         │
│                                                 │
│  RDS PostgreSQL (Multi-AZ)                      │
│  ElastiCache Redis (Cluster mode)               │
│  S3 (File storage)                              │
│  CloudWatch (Monitoring)                        │
│  Secrets Manager (API keys)                     │
└─────────────────────────────────────────────────┘
```

**Deployment** (Terraform):
```hcl
# infrastructure/aws/main.tf
module "agentpay" {
  source = "./modules/agentpay"

  environment = "production"
  region      = "us-east-1"

  # ECS
  api_task_cpu    = 1024
  api_task_memory = 2048
  api_desired_count = 2

  # RDS
  db_instance_class = "db.t3.medium"
  db_storage_gb     = 100

  # Redis
  redis_node_type = "cache.t3.medium"

  # Auto-scaling
  api_min_capacity = 2
  api_max_capacity = 10
}
```

**Deployment Script**:
```bash
# 1. Install AWS CLI and Terraform
brew install awscli terraform

# 2. Configure AWS credentials
aws configure

# 3. Deploy infrastructure
cd infrastructure/aws
terraform init
terraform plan
terraform apply

# 4. Deploy application
./deploy-ecs.sh production
```

**Cost** (production scale):
- ECS (2 API + 1 Worker): $60-100/month
- RDS PostgreSQL (Multi-AZ): $120-200/month
- ElastiCache Redis: $50-80/month
- Data transfer: $20-50/month
- **Total**: **$250-430/month**

**Pros**:
- ✅ **Best for enterprise**
- ✅ Full control and customization
- ✅ Compliance certifications (SOC2, HIPAA, etc.)
- ✅ Multi-region support
- ✅ Advanced security features

**Cons**:
- ❌ **Most expensive** option
- ❌ Complex setup and management
- ❌ Requires DevOps expertise
- ❌ Overkill for small merchants

---

### **Option 4: DigitalOcean App Platform** 🌊 (NEW - BUDGET FRIENDLY)

**Best For**: Budget-conscious deployments, simplicity

**Features**:
- ✅ Simple, affordable pricing
- ✅ Managed PostgreSQL with pgvector
- ✅ Managed Redis
- ✅ Auto-deploy from Git
- ✅ Built-in load balancing
- ✅ Free SSL certificates

**Architecture**:
```
┌─────────────────────────────────────────────────┐
│  DIGITALOCEAN APP PLATFORM                      │
│  ├── App (FastAPI + Worker)                     │
│  ├── Managed PostgreSQL                         │
│  └── Managed Redis                              │
└─────────────────────────────────────────────────┘
```

**Deployment** (.do/app.yaml):
```yaml
name: agentpay
region: nyc

services:
  - name: api
    github:
      repo: your-org/agentpay
      branch: main
      deploy_on_push: true
    build_command: cd server && pip install uv && uv sync
    run_command: cd server && uv run uvicorn polar.app:app --host 0.0.0.0 --port 8080
    instance_size_slug: professional-xs
    instance_count: 1
    health_check:
      http_path: /healthz

  - name: worker
    github:
      repo: your-org/agentpay
      branch: main
    build_command: cd server && pip install uv && uv sync
    run_command: cd server && uv run task worker
    instance_size_slug: professional-xs
    instance_count: 1

databases:
  - name: agentpay-db
    engine: PG
    version: "15"
    size: db-s-1vcpu-1gb

  - name: agentpay-redis
    engine: REDIS
    version: "7"
    size: db-s-1vcpu-1gb
```

**Cost**:
- App instances (2x): $12/month each = $24
- PostgreSQL: $15/month
- Redis: $15/month
- **Total**: **$54/month** 💰 (Most affordable!)

**Pros**:
- ✅ **Most affordable** managed option
- ✅ Simple pricing and setup
- ✅ Good performance for small-medium scale
- ✅ Great community and docs

**Cons**:
- ❌ Limited regions (vs. AWS/GCP)
- ❌ Fewer advanced features
- ❌ Not ideal for enterprise scale

---

### **Option 5: Fly.io** 🪂 (NEW - GLOBAL EDGE)

**Best For**: Global deployments, low latency worldwide

**Features**:
- ✅ Deploy globally (edge computing)
- ✅ Run close to users worldwide
- ✅ Excellent for international merchants
- ✅ WebSocket support
- ✅ Pay-per-use pricing

**Architecture**:
```
┌─────────────────────────────────────────────────┐
│  FLY.IO (Global Edge Network)                   │
│                                                 │
│  [US-East] ─┐                                   │
│  [EU-West] ─┼─► API Instances (Auto-replicate) │
│  [Asia-Pac] ─┘                                  │
│                                                 │
│  PostgreSQL (Primary: US-East)                  │
│  └─► Read replicas (EU, Asia)                   │
│                                                 │
│  Redis (Global cache)                           │
└─────────────────────────────────────────────────┘
```

**Deployment** (fly.toml):
```toml
app = "agentpay"
primary_region = "iad" # US-East

[build]
  builder = "paketobuildpacks/builder:base"
  buildpacks = ["gcr.io/paketo-buildpacks/python"]

[env]
  POLAR_ENV = "production"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    type = "requests"
    hard_limit = 250
    soft_limit = 200

[[services]]
  protocol = "tcp"
  internal_port = 8000

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

# Auto-scale
[[services.http_checks]]
  interval = 10000
  grace_period = "5s"
  method = "GET"
  path = "/healthz"
  protocol = "http"

# Regions (auto-replicate)
[deploy]
  regions = ["iad", "lhr", "nrt"]  # US, EU, Asia
```

**Deployment**:
```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Launch app
fly launch

# 4. Deploy
fly deploy

# 5. Scale globally
fly scale count 3 --region iad,lhr,nrt
```

**Cost** (pay-per-use):
- 3 instances (global): ~$15-20/month
- PostgreSQL: ~$20/month
- Redis: ~$10/month
- Data transfer: ~$5-10/month
- **Total**: **$50-60/month**

**Pros**:
- ✅ **Global edge deployment** (best latency worldwide)
- ✅ Auto-scale to zero (cost savings)
- ✅ Great for international merchants
- ✅ Modern architecture

**Cons**:
- ❌ Newer platform (less proven)
- ❌ Learning curve for edge deployments
- ❌ May be overkill for US-only merchants

---

## Deployment Comparison Matrix

| Feature | Render | Railway | AWS | DigitalOcean | Fly.io | Vercel* |
|---------|--------|---------|-----|--------------|--------|---------|
| **Ease of Setup** | ★★★★★ | ★★★★★ | ★★☆☆☆ | ★★★★☆ | ★★★★☆ | ★★★★☆ |
| **Cost (Starter)** | $28 | $20-40 | $250+ | **$54** | $50-60 | $48+ |
| **WebSocket** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Auto-deploy** | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| **Global Edge** | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Enterprise Ready** | ★★★☆☆ | ★★☆☆☆ | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★★★☆ |
| **Best For** | Standard | Pro | Enterprise | Budget | Global | Widget |

*Vercel is for frontend/widget only, requires separate backend

---

## Technical Architecture by Tier

### **STANDARD Tier Architecture**

```
┌─────────────────────────────────────────────────────────┐
│  MERCHANT WEBSITE                                       │
│  ├── AgentPay Widget (embedded)                         │
│  └── Checkout redirect                                  │
└────────────┬────────────────────────────────────────────┘
             │
             │ WebSocket/HTTPS
             ▼
┌─────────────────────────────────────────────────────────┐
│  AGENTPAY PLATFORM (Multi-tenant)                       │
│  ├── API Server                                         │
│  │   └── Shared LLM pool (Claude API)                   │
│  ├── Worker (background jobs)                           │
│  ├── PostgreSQL (shared, row-level security)            │
│  └── Redis (shared cache)                               │
└────────────┬────────────────────────────────────────────┘
             │
             ├─► Anthropic API (our key)
             ├─► OpenAI API (our key, embeddings)
             └─► Stripe API (our account, Connect)
```

**Key Characteristics**:
- Multi-tenant database (row-level security)
- Shared LLM API keys (fair use quotas)
- Stripe Connect for payment isolation
- Deployed on Render.com or DigitalOcean

---

### **PRO Tier Architecture**

```
┌─────────────────────────────────────────────────────────┐
│  MERCHANT WEBSITE                                       │
│  ├── AgentPay Widget (branded)                          │
│  └── Custom checkout flow                               │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│  AGENTPAY PLATFORM (Dedicated instances)                │
│  ├── API Server (dedicated)                             │
│  ├── Worker (dedicated)                                 │
│  ├── PostgreSQL (dedicated schema)                      │
│  └── Redis (dedicated namespace)                        │
└────────────┬────────────────────────────────────────────┘
             │
             ├─► Option A: Our LLM keys
             │   └── Anthropic + OpenAI (pooled with quotas)
             │
             ├─► Option B: Their LLM keys
             │   └── Merchant's Anthropic + OpenAI accounts
             │
             ├─► Option A: Our Stripe
             │   └── Stripe Connect (our account)
             │
             └─► Option B: Their Stripe
                 └── Direct integration (their account)
```

**Key Characteristics**:
- Dedicated compute resources
- Optional bring-your-own API keys
- Optional bring-your-own Stripe
- Deployed on Railway or Render

---

### **ENTERPRISE Tier Architecture**

```
┌─────────────────────────────────────────────────────────┐
│  MERCHANT INFRASTRUCTURE                                │
│  ├── Multiple websites/brands                           │
│  ├── Existing CRM/ERP systems                           │
│  └── Custom auth (SSO/SAML)                             │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│  DEDICATED AGENTPAY DEPLOYMENT                          │
│  ├── API Cluster (auto-scaling, 2-10 instances)         │
│  ├── Worker Cluster (auto-scaling)                      │
│  ├── PostgreSQL (dedicated RDS, Multi-AZ)               │
│  ├── Redis Cluster (dedicated ElastiCache)              │
│  ├── S3 (dedicated bucket)                              │
│  └── VPC (isolated network)                             │
└────────────┬────────────────────────────────────────────┘
             │
             ├─► Merchant's Anthropic account
             ├─► Merchant's OpenAI account
             ├─► Merchant's payment provider (Stripe/Braintree/Adyen)
             ├─► Merchant's CRM (via webhooks)
             └─► Merchant's analytics (custom integrations)
```

**Key Characteristics**:
- Fully isolated infrastructure
- Merchant's API keys only
- Merchant's payment provider
- Custom integrations
- Deployed on AWS or self-hosted

---

### **SELF-HOSTED Architecture**

```
┌─────────────────────────────────────────────────────────┐
│  MERCHANT'S INFRASTRUCTURE (Full control)               │
│                                                         │
│  ├── Kubernetes Cluster / Docker Swarm                  │
│  │   ├── AgentPay API (3+ replicas)                     │
│  │   ├── AgentPay Worker (2+ replicas)                  │
│  │   └── Widget CDN (nginx/Cloudflare)                  │
│  │                                                      │
│  ├── PostgreSQL (on-premise or cloud)                   │
│  ├── Redis (on-premise or cloud)                        │
│  ├── S3-compatible storage (Minio/S3/etc.)              │
│  │                                                      │
│  └── Their monitoring stack                             │
│      ├── Prometheus                                     │
│      ├── Grafana                                        │
│      └── Custom logging                                 │
└────────────┬────────────────────────────────────────────┘
             │
             ├─► Their Anthropic account
             ├─► Their OpenAI account
             ├─► Their payment provider
             └─► Their existing systems (full integration)
```

**Key Characteristics**:
- Full source code access
- Deploy anywhere (cloud, on-premise, hybrid)
- Complete customization
- No data leaves their infrastructure
- White-label capable

---

## Revenue Analysis

### **Monthly Recurring Revenue (MRR) Projections**

#### **Scenario 1: 100 Merchants (Mixed Tiers)**

**Breakdown**:
- 60 Standard ($29/mo): $1,740
- 30 Pro ($99/mo): $2,970
- 8 Enterprise ($499/mo avg): $3,992
- 2 Self-Hosted ($199/mo): $398

**Base MRR**: $9,100/month

**Transaction Revenue** (example volumes):
- Standard (60 merchants × 100 transactions × $50 avg × 0.6% margin): $1,800
- Pro Option A (15 merchants × 500 trans × 0.4% margin): $1,500
- Pro Option B (15 merchants × 500 trans × $0.40 flat): $3,000
- Enterprise (8 merchants × 5,000 trans × $0.25): $10,000

**Transaction Revenue**: $16,300/month

**Total Revenue**: $25,400/month
**Annual Run Rate**: $304,800/year

---

#### **Scenario 2: 1,000 Merchants (Scale)**

**Breakdown**:
- 700 Standard: $20,300
- 250 Pro: $24,750
- 40 Enterprise ($999/mo avg): $39,960
- 10 Self-Hosted: $1,990

**Base MRR**: $87,000/month

**Transaction Revenue**:
- Standard tier: $42,000
- Pro tier: $62,500
- Enterprise: $250,000

**Transaction Revenue**: $354,500/month

**Total Revenue**: $441,500/month
**Annual Run Rate**: **$5.3M/year**

---

### **Cost Structure (for AgentPay)**

#### **Per-Merchant Costs (Standard Tier)**

**Fixed Costs**:
- Infrastructure (shared): $2/merchant/month
- Support: $1/merchant/month
- **Total Fixed**: $3/merchant/month

**Variable Costs**:
- LLM (1,000 conversations): $13
- Stripe fees on margin: Included in pricing

**Gross Margin**:
- Revenue: $29 + transaction fees
- Costs: $3 + $13 = $16
- **Margin**: $10 + transaction margin (~50% margin)

#### **At Scale (1,000 merchants)**

**Monthly Costs**:
- Infrastructure (dedicated): $10,000
- LLM (aggregate): $180,000
- Support team (5 people): $50,000
- Engineering (10 people): $150,000
- Sales & Marketing: $50,000
- **Total**: $440,000/month

**Monthly Revenue**: $441,500
**Monthly Profit**: $1,500
**Margin**: 0.3% (break-even)

**Note**: Profitable after factoring in enterprise customers and transaction fees. Real margin ~20-30% at scale.

---

## Implementation Roadmap

### **Phase 1: MVP (Standard Tier Only)** - 2 weeks

**Goal**: Launch with simplest offering

**Features**:
- Single-tenant deployment (Render.com)
- AgentPay provides everything (LLM + Stripe)
- Basic widget
- Simple dashboard
- Email support

**Deployment**:
```bash
# Use existing deployment
./scripts/deploy.sh
# Select Render.com
```

**Launch Criteria**:
- 3-5 beta merchants
- 100+ conversations processed
- <2% error rate
- Positive merchant feedback

---

### **Phase 2: Pro Tier (BYOK)** - 4 weeks

**Goal**: Add flexibility for growing merchants

**New Features**:
- Bring-your-own LLM keys
- Bring-your-own Stripe account
- Advanced analytics
- Priority support

**Technical Work**:
1. **Multi-key LLM support**:
   ```python
   # Allow per-organization API keys
   if organization.llm_config.api_key:
       client = AnthropicClient(api_key=organization.llm_config.api_key)
   else:
       client = shared_llm_client
   ```

2. **Stripe Connect + Direct**:
   ```python
   # Support both Stripe Connect and direct integration
   if organization.stripe_mode == "connect":
       # Use our Stripe with Connect
   elif organization.stripe_mode == "direct":
       # Use their Stripe account
   ```

3. **Dedicated instances** (Railway.app)

---

### **Phase 3: Enterprise Tier** - 8 weeks

**Goal**: Enterprise-ready platform

**New Features**:
- White-label
- SSO/SAML
- Custom integrations
- Dedicated infrastructure
- SLA guarantees

**Technical Work**:
1. AWS/GCP deployment templates
2. Multi-region support
3. Advanced security (audit logs, encryption at rest)
4. Enterprise dashboard
5. Dedicated account management portal

---

### **Phase 4: Self-Hosted** - 12 weeks

**Goal**: Enable self-hosted deployments

**Deliverables**:
1. **Clean source code package**
2. **Deployment documentation**
3. **License management system**
4. **Update distribution system**
5. **Support portal**

**Technical Work**:
- Remove multi-tenancy dependencies
- Create standalone deployment scripts
- Build license validation system
- Create update mechanism

---

## Recommendations

### **Start With**:
1. ✅ **Standard Tier** on **DigitalOcean** ($54/month infrastructure)
   - Lowest operational complexity
   - Most affordable
   - Fast time to market

2. ✅ Focus on **Standard Tier** for first 3 months
   - Validate product-market fit
   - Build case studies
   - Refine agent quality

3. ✅ Add **Pro Tier** after 10+ successful Standard merchants
   - Respond to merchant requests
   - Add BYOK features incrementally

### **Deployment Strategy**:

**Month 1-3**: DigitalOcean ($54/month)
- Deploy Standard tier
- Onboard 5-10 merchants
- Validate economics

**Month 4-6**: Migrate to Railway ($60-100/month)
- Better developer experience
- Add Pro tier features
- Scale to 25-50 merchants

**Month 7-12**: Add AWS option for Enterprise
- Deploy enterprise tier
- Onboard 1-3 enterprise customers
- Build case studies

**Year 2+**: Enable Self-Hosted
- Mature product
- High-volume customers
- Expand TAM

---

## Next Steps

1. ✅ **Create deployment configs** for all 5 options
2. ✅ **Implement tier-based configuration** in codebase
3. ✅ **Build merchant dashboard** with tier management
4. ✅ **Create pricing page** and billing system
5. ✅ **Document BYOK setup** for Pro tier

---

**Status**: Ready for business model implementation
**Recommended Start**: Standard Tier on DigitalOcean
**Timeline to MVP**: 2 weeks
