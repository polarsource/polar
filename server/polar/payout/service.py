import datetime
import uuid
from collections.abc import AsyncIterable

import stripe as stripe_lib
import structlog

from polar.auth.models import AuthSubject, User
from polar.config import settings
from polar.enums import AccountType
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.csv import IterableCSVWriter
from polar.kit.db.postgres import AsyncSessionMaker
from polar.locker import Locker
from polar.logging import Logger
from polar.models import Account, Payout
from polar.models.payout import PayoutStatus
from polar.postgres import AsyncSession
from polar.transaction.repository import PayoutTransactionRepository
from polar.transaction.service.payout import (
    payout_transaction as payout_transaction_service,
)
from polar.transaction.service.platform_fee import PayoutAmountTooLow
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)
from polar.transaction.service.transaction import transaction as transaction_service
from polar.worker import enqueue_job

from .repository import PayoutRepository
from .schemas import PayoutEstimate

log: Logger = structlog.get_logger()


class PayoutError(PolarError): ...


class InsufficientBalance(PayoutError):
    def __init__(self, account: Account, balance: int) -> None:
        self.account = account
        self.balance = balance
        message = (
            f"The account {account.id} has an insufficient balance "
            f"of {balance} to make a payout."
        )
        super().__init__(message)


class UnderReviewAccount(PayoutError):
    def __init__(self, account: Account) -> None:
        self.account = account
        message = f"The account {account.id} is under review and can't receive payouts."
        super().__init__(message)


class NotReadyAccount(PayoutError):
    def __init__(self, account: Account) -> None:
        self.account = account
        message = (
            f"The account {account.id} is not ready."
            f"The owner should go through the onboarding on {account.account_type}"
        )
        super().__init__(message)


class PendingPayoutCreation(PayoutError):
    def __init__(self, account: Account) -> None:
        self.account = account
        message = f"A payout is already being created for the account {account.id}."
        super().__init__(message, 409)


class PayoutDoesNotExist(PayoutError):
    def __init__(self, payout_id: str) -> None:
        self.payout_id = payout_id
        message = (
            f"Received payout {payout_id} from Stripe, "
            "but it's not associated to a Payout."
        )
        super().__init__(message, 404)


