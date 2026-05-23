"""Forward post-decision outcome computation (Slice 6 part 2).

Computes, for an organization, the 60-day-forward outcomes after a
review decision: refund rate, chargeback (dispute) rate, and offboard
flag — joined from the real Payment / Refund / Dispute tables. These
feed :func:`auto_action.evaluate_retroactive`'s promotion gate.

``complaint_rate`` stays 0.0 with a documented TODO: it needs Plain
threads tagged 'complaint', which is a data/credential-gated source
not available offline. The other three are computed from first-party
tables.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select

from polar.models.dispute import Dispute
from polar.models.organization import Organization, OrganizationStatus
from polar.models.payment import Payment, PaymentStatus
from polar.models.refund import Refund, RefundStatus
from polar.postgres import AsyncReadSession

from .auto_action import OutcomeMetric


async def forward_outcomes(
    session: AsyncReadSession,
    organization_id: UUID,
    *,
    since: datetime,
    window_days: int = 60,
) -> OutcomeMetric:
    """Per-org outcomes over ``[since, since + window_days]``.

    * refund_rate    = refunds / succeeded payments in window
    * chargeback_rate = disputes / succeeded payments in window
    * offboard_rate  = 1.0 if the org is currently DENIED/BLOCKED else 0
      (point-in-time; the cohort mean is the offboard share)
    * complaint_rate = 0.0 (TODO: Plain complaint-tagged threads)
    """

    until = since + timedelta(days=window_days)

    succeeded = (
        await session.execute(
            select(func.count(Payment.id)).where(
                Payment.organization_id == organization_id,
                Payment.status == PaymentStatus.succeeded,
                Payment.created_at >= since,
                Payment.created_at < until,
            )
        )
    ).scalar_one()

    refunds = (
        await session.execute(
            select(func.count(Refund.id)).where(
                Refund.organization_id == organization_id,
                Refund.status == RefundStatus.succeeded,
                Refund.created_at >= since,
                Refund.created_at < until,
            )
        )
    ).scalar_one()

    # Disputes have no org column — join through the payment.
    disputes = (
        await session.execute(
            select(func.count(Dispute.id))
            .join(Payment, Payment.id == Dispute.payment_id)
            .where(
                Payment.organization_id == organization_id,
                Dispute.created_at >= since,
                Dispute.created_at < until,
            )
        )
    ).scalar_one()

    org_status = (
        await session.execute(
            select(Organization.status).where(
                Organization.id == organization_id
            )
        )
    ).scalar_one_or_none()
    offboarded = org_status in (
        OrganizationStatus.DENIED,
        OrganizationStatus.BLOCKED,
    )

    denom = succeeded or 0
    return OutcomeMetric(
        chargeback_rate=(disputes / denom) if denom else 0.0,
        refund_rate=(refunds / denom) if denom else 0.0,
        offboard_rate=1.0 if offboarded else 0.0,
        complaint_rate=0.0,  # TODO: Plain complaint-tagged threads
    )


async def cohort_outcomes(
    session: AsyncReadSession,
    org_starts: Sequence[tuple[UUID, datetime]],
    *,
    window_days: int = 60,
) -> dict[UUID, OutcomeMetric]:
    """Compute :func:`forward_outcomes` for a set of (org, since) pairs.

    Returned dict is keyed by organization_id (the most recent
    ``since`` wins if an org appears twice). Passed to
    ``evaluate_retroactive(..., outcomes=...)``.
    """

    out: dict[UUID, OutcomeMetric] = {}
    for organization_id, since in org_starts:
        out[organization_id] = await forward_outcomes(
            session, organization_id, since=since, window_days=window_days
        )
    return out


__all__ = ["forward_outcomes", "cohort_outcomes"]
