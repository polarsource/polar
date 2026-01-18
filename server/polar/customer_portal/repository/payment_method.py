from uuid import UUID

from sqlalchemy import Select

from polar.auth.models import AuthSubject, Customer, Member
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import PaymentMethod

from ..utils import get_customer_id


class CustomerPaymentMethodRepository(
    RepositorySoftDeletionIDMixin[PaymentMethod, UUID],
    RepositorySoftDeletionMixin[PaymentMethod],
    RepositoryBase[PaymentMethod],
):
    model = PaymentMethod

    def get_readable_statement(
        self, auth_subject: AuthSubject[Customer | Member]
    ) -> Select[tuple[PaymentMethod]]:
        return self.get_base_statement().where(
            PaymentMethod.customer_id == get_customer_id(auth_subject)
        )
