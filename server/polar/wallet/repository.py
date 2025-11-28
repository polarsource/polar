from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositoryIDMixin,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import Customer, UserOrganization, Wallet, WalletTransaction
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
        self, type: WalletType, currency: str, customer_id: UUID
    ) -> Wallet | None:
        statement = self.get_base_statement().where(
            Wallet.type == type,
            Wallet.currency == currency,
            Wallet.customer_id == customer_id,
        )
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Wallet]]:
        statement = (
            self.get_base_statement()
            .join(Customer, Wallet.customer_id == Customer.id)
            .options(
                contains_eager(Wallet.customer).joinedload(Customer.organization),
            )
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Customer.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Customer.organization_id == auth_subject.subject.id,
            )

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
