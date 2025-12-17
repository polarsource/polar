import uuid
from collections.abc import Sequence

import stripe as stripe_lib

from polar.auth.models import AuthSubject, Organization, User
from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.tax import TaxCode, calculate_tax
from polar.models import Customer, Order, Wallet, WalletTransaction
from polar.models.payment_method import PaymentMethod
from polar.models.wallet import WalletType
from polar.payment_method.service import payment_method as payment_method_service
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import WalletRepository, WalletTransactionRepository
from .sorting import WalletSortProperty


class WalletError(PolarError): ...


class MissingPaymentMethodError(WalletError):
    def __init__(self, wallet: Wallet) -> None:
        self.wallet = wallet
        message = "No payment method available for the wallet's customer."
        super().__init__(message, 402)


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
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        type: Sequence[WalletType] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[WalletSortProperty]] = [
            (WalletSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Wallet], int]:
        repository = WalletRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(Customer.organization_id.in_(organization_id))

        if type is not None:
            statement = statement.where(Wallet.type.in_(type))

        if customer_id is not None:
            statement = statement.where(Customer.id.in_(customer_id))

        statement = repository.apply_sorting(statement, sorting)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Wallet | None:
        repository = WalletRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            Wallet.id == id
        )
        return await repository.get_one_or_none(statement)

    async def top_up(
        self,
        session: AsyncSession,
        wallet: Wallet,
        amount: int,
        payment_method: PaymentMethod | None = None,
    ) -> WalletTransaction:
        if payment_method is None:
            payment_method = await payment_method_service.get_customer_payment_method(
                session, wallet.customer
            )
            if payment_method is None:
                raise MissingPaymentMethodError(wallet)

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

        transaction = await self.create_transaction(
            session,
            wallet,
            amount,
            tax_amount=tax_amount,
            tax_calculation_processor_id=tax_calculation_processor_id,
            flush=True,
        )
        total_amount = amount + tax_amount

        if payment_method.processor == PaymentProcessor.stripe:
            organization = wallet.organization
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

        # Refresh wallet balance
        await session.flush()
        await session.refresh(wallet, {"balance"})

        return transaction

    async def create_transaction(
        self,
        session: AsyncSession,
        wallet: Wallet,
        amount: int,
        *,
        tax_amount: int | None = None,
        tax_calculation_processor_id: str | None = None,
        order: Order | None = None,
        flush: bool = False,
    ) -> WalletTransaction:
        repository = WalletTransactionRepository(session)
        return await repository.create(
            WalletTransaction(
                currency=wallet.currency,
                amount=amount,
                wallet=wallet,
                tax_amount=tax_amount,
                tax_calculation_processor_id=tax_calculation_processor_id,
                order=order,
            ),
            flush=flush,
        )

    async def get_billing_wallet_balance(
        self, session: AsyncSession, customer: Customer, currency: str
    ) -> int:
        repository = WalletRepository.from_session(session)
        wallet = await repository.get_by_type_currency_customer(
            WalletType.billing, currency, customer.id
        )
        # Small optimization to avoid creating wallet if not existing
        if wallet is None:
            return 0
        await session.refresh(wallet, {"balance"})
        return wallet.balance

    async def get_or_create_billing_wallet(
        self, session: AsyncSession, customer: Customer, currency: str
    ) -> Wallet:
        repository = WalletRepository.from_session(session)
        wallet = await repository.get_by_type_currency_customer(
            WalletType.billing, currency, customer.id
        )
        if wallet is None:
            wallet = await repository.create(
                Wallet(
                    type=WalletType.billing,
                    currency=currency,
                    customer=customer,
                )
            )
        return wallet

    async def create_balance_transaction(
        self,
        session: AsyncSession,
        customer: Customer,
        amount: int,
        currency: str,
        *,
        order: Order | None = None,
    ) -> WalletTransaction:
        wallet = await self.get_or_create_billing_wallet(session, customer, currency)
        return await self.create_transaction(session, wallet, amount, order=order)


wallet = WalletService()
