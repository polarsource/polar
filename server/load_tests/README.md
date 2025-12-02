# Load Testing Infrastructure

Comprehensive load testing suite for Polar's payment infrastructure, focusing on checkout flows, webhook processing, and background job performance.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Test Scenarios](#test-scenarios)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [CI/CD Integration](#cicd-integration)
- [Interpreting Results](#interpreting-results)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Quick Start

### Prerequisites

- Python 3.14+ with uv
- Running Polar API server (or staging environment)
- Test data (products, organizations)

### Installation

```bash
cd server
uv sync  # Installs Locust and dependencies
```

### Run Your First Load Test

```bash
# 1. Start local services (if testing locally)
docker compose up -d  # Start PostgreSQL, Redis, MinIO
uv run task api       # Start API server
uv run task worker    # Start background worker

# 2. Run interactive load test
uv run task loadtest

# 3. Open browser to http://localhost:8089
# 4. Configure users (start with 10) and spawn rate (2/sec)
# 5. Click "Start swarming"
```


## Architecture

### Directory Structure

```
load_tests/
├── __init__.py
├── README.md                  # This file
├── config.py                  # Configuration and environment variables
├── locustfile.py             # Main Locust entry point
├── common/                   # Shared utilities
│   ├── __init__.py
│   ├── auth.py              # Authentication helpers
│   └── test_data.py         # Test data generators
├── scenarios/               # Load test scenarios
│   ├── __init__.py
│   ├── checkout.py          # Checkout flow scenarios
│   ├── event_ingestion.py   # Event ingestion scenarios
└── regression/              # Performance regression tests (pytest)
    ├── __init__.py
    ├── conftest.py
    ├── test_checkout_performance.py
    └── test_api_performance.py
```

### Components

1. **Locust Scenarios** (`scenarios/`): HTTP-based load tests simulating user behavior
4. **Test Data Generators** (`common/test_data.py`): Create realistic test data (checkouts, webhooks, customers)

---

## Test Scenarios

### 1. Checkout Flow (`scenarios/checkout.py`)

**CheckoutUser**: Standard user flow with weighted tasks
- Create checkout (weight: 10)
- Update customer details (weight: 5)
- Get checkout status (weight: 3)
- Confirm checkout

### 2. Event Ingestion (`scenarios/event_ingestion.py`)

**EventIngestionUser**: Simulates event ingestion patterns

**Understanding RPS vs Events:**

Each HTTP request sends a batch of events (default: 7 events per request).
- 1 HTTP RPS = 1 × 7 = 7 events/sec = 420 events/min
- 5 HTTP RPS = 5 × 7 = 35 events/sec = 2,100 events/min

**Scaling Guide:**

| Target Events/Min | Users | HTTP RPS |
|-------------------|-------|----------|
| ~420              | 1     | ~1       |
| ~840              | 2     | ~2       |
| ~1680             | 4     | ~4       |
| ~2940             | 7     | ~7       |

**Required Environment Variables:**
```bash
LOAD_TEST_API_TOKEN=polar_oat_...                           # Organization access token (required)
LOAD_TEST_EVENT_EXTERNAL_CUSTOMER_IDS=id1,id2,id3,...       # External customer IDs (required, comma-separated)
LOAD_TEST_EVENT_BATCH_SIZE=7                                # Events per batch (optional, default: 7)
```

**Running Event Ingestion Tests:**
```bash
# Pre-provision test customers in your organization first, then:

# Interactive mode
LOAD_TEST_EVENT_EXTERNAL_CUSTOMER_IDS="id1,id2,id3" \
LOAD_TEST_API_TOKEN="polar_oat_..." \
uv run task loadtest

# Select "EventIngestionUser" in the web UI

# Headless mode
locust -f load_tests/locustfile.py --host=http://127.0.0.1:8000 \
       --users 2 --spawn-rate 1 --run-time 5m EventIngestionUser
```


## Configuration

### Environment Variables

All configuration is managed via environment variables. See `load_tests/config.py` for full list.

#### Required (for non-local testing)

```bash
LOAD_TEST_HOST=https://staging.polar.sh
LOAD_TEST_API_TOKEN=polar_pat_...          # Personal access token
LOAD_TEST_PRODUCT_ID=uuid-here             # Product for checkout tests
```

#### Required (for event ingestion tests)

```bash
LOAD_TEST_EVENT_EXTERNAL_CUSTOMER_IDS=id1,id2,id3  # Comma-separated external customer IDs
LOAD_TEST_EVENT_BATCH_SIZE=7                       # Events per batch (default: 7)
```
