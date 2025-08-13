"""Schemas for organization backoffice components."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PaymentStatistics:
    """Payment statistics for organization account review."""

    payment_count: int
    p50_risk: float
    p90_risk: float
    refunds_count: int
    transfer_sum: int
    refunds_amount: int
    total_payment_amount: int


@dataclass(frozen=True)
class SetupVerdictData:
    """Setup verdict data for organization integration status."""

    checkout_links_count: int
    webhooks_count: int
    api_keys_count: int
    products_count: int
    benefits_count: int
    user_verified: bool
    account_charges_enabled: bool
    account_payouts_enabled: bool
    setup_score: int
    benefits_configured: bool
    webhooks_configured: bool
    products_configured: bool
    api_keys_created: bool
