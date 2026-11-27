import uuid
from collections.abc import Sequence

from polar.auth.models import AuthSubject, Organization, User
from polar.authz.service import get_accessible_org_ids
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.models import Customer, Order, Wallet, WalletTransaction
from polar.models.wallet import WalletType
from polar.postgres import AsyncReadSession, AsyncSession
from polar.tax.calculation import TaxBreakdownItem

from .repository import WalletRepository, WalletTransactionRepository
from .sorting import WalletSortProperty


class WalletService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        type: Sequence[WalletType] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        external_customer_id: Sequence[str] | None = None,
        pagination: PaginationParams,
        sorting: Sequence[Sorting[WalletSortProperty]] = (
            (WalletSortProperty.created_at, True),
        ),
    ) -> tuple[Sequence[Wallet], int]:
        repository = WalletRepository.from_session(session)
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = repository.get_statement_by_org_ids(org_ids)

        if organization_id is not None:
            statement = statement.where(Customer.organization_id.in_(organization_id))

        if type is not None:
            statement = statement.where(Wallet.type.in_(type))

        if customer_id is not None:
            statement = statement.where(Customer.id.in_(customer_id))

        if external_customer_id is not None:
            statement = statement.where(Customer.external_id.in_(external_customer_id))

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
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = repository.get_statement_by_org_ids(org_ids).where(Wallet.id == id)
        return await repository.get_one_or_none(statement)

    async def create_transaction(
        self,
        session: AsyncSession,
        wallet: Wallet,
        amount: int,
        *,
        tax_amount: int | None = None,
        tax_breakdown: Sequence[TaxBreakdownItem] | None = None,
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
                tax_breakdown=tax_breakdown,
                tax_calculation_processor_id=tax_calculation_processor_id,
                order=order,
            ),
            flush=flush,
        )

    async def get_billing_wallet_balance(
        self,
        session: AsyncSession,
        customer: Customer,
        currency: str,
        *,
        for_update: bool = False,
    ) -> int:
        repository = WalletRepository.from_session(session)
        wallet = await repository.get_by_type_currency_customer(
            WalletType.billing, currency, customer.id, for_update=for_update
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
