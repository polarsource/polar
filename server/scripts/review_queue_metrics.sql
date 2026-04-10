-- Review Queue Metrics
-- Shows all organizations in ongoing_review with payment rates, GTV, and AI verdict
-- to help reviewers quickly decide approve/deny.
--
-- Rate thresholds (from organization_review/thresholds.py):
--   Auth Rate:       warn < 90%, crit < 75%  (lower is worse)
--   Refund Rate:     warn > 10%, crit > 15%
--   Dispute Rate:    warn > 0.50%, crit > 0.75%
--   Chargeback Rate: warn > 0.15%, crit > 0.30%

WITH succeeded AS (
    SELECT
        p.organization_id,
        COUNT(p.id) AS cnt,
        COALESCE(SUM(t.amount), 0) AS gtv_cents
    FROM payments p
    LEFT JOIN transactions t
        ON t.charge_id = p.processor_id
       AND t.type = 'payment'
    WHERE p.status = 'succeeded'
      AND p.deleted_at IS NULL
    GROUP BY p.organization_id
),
failed AS (
    SELECT
        p.organization_id,
        COUNT(p.id) AS cnt
    FROM payments p
    WHERE p.status = 'failed'
      AND p.deleted_at IS NULL
    GROUP BY p.organization_id
),
refunds AS (
    SELECT
        r.organization_id,
        COUNT(DISTINCT r.order_id) AS cnt
    FROM refunds r
    WHERE r.status = 'succeeded'
    GROUP BY r.organization_id
),
disputes AS (
    SELECT
        p.organization_id,
        COUNT(d.id) AS dispute_cnt,
        COUNT(d.id) FILTER (WHERE d.status = 'lost') AS chargeback_cnt
    FROM disputes d
    JOIN payments p ON d.payment_id = p.id
    WHERE d.status IN ('needs_response', 'under_review', 'lost', 'won')
    GROUP BY p.organization_id
),
latest_agent_review AS (
    SELECT DISTINCT ON (organization_id)
        organization_id,
        report->'report'->>'verdict' AS ai_verdict,
        report->'report'->>'summary' AS ai_summary,
        report->'report'->>'overall_risk_level' AS ai_risk_level,
        reviewed_at
    FROM organization_agent_reviews
    ORDER BY organization_id, reviewed_at DESC
)
SELECT
    o.slug,
    o.name,

    -- GTV
    COALESCE(s.gtv_cents, 0) / 100.0 AS gtv_usd,
    COALESCE(s.cnt, 0) AS succeeded_payments,

    -- Auth Rate
    CASE
        WHEN COALESCE(s.cnt, 0) + COALESCE(f.cnt, 0) > 0
        THEN ROUND(COALESCE(s.cnt, 0)::numeric / (COALESCE(s.cnt, 0) + COALESCE(f.cnt, 0)) * 100, 2)
        ELSE 100.0
    END AS auth_rate,

    -- Refund Rate
    CASE
        WHEN COALESCE(s.cnt, 0) > 0
        THEN ROUND(COALESCE(ref.cnt, 0)::numeric / s.cnt * 100, 2)
        ELSE 0
    END AS refund_rate,

    -- Dispute Rate
    CASE
        WHEN COALESCE(s.cnt, 0) > 0
        THEN ROUND(COALESCE(dis.dispute_cnt, 0)::numeric / s.cnt * 100, 2)
        ELSE 0
    END AS dispute_rate,

    -- Chargeback Rate
    CASE
        WHEN COALESCE(s.cnt, 0) > 0
        THEN ROUND(COALESCE(dis.chargeback_cnt, 0)::numeric / s.cnt * 100, 2)
        ELSE 0
    END AS chargeback_rate,

    -- Flags (quick visual: OK / WARN / CRIT)
    CASE
        WHEN COALESCE(s.cnt, 0) + COALESCE(f.cnt, 0) = 0 THEN 'OK'
        WHEN COALESCE(s.cnt, 0)::numeric / (COALESCE(s.cnt, 0) + COALESCE(f.cnt, 0)) * 100 <= 75 THEN 'CRIT'
        WHEN COALESCE(s.cnt, 0)::numeric / (COALESCE(s.cnt, 0) + COALESCE(f.cnt, 0)) * 100 <= 90 THEN 'WARN'
        ELSE 'OK'
    END AS auth_flag,
    CASE
        WHEN COALESCE(s.cnt, 0) = 0 THEN 'OK'
        WHEN COALESCE(ref.cnt, 0)::numeric / s.cnt * 100 >= 15 THEN 'CRIT'
        WHEN COALESCE(ref.cnt, 0)::numeric / s.cnt * 100 >= 10 THEN 'WARN'
        ELSE 'OK'
    END AS refund_flag,
    CASE
        WHEN COALESCE(s.cnt, 0) = 0 THEN 'OK'
        WHEN COALESCE(dis.dispute_cnt, 0)::numeric / s.cnt * 100 >= 0.75 THEN 'CRIT'
        WHEN COALESCE(dis.dispute_cnt, 0)::numeric / s.cnt * 100 >= 0.50 THEN 'WARN'
        ELSE 'OK'
    END AS dispute_flag,
    CASE
        WHEN COALESCE(s.cnt, 0) = 0 THEN 'OK'
        WHEN COALESCE(dis.chargeback_cnt, 0)::numeric / s.cnt * 100 >= 0.30 THEN 'CRIT'
        WHEN COALESCE(dis.chargeback_cnt, 0)::numeric / s.cnt * 100 >= 0.15 THEN 'WARN'
        ELSE 'OK'
    END AS chargeback_flag,

    -- AI Review
    COALESCE(ar.ai_verdict, '—') AS ai_verdict,
    COALESCE(ar.ai_risk_level, '—') AS ai_risk_level,
    LEFT(ar.ai_summary, 120) AS ai_summary,

    -- Polar-held balance (distinct from GTV: this is money currently in their account)
    ROUND(COALESCE(bal.balance_cents, 0) / 100.0, 2) AS balance_usd,

    -- Activity freshness
    lo.last_order_at::date AS last_order_date,

    -- Context
    o.created_at::date AS org_created_at,
    o.next_review_threshold / 100.0 AS next_review_usd,
    o.status_updated_at,
    EXTRACT(DAY FROM NOW() - o.status_updated_at)::int AS days_in_review

