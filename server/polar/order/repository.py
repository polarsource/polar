from collections.abc import Sequence
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.strategy_options import selectinload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    Order,
    OrderItem,
    ProductPrice,
    Subscription,
    UserOrganization,
)

if TYPE_CHECKING:
    from sqlalchemy.orm.strategy_options import _AbstractLoad


class OrderRepository(
    RepositorySoftDeletionIDMixin[Order, UUID],
    RepositorySoftDeletionMixin[Order],
    RepositoryBase[Order],
):
    model = Order

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

    async def acquire_payment_lock(self, order_id: UUID) -> bool:
        """
        Attempt to acquire a payment lock for an order atomically.

        Returns:
            True if lock was acquired, False if already locked
        """
        from sqlalchemy import update

        result = await self.session.execute(
            update(Order)
            .where(Order.id == order_id, Order.payment_lock_acquired_at.is_(None))
            .values(payment_lock_acquired_at=utc_now())
        )
        return result.rowcount > 0

    async def release_payment_lock(self, order_id: UUID) -> None:
        """Release a payment lock for an order."""
        from sqlalchemy import update

        await self.session.execute(
            update(Order)
            .where(Order.id == order_id)
            .values(payment_lock_acquired_at=None)
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
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
