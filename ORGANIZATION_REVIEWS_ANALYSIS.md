# Organization Reviews System — Staff Data Engineer Analysis

## Overview

Analysis of the organization reviews subsystem covering 3 database models, 8 migrations, the AI review agent pipeline, data collectors, analyzer, backoffice UI, and frontend. Reviewed as a staff data engineer for data integrity, scalability, and operational concerns.

## Top 10 Improvements

### 1. Finish the Expand-Modify-Contract Migration on `organization_review_feedback`

**Files:** `server/polar/models/organization_review_feedback.py:68-94`, `server/polar/organization_review/repository.py:193-234`

The Feb 24–25 migrations added new columns (`organization_id`, `actor_type`, `decision`, `verdict`, `risk_score`, `review_context`, `reason`, `is_current`) alongside the originals (`agent_review_id`, `reviewer_id`, `ai_verdict`, `human_verdict`, `agreement`, `override_reason`, `reviewed_at`). The **contract phase — dropping the old columns — was never executed**.

**Impact:** Every write pays dual-write overhead. Every reader must decide which columns to trust. The old columns use different naming conventions (`ai_verdict` vs `verdict`, `override_reason` vs `reason`). `save_review_decision()` manually maps between the two schemas on every insert. If any code path writes to only one set of columns, you get silent data drift.

**Recommendation:** Ship the contract migration: drop `ai_verdict`, `human_verdict`, `agreement`, `override_reason`, `reviewed_at`. Remove the dual-write logic. Add `NOT NULL` constraints to `organization_id`, `actor_type`, and `decision`.

---

### 2. Compute Percentiles in SQL, Not in Python Memory

**Files:** `server/polar/organization_review/repository.py:127-135`, `server/polar/organization_review/collectors/metrics.py:31-41`

`get_risk_scores()` loads **every risk score** into a Python list. Then `metrics.py` sorts the entire list to compute P50/P90. For a high-volume organization with 100K+ payments, this loads 100K integers into memory per review.

PostgreSQL has `PERCENTILE_CONT` which computes this in a single aggregate with zero application memory footprint.

**Recommendation:**
```sql
SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY risk_score) AS p50,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY risk_score) AS p90
FROM payments
WHERE organization_id = :org_id
  AND status = 'succeeded'
  AND risk_score IS NOT NULL
```

---

### 3. Add Schema Versioning to the JSONB `report` Column

**Files:** `server/polar/models/organization_agent_review.py:27`, `server/polar/organization_review/repository.py:49-59`

`OrganizationAgentReview.report` is `dict[str, Any]` — an opaque JSONB blob with no version field, no validation on read, and an already-changed structure (legacy records store `context` under `data_snapshot`; new records store `review_type` at the top level).

Downstream code does fragile nested access like `report.get("report", {}).get("verdict")`. If the AI output schema changes, there is no migration path for existing records.

**Recommendation:** Add a `schema_version` integer field. Validate on write with a Pydantic discriminated union. Backfill existing records as `v1`.

---

### 4. Replace the Global Mutable Policy Cache with a TTL Cache

**File:** `server/polar/organization_review/policy.py:100-132`

`_cached_policy_content` is a module-level `str | None`. The first call fetches the policy from an external URL and caches it **forever** — no TTL, no invalidation, no async safety. If the policy document is updated, every worker uses the stale version until redeployed. If the first fetch fails, the fallback is cached permanently.

**Recommendation:** Use a timestamp-based TTL (re-fetch every hour), or bundle the policy as a static file versioned alongside the code.

---

### 5. Store Computed Financial Metrics as Materialized Data

**Files:** `server/polar/organization_review/repository.py:108-167`, `server/polar/organization_review/analyzer.py:454-474`

Refund rate, dispute rate, auth rate, and risk score percentiles are computed on the fly by the prompt builder but **never persisted**. The only stored metric is the AI's `overall_risk_score`.

This means you cannot trend an organization's financial health over time, backoffice cannot filter by actual refund rate, and each review re-queries raw tables.

**Recommendation:** Persist the `PaymentMetrics` snapshot alongside each `OrganizationAgentReview`. This creates a financial health time series per org and enables analytical queries without re-computation.

---

### 6. Add Idempotency Guards to the Review Task

**File:** `server/polar/organization_review/tasks.py:44-207`

`run_review_agent` has no deduplication. If enqueued twice (retry, race condition, or manual + automatic trigger collision), two AI reviews run, two `OrganizationAgentReview` records are created, and two feedback decisions may be recorded.

**Recommendation:** Add a Redis/DB advisory lock keyed on `(organization_id, context)` with a TTL matching the task timeout (3 min). Skip if already running.

---

### 7. Eliminate Stringly-Typed Columns — Use DB-Level Constraints

**Files:** `server/polar/models/organization_review_feedback.py:84-113`, `server/polar/organization_review/repository.py:193-316`

`actor_type`, `decision`, `verdict`, `review_context`, and `agreement` are `String` columns with no database-level constraint. Python enums exist but nothing prevents writing invalid values. The codebase passes raw strings everywhere — one missed `.value` or typo results in silently corrupt data.

**Recommendation:** Add `CHECK` constraints for all enum columns. At minimum, validate in `save_review_decision()` before writing.

---

### 8. Fix the 5-Connection-per-Review Parallel Collection Pattern

**File:** `server/polar/organization_review/agent.py:101-257`

Each of the 5 collectors opens its own `AsyncReadSessionMaker()` session. A single review grabs **5 DB connections simultaneously**. Under load (batch of threshold reviews), this can exhaust the connection pool.

Additionally, `_collect_setup` makes 4 sequential queries in a single session when they could be parallelized.

**Recommendation:** Restructure to use 2 sessions max: one for fast aggregate queries, one for eager-loaded entity queries. Or batch fast queries into a single session.

---

### 9. Add Analytical Indexes for Review Decision Queries

**File:** `server/polar/models/organization_review_feedback.py:59-66`

The only non-FK index is the partial unique on `(organization_id) WHERE is_current = true`. There are no indexes on `actor_type`, `decision`, `review_context`, or `created_at` for the feedback table.

Queries like "all agent escalations this week" or "all human overrides" will full-scan the table.

**Recommendation:**
- `(review_context, decision)` — filter by context and outcome
- `(actor_type, created_at)` — agent vs human trends
- `(organization_id, created_at)` — per-org decision timeline

---

### 10. Consolidate the Three Review Models into a Clear Domain Hierarchy

**Files:** `server/polar/models/organization_review.py`, `server/polar/models/organization_agent_review.py`, `server/polar/models/organization_review_feedback.py`

Three tables with overlapping data:
- `organization_reviews` — initial AI verdict + appeal state (1:1 with org)
- `organization_agent_reviews` — detailed agent reports (1:N with org)
- `organization_review_feedback` — decisions from agents/humans (1:N with org)

The verdict lives in **three places**: `organization_reviews.verdict`, `organization_agent_reviews.report.verdict`, and `organization_review_feedback.verdict`. The `SUBMISSION` context writes to all three tables; `THRESHOLD` writes to only two. Appeal state lives on one table, decision state on another.

**Recommendation:** Clarify the domain: `organization_reviews` = review lifecycle (state + appeal), `organization_agent_reviews` = immutable AI audit log, `organization_review_feedback` = immutable decision audit log. Stop duplicating verdict/risk_score. Derive current state from `organization_review_feedback WHERE is_current = true`.
