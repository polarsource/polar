-- Monthly Recurring GTV (Gross Transaction Value) Query
-- Calculates total subscription amounts converted to monthly equivalent
--
-- Breakdown:
--   1. "Already Generated" - subscriptions that renewed from 1st of month until now
--   2. "To Generate" - subscriptions that will renew between now and end of month
--   3. Total monthly recurring GTV
--
-- Accounts for:
--   - Different billing intervals (daily, weekly, monthly, yearly)
--   - Interval counts (e.g., every 2 months)
--   - Discounts (already reflected in subscription.amount)
--   - Excludes canceled subscriptions and those set to cancel

WITH params AS (
    -- Define time boundaries for the current month
    SELECT
        date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS month_start,
        (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 month') AS month_end,
        CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS now
),

-- Calculate monthly equivalent multiplier for each subscription
-- This converts any billing interval to its monthly equivalent
subscription_monthly AS (
    SELECT
        s.id,
        s.amount,
        s.currency,
        s.recurring_interval,
        s.recurring_interval_count,
        s.current_period_start,
        s.current_period_end,
        s.status,
        s.cancel_at_period_end,
        s.canceled_at,
        s.ended_at,
        -- Calculate how many billing cycles occur per month
        -- Then multiply by subscription amount to get monthly value
        CASE s.recurring_interval
            -- Daily: ~30.44 days per month on average, divided by interval_count
            WHEN 'day' THEN (30.44 / COALESCE(s.recurring_interval_count, 1))
            -- Weekly: ~4.33 weeks per month on average, divided by interval_count
            WHEN 'week' THEN (4.33 / COALESCE(s.recurring_interval_count, 1))
            -- Monthly: 1 per month, divided by interval_count (e.g., every 2 months = 0.5)
            WHEN 'month' THEN (1.0 / COALESCE(s.recurring_interval_count, 1))
            -- Yearly: 1/12 per month, divided by interval_count
            WHEN 'year' THEN (1.0 / (12.0 * COALESCE(s.recurring_interval_count, 1)))
            ELSE 1.0
        END AS monthly_multiplier,
        -- The actual monthly equivalent amount
        s.amount * CASE s.recurring_interval
            WHEN 'day' THEN (30.44 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'week' THEN (4.33 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'month' THEN (1.0 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'year' THEN (1.0 / (12.0 * COALESCE(s.recurring_interval_count, 1)))
            ELSE 1.0
        END AS monthly_amount
    FROM subscriptions s
    WHERE
        -- Only include active subscriptions (active, trialing, past_due are billable)
        s.status IN ('active', 'trialing', 'past_due')
        -- Exclude subscriptions that are set to cancel at period end
        AND s.cancel_at_period_end = FALSE
        -- Exclude subscriptions that have already ended
        AND s.ended_at IS NULL
        -- Exclude subscriptions that are already canceled (double check)
        AND s.canceled_at IS NULL
),

-- Subscriptions that already renewed this month (from 1st until now)
already_renewed AS (
    SELECT
        sm.*,
        'already_generated' AS category
    FROM subscription_monthly sm, params p
    WHERE
        -- Renewal happened when current_period_start falls within our window
        sm.current_period_start >= p.month_start
        AND sm.current_period_start < p.now
),

-- Subscriptions that will renew between now and end of month
to_renew AS (
    SELECT
        sm.*,
        'to_generate' AS category
    FROM subscription_monthly sm, params p
    WHERE
        -- Renewal will happen when current_period_end (next billing date) falls within our window
        sm.current_period_end >= p.now
        AND sm.current_period_end < p.month_end
),

-- Combine both categories
combined AS (
    SELECT * FROM already_renewed
    UNION ALL
    SELECT * FROM to_renew
)

-- Final aggregation with breakdown
SELECT
    p.month_start::date AS month,
    p.now::timestamp AS as_of,

    -- Already generated revenue (renewed from 1st until now)
    COALESCE(SUM(CASE WHEN c.category = 'already_generated' THEN c.amount ELSE 0 END), 0) AS already_generated_cents,
    COALESCE(SUM(CASE WHEN c.category = 'already_generated' THEN c.amount ELSE 0 END) / 100.0, 0) AS already_generated_dollars,
    COUNT(CASE WHEN c.category = 'already_generated' THEN 1 END) AS already_generated_count,

    -- Revenue to generate (will renew between now and end of month)
    COALESCE(SUM(CASE WHEN c.category = 'to_generate' THEN c.amount ELSE 0 END), 0) AS to_generate_cents,
    COALESCE(SUM(CASE WHEN c.category = 'to_generate' THEN c.amount ELSE 0 END) / 100.0, 0) AS to_generate_dollars,
    COUNT(CASE WHEN c.category = 'to_generate' THEN 1 END) AS to_generate_count,

    -- Total for the month
    COALESCE(SUM(c.amount), 0) AS total_month_cents,
    COALESCE(SUM(c.amount) / 100.0, 0) AS total_month_dollars,
    COUNT(*) AS total_renewals,

    -- Monthly recurring GTV (sum of all monthly-equivalent amounts)
    -- This represents what we'd expect if all subscriptions renewed monthly
    COALESCE(SUM(c.monthly_amount), 0)::bigint AS monthly_recurring_gtv_cents,
    COALESCE(SUM(c.monthly_amount) / 100.0, 0) AS monthly_recurring_gtv_dollars

FROM params p
LEFT JOIN combined c ON TRUE
GROUP BY p.month_start, p.now;


-- ============================================================================
-- ADDITIONAL BREAKDOWN QUERIES
-- ============================================================================

-- Query 2: Breakdown by billing interval
-- Shows how different billing intervals contribute to monthly GTV
SELECT
    '=== BREAKDOWN BY BILLING INTERVAL ===' AS section;

WITH params AS (
    SELECT
        date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS month_start,
        (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 month') AS month_end,
        CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS now
),

active_subs AS (
    SELECT
        s.id,
        s.amount,
        s.currency,
        s.recurring_interval,
        s.recurring_interval_count,
        s.current_period_start,
        s.current_period_end,
        s.amount * CASE s.recurring_interval
            WHEN 'day' THEN (30.44 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'week' THEN (4.33 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'month' THEN (1.0 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'year' THEN (1.0 / (12.0 * COALESCE(s.recurring_interval_count, 1)))
            ELSE 1.0
        END AS monthly_amount,
        CASE
            WHEN s.current_period_start >= (SELECT month_start FROM params)
                 AND s.current_period_start < (SELECT now FROM params)
            THEN 'already_generated'
            WHEN s.current_period_end >= (SELECT now FROM params)
                 AND s.current_period_end < (SELECT month_end FROM params)
            THEN 'to_generate'
            ELSE 'other'
        END AS category
    FROM subscriptions s
    WHERE
        s.status IN ('active', 'trialing', 'past_due')
        AND s.cancel_at_period_end = FALSE
        AND s.ended_at IS NULL
        AND s.canceled_at IS NULL
)

SELECT
    recurring_interval,
    recurring_interval_count,
    category,
    COUNT(*) AS subscription_count,
    SUM(amount) AS period_amount_cents,
    SUM(amount) / 100.0 AS period_amount_dollars,
    SUM(monthly_amount)::bigint AS monthly_equivalent_cents,
    SUM(monthly_amount) / 100.0 AS monthly_equivalent_dollars
FROM active_subs
WHERE category IN ('already_generated', 'to_generate')
GROUP BY recurring_interval, recurring_interval_count, category
ORDER BY recurring_interval, recurring_interval_count, category;


-- Query 3: Weekly subscriptions detailed view
-- Shows exactly how weekly subs contribute multiple times per month
SELECT
    '=== WEEKLY SUBSCRIPTIONS DETAIL (multiple renewals per month) ===' AS section;

WITH params AS (
    SELECT
        date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS month_start,
        (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '1 month') AS month_end,
        CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS now
)

SELECT
    s.id,
    s.amount AS per_period_amount_cents,
    s.amount / 100.0 AS per_period_amount_dollars,
    s.recurring_interval,
    s.recurring_interval_count,
    4.33 / COALESCE(s.recurring_interval_count, 1) AS renewals_per_month,
    (s.amount * 4.33 / COALESCE(s.recurring_interval_count, 1))::bigint AS monthly_equivalent_cents,
    s.current_period_start,
    s.current_period_end
FROM subscriptions s, params p
WHERE
    s.recurring_interval = 'week'
    AND s.status IN ('active', 'trialing', 'past_due')
    AND s.cancel_at_period_end = FALSE
    AND s.ended_at IS NULL
    AND s.canceled_at IS NULL
ORDER BY s.amount DESC
LIMIT 20;


-- Query 4: Subscriptions with discounts
-- Shows impact of discounts on MRR
SELECT
    '=== SUBSCRIPTIONS WITH ACTIVE DISCOUNTS ===' AS section;

SELECT
    s.id AS subscription_id,
    s.amount AS current_amount_cents,
    s.amount / 100.0 AS current_amount_dollars,
    s.recurring_interval,
    d.name AS discount_name,
    d.type AS discount_type,
    CASE d.type
        WHEN 'percentage' THEN (dp.basis_points / 100.0)::text || '%'
        WHEN 'fixed' THEN '$' || (df.amount / 100.0)::text
        ELSE 'unknown'
    END AS discount_value,
    d.duration AS discount_duration,
    s.amount * CASE s.recurring_interval
        WHEN 'day' THEN (30.44 / COALESCE(s.recurring_interval_count, 1))
        WHEN 'week' THEN (4.33 / COALESCE(s.recurring_interval_count, 1))
        WHEN 'month' THEN (1.0 / COALESCE(s.recurring_interval_count, 1))
        WHEN 'year' THEN (1.0 / (12.0 * COALESCE(s.recurring_interval_count, 1)))
        ELSE 1.0
    END AS monthly_equivalent_cents
FROM subscriptions s
JOIN discounts d ON s.discount_id = d.id
LEFT JOIN discounts dp ON d.id = dp.id AND d.type = 'percentage'
LEFT JOIN discounts df ON d.id = df.id AND d.type = 'fixed'
WHERE
    s.status IN ('active', 'trialing', 'past_due')
    AND s.cancel_at_period_end = FALSE
    AND s.ended_at IS NULL
    AND s.canceled_at IS NULL
ORDER BY s.amount DESC
LIMIT 20;


-- Query 5: Overall Monthly Recurring GTV summary
-- This is the "true MRR" - what all active subscriptions would generate monthly
SELECT
    '=== OVERALL MONTHLY RECURRING GTV (All Active Subscriptions) ===' AS section;

SELECT
    COUNT(*) AS total_active_subscriptions,

    -- Raw sum (not converted to monthly)
    SUM(s.amount) AS total_raw_amount_cents,
    SUM(s.amount) / 100.0 AS total_raw_amount_dollars,

    -- Monthly recurring GTV (converted to monthly equivalent)
    SUM(
        s.amount * CASE s.recurring_interval
            WHEN 'day' THEN (30.44 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'week' THEN (4.33 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'month' THEN (1.0 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'year' THEN (1.0 / (12.0 * COALESCE(s.recurring_interval_count, 1)))
            ELSE 1.0
        END
    )::bigint AS monthly_recurring_gtv_cents,

    SUM(
        s.amount * CASE s.recurring_interval
            WHEN 'day' THEN (30.44 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'week' THEN (4.33 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'month' THEN (1.0 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'year' THEN (1.0 / (12.0 * COALESCE(s.recurring_interval_count, 1)))
            ELSE 1.0
        END
    ) / 100.0 AS monthly_recurring_gtv_dollars,

    -- Breakdown by interval
    COUNT(CASE WHEN s.recurring_interval = 'day' THEN 1 END) AS daily_subs,
    COUNT(CASE WHEN s.recurring_interval = 'week' THEN 1 END) AS weekly_subs,
    COUNT(CASE WHEN s.recurring_interval = 'month' THEN 1 END) AS monthly_subs,
    COUNT(CASE WHEN s.recurring_interval = 'year' THEN 1 END) AS yearly_subs

FROM subscriptions s
WHERE
    s.status IN ('active', 'trialing', 'past_due')
    AND s.cancel_at_period_end = FALSE
    AND s.ended_at IS NULL
    AND s.canceled_at IS NULL;


-- Query 6: Currency breakdown (if multi-currency)
SELECT
    '=== MONTHLY RECURRING GTV BY CURRENCY ===' AS section;

SELECT
    s.currency,
    COUNT(*) AS subscription_count,
    SUM(
        s.amount * CASE s.recurring_interval
            WHEN 'day' THEN (30.44 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'week' THEN (4.33 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'month' THEN (1.0 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'year' THEN (1.0 / (12.0 * COALESCE(s.recurring_interval_count, 1)))
            ELSE 1.0
        END
    )::bigint AS monthly_recurring_gtv_cents,
    SUM(
        s.amount * CASE s.recurring_interval
            WHEN 'day' THEN (30.44 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'week' THEN (4.33 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'month' THEN (1.0 / COALESCE(s.recurring_interval_count, 1))
            WHEN 'year' THEN (1.0 / (12.0 * COALESCE(s.recurring_interval_count, 1)))
            ELSE 1.0
        END
    ) / 100.0 AS monthly_recurring_gtv_formatted
FROM subscriptions s
WHERE
    s.status IN ('active', 'trialing', 'past_due')
    AND s.cancel_at_period_end = FALSE
    AND s.ended_at IS NULL
    AND s.canceled_at IS NULL
GROUP BY s.currency
ORDER BY monthly_recurring_gtv_cents DESC;
