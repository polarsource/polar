import uuid

from sqlalchemy.orm import joinedload

from polar.account.repository import AccountRepository
from polar.exceptions import PolarTaskError
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.plain.service import plain as plain_service
from polar.models import Account
from polar.notifications.notification import (
    MaintainerAccountReviewedNotificationPayload,
    MaintainerAccountUnderReviewNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notification_service
from polar.organization.repository import OrganizationRepository
from polar.worker import AsyncSessionMaker, TaskPriority, actor


class AccountTaskError(PolarTaskError): ...


class AccountDoesNotExist(AccountTaskError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = f"The account with id {account_id} does not exist."
        super().__init__(message)


@actor(actor_name="account.under_review", priority=TaskPriority.LOW)
async def account_under_review(account_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = AccountRepository.from_session(session)
        account = await repository.get_by_id(
            account_id, options=(joinedload(Account.organizations),)
        )
        if account is None:
            raise AccountDoesNotExist(account_id)

        organization_repository = OrganizationRepository.from_session(session)
        organizations = await organization_repository.get_all_by_account(account_id)
        for organization in organizations:
            await plain_service.create_account_review_thread(session, organization)

        await notification_service.send_to_user(
            session=session,
            user_id=account.admin_id,
            notif=PartialNotification(
                type=NotificationType.maintainer_account_under_review,
                payload=MaintainerAccountUnderReviewNotificationPayload(
                    account_type=account.account_type.get_display_name()
                ),
            ),
        )


@actor(actor_name="account.reviewed", priority=TaskPriority.LOW)
async def account_reviewed(account_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = AccountRepository.from_session(session)
        account = await repository.get_by_id(account_id)
        if account is None:
            raise AccountDoesNotExist(account_id)

        await held_balance_service.release_account(session, account)

        await notification_service.send_to_user(
            session=session,
            user_id=account.admin_id,
            notif=PartialNotification(
                type=NotificationType.maintainer_account_reviewed,
                payload=MaintainerAccountReviewedNotificationPayload(
                    account_type=account.account_type.get_display_name()
                ),
            ),
        )
