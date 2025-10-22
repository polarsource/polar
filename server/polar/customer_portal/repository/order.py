from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Select
from sqlalchemy.orm import joinedload, selectinload

from polar.auth.models import AuthSubject
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import (
    Customer,
    Order,
    OrderItem,
    Product,
    ProductPrice,
    Subscription,
)

if TYPE_CHECKING:
    from sqlalchemy.orm.strategy_options import _AbstractLoad


class CustomerOrderRepository(
    RepositorySoftDeletionIDMixin[Order, UUID],
    RepositorySoftDeletionMixin[Order],
    RepositoryBase[Order],
):
    model = Order

    def get_readable_statement(
        self, auth_subject: AuthSubject[Customer]
    ) -> Select[tuple[Order]]:
        return self.get_base_statement().where(
            Order.customer_id == auth_subject.subject.id
        )

    def get_eager_options(
        self, *, product_load: "_AbstractLoad | None" = None
    ) -> Options:
        if product_load is None:
            product_load = joinedload(Order.product)
        return (
            joinedload(Order.customer).joinedload(Customer.organization),
            joinedload(Order.discount),
            joinedload(Order.subscription).joinedload(Subscription.customer),
            product_load.options(
                selectinload(Product.product_medias),
                joinedload(Product.organization),
            ),
            selectinload(Order.items)
            .joinedload(OrderItem.product_price)
            .joinedload(ProductPrice.product),
        )
