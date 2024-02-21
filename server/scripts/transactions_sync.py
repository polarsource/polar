import asyncio
import datetime
import logging.config
import uuid
from functools import wraps
from typing import Any, cast

import stripe as stripe_lib
import structlog
import typer
from sqlalchemy import select

from polar.account.service import account as account_service
from polar.enums import AccountType
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe
from polar.integrations.stripe.utils import get_expandable_id  # noqa
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import generate_uuid
from polar.models import Account, PledgeTransaction, Transaction
from polar.models.transaction import PaymentProcessor, TransactionType
from polar.pledge.service import pledge as pledge_service
from polar.postgres import create_engine
from polar.transaction.service.payment import (
    PledgeDoesNotExist,
    SubscriptionDoesNotExist,
)
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.transaction.service.payout import (
    payout_transaction as payout_transaction_service,
)
from polar.transaction.service.refund import (
    refund_transaction as refund_transaction_service,
)

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": True,
    }
)


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


@cli.command()
@typer_async
async def sync_transactions(
    stripe_api_key: str,
    dry_run: bool = typer.Option(
        False, help="If `True`, changes won't be commited to the database."
    ),
) -> None:
    stripe_lib.api_key = stripe_api_key
    engine = create_engine("script")
    async with engine.connect() as connection:
        async with connection.begin() as transaction:
            session = AsyncSession(
                bind=connection,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False,
                join_transaction_mode="create_savepoint",
            )

            typer.secho("HANDLING CHARGES", bg="green")
            charges_params: stripe_lib.Charge.SearchParams = {
                "query": 'status:"succeeded"',
                "limit": 100,
            }
            charge_result = stripe_lib.Charge.search(**charges_params)
            for charge in charge_result.auto_paging_iter():
                typer.echo("\n---\n")
                typer.echo(f"Charge {charge.id}")

                charge.metadata["type"] = ProductType.pledge

                try:
                    payment_transaction = (
                        await payment_transaction_service.create_payment(
                            session, charge=charge
                        )
                    )
                    payment_transaction.created_at = datetime.datetime.fromtimestamp(
                        charge.created, tz=datetime.UTC
                    )
                    session.add(payment_transaction)
                except SubscriptionDoesNotExist:
                    typer.secho("Payment linked to unknown subscription", fg="red")
                except PledgeDoesNotExist:
                    typer.secho("Payment linked to unknown pledge", fg="red")
                else:
                    typer.secho(
                        f"Created transaction {payment_transaction.id}", fg="green"
                    )

                refund_transactions = await refund_transaction_service.create_refunds(
                    session, charge=charge
                )
                for refund_transaction in refund_transactions:
                    assert refund_transaction.refund_id is not None
                    stripe_refund = stripe_lib.Refund.retrieve(
                        refund_transaction.refund_id
                    )
                    refund_transaction.created_at = datetime.datetime.fromtimestamp(
                        stripe_refund.created, tz=datetime.UTC
                    )
                    typer.secho(
                        f"Created refund transaction {refund_transaction.id}",
                        fg="green",
                    )

            typer.secho("HANDLING TRANSFERS", bg="green")
            transfers_statement = select(PledgeTransaction).where(
                PledgeTransaction.type == "transfer"
            )
            transfers_result = await session.execute(transfers_statement)
            for transfer in transfers_result.scalars().all():
                assert transfer.transaction_id is not None
                stripe_transfer = stripe_lib.Transfer.retrieve(transfer.transaction_id)
                assert stripe_transfer.destination is not None
                account = await account_service.get_by_stripe_id(
                    session, get_expandable_id(stripe_transfer.destination)
                )
                assert account is not None
                pledge = await pledge_service.get(session, transfer.pledge_id)
                assert pledge is not None
                created_at = datetime.datetime.fromtimestamp(
                    stripe_transfer.created, tz=datetime.UTC
                )
                balance_correlation_key = str(uuid.uuid4())

                assert pledge.payment_id is not None
                payment_intent = stripe.retrieve_intent(pledge.payment_id)
                transfer_payment_transaction = await payment_transaction_service.get_by(
                    session,
                    type=TransactionType.payment,
                    charge_id=payment_intent.latest_charge,
                )

                outgoing_transaction = Transaction(
                    id=generate_uuid(),
                    created_at=created_at,
                    account=None,  # Polar account
                    type=TransactionType.balance,
                    processor=PaymentProcessor.stripe,
                    currency=stripe_transfer.currency,
                    amount=-stripe_transfer.amount,
                    account_currency=stripe_transfer.currency,
                    account_amount=-stripe_transfer.amount,
                    tax_amount=0,
                    balance_correlation_key=balance_correlation_key,
                    payment_transaction=transfer_payment_transaction,
                    transfer_id=stripe_transfer.id,
                    pledge_id=transfer.pledge_id,
                    issue_reward_id=transfer.issue_reward_id,
                )
                incoming_transaction = Transaction(
                    id=generate_uuid(),
                    created_at=created_at,
                    account=account,  # User account
                    type=TransactionType.balance,
                    processor=PaymentProcessor.stripe,
                    currency=stripe_transfer.currency,
                    amount=stripe_transfer.amount,
                    account_currency=stripe_transfer.currency,
                    account_amount=stripe_transfer.amount,
                    tax_amount=0,
                    balance_correlation_key=balance_correlation_key,
                    payment_transaction=transfer_payment_transaction,
                    transfer_id=stripe_transfer.id,
                    pledge_id=transfer.pledge_id,
                    issue_reward_id=transfer.issue_reward_id,
                )

                source_currency = stripe_transfer.currency.lower()
                assert account.currency is not None
                destination_currency = account.currency.lower()
                if source_currency != destination_currency:
                    assert stripe_transfer.destination_payment is not None
                    stripe_destination_charge = stripe.get_charge(
                        get_expandable_id(stripe_transfer.destination_payment),
                        stripe_account=account.stripe_id,
                        expand=["balance_transaction"],
                    )
                    stripe_destination_balance_transaction = cast(
                        stripe_lib.BalanceTransaction,
                        stripe_destination_charge.balance_transaction,
                    )
                    incoming_transaction.account_amount = (
                        stripe_destination_balance_transaction.amount
                    )
                    incoming_transaction.account_currency = (
                        stripe_destination_balance_transaction.currency
                    )
                    typer.echo(
                        f"Different currency: {source_currency}/{destination_currency}: "
                        f"{transfer.amount}/{incoming_transaction.account_amount}"
                    )

                transfer_metadata = {
                    "outgoing_transaction_id": str(outgoing_transaction.id),
                    "incoming_transaction_id": str(incoming_transaction.id),
                    "pledge_id": str(transfer.pledge_id),
                    "issue_reward_id": str(transfer.issue_reward_id),
                    **(
                        {"stripe_payment_id": pledge.payment_id}
                        if pledge.payment_id
                        else {}
                    ),
                }
                stripe_lib.Transfer.modify(
                    stripe_transfer.id, metadata=transfer_metadata
                )

                session.add(outgoing_transaction)
                session.add(incoming_transaction)

                typer.secho(
                    f"Created outgoing/incoming transaction {outgoing_transaction.id}/{incoming_transaction.id}",
                    fg="green",
                )

                typer.echo("\n---\n")

            typer.secho("HANDLING PAYOUTS", bg="green")
            accounts_statement = select(Account).where(
                Account.account_type == AccountType.stripe,
                Account.stripe_id.is_not(None),
            )
            accounts_result = await session.execute(accounts_statement)
            for account in accounts_result.scalars().all():
                typer.echo(f"Account {account.id}")
                assert account.stripe_id is not None
                payouts_params: stripe_lib.Payout.ListParams = {
                    "limit": 100,
                    "stripe_account": account.stripe_id,
                }
                payout_result = stripe_lib.Payout.list(**payouts_params)
                for payout in payout_result.auto_paging_iter():
                    payout_transaction = (
                        await payout_transaction_service.create_payout_from_stripe(
                            session,
                            payout=payout,
                            stripe_account_id=account.stripe_id,
                        )
                    )
                    payout_transaction.created_at = datetime.datetime.fromtimestamp(
                        payout.created, tz=datetime.UTC
                    )
                    session.add(payout_transaction)
                    typer.secho(
                        f"Created payout transaction {payout_transaction.id}",
                        fg="green",
                    )

                typer.echo("\n---\n")

            await session.commit()

            typer.echo("\n---\n")

            if dry_run:
                await transaction.rollback()
                typer.echo(
                    typer.style(
                        "Dry run, changes were not saved to the DB", fg="yellow"
                    )
                )


if __name__ == "__main__":
    cli()