class PayoutService:
    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        id: uuid.UUID,
    ) -> Payout | None:
        repository = PayoutRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Payout.id == id)
            .options(*repository.get_eager_options())
        )
        return await repository.get_one_or_none(statement)

    async def estimate(
        self, session: AsyncSession, *, account: Account
    ) -> PayoutEstimate:
        if account.is_under_review():
            raise UnderReviewAccount(account)
        if not account.is_payout_ready():
            raise NotReadyAccount(account)

        balance_amount = await transaction_service.get_transactions_sum(
            session, account.id
        )
        if balance_amount < settings.ACCOUNT_PAYOUT_MINIMUM_BALANCE:
            raise InsufficientBalance(account, balance_amount)

        try:
            payout_fees = await platform_fee_transaction_service.get_payout_fees(
                session, account=account, balance_amount=balance_amount
            )
        except PayoutAmountTooLow as e:
            raise InsufficientBalance(account, balance_amount) from e

        return PayoutEstimate(
            account_id=account.id,
            gross_amount=balance_amount,
            fees_amount=sum(fee for _, fee in payout_fees),
            net_amount=balance_amount - sum(fee for _, fee in payout_fees),
        )

    async def create(
        self, session: AsyncSession, locker: Locker, *, account: Account
    ) -> Payout:
        lock_name = f"payout:{account.id}"
        if await locker.is_locked(lock_name):
            raise PendingPayoutCreation(account)

        async with locker.lock(
            lock_name,
            # Creating a payout may take lot of time because of individual Stripe transfers
            timeout=datetime.timedelta(hours=1).total_seconds(),
            blocking_timeout=1,
        ):
            if account.is_under_review():
                raise UnderReviewAccount(account)
            if not account.is_payout_ready():
                raise NotReadyAccount(account)

            balance_amount = await transaction_service.get_transactions_sum(
                session, account.id
            )
            if balance_amount < settings.ACCOUNT_PAYOUT_MINIMUM_BALANCE:
                raise InsufficientBalance(account, balance_amount)

            try:
                (
                    balance_amount_after_fees,
                    payout_fees_balances,
                ) = await platform_fee_transaction_service.create_payout_fees_balances(
                    session, account=account, balance_amount=balance_amount
                )
            except PayoutAmountTooLow as e:
                raise InsufficientBalance(account, balance_amount) from e

            repository = PayoutRepository.from_session(session)
            payout = await repository.create(
                Payout(
                    processor=account.account_type,
                    currency="usd",  # FIXME: Main Polar currency
                    amount=balance_amount_after_fees,
                    account_currency=account.currency,
                    account_amount=balance_amount_after_fees,
                    account=account,
                )
            )
            transaction = await payout_transaction_service.create(
                session, payout, payout_fees_balances
            )

            if payout.currency != payout.account_currency:
                await repository.update(
                    payout,
                    update_dict={"account_amount": -transaction.account_amount},
                )

            enqueue_job("payout.created", payout_id=payout.id)

            return payout

    async def update_from_stripe(
        self, session: AsyncSession, stripe_payout: stripe_lib.Payout
    ) -> Payout:
        repository = PayoutRepository.from_session(session)
        payout = await repository.get_by_processor_id(
            AccountType.stripe, stripe_payout.id
        )
        if payout is None:
            raise PayoutDoesNotExist(stripe_payout.id)

        status = PayoutStatus.from_stripe(stripe_payout.status)
        return await repository.update(payout, update_dict={"status": status})

    async def trigger_stripe_payouts(self, session: AsyncSession) -> None:
        """
        The Stripe payout is a two-steps process:

        1. Transfer the balance transactions to the Stripe Connect account.
        2. Trigger a payout on the Stripe Connect account,
        but later once our safety delay is passed and the balance is actually available.

        This function performs the second step and tries to trigger pending payouts,
        if balance is available.
        """
        repository = PayoutRepository.from_session(session)
        for payout in await repository.get_all_stripe_pending():
            enqueue_job("payout.trigger_stripe_payout", payout_id=payout.id)

    async def trigger_stripe_payout(
        self, session: AsyncSession, payout: Payout
    ) -> Payout:
        assert payout.processor_id is None

        account = payout.account
        assert account.stripe_id is not None
        _, balance = await stripe_service.retrieve_balance(account.stripe_id)

        if balance < payout.account_amount:
            log.info(
                (
                    "The Stripe Connect account doesn't have enough balance "
                    "to make the payout yet"
                ),
                payout_id=str(payout.id),
                account_id=str(account.id),
                balance=balance,
                payout_amount=payout.account_amount,
            )
            return payout

        # Trigger a payout on the Stripe Connect account
        stripe_payout = await stripe_service.create_payout(
            stripe_account=account.stripe_id,
            amount=payout.account_amount,
            currency=payout.account_currency,
            metadata={
                "payout_id": str(payout.id),
            },
        )

        repository = PayoutRepository.from_session(session)
        return await repository.update(
            payout,
            update_dict={"processor_id": stripe_payout.id},
        )

    async def get_csv(
        self, session: AsyncSession, sessionmaker: AsyncSessionMaker, payout: Payout
    ) -> AsyncIterable[str]:
        payout_transaction_repository = PayoutTransactionRepository.from_session(
            session
        )
        payout_transaction = await payout_transaction_repository.get_by_payout_id(
            payout.id
        )
        assert payout_transaction is not None

        statement = payout_transaction_repository.get_paid_transactions_statement(
            payout_transaction.id
        )

        csv_writer = IterableCSVWriter(dialect="excel")
        yield csv_writer.getrow(
            (
                "Date",
                "Payout ID",
                "Transaction ID",
                "Description",
                "Currency",
                "Amount",
                "Payout Total",
                "Account Currency",
                "Account Payout Total",
            )
        )

        # StreamingResponse is running its own async task to exhaust the iterator
        # Thus, rely on the main session generated by the FastAPI dependency leads to
        # garbage collection problems.
        # We create a new session to avoid this.
        async with sessionmaker() as sub_session:
            transactions = await sub_session.stream_scalars(statement)
            async for transaction in transactions:
                description = ""
                if transaction.platform_fee_type is not None:
                    if transaction.platform_fee_type == "platform":
                        description = "Polar fee"
                    else:
                        description = (
                            f"Payment processor fee ({transaction.platform_fee_type})"
                        )
                elif transaction.pledge is not None:
                    description = f"Pledge to {transaction.pledge.issue_reference}"
                elif transaction.order is not None:
                    product = transaction.order.product
                    if transaction.order.subscription_id is not None:
                        description = f"Subscription to {product.name}"
                    else:
                        description = f"Order of {product.name}"

                transaction_id = (
                    str(transaction.id)
                    if transaction.incurred_by_transaction_id is None
                    else str(transaction.incurred_by_transaction_id)
                )

                yield csv_writer.getrow(
                    (
                        transaction.created_at.isoformat(),
                        str(payout.id),
                        transaction_id,
                        description,
                        transaction.currency,
                        transaction.amount / 100,
                        abs(payout.amount / 100),
                        payout.account_currency,
                        abs(payout.account_amount / 100),
                    )
                )


payout = PayoutService()
