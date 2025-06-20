from uuid import UUID

from sqlalchemy import Select

from polar.auth.models import AuthSubject, Customer
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import PaymentMethod


class CustomerPaymentMethodRepository(
    RepositorySoftDeletionIDMixin[PaymentMethod, UUID],
    RepositorySoftDeletionMixin[PaymentMethod],
    RepositoryBase[PaymentMethod],
):
    model = PaymentMethod

    def get_readable_statement(
        self, auth_subject: AuthSubject[Customer]
    ) -> Select[tuple[PaymentMethod]]:
        return self.get_base_statement().where(
            PaymentMethod.customer_id == auth_subject.subject.id
        )
