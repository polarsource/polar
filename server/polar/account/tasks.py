import uuid

from discord_webhook import AsyncDiscordWebhook, DiscordEmbed

from polar.config import settings
from polar.enums import AccountType
from polar.exceptions import PolarError
from polar.held_balance.service import held_balance as held_balance_service
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


class AccountTaskError(PolarError): ...


class AccountDoesNotExist(AccountTaskError):
    def __init__(self, account_id: uuid.UUID) -> None:
        self.account_id = account_id
        message = f"The account with id {account_id} does not exist."
        super().__init__(message, 500)


async def send_account_under_review_discord_notification(account: Account) -> None:
    if not settings.DISCORD_WEBHOOK_URL:
        return

    webhook = AsyncDiscordWebhook(
        url=settings.DISCORD_WEBHOOK_URL, content="Payout account should be reviewed"
    )

    associations_names = ", ".join(account.get_associations_names())

    embed = DiscordEmbed(
        title="Payout account should be reviewed",
        description=(
            f"The {AccountType.get_display_name(account.account_type)} "
            f"payout account used by {associations_names} should be reviewed."
        ),
        color="65280",
    )

    webhook.add_embed(embed)
    await webhook.execute()


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
                    account_type=AccountType.get_display_name(account.account_type)
                ),
            ),
        )

        await send_account_under_review_discord_notification(account)


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
                    account_type=AccountType.get_display_name(account.account_type)
                ),
            ),
        )
