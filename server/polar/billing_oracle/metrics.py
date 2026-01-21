"""
Prometheus metrics for the Billing Oracle.

Metrics emitted:
- billing_oracle_reconciliation_total: Total reconciliation runs by status
- billing_oracle_mismatch_total: Total mismatches by classification and severity
- billing_oracle_orders_checked_total: Total orders checked
- billing_oracle_reconciliation_duration_seconds: Reconciliation duration

These metrics are designed for:
- Alerting on billing anomalies
- Dashboard visualization
- SLA monitoring
"""

from prometheus_client import Counter, Histogram

# Reconciliation run metrics
ORACLE_RECONCILIATION_TOTAL = Counter(
    "polar_billing_oracle_reconciliation_total",
    "Total number of reconciliation runs",
    ["status"],  # clean, warning, error, critical
)

ORACLE_RECONCILIATION_DURATION = Histogram(
    "polar_billing_oracle_reconciliation_duration_seconds",
    "Reconciliation run duration in seconds",
    ["scope"],  # order, subscription, sweep
    buckets=(0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0),
)

# Mismatch metrics
ORACLE_MISMATCH_TOTAL = Counter(
    "polar_billing_oracle_mismatch_total",
    "Total number of billing mismatches detected",
    ["classification", "severity"],
)

# Items checked metrics
ORACLE_ORDERS_CHECKED = Counter(
    "polar_billing_oracle_orders_checked_total",
    "Total number of orders checked by the oracle",
)

ORACLE_LINE_ITEMS_CHECKED = Counter(
    "polar_billing_oracle_line_items_checked_total",
    "Total number of line items checked by the oracle",
)

# Amount discrepancy metrics (for tracking monetary impact)
ORACLE_AMOUNT_DISCREPANCY = Histogram(
    "polar_billing_oracle_amount_discrepancy_cents",
    "Absolute amount discrepancy in cents",
    ["classification"],
    buckets=(1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 50000),
)


def record_reconciliation_result(
    status: str,
    scope: str,
    duration_seconds: float,
    orders_checked: int,
    line_items_checked: int,
) -> None:
    """
    Record metrics for a reconciliation result.

    Args:
        status: clean, warning, error, or critical
        scope: order, subscription, or sweep
        duration_seconds: How long the reconciliation took
        orders_checked: Number of orders checked
        line_items_checked: Number of line items checked
    """
    ORACLE_RECONCILIATION_TOTAL.labels(status=status).inc()
    ORACLE_RECONCILIATION_DURATION.labels(scope=scope).observe(duration_seconds)
    ORACLE_ORDERS_CHECKED.inc(orders_checked)
    ORACLE_LINE_ITEMS_CHECKED.inc(line_items_checked)


def record_mismatch(
    classification: str,
    severity: str,
    amount_difference: int | None = None,
) -> None:
    """
    Record metrics for a single mismatch.

    Args:
        classification: The mismatch classification (e.g., amount_mismatch)
        severity: The severity level (info, warning, error, critical)
        amount_difference: Optional absolute amount difference in cents
    """
    ORACLE_MISMATCH_TOTAL.labels(
        classification=classification,
        severity=severity,
    ).inc()

    if amount_difference is not None:
        ORACLE_AMOUNT_DISCREPANCY.labels(
            classification=classification,
        ).observe(abs(amount_difference))
