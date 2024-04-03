import uuid

from discord_webhook import AsyncDiscordWebhook, DiscordEmbed

from polar.config import settings
from polar.enums import AccountType
from polar.exceptions import PolarError
from polar.kit.money import get_cents_in_dollar_string
from polar.worker import (
    AsyncSessionMaker,
    JobContext,
    PolarWorkerContext,
    interval,
    task,
)

from .service.payout import payout_transaction as payout_transaction_service
from .service.processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)


class TransactionTaskError(PolarError): ...


class PayoutDoesNotExist(TransactionTaskError):
    def __init__(self, payout_id: uuid.UUID) -> None:
        self.payout_id = payout_id
        message = f"The payout with id {payout_id} does not exist."
        super().__init__(message, 500)


@interval(hour=0, minute=0)
async def sync_stripe_fees(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await processor_fee_transaction_service.sync_stripe_fees(session)


@interval(minute=15)
async def trigger_stripe_payouts(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await payout_transaction_service.trigger_stripe_payouts(session)


@task("payout.created")
async def payout_created(
    ctx: JobContext, payout_id: uuid.UUID, polar_context: PolarWorkerContext
) -> None:
    if not settings.DISCORD_WEBHOOK_URL:
        return

    async with AsyncSessionMaker(ctx) as session:
        payout = await payout_transaction_service.get(session, payout_id)
        if payout is None:
            raise PayoutDoesNotExist(payout_id)

        await session.refresh(payout, {"account"})
        account = payout.account
        assert account is not None

        webhook = AsyncDiscordWebhook(
            url=settings.DISCORD_WEBHOOK_URL,
            content="Payout triggered. Please review it.",
        )

        embed = DiscordEmbed(
            title="Payout amount",
            description=f"${get_cents_in_dollar_string(abs(payout.amount))}",
            color="65280",
        )
        embed.add_embed_field(
            name="Account Type",
            value=f"{account.account_type}",
        )

        if account.account_type == AccountType.stripe:
            embed.add_embed_field(
                name="Stripe ID",
                value=f"[{account.stripe_id}](https://dashboard.stripe.com/connect/accounts/{account.stripe_id})",
            )

        webhook.add_embed(embed)
        await webhook.execute()
