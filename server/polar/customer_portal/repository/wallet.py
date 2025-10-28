from uuid import UUID

from sqlalchemy import Select
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import Customer, Wallet

from ..sorting.wallet import CustomerWalletSortProperty


class CustomerWalletRepository(
    RepositorySortingMixin[Wallet, CustomerWalletSortProperty],
    RepositorySoftDeletionIDMixin[Wallet, UUID],
    RepositorySoftDeletionMixin[Wallet],
    RepositoryBase[Wallet],
):
    model = Wallet

    def get_readable_statement(
        self, auth_subject: AuthSubject[Customer]
    ) -> Select[tuple[Wallet]]:
        return self.get_base_statement().where(
            Wallet.customer_id == auth_subject.subject.id
        )

    def get_eager_options(self) -> Options:
        return (joinedload(Wallet.customer).joinedload(Customer.organization),)

    def get_sorting_clause(self, property: CustomerWalletSortProperty) -> SortingClause:
        match property:
            case CustomerWalletSortProperty.created_at:
                return Wallet.created_at
            case CustomerWalletSortProperty.balance:
                return Wallet.balance
