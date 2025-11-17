# AgentPay Monitoring & Alerting Setup Guide

**Purpose**: Comprehensive monitoring and alerting for production AgentPay deployment
**Audience**: DevOps, SRE, and platform administrators
**Time**: 1-2 hours for complete setup

---

## Table of Contents

1. [Overview](#overview)
2. [Error Tracking (Sentry)](#error-tracking-sentry)
3. [Uptime Monitoring](#uptime-monitoring)
4. [Application Metrics](#application-metrics)
5. [Log Aggregation](#log-aggregation)
6. [Performance Monitoring](#performance-monitoring)
7. [Cost Monitoring](#cost-monitoring)
8. [Alert Configuration](#alert-configuration)
9. [Dashboards](#dashboards)
10. [On-Call Setup](#on-call-setup)

---

## Overview

### Monitoring Stack

**Recommended for Production**:
- **Error Tracking**: Sentry (errors, exceptions, performance)
- **Uptime**: UptimeRobot or Better Uptime (health checks)
- **Metrics**: Prometheus + Grafana (application metrics)
- **Logs**: CloudWatch or Datadog (log aggregation)
- **APM**: Sentry Performance or Datadog APM (request tracing)
- **Costs**: CloudWatch billing alerts or custom scripts

### Monitoring Philosophy

**The Four Golden Signals** (Google SRE):
1. **Latency**: Request response time
2. **Traffic**: Requests per second
3. **Errors**: Error rate
4. **Saturation**: Resource utilization (CPU, memory, disk)

**AgentPay-Specific Metrics**:
- Conversation volume
- LLM request latency
- RAG query performance
- Checkout conversion rate
- WebSocket connection stability

---

## Error Tracking (Sentry)

### 1. Sentry Setup

#### Create Account
```bash
# 1. Sign up at https://sentry.io/
# 2. Create new project: Select "Python" for backend
# 3. Get DSN: https://HASH@o123456.ingest.sentry.io/789
```

#### Configure Backend
Add to `.env.production`:
```bash
SENTRY_DSN=https://HASH@o123456.ingest.sentry.io/789
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1  # Sample 10% of transactions
```

#### Install SDK
Already included in `pyproject.toml`:
```python
# In server/polar/app.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    environment=settings.SENTRY_ENVIRONMENT,
    traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
    profiles_sample_rate=0.1,
    integrations=[
        FastApiIntegration(),
        RedisIntegration(),
        SqlalchemyIntegration(),
    ],
    before_send=filter_sensitive_data,
)
```

### 2. Custom Error Context

Add custom context to errors:

```python
# In server/polar/agent_core/orchestrator.py
def process_message(self, session, conversation, user_message):
    with sentry_sdk.configure_scope() as scope:
        scope.set_user({"id": conversation.user_id})
        scope.set_context("conversation", {
            "conversation_id": str(conversation.id),
            "organization_id": str(conversation.organization_id),
            "stage": conversation.stage,
            "message_count": len(conversation.messages),
        })
        scope.set_tag("agent_type", "sales")

        # Process message
        try:
            result = await self._process_internal(...)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            raise
```

### 3. Performance Monitoring

Track LLM request performance:

```python
# In server/polar/agent_llm/anthropic_client.py
async def chat(self, messages, model, temperature, max_tokens, tools, stream):
    with sentry_sdk.start_transaction(op="llm.chat", name="anthropic.chat"):
        with sentry_sdk.start_span(op="llm.request", description=f"Model: {model}"):
            response = await self.client.messages.create(...)

            # Add custom measurements
            sentry_sdk.set_measurement("llm.tokens.input", usage.input_tokens)
            sentry_sdk.set_measurement("llm.tokens.output", usage.output_tokens)
            sentry_sdk.set_measurement("llm.cost", calculate_cost(usage))
```

### 4. Sentry Alerts

Configure alerts in Sentry dashboard:

**Critical Alerts** (PagerDuty, SMS):
- [ ] Error rate > 5% for 5 minutes
- [ ] API response time p95 > 2s for 10 minutes
- [ ] LLM request failures > 10 in 5 minutes

**Warning Alerts** (Email):
- [ ] Error rate > 1% for 15 minutes
- [ ] Memory usage > 80% for 10 minutes
- [ ] Slow database queries (>1s) detected

---

## Uptime Monitoring

### 5. UptimeRobot Setup (Free Tier)

#### Create Monitors
```bash
# 1. Sign up at https://uptimerobot.com/
# 2. Add monitors:

# API Health Check
URL: https://api.yourdomain.com/healthz
Type: HTTP(s)
Interval: 5 minutes
Expected: 200 OK

# WebSocket Endpoint
URL: wss://api.yourdomain.com/api/v1/agent/conversations/test/ws
Type: Port
Port: 443
Interval: 5 minutes

# Widget CDN
URL: https://cdn.agentpay.com/widget/v1/agentpay-chat.js
Type: HTTP(s)
Interval: 30 minutes
Expected: 200 OK
```

#### Configure Alerts
- [ ] Email: your-email@domain.com
- [ ] SMS: +1-555-0100 (for critical endpoints only)
- [ ] Slack: #alerts channel webhook
- [ ] PagerDuty: integration key (enterprise)

#### Create Status Page
```bash
# Public status page: https://status.agentpay.com
# Shows:
- API uptime
- WebSocket uptime
- Widget availability
- Scheduled maintenance
```

### 6. Better Uptime (Alternative)

More advanced features:

```bash
# 1. Sign up at https://betteruptime.com/
# 2. Features:
- Incident management
- On-call scheduling
- Phone call alerts
- Integration with PagerDuty, Slack, etc.
```

---

## Application Metrics

### 7. Prometheus Setup

#### Install Prometheus

**Docker Deployment**:
```yaml
# In docker-compose.prod.yml (already included)
prometheus:
  image: prom/prometheus:latest
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus
  ports:
    - "9090:9090"
```

**Prometheus Configuration**:
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # API Server Metrics
  - job_name: 'agentpay-api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/metrics'

  # Worker Metrics
  - job_name: 'agentpay-worker'
    static_configs:
      - targets: ['worker:10000']

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis Exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

#### Expose Metrics in FastAPI

```python
# In server/polar/app.py
from prometheus_client import Counter, Histogram, Gauge, generate_latest

# Define metrics
REQUEST_COUNT = Counter(
    'agentpay_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'agentpay_request_latency_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

ACTIVE_CONVERSATIONS = Gauge(
    'agentpay_active_conversations',
    'Number of active conversations'
)

LLM_REQUEST_COUNT = Counter(
    'agentpay_llm_requests_total',
    'Total LLM requests',
    ['model', 'status']
)

LLM_COST = Counter(
    'agentpay_llm_cost_usd',
    'Total LLM cost in USD',
    ['model']
)

@app.middleware("http")
async def metrics_middleware(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time

    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()

    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)

    return response

@app.get("/metrics")
async def metrics():
    return Response(
        content=generate_latest(),
        media_type="text/plain"
    )
```

### 8. Grafana Dashboards

#### Install Grafana

```bash
# Access: http://localhost:3001
# Login: admin / (see GRAFANA_ADMIN_PASSWORD in .env)
```

#### Add Prometheus Data Source

```bash
# In Grafana UI:
1. Configuration → Data Sources → Add data source
2. Select Prometheus
3. URL: http://prometheus:9090
4. Save & Test
```

#### Import Pre-built Dashboard

Create `monitoring/grafana/dashboards/agentpay.json`:

```json
{
  "dashboard": {
    "title": "AgentPay Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{
          "expr": "rate(agentpay_requests_total[5m])"
        }]
      },
      {
        "title": "p95 Latency",
        "targets": [{
          "expr": "histogram_quantile(0.95, agentpay_request_latency_seconds)"
        }]
      },
      {
        "title": "Error Rate",
        "targets": [{
          "expr": "rate(agentpay_requests_total{status=~\"5..\"}[5m])"
        }]
      },
      {
        "title": "Active Conversations",
        "targets": [{
          "expr": "agentpay_active_conversations"
        }]
      },
      {
        "title": "LLM Cost (Last Hour)",
        "targets": [{
          "expr": "increase(agentpay_llm_cost_usd[1h])"
        }]
      }
    ]
  }
}
```

---

## Log Aggregation

### 9. CloudWatch Logs (AWS)

#### Configure CloudWatch Agent

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
```

#### Configuration

```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/agentpay/api.log",
            "log_group_name": "/agentpay/api",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%Y-%m-%d %H:%M:%S"
          },
          {
            "file_path": "/var/log/agentpay/worker.log",
            "log_group_name": "/agentpay/worker",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
```

### 10. Datadog Logs (Alternative)

#### Install Agent

```bash
DD_API_KEY=<YOUR_KEY> DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"
```

#### Configure

```yaml
# /etc/datadog-agent/conf.d/agentpay.yaml
logs:
  - type: file
    path: /var/log/agentpay/*.log
    service: agentpay
    source: python
    sourcecategory: agentpay
    tags:
      - env:production
```

### 11. Structured Logging

Ensure logs are structured for better parsing:

```python
# In server/polar/logging_config.py
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger()

# Usage
logger.info(
    "conversation_started",
    conversation_id=conversation.id,
    organization_id=organization.id,
    user_id=user.id
)
```

---

## Performance Monitoring

### 12. Database Query Monitoring

#### Enable PostgreSQL Slow Query Log

```sql
-- Log queries slower than 1 second
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- View slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

#### pg_stat_statements Extension

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Query statistics
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%product%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 13. LLM Performance Tracking

Create custom dashboard for LLM metrics:

```python
# Track LLM performance
@dataclass
class LLMMetrics:
    model: str
    latency_ms: float
    tokens_input: int
    tokens_output: int
    cost_usd: float
    cached: bool
    timestamp: datetime

# Log to database
async def track_llm_request(metrics: LLMMetrics):
    await session.execute(
        insert(llm_metrics).values(
            model=metrics.model,
            latency_ms=metrics.latency_ms,
            tokens_input=metrics.tokens_input,
            tokens_output=metrics.tokens_output,
            cost_usd=metrics.cost_usd,
            cached=metrics.cached,
            timestamp=metrics.timestamp
        )
    )
```

---

## Cost Monitoring

### 14. LLM Cost Tracking

```python
# Real-time cost calculation
PRICING = {
    "claude-3-5-sonnet-20241022": {
        "input": 0.003,  # per 1K tokens
        "output": 0.015,
        "cache_write": 0.00375,
        "cache_read": 0.0003
    },
    "claude-3-haiku-20240307": {
        "input": 0.00025,
        "output": 0.00125
    },
    "text-embedding-3-small": {
        "input": 0.00002
    }
}

def calculate_cost(model, usage):
    pricing = PRICING[model]
    cost = (
        (usage.input_tokens / 1000) * pricing["input"] +
        (usage.output_tokens / 1000) * pricing["output"]
    )

    if hasattr(usage, "cache_creation_input_tokens"):
        cost += (usage.cache_creation_input_tokens / 1000) * pricing.get("cache_write", 0)
    if hasattr(usage, "cache_read_input_tokens"):
        cost += (usage.cache_read_input_tokens / 1000) * pricing.get("cache_read", 0)

    return cost

# Track costs
LLM_COST.labels(model=model).inc(cost)
```

### 15. Daily Cost Reports

```python
# scripts/cost_report.py
from datetime import datetime, timedelta

async def generate_daily_cost_report():
    yesterday = datetime.now() - timedelta(days=1)

    # Query metrics
    llm_cost = await get_llm_cost(yesterday)
    infrastructure_cost = await get_infrastructure_cost(yesterday)

    # Calculate per-conversation cost
    conversations = await count_conversations(yesterday)
    cost_per_conversation = (llm_cost + infrastructure_cost) / conversations

    # Send report
    send_email(
        to="finance@agentpay.com",
        subject=f"AgentPay Daily Cost Report - {yesterday.date()}",
        body=f"""
        LLM Costs: ${llm_cost:.2f}
        Infrastructure: ${infrastructure_cost:.2f}
        Total: ${llm_cost + infrastructure_cost:.2f}

        Conversations: {conversations}
        Cost/Conversation: ${cost_per_conversation:.4f}

        Projected Monthly Cost: ${(llm_cost + infrastructure_cost) * 30:.2f}
        """
    )
```

---

## Alert Configuration

### 16. Critical Alerts

#### API Health Alert
```yaml
# Prometheus alert rules
groups:
  - name: api_health
    interval: 30s
    rules:
      - alert: APIDown
        expr: up{job="agentpay-api"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "API server is down"
          description: "API server {{ $labels.instance }} has been down for more than 2 minutes"
```

#### High Error Rate
```yaml
- alert: HighErrorRate
  expr: rate(agentpay_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value | humanizePercentage }}"
```

#### LLM Failures
```yaml
- alert: LLMRequestFailures
  expr: rate(agentpay_llm_requests_total{status="error"}[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "LLM request failures detected"
```

### 17. Performance Alerts

#### Slow Response Times
```yaml
- alert: SlowAPIResponses
  expr: histogram_quantile(0.95, agentpay_request_latency_seconds) > 2
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "API p95 latency > 2s"
```

#### Database Connection Pool Exhaustion
```yaml
- alert: DatabasePoolExhausted
  expr: postgres_connections_active / postgres_connections_max > 0.8
  for: 5m
  labels:
    severity: warning
```

### 18. Cost Alerts

#### Daily Cost Threshold
```yaml
- alert: HighDailyCost
  expr: increase(agentpay_llm_cost_usd[24h]) > 100
  labels:
    severity: warning
  annotations:
    summary: "Daily LLM cost exceeded $100"
```

---

## Dashboards

### 19. Executive Dashboard

Key metrics for stakeholders:

**Metrics to Display**:
- Total conversations (today, week, month)
- Conversion rate trend
- Revenue generated
- Average response time
- Uptime percentage
- Cost per conversation

**Create in Grafana or Metabase**:
```sql
-- Daily conversation stats
SELECT
  DATE(created_at) as date,
  COUNT(*) as conversations,
  SUM(CASE WHEN status = 'completed' AND checkout_id IS NOT NULL THEN 1 ELSE 0 END) as conversions,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration
FROM conversations
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 20. Technical Dashboard

For engineers and SREs:

**Panels**:
- Request rate (by endpoint)
- Error rate (by type)
- p50, p95, p99 latency
- Database query time
- LLM request latency
- Redis memory usage
- Active WebSocket connections
- Worker queue length

---

## On-Call Setup

### 21. PagerDuty Integration

```bash
# 1. Create PagerDuty account
# 2. Create service: AgentPay Production
# 3. Get integration key

# Configure in Prometheus
alertmanagers:
  - static_configs:
      - targets:
          - pagerduty:443
    tls_config:
      ca_file: /etc/pagerduty/ca.crt
    pagerduty_configs:
      - service_key: YOUR_INTEGRATION_KEY
```

### 22. On-Call Schedule

```bash
# Recommended schedule:
Primary: Mon-Wed (Engineer A)
Secondary: Thu-Sun (Engineer B)
Backup: Always available (Engineering Manager)

# Escalation policy:
1. Page primary (immediate)
2. If no response in 15 min, page secondary
3. If no response in 30 min, page backup
```

---

## Monitoring Checklist

**Error Tracking** (15 minutes):
- [ ] Sentry account created
- [ ] DSN added to .env.production
- [ ] Error tracking verified
- [ ] Performance monitoring enabled
- [ ] Alerts configured

**Uptime Monitoring** (10 minutes):
- [ ] UptimeRobot monitors created
- [ ] Alert channels configured
- [ ] Status page created
- [ ] Webhooks tested

**Metrics** (30 minutes):
- [ ] Prometheus installed
- [ ] Metrics endpoint exposed
- [ ] Grafana dashboards created
- [ ] Alert rules configured

**Logs** (20 minutes):
- [ ] Log aggregation configured
- [ ] Structured logging implemented
- [ ] Log retention set (30 days)

**Performance** (15 minutes):
- [ ] Database slow query log enabled
- [ ] LLM performance tracking added
- [ ] APM configured (optional)

**Costs** (10 minutes):
- [ ] Cost tracking implemented
- [ ] Daily reports scheduled
- [ ] Budget alerts configured

**Total Time**: 1-2 hours

---

## Next Steps

After setup:
1. **Test Alerts**: Trigger test alerts to verify delivery
2. **Create Runbooks**: Document response procedures for each alert
3. **Schedule Reviews**: Weekly metric reviews, monthly cost reviews
4. **Optimize**: Adjust thresholds based on actual traffic patterns
5. **Train Team**: Ensure all engineers know how to access dashboards and respond to alerts

---

**Status**: Monitoring setup complete ✅
**Next**: Configure alerts and create runbooks for incident response
