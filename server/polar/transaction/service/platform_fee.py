import datetime
from uuid import UUID

import structlog
from sqlalchemy import select

from polar.account.repository import AccountRepository
from polar.enums import AccountType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.logging import Logger
from polar.models import Account, Transaction
from polar.models.transaction import PlatformFeeType, Processor, TransactionType
from polar.postgres import AsyncSession
from polar.transaction.fees.stripe import (
    get_reverse_stripe_payout_fees,
    get_stripe_account_fee,
    get_stripe_international_fee,
    get_stripe_invoice_fee,
    get_stripe_subscription_fee,
)

from .balance import balance_transaction as balance_transaction_service
from .base import BaseTransactionService, BaseTransactionServiceError

log: Logger = structlog.get_logger()


class PlatformFeeTransactionError(BaseTransactionServiceError): ...


class PayoutAmountTooLow(PlatformFeeTransactionError):
    def __init__(self, balance_amount: int) -> None:
        self.balance_amount = balance_amount
        message = "Fees are higher than the amount to be paid out."
        super().__init__(message)


class PlatformFeeTransactionService(BaseTransactionService):
    async def create_fees_reversal_balances(
        self,
        session: AsyncSession,
        *,
        balance_transactions: tuple[Transaction, Transaction],
    ) -> list[tuple[Transaction, Transaction]]:
        return await self._create_payment_fees(
            session, balance_transactions=balance_transactions
        )

    async def create_dispute_fees_balances(
        self,
        session: AsyncSession,
        *,
        dispute_fees: list[Transaction],
        balance_transactions: tuple[Transaction, Transaction],
    ) -> list[tuple[Transaction, Transaction]]:
        outgoing, incoming = balance_transactions

        fees_balances: list[tuple[Transaction, Transaction]] = []
        for dispute_fee in dispute_fees:
            fee_balances = await balance_transaction_service.create_reversal_balance(
                session,
                balance_transactions=balance_transactions,
                amount=-dispute_fee.amount,
                platform_fee_type=PlatformFeeType.dispute,
                outgoing_incurred_by=incoming,
                incoming_incurred_by=outgoing,
            )
            fees_balances.append(fee_balances)

        return fees_balances

    async def get_payout_fees(
        self, session: AsyncSession, *, account: Account, balance_amount: int
    ) -> list[tuple[PlatformFeeType, int]]:
        if not account.processor_fees_applicable:
            return []

        if account.account_type != AccountType.stripe:
            return []

        payout_fees: list[tuple[PlatformFeeType, int]] = []

        last_payout = await self._get_last_payout(session, account)
        if last_payout is None:
            account_fee_amount = get_stripe_account_fee()
            balance_amount -= account_fee_amount
            payout_fees.append((PlatformFeeType.account, account_fee_amount))

        try:
            transfer_fee_amount, payout_fee_amount = get_reverse_stripe_payout_fees(
                balance_amount, account.country
            )
        except ValueError as e:
            raise PayoutAmountTooLow(balance_amount) from e

        if transfer_fee_amount > 0:
            payout_fees.append(
                (PlatformFeeType.cross_border_transfer, transfer_fee_amount)
            )

        if payout_fee_amount > 0:
            payout_fees.append((PlatformFeeType.payout, payout_fee_amount))

        return payout_fees

    async def create_payout_fees_balances(
        self, session: AsyncSession, *, account: Account, balance_amount: int
    ) -> tuple[int, list[tuple[Transaction, Transaction]]]:
        payout_fees = await self.get_payout_fees(
            session, account=account, balance_amount=balance_amount
        )

        payout_fees_balances: list[tuple[Transaction, Transaction]] = []
        for payout_fee_type, fee_amount in payout_fees:
            fee_balances = await balance_transaction_service.create_balance(
                session,
                source_account=account,
                destination_account=None,
                amount=fee_amount,
                platform_fee_type=payout_fee_type,
            )
            payout_fees_balances.append(fee_balances)
            balance_amount -= fee_amount

        return balance_amount, payout_fees_balances

    async def _create_payment_fees(
        self,
        session: AsyncSession,
        *,
        balance_transactions: tuple[Transaction, Transaction],
    ) -> list[tuple[Transaction, Transaction]]:
        outgoing, incoming = balance_transactions

        assert incoming.account_id is not None
        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_id(incoming.account_id)
        assert account is not None

        total_amount = incoming.amount + incoming.tax_amount
        fees_balances: list[tuple[Transaction, Transaction]] = []

        # Payment fee
        fee_amount = account.calculate_fee_in_cents(total_amount)
        fee_balances = await balance_transaction_service.create_reversal_balance(
            session,
            balance_transactions=balance_transactions,
            amount=fee_amount,
            platform_fee_type=PlatformFeeType.payment,
            outgoing_incurred_by=incoming,
            incoming_incurred_by=outgoing,
        )
        fees_balances.append(fee_balances)

        # International fee
        if incoming.payment_transaction_id is not None:
            if await self._is_international_payment_transaction(
                session, incoming.payment_transaction_id
            ):
                international_fee_amount = get_stripe_international_fee(total_amount)
                fee_balances = (
                    await balance_transaction_service.create_reversal_balance(
                        session,
                        balance_transactions=balance_transactions,
                        amount=international_fee_amount,
                        platform_fee_type=PlatformFeeType.international_payment,
                        outgoing_incurred_by=incoming,
                        incoming_incurred_by=outgoing,
                    )
                )
                fees_balances.append(fee_balances)

        # Subscription fee
        if incoming.order_id is not None:
            await session.refresh(incoming, {"order"})
            assert incoming.order is not None
            if incoming.order.subscription_id is not None:
                subscription_fee_amount = get_stripe_subscription_fee(total_amount)
                fee_balances = (
                    await balance_transaction_service.create_reversal_balance(
                        session,
                        balance_transactions=balance_transactions,
                        amount=subscription_fee_amount,
                        platform_fee_type=PlatformFeeType.subscription,
                        outgoing_incurred_by=incoming,
                        incoming_incurred_by=outgoing,
                    )
                )
                fees_balances.append(fee_balances)

        # Invoice fee
        pledge = incoming.pledge
        if pledge is not None and pledge.invoice_id is not None:
            invoice_fee_amount = get_stripe_invoice_fee(total_amount)
            fee_balances = await balance_transaction_service.create_reversal_balance(
                session,
                balance_transactions=balance_transactions,
                amount=invoice_fee_amount,
                platform_fee_type=PlatformFeeType.invoice,
                outgoing_incurred_by=incoming,
                incoming_incurred_by=outgoing,
            )
            fees_balances.append(fee_balances)

        return fees_balances

    async def _is_international_payment_transaction(
        self, session: AsyncSession, payment_transaction_id: UUID
    ) -> bool:
        """
        Check if the payment transaction is an international payment.

        Currently, we only check if the payment was made using Stripe
        and the card is not from the US.
        """
        payment_transaction = await self.get(session, payment_transaction_id)
        assert payment_transaction is not None

        if payment_transaction.processor != Processor.stripe:
            return False

        if payment_transaction.charge_id is None:
            return False

        charge = await stripe_service.get_charge(payment_transaction.charge_id)

        if (payment_method_details := charge.payment_method_details) is None:
            return False

        if (
            payment_method_details.type == "card"
            and payment_method_details.card is not None
        ):
            return payment_method_details.card.country != "US"

        if (
            payment_method_details.type == "link"
            and payment_method_details.link is not None
        ):
            return payment_method_details.link.country != "US"

        return False

    async def _get_last_payout(
        self, session: AsyncSession, account: Account
    ) -> Transaction | None:
        statement = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.payout,
                Transaction.account_id == account.id,
                Transaction.created_at
                > datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=30),
            )
            .limit(1)
            .order_by(Transaction.created_at.desc())
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()


platform_fee_transaction = PlatformFeeTransactionService(Transaction)
