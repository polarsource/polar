from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Customer, Order, Subscription, UserOrganization


class OrderRepository(
    RepositorySoftDeletionIDMixin[Order, UUID],
    RepositorySoftDeletionMixin[Order],
    RepositoryBase[Order],
):
    model = Order

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Order]]:
        statement = (
            self.get_base_statement()
            .join(Customer, Order.customer_id == Customer.id)
            .options(contains_eager(Order.customer))
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
        return (
            joinedload(Order.customer),
            joinedload(Order.subscription).joinedload(Subscription.customer),
            joinedload(Order.discount),
        )