FROM organizations o
LEFT JOIN succeeded s ON s.organization_id = o.id
LEFT JOIN failed f ON f.organization_id = o.id
LEFT JOIN refunds ref ON ref.organization_id = o.id
LEFT JOIN disputes dis ON dis.organization_id = o.id
LEFT JOIN latest_agent_review ar ON ar.organization_id = o.id
LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(t.amount), 0) AS balance_cents
    FROM transactions t
    WHERE t.account_id = o.account_id
      AND t.type = 'balance'
) bal ON true
LEFT JOIN LATERAL (
    SELECT MAX(ordr.created_at) AS last_order_at
    FROM orders ordr
    JOIN products p ON p.id = ordr.product_id
    WHERE p.organization_id = o.id
      AND ordr.deleted_at IS NULL
) lo ON true
WHERE o.status = 'ongoing_review'
  AND o.deleted_at IS NULL
ORDER BY
    -- Surface problems first: any CRIT flag, then WARN, then OK
    CASE
        WHEN COALESCE(s.cnt, 0) > 0 AND (
            (COALESCE(s.cnt, 0)::numeric / NULLIF(COALESCE(s.cnt, 0) + COALESCE(f.cnt, 0), 0) * 100 <= 75) OR
            (COALESCE(ref.cnt, 0)::numeric / s.cnt * 100 >= 15) OR
            (COALESCE(dis.dispute_cnt, 0)::numeric / s.cnt * 100 >= 0.75) OR
            (COALESCE(dis.chargeback_cnt, 0)::numeric / s.cnt * 100 >= 0.30)
        ) THEN 0  -- CRIT first
        WHEN COALESCE(s.cnt, 0) > 0 AND (
            (COALESCE(s.cnt, 0)::numeric / NULLIF(COALESCE(s.cnt, 0) + COALESCE(f.cnt, 0), 0) * 100 <= 90) OR
            (COALESCE(ref.cnt, 0)::numeric / s.cnt * 100 >= 10) OR
            (COALESCE(dis.dispute_cnt, 0)::numeric / s.cnt * 100 >= 0.50) OR
            (COALESCE(dis.chargeback_cnt, 0)::numeric / s.cnt * 100 >= 0.15)
        ) THEN 1  -- WARN second
        ELSE 2    -- OK last
    END,
    ar.ai_verdict = 'DENY' DESC,  -- AI denials before approvals
    COALESCE(s.gtv_cents, 0) DESC;  -- Higher GTV first within same priority
