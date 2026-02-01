import datetime
import uuid
from collections.abc import AsyncIterable, Sequence
from typing import Any, cast

import stripe as stripe_lib
import structlog

from polar.auth.models import AuthSubject, User
from polar.config import settings
from polar.enums import AccountType
from polar.eventstream.service import publish as eventstream_publish
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.invoice.service import invoice as invoice_service
from polar.kit.csv import IterableCSVWriter
from polar.kit.db.postgres import AsyncSessionMaker
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.locker import Locker
from polar.logging import Logger
from polar.models import Account, Payout
from polar.models.payout import PayoutStatus
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from polar.transaction.repository import (
    PayoutTransactionRepository,
    TransactionRepository,
)
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
from .schemas import PayoutEstimate, PayoutGenerateInvoice, PayoutInvoice
from .sorting import PayoutSortProperty

log: Logger = structlog.get_logger()


class PayoutError(PolarError): ...


class InsufficientBalance(PayoutError):
    def __init__(self, account: Account, balance: int) -> None:
        self.account = account
        self.balance = balance
        message = "You have an insufficient balance to make a payout."
        super().__init__(message, 400)


class UnderReviewAccount(PayoutError):
    def __init__(self, account: Account) -> None:
        self.account = account
        message = "Your account is under review and can't receive payouts."
        super().__init__(message, 403)


class NotReadyAccount(PayoutError):
    def __init__(self, account: Account) -> None:
        self.account = account
        message = "Your payout account is not ready yet. Complete the setup to receive payouts."
        super().__init__(message, 403)


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


class InvoiceAlreadyExists(PayoutError):
    def __init__(self, payout: Payout) -> None:
        self.payout = payout
        message = f"An invoice already exists for payout {payout.id}."
        super().__init__(message, 409)


class PayoutNotSucceeded(PayoutError):
    def __init__(self, payout: Payout) -> None:
        self.payout = payout
        message = (
            f"Can't generate an invoice for payout {payout.id} because "
            "it has not succeeded yet."
        )
        super().__init__(message, 400)


class MissingInvoiceBillingDetails(PayoutError):
    def __init__(self, payout: Payout) -> None:
        self.payout = payout
        message = (
            "You must provide billing details for the account to generate an invoice."
        )
        super().__init__(message, 400)


class InvoiceDoesNotExist(PayoutError):
    def __init__(self, payout: Payout) -> None:
        self.payout = payout
        message = f"Invoice does not exist for payout {payout.id}."
        super().__init__(message, 404)


class PayoutAlreadyTriggered(PayoutError):
    def __init__(self, payout: Payout) -> None:
        self.payout = payout
        message = f"Payout {payout.id} has already been triggered."
        super().__init__(message)


