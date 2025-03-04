import uuid

from polar.exceptions import PolarTaskError
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.discord.internal_webhook import (
    get_branded_discord_embed,
    send_internal_webhook,
)
from polar.integrations.plain.service import plain as plain_service
from polar.models import Account
from polar.notifications.notification import (
    MaintainerAccountReviewedNotificationPayload,
    MaintainerAccountUnderReviewNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notification_service
from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from .service import account as account_service


class AccountTaskError(PolarTaskError): ...


class AccountDoesNotExist(AccountTaskError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = f"The account with id {account_id} does not exist."
        super().__init__(message)


async def send_account_under_review_discord_notification(account: Account) -> None:
    await send_internal_webhook(
        {
            "content": "Payout account should be reviewed",
            "embeds": [
                get_branded_discord_embed(
                    {
                        "title": "Payout account should be reviewed",
                        "description": (
                            f"The {account.account_type.get_display_name()} "
                            f"payout account used by {', '.join(account.get_associations_names())} should be reviewed."
                        ),
                    }
                )
            ],
        }
    )


@task("account.under_review")
async def account_under_review(
    ctx: JobContext, account_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        account = await account_service.get_by_id(session, account_id)
        if account is None:
            raise AccountDoesNotExist(account_id)

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

        await plain_service.create_account_review_thread(session, account)


@task("account.reviewed")
async def account_reviewed(
    ctx: JobContext, account_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        account = await account_service.get_by_id(session, account_id)
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
