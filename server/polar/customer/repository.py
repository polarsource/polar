from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositoryIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Customer


class CustomerRepository(
    RepositoryBase[Customer],
    RepositorySoftDeletionMixin[Customer],
    RepositoryIDMixin[Customer, UUID],
):
    model = Customer
