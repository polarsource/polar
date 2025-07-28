import uuid

from sqlalchemy.orm import joinedload

from polar.account.repository import AccountRepository
from polar.exceptions import PolarTaskError
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.plain.service import plain as plain_service
from polar.models import Organization
from polar.notifications.notification import (
    MaintainerOrganizationReviewedNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notification_service
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

        if organization.account is None:
            raise OrganizationAccountNotSet(organization_id)

        await plain_service.create_organization_review_thread(session, organization)

        await notification_service.send_to_user(
            session=session,
            user_id=organization.account.admin_id,
            notif=PartialNotification(
                type=NotificationType.maintainer_organization_reviewed,
                payload=MaintainerOrganizationReviewedNotificationPayload(
                    organization_name=organization.name
                ),
            ),
        )


@actor(actor_name="organization.reviewed", priority=TaskPriority.LOW)
async def organization_reviewed(organization_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(
            organization_id, options=(joinedload(Organization.account),)
        )
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)

        if organization.account is None:
            raise OrganizationAccountNotSet(organization_id)

        # Release held balance for the organization's account
        if organization.account:
            await held_balance_service.release_account(session, organization.account)

        await notification_service.send_to_user(
            session=session,
            user_id=organization.account.admin_id,
            notif=PartialNotification(
                type=NotificationType.maintainer_organization_reviewed,
                payload=MaintainerOrganizationReviewedNotificationPayload(
                    organization_name=organization.name
                ),
            ),
        )
