import uuid

from polar.enums import AccountType
from polar.exceptions import PolarTaskError
from polar.integrations.discord.internal_webhook import (
    DiscordEmbedField,
    get_branded_discord_embed,
    send_internal_webhook,
)
from polar.kit.money import get_cents_in_dollar_string
from polar.worker import AsyncSessionMaker, CronTrigger, JobContext, task

from .service.payout import payout_transaction as payout_transaction_service
from .service.processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)


class TransactionTaskError(PolarTaskError): ...


class PayoutDoesNotExist(TransactionTaskError):
    def __init__(self, payout_id: uuid.UUID) -> None:
        self.payout_id = payout_id
        message = f"The payout with id {payout_id} does not exist."
        super().__init__(message)


@task("processor_fee.sync_stripe_fees", cron_trigger=CronTrigger(hour=0, minute=0))
async def sync_stripe_fees(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await processor_fee_transaction_service.sync_stripe_fees(session)


@task("payout.created")
async def payout_created(ctx: JobContext, payout_id: uuid.UUID) -> None:
    async with AsyncSessionMaker(ctx) as session:
        payout = await payout_transaction_service.get(session, payout_id)
        if payout is None:
            raise PayoutDoesNotExist(payout_id)

        await session.refresh(payout, {"account"})
        account = payout.account
        assert account is not None

        fields: list[DiscordEmbedField] = [
            {
                "name": "Account Type",
                "value": f"{account.account_type}",
            }
        ]
        if account.account_type == AccountType.stripe:
            fields.append(
                {
                    "name": "Stripe ID",
                    "value": f"[{account.stripe_id}](https://dashboard.stripe.com/connect/accounts/{account.stripe_id})",
                }
            )

        await send_internal_webhook(
            {
                "content": "Payout triggered. Please review it.",
                "embeds": [
                    get_branded_discord_embed(
                        {
                            "title": "Payout amount",
                            "description": f"${get_cents_in_dollar_string(abs(payout.amount))}",
                            "fields": fields,
                        }
                    )
                ],
            }
        )


@task("payout.trigger_stripe_payouts", cron_trigger=CronTrigger(minute=15))
async def trigger_stripe_payouts(ctx: JobContext) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await payout_transaction_service.trigger_stripe_payouts(session)


@task("payout.trigger_stripe_payout")
async def trigger_payout(ctx: JobContext, payout_id: uuid.UUID) -> None:
    async with AsyncSessionMaker(ctx) as session:
        payout = await payout_transaction_service.get(session, payout_id)
        if payout is None:
            raise PayoutDoesNotExist(payout_id)
        await payout_transaction_service.trigger_stripe_payout(session, payout)