class PayoutService:
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        account_id: Sequence[uuid.UUID] | None = None,
        status: Sequence[PayoutStatus] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[PayoutSortProperty]] = [
            (PayoutSortProperty.created_at, False)
        ],
    ) -> tuple[Sequence[Payout], int]:
        repository = PayoutRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).options(
            *repository.get_eager_options()
        )

        if account_id is not None:
            statement = statement.where(Payout.account_id.in_(account_id))

        if status is not None:
            statement = statement.where(Payout.status.in_(status))

        statement = repository.apply_sorting(statement, sorting)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

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
        if balance_amount < settings.get_minimum_payout_for_currency(account.currency):
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

        async with locker.lock(lock_name, timeout=60, blocking_timeout=1):
            if account.is_under_review():
                raise UnderReviewAccount(account)
            if not account.is_payout_ready():
                raise NotReadyAccount(account)

            balance_amount = await transaction_service.get_transactions_sum(
                session, account.id
            )
            if balance_amount < settings.get_minimum_payout_for_currency(
                account.currency
            ):
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
                    fees_amount=balance_amount - balance_amount_after_fees,
                    account_currency=account.currency,
                    account_amount=balance_amount_after_fees,
                    account=account,
                    invoice_number=await self._get_next_invoice_number(
                        session, account
                    ),
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

    async def transfer_stripe(self, session: AsyncSession, payout: Payout) -> Payout:
        """
        The Stripe payout is a two-steps process:

        1. Make the transfer to the Stripe Connect account
        2. Trigger a payout on the Stripe Connect account,
        but later once the balance is actually available.

        This function performs the first step.
        """
        account = payout.account
        assert account.stripe_id is not None

        payout_transaction_repository = PayoutTransactionRepository.from_session(
            session
        )
        transaction = await payout_transaction_repository.get_by_payout_id(payout.id)
        assert transaction is not None

        stripe_transfer = await stripe_service.transfer(
            account.stripe_id,
            payout.amount,
            metadata={
                "payout_id": str(payout.id),
                "payout_transaction_id": str(transaction.id),
            },
            idempotency_key=f"payout-{payout.id}",
        )

        transaction.transfer_id = stripe_transfer.id

        # Different source and destination currencies: get the converted amount
        account_amount = payout.account_amount
        if transaction.currency != transaction.account_currency:
            assert stripe_transfer.destination_payment is not None
            stripe_destination_charge = await stripe_service.get_charge(
                get_expandable_id(stripe_transfer.destination_payment),
                stripe_account=account.stripe_id,
                expand=["balance_transaction"],
            )
            # Case where the charge don't lead to a balance transaction,
            # e.g. when the converted amount is 0
            if stripe_destination_charge.balance_transaction is None:
                account_amount = 0
            else:
                stripe_destination_balance_transaction = cast(
                    stripe_lib.BalanceTransaction,
                    stripe_destination_charge.balance_transaction,
                )
                account_amount = stripe_destination_balance_transaction.amount

        await payout_transaction_repository.update(
            transaction,
            update_dict={
                "account_amount": -account_amount,
                "transfer_id": stripe_transfer.id,
            },
        )

        payout_repository = PayoutRepository.from_session(session)
        payout = await payout_repository.update(
            payout, update_dict={"account_amount": account_amount}
        )

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
        update_dict: dict[str, Any] = {"status": status}
        if status == PayoutStatus.succeeded and stripe_payout.arrival_date is not None:
            update_dict["paid_at"] = datetime.datetime.fromtimestamp(
                stripe_payout.arrival_date, datetime.UTC
            )
        return await repository.update(payout, update_dict=update_dict)

    async def trigger_stripe_payouts(self, session: AsyncSession) -> None:
        """
        The Stripe payout is a two-steps process:

        1. Make the transfer to the Stripe Connect account.
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
        if payout.processor_id is not None:
            raise PayoutAlreadyTriggered(payout)

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

    async def trigger_invoice_generation(
        self,
        session: AsyncSession,
        payout: Payout,
        payout_generate_invoice: PayoutGenerateInvoice,
    ) -> Payout:
        if payout.is_invoice_generated:
            raise InvoiceAlreadyExists(payout)

        if payout.status != PayoutStatus.succeeded:
            raise PayoutNotSucceeded(payout)

        account = payout.account
        if account.billing_name is None or account.billing_address is None:
            raise MissingInvoiceBillingDetails(payout)

        repository = PayoutRepository.from_session(session)
        if payout_generate_invoice.invoice_number is not None:
            existing_payout = await repository.get_by_account_and_invoice_number(
                account.id, payout_generate_invoice.invoice_number
            )
            if existing_payout is not None and existing_payout.id != payout.id:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "invoice_number"),
                            "msg": "An invoice with this number already exists.",
                            "input": payout_generate_invoice.invoice_number,
                        }
                    ]
                )
            payout = await repository.update(
                payout,
                update_dict={"invoice_number": payout_generate_invoice.invoice_number},
            )

        enqueue_job("payout.invoice", payout_id=payout.id)

        return payout

    async def generate_invoice(self, session: AsyncSession, payout: Payout) -> Payout:
        invoice_path = await invoice_service.create_payout_invoice(session, payout)
        repository = PayoutRepository.from_session(session)
        payout = await repository.update(
            payout, update_dict={"invoice_path": invoice_path}
        )

        organization_repository = OrganizationRepository.from_session(session)
        account_organizations = await organization_repository.get_all_by_account(
            payout.account_id
        )
        for organization in account_organizations:
            await eventstream_publish(
                "payout.invoice_generated",
                {"payout_id": payout.id},
                organization_id=organization.id,
            )

        return payout

    async def get_invoice(self, payout: Payout) -> PayoutInvoice:
        if not payout.is_invoice_generated:
            raise InvoiceDoesNotExist(payout)

        url, _ = await invoice_service.get_payout_invoice_url(payout)
        return PayoutInvoice(url=url)

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

        transaction_repository = TransactionRepository.from_session(session)
        statement = transaction_repository.get_paid_transactions_statement(
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
            transactions = await sub_session.stream_scalars(
                statement,
                execution_options={"yield_per": settings.DATABASE_STREAM_YIELD_PER},
            )
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
                    description = transaction.order.description

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

    async def _get_next_invoice_number(
        self, session: AsyncSession, account: Account, increment: int = 1
    ) -> str:
        repository = PayoutRepository.from_session(session)
        payouts_count = await repository.count_by_account(account.id)
        invoice_number = (
            f"{settings.PAYOUT_INVOICES_PREFIX}{payouts_count + increment:04d}"
        )
        existing_payout = await repository.get_by_account_and_invoice_number(
            account.id, invoice_number
        )
        if existing_payout is not None:
            return await self._get_next_invoice_number(
                session, account, increment=increment + 1
            )
        return invoice_number


payout = PayoutService()
