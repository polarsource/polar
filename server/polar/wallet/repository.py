from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.authz.types import AccessibleOrganizationID
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositoryIDMixin,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import Customer, Wallet, WalletTransaction
from polar.models.wallet import WalletType

from .sorting import WalletSortProperty


class WalletRepository(
    RepositorySortingMixin[Wallet, WalletSortProperty],
    RepositorySoftDeletionIDMixin[Wallet, UUID],
    RepositorySoftDeletionMixin[Wallet],
    RepositoryBase[Wallet],
):
    model = Wallet

    async def get_by_type_currency_customer(
        self,
        type: WalletType,
        currency: str,
        customer_id: UUID,
        *,
        for_update: bool = False,
    ) -> Wallet | None:
        statement = self.get_base_statement().where(
            Wallet.type == type,
            Wallet.currency == currency,
            Wallet.customer_id == customer_id,
        )
        if for_update:
            statement = statement.with_for_update()
        return await self.get_one_or_none(statement)

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Wallet]]:
        statement = (
            self.get_base_statement()
            .join(Customer, Wallet.customer_id == Customer.id)
            .options(
                contains_eager(Wallet.customer).joinedload(Customer.organization),
            )
        )
        statement = statement.where(Customer.organization_id.in_(org_ids))
        return statement

    def get_eager_options(self) -> Options:
        return (joinedload(Wallet.customer).joinedload(Customer.organization),)

    def get_sorting_clause(self, property: WalletSortProperty) -> SortingClause:
        match property:
            case WalletSortProperty.created_at:
                return Wallet.created_at
            case WalletSortProperty.balance:
                return Wallet.balance


class WalletTransactionRepository(
    RepositoryIDMixin[WalletTransaction, UUID],
    RepositoryBase[WalletTransaction],
):
    model = WalletTransaction

    async def get_balance(self, wallet_id: UUID) -> int:
        statement = select(func.coalesce(func.sum(WalletTransaction.amount), 0)).where(
            WalletTransaction.wallet_id == wallet_id,
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    def get_eager_options(self) -> Options:
        return (
            joinedload(WalletTransaction.wallet).options(
                joinedload(Wallet.customer).joinedload(Customer.organization)
            ),
        )
