import uuid

import stripe as stripe_lib

from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.tax import TaxCode, calculate_tax
from polar.models import Customer, Refund, Wallet, WalletTransaction
from polar.models.payment_method import PaymentMethod
from polar.models.wallet_transaction import WalletTransactionType
from polar.postgres import AsyncSession

from .repository import WalletRepository, WalletTransactionRepository


class WalletError(PolarError): ...


class WalletAlreadyExistsError(WalletError):
    def __init__(self, customer: Customer) -> None:
        self.customer = customer
        message = "A wallet already exists for this customer."
        super().__init__(message, 409)


class InvalidPaymentMethodError(WalletError):
    def __init__(self, wallet: Wallet, payment_method: PaymentMethod) -> None:
        self.wallet = wallet
        self.payment_method = payment_method
        message = "The payment method does not belong to the wallet's customer."
        super().__init__(message, 403)


class PaymentIntentFailedError(WalletError):
    def __init__(
        self, wallet: Wallet, payment_intent: stripe_lib.PaymentIntent
    ) -> None:
        self.wallet = wallet
        self.payment_intent = payment_intent
        message = "Payment failed."
        super().__init__(message, 400)


class WalletService:
    async def create(self, session: AsyncSession, customer: Customer) -> Wallet:
        repository = WalletRepository(session)

        if await repository.get_by_customer(customer.id) is not None:
            raise WalletAlreadyExistsError(customer)

        return await repository.create(
            Wallet(
                customer=customer,
                currency="usd",  # FIXME: Main Polar currency
            )
        )

    async def top_up(
        self,
        session: AsyncSession,
        wallet: Wallet,
        amount: int,
        payment_method: PaymentMethod,
    ) -> WalletTransaction:
        if payment_method.customer != wallet.customer:
            raise InvalidPaymentMethodError(wallet, payment_method)

        customer = wallet.customer
        billing_address = customer.billing_address

        # Calculate tax
        tax_amount = 0
        tax_calculation_processor_id: str | None = None
        if billing_address is not None:
            tax_id = customer.tax_id
            tax_calculation = await calculate_tax(
                f"top_up:{wallet.id}:{uuid.uuid4()}",
                wallet.currency,
                amount,
                TaxCode.general_electronically_supplied_services,
                billing_address,
                [tax_id] if tax_id is not None else [],
                False,
            )
            tax_calculation_processor_id = tax_calculation["processor_id"]
            tax_amount = tax_calculation["amount"]

        transaction = await self.credit(
            session,
            wallet,
            amount,
            tax_amount=tax_amount,
            tax_calculation_processor_id=tax_calculation_processor_id,
            flush=True,
        )
        total_amount = amount + tax_amount

        if payment_method.processor == PaymentProcessor.stripe:
            organization = wallet.customer.organization
            assert customer.stripe_customer_id is not None
            payment_intent = await stripe_service.create_payment_intent(
                amount=total_amount,
                currency=wallet.currency,
                payment_method=payment_method.processor_id,
                customer=customer.stripe_customer_id,
                confirm=True,
                off_session=True,
                statement_descriptor_suffix=organization.statement_descriptor(),
                description=f"{organization.name} — Wallet Top-Up",
                metadata={
                    "customer_id": str(wallet.customer.id),
                    "wallet_id": str(wallet.id),
                    "wallet_transaction_id": str(transaction.id),
                },
            )

            if payment_intent.status != "succeeded":
                raise PaymentIntentFailedError(wallet, payment_intent)

        return transaction

    async def credit(
        self,
        session: AsyncSession,
        wallet: Wallet,
        amount: int,
        *,
        tax_amount: int | None = None,
        tax_calculation_processor_id: str | None = None,
        flush: bool = False,
    ) -> WalletTransaction:
        repository = WalletTransactionRepository(session)
        return await repository.create(
            WalletTransaction(
                type=WalletTransactionType.credit,
                currency=wallet.currency,
                amount=amount,
                wallet=wallet,
                tax_amount=tax_amount,
                tax_calculation_processor_id=tax_calculation_processor_id,
            ),
            flush=flush,
        )

    async def debit(
        self, session: AsyncSession, wallet: Wallet, amount: int
    ) -> WalletTransaction:
        repository = WalletTransactionRepository(session)

        current_balance = await repository.get_balance(wallet.id)
        amount = min(amount, current_balance)  # Prevent going negative

        return await repository.create(
            WalletTransaction(
                type=WalletTransactionType.debit,
                currency=wallet.currency,
                amount=-amount,
                wallet=wallet,
            ),
        )

    async def refund(
        self, session: AsyncSession, wallet: Wallet, refund: Refund
    ) -> WalletTransaction:
        repository = WalletTransactionRepository(session)

        current_balance = await repository.get_balance(wallet.id)
        amount = min(refund.amount, current_balance)  # Prevent going negative

        return await repository.create(
            WalletTransaction(
                type=WalletTransactionType.refund,
                currency=wallet.currency,
                amount=-amount,
                wallet=wallet,
                order=refund.order,
                refund=refund,
            ),
        )


wallet = WalletService()
