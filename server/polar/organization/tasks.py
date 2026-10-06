import uuid
from typing import Annotated

import structlog

from polar.email.schemas import (
    OrganizationOffboardedEmail,
    OrganizationOffboardedProps,
)
from polar.email.sender import enqueue_email_template
from polar.exceptions import PolarTaskError
from polar.integrations.plain.service import plain as plain_service
from polar.models.organization import OrganizationStatus
from polar.observability.task_logging import LoggableField
from polar.user.repository import UserRepository
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

from .repository import OrganizationRepository
from .service import organization as organization_service

log = structlog.get_logger()


class OrganizationTaskError(PolarTaskError): ...


class OrganizationDoesNotExist(OrganizationTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization with id {organization_id} does not exist."
        super().__init__(message)


class AccountDoesNotExist(OrganizationTaskError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = f"The account with id {account_id} does not exist."
        super().__init__(message)


class UserDoesNotExist(OrganizationTaskError):
    def __init__(self, user_id: uuid.UUID) -> None:
        self.user_id = user_id
        message = f"The user with id {user_id} does not exist."
        super().__init__(message)


@actor(
    actor_name="organization.created",
    priority=TaskPriority.LOW,
)
async def organization_created(
    organization_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)


@actor(
    actor_name="organization.unsnooze_expired",
    cron_trigger=CronTrigger.from_crontab("0 * * * *"),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def organization_unsnooze_expired() -> None:
    """Auto-unsnooze TIME_BASED snoozed orgs whose deadline has passed."""
    async with AsyncSessionMaker() as session:
        await organization_service.unsnooze_expired_organizations(session)


@actor(
    actor_name="organization.offboard_expired",
    cron_trigger=CronTrigger.from_crontab("0 4 * * *"),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def organization_offboard_expired() -> None:
    """Enqueue a per-org job for each offboarding org past the wind-down floor."""
    async with AsyncSessionMaker() as session:
        await organization_service.offboard_expired_organizations(session)


@actor(
    actor_name="organization.offboard_expired_one",
    priority=TaskPriority.LOW,
)
async def organization_offboard_expired_one(
    organization_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    """Complete offboarding for one org if the chargeback window has also elapsed."""
    async with AsyncSessionMaker() as session:
        await organization_service.complete_expired_offboarding(
            session, organization_id
        )


@actor(
    actor_name="organization.cancel_expired_subscriptions",
    cron_trigger=CronTrigger.from_crontab("0 5 * * *"),
    priority=TaskPriority.LOW,
    max_retries=0,
)
async def organization_cancel_expired_subscriptions() -> None:
    """Cancel customer subscriptions of orgs denied/blocked/offboarded past the
    cancellation delay. Customers are not notified."""
    async with AsyncSessionMaker() as session:
        await organization_service.cancel_expired_organizations_subscriptions(session)


@actor(
    actor_name="organization.offboarded",
    priority=TaskPriority.LOW,
)
async def organization_offboarded(
    organization_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    """Notify an organization's members that it has been offboarded."""
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        # include_blocked: an admin may block the org between the offboard
        # transition and this task running; we still want to send the email.
        organization = await repository.get_by_id(organization_id, include_blocked=True)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        members = await user_organization_service.list_by_org(session, organization.id)
        for member in members:
            email = member.user.email
            if not email:
                continue
            enqueue_email_template(
                OrganizationOffboardedEmail(
                    props=OrganizationOffboardedProps(
                        email=email,
                        organization_name=organization.name,
                        account_url=organization.account_url,
                    )
                ),
                to_email_addr=email,
                subject=f"{organization.name} has been offboarded from Polar",
            )


def _check_threshold_debounce_key(account_id: uuid.UUID) -> str:
    return f"organization.check_threshold:{account_id}"


@actor(
    actor_name="organization.check_threshold",
    priority=TaskPriority.LOW,
    debounce_key=_check_threshold_debounce_key,
)
async def organization_check_threshold(
    account_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    """Refresh the cached ``total_balance`` for the organization owning
    ``account_id`` and re-evaluate the review threshold.

    Enqueued by the transaction layer after balance / reversal-balance rows
    are written, so the transaction service does not need to call into
    organization service logic synchronously.

    Debounced per-account: a single business event writes multiple balance
    rows (charge + platform fee + reversal fees) and each row enqueues this
    task, so the bursts collapse to one execution per debounce window. The
    concrete failure mode without this: when an order pushes ``total_balance``
    past ``next_review_threshold``, the concurrent check_threshold tasks all
    race past the unguarded ACTIVE→REVIEW transition and each spawns its own
    agent run.
    """
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_account(account_id)
        if organization is None:
            return
        await organization_service.check_review_threshold(session, organization)


@actor(
    actor_name="organization.under_review",
    priority=TaskPriority.LOW,
)
async def organization_under_review(
    organization_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        is_auto_approve_eligible = organization.status == OrganizationStatus.REVIEW

        enqueue_job(
            "organization_review.run_agent",
            organization_id=organization_id,
            auto_approve_eligible=is_auto_approve_eligible,
        )
        enqueue_job(
            "organization.evaluate_website_risk",
            organization_id=organization_id,
        )


@actor(
    actor_name="organization.deletion_requested",
    priority=TaskPriority.HIGH,
)
async def organization_deletion_requested(
    organization_id: Annotated[uuid.UUID, LoggableField],
    user_id: Annotated[uuid.UUID, LoggableField],
    blocked_reasons: Annotated[list[str], LoggableField],
) -> None:
    """Handle organization deletion request that requires support review."""
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        user_repository = UserRepository.from_session(session)
        user = await user_repository.get_by_id(user_id)
        if user is None:
            raise UserDoesNotExist(user_id)

        # Create Plain ticket for support handling
        await plain_service.create_organization_deletion_thread(
            session, organization, user, blocked_reasons
        )


@actor(
    actor_name="organization.evaluate_website_risk",
    priority=TaskPriority.LOW,
)
async def evaluate_website_risk(
    organization_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        await organization_service.evaluate_website_risk(session, organization)


@actor(
    actor_name="organization.sync_payout_account_website",
    priority=TaskPriority.LOW,
)
async def sync_payout_account_website(
    organization_id: Annotated[uuid.UUID, LoggableField],
    payout_account_id: Annotated[uuid.UUID | None, LoggableField] = None,
) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        await organization_service.sync_payout_account_website(
            session, organization, payout_account_id
        )
