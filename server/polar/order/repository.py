from collections.abc import Sequence
from typing import TYPE_CHECKING, cast
from uuid import UUID

from sqlalchemy import CursorResult, Select, case, select, update
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.strategy_options import selectinload

from polar.auth.models import (
    AuthSubject,
    Organization,
    User,
    is_customer,
    is_organization,
    is_user,
)
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    Discount,
    Order,
    OrderItem,
    Product,
    ProductPrice,
    Subscription,
    UserOrganization,
)
from polar.models.order import OrderStatus

from .sorting import OrderSortProperty

if TYPE_CHECKING:
    from sqlalchemy.orm.strategy_options import _AbstractLoad


class OrderRepository(
    RepositorySortingMixin[Order, OrderSortProperty],
    RepositorySoftDeletionIDMixin[Order, UUID],
    RepositorySoftDeletionMixin[Order],
    RepositoryBase[Order],
):
    model = Order

    async def get_all_by_customer(
        self,
        customer_id: UUID,
        *,
        status: OrderStatus | None = None,
        options: Options = (),
    ) -> Sequence[Order]:
        statement = (
            self.get_base_statement()
            .where(Order.customer_id == customer_id)
            .options(*options)
        )
        if status is not None:
            statement = statement.where(Order.status == status)
        return await self.get_all(statement)

    async def get_by_stripe_invoice_id(
        self, stripe_invoice_id: str, *, options: Options = ()
    ) -> Order | None:
        statement = (
            self.get_base_statement()
            .where(Order.stripe_invoice_id == stripe_invoice_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_earliest_by_checkout_id(
        self, checkout_id: UUID, *, options: Options = ()
    ) -> Order | None:
        statement = (
            self.get_base_statement()
            .where(Order.checkout_id == checkout_id)
            .order_by(Order.created_at.asc())
            .limit(1)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_due_dunning_orders(self, *, options: Options = ()) -> Sequence[Order]:
        """Get orders that are due for dunning retry based on next_payment_attempt_at."""

        statement = (
            self.get_base_statement()
            .where(
                Order.next_payment_attempt_at.is_not(None),
                Order.next_payment_attempt_at <= utc_now(),
            )
            .order_by(Order.next_payment_attempt_at.asc())
            .options(*options)
        )
        return await self.get_all(statement)

    async def acquire_payment_lock_by_id(self, order_id: UUID) -> bool:
        """
        Internal method to acquire a payment lock by order ID.
        This is the original acquire_payment_lock logic.

        Returns:
            True if lock was acquired, False if already locked
        """
        statement = (
            update(Order)
            .where(Order.id == order_id, Order.payment_lock_acquired_at.is_(None))
            .values(payment_lock_acquired_at=utc_now())
        )

        # https://github.com/sqlalchemy/sqlalchemy/commit/67f62aac5b49b6d048ca39019e5bd123d3c9cfb2
        result = cast(CursorResult[Order], await self.session.execute(statement))
        return result.rowcount > 0

    async def release_payment_lock(self, order: Order, *, flush: bool = False) -> Order:
        """Release a payment lock for an order."""
        return await self.update(
            order, update_dict={"payment_lock_acquired_at": None}, flush=flush
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization | Customer]
    ) -> Select[tuple[Order]]:
        statement = self.get_base_statement().join(
            Customer, Order.customer_id == Customer.id
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
        elif is_customer(auth_subject):
            customer = auth_subject.subject
            statement = statement.where(
                Order.customer_id == customer.id,
                Order.deleted_at.is_(None),
            )

        return statement

    def get_eager_options(
        self,
        *,
        customer_load: "_AbstractLoad | None" = None,
        product_load: "_AbstractLoad | None" = None,
        discount_load: "_AbstractLoad | None" = None,
    ) -> Options:
        return (
            customer_load
            if customer_load
            else joinedload(Order.customer).joinedload(Customer.organization),
            discount_load if discount_load else joinedload(Order.discount),
            product_load if product_load else joinedload(Order.product),
            joinedload(Order.subscription).joinedload(Subscription.customer),
            selectinload(Order.items)
            .joinedload(OrderItem.product_price)
            .joinedload(ProductPrice.product),
        )

    def get_sorting_clause(self, property: OrderSortProperty) -> SortingClause:
        match property:
            case OrderSortProperty.created_at:
                return Order.created_at
            case OrderSortProperty.status:
                return case(
                    (Order.status == OrderStatus.pending, 1),
                    (Order.status == OrderStatus.paid, 2),
                    (Order.status == OrderStatus.refunded, 3),
                    (Order.status == OrderStatus.partially_refunded, 4),
                )
            case OrderSortProperty.invoice_number:
                return Order.invoice_number
            case OrderSortProperty.amount | OrderSortProperty.net_amount:
                return Order.net_amount
            case OrderSortProperty.customer:
                return Customer.email
            case OrderSortProperty.product:
                return Product.name
            case OrderSortProperty.discount:
                return Discount.name
            case OrderSortProperty.subscription:
                return Order.subscription_id
