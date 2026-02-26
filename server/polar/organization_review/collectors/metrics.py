from ..schemas import PaymentMetrics


def collect_metrics_data(
    *,
    total_payments: int,
    succeeded_payments: int,
    total_amount_cents: int,
    risk_scores: list[int],
    refund_count: int,
    refund_amount_cents: int,
    dispute_count: int,
    dispute_amount_cents: int,
) -> PaymentMetrics:
    p50 = _percentile(risk_scores, 50) if risk_scores else None
    p90 = _percentile(risk_scores, 90) if risk_scores else None

    return PaymentMetrics(
        total_payments=total_payments,
        succeeded_payments=succeeded_payments,
        total_amount_cents=total_amount_cents,
        p50_risk_score=p50,
        p90_risk_score=p90,
        refund_count=refund_count,
        refund_amount_cents=refund_amount_cents,
        dispute_count=dispute_count,
        dispute_amount_cents=dispute_amount_cents,
    )


def _percentile(data: list[int], percentile: int) -> int:
    if not data:
        return 0
    sorted_data = sorted(data)
    index = (percentile / 100) * (len(sorted_data) - 1)
    lower = int(index)
    upper = lower + 1
    if upper >= len(sorted_data):
        return sorted_data[-1]
    weight = index - lower
    return int(sorted_data[lower] * (1 - weight) + sorted_data[upper] * weight)
