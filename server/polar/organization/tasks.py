import uuid

from sqlalchemy.orm import joinedload

from polar.account.repository import AccountRepository
from polar.email.react import render_email_template
from polar.email.schemas import (
    OrganizationReviewedEmail,
    OrganizationReviewedProps,
    OrganizationUnderReviewEmail,
    OrganizationUnderReviewProps,
)
from polar.email.sender import enqueue_email
from polar.exceptions import PolarTaskError
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.plain.service import plain as plain_service
from polar.models import Organization
from polar.models.organization import OrganizationStatus
from polar.user.repository import UserRepository
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import OrganizationRepository


class OrganizationTaskError(PolarTaskError): ...


class OrganizationDoesNotExist(OrganizationTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"The organization with id {organization_id} does not exist."
        super().__init__(message)


class OrganizationAccountNotSet(OrganizationTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = (
            f"The organization with id {organization_id} does not have an account set."
        )
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


@actor(actor_name="organization.created", priority=TaskPriority.LOW)
async def organization_created(organization_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)


@actor(actor_name="organization.account_set", priority=TaskPriority.LOW)
async def organization_account_set(organization_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        if organization.account_id is None:
            raise OrganizationAccountNotSet(organization_id)

        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_id(organization.account_id)
        if account is None:
            raise AccountDoesNotExist(organization.account_id)

        await held_balance_service.release_account(session, account)


@actor(actor_name="organization.under_review", priority=TaskPriority.LOW)
async def organization_under_review(organization_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(
            organization_id, options=(joinedload(Organization.account),)
        )
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        await plain_service.create_organization_review_thread(session, organization)

        # Send an email for the initial review
        if organization.status == OrganizationStatus.INITIAL_REVIEW:
            admin_user = await repository.get_admin_user(session, organization)
            if admin_user:
                email = OrganizationUnderReviewEmail(
                    props=OrganizationUnderReviewProps.model_validate(
                        {"email": admin_user.email, "organization": organization}
                    )
                )
                enqueue_email(
                    to_email_addr=admin_user.email,
                    subject="Your organization is under review",
                    html_content=render_email_template(email),
                )


@actor(actor_name="organization.reviewed", priority=TaskPriority.LOW)
async def organization_reviewed(
    organization_id: uuid.UUID, initial_review: bool = False
) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        # Release held balance if account exists
        if organization.account_id:
            account_repository = AccountRepository.from_session(session)
            account = await account_repository.get_by_id(organization.account_id)
            if account:
                await held_balance_service.release_account(session, account)

        # Send an email after the initial review
        if initial_review:
            admin_user = await repository.get_admin_user(session, organization)
            if admin_user:
                email = OrganizationReviewedEmail(
                    props=OrganizationReviewedProps.model_validate(
                        {"email": admin_user.email, "organization": organization}
                    )
                )
                enqueue_email(
                    to_email_addr=admin_user.email,
                    subject="Your organization review is complete",
                    html_content=render_email_template(email),
                )


@actor(actor_name="organization.deletion_requested", priority=TaskPriority.HIGH)
async def organization_deletion_requested(
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    blocked_reasons: list[str],
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
