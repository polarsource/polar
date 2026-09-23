import uuid
from typing import Annotated

from polar.integrations.stripe.service import StripeAccountRejectReason
from polar.observability.task_logging import LoggableField
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import payout_account as payout_account_service


@actor(
    actor_name="payout_account.reject_stripe_account",
    priority=TaskPriority.LOW,
)
async def reject_stripe_account(
    payout_account_id: Annotated[uuid.UUID, LoggableField],
    reason: Annotated[StripeAccountRejectReason, LoggableField],
) -> None:
    """Reject the Stripe connected account for a denied or blocked organization.

    Enqueued by ``deny_organization``/``block_organization`` only when a human
    reviewer opts in from the backoffice. Rejection is permanent on Stripe, so
    read from the primary session to avoid a replica-lag miss dropping it.
    """
    async with AsyncSessionMaker() as session:
        await payout_account_service.reject_stripe_account(
            session, payout_account_id, reason
        )
