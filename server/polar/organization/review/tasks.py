from uuid import UUID

from polar.exceptions import PolarTaskError
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import organization_review


class OrganizationReviewTaskError(PolarTaskError): ...


@actor(actor_name="organization.review.check_payments", priority=TaskPriority.LOW)
async def check_payments(organization_id: UUID) -> None:
    """
    Check payment-related metrics (auth rate and P90 risk score) for an organization.
    Triggered by payment_intent.succeeded or payment_intent.payment_failed webhooks.
    """
    async with AsyncSessionMaker() as session:
        await organization_review.check_payments(session, organization_id)


@actor(actor_name="organization.review.check_refund_rate", priority=TaskPriority.LOW)
async def check_refund_rate(organization_id: UUID) -> None:
    """
    Check refund rate for an organization.
    Triggered by refund creation.
    """
    async with AsyncSessionMaker() as session:
        await organization_review.check_refund_rate(session, organization_id)


@actor(actor_name="organization.review.check_dispute_rate", priority=TaskPriority.HIGH)
async def check_dispute_rate(organization_id: UUID) -> None:
    """
    Check dispute and chargeback rates for an organization.
    Triggered by dispute webhook (ChargebackStop or Stripe).
    Higher priority since disputes are more urgent.
    """
    async with AsyncSessionMaker() as session:
        await organization_review.check_dispute_rate(session, organization_id)
