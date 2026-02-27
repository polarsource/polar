from ..schemas import PaymentMetrics


def collect_metrics_data(
    *,
    total_payments: int,
    succeeded_payments: int,
    total_amount_cents: int,
    p50_risk_score: int | None,
    p90_risk_score: int | None,
    refund_count: int,
    refund_amount_cents: int,
    dispute_count: int,
    dispute_amount_cents: int,
) -> PaymentMetrics:
    return PaymentMetrics(
        total_payments=total_payments,
        succeeded_payments=succeeded_payments,
        total_amount_cents=total_amount_cents,
        p50_risk_score=p50_risk_score,
        p90_risk_score=p90_risk_score,
        refund_count=refund_count,
        refund_amount_cents=refund_amount_cents,
        dispute_count=dispute_count,
        dispute_amount_cents=dispute_amount_cents,
    )
