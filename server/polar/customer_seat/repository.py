from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase
from polar.kit.repository.base import Options
from polar.models import (
    Customer,
    CustomerSeat,
    Order,
    Product,
    Subscription,
    UserOrganization,
)
from polar.models.customer_seat import SeatStatus
from polar.order.repository import OrderRepository
from polar.subscription.repository import SubscriptionRepository

SeatContainer = Subscription | Order


class CustomerSeatRepository(RepositoryBase[CustomerSeat]):
    model = CustomerSeat

    async def list_by_container(
        self, container: SeatContainer, *, options: Options = ()
    ) -> Sequence[CustomerSeat]:
        """List seats for a subscription or order."""
        if isinstance(container, Subscription):
            return await self.list_by_subscription_id(container.id, options=options)
        else:
            return await self.list_by_order_id(container.id, options=options)

    async def get_available_seats_count_for_container(
        self, container: SeatContainer
    ) -> int:
        """Get available seats count for a subscription or order."""
        if isinstance(container, Subscription):
            return await self.get_available_seats_count(container.id)
        else:
            return await self.get_available_seats_count_for_order(container.id)

    async def get_by_container_and_customer(
        self,
        container: SeatContainer,
        customer_id: UUID,
        *,
        options: Options = (),
    ) -> CustomerSeat | None:
        if isinstance(container, Subscription):
            return await self.get_by_subscription_and_customer(
                container.id, customer_id, options=options
            )
        else:
            return await self.get_by_order_and_customer(
                container.id, customer_id, options=options
            )

    async def get_revoked_seat_by_container(
        self,
        container: SeatContainer,
        *,
        options: Options = (),
    ) -> CustomerSeat | None:
        if isinstance(container, Subscription):
            return await self.get_revoked_seat_by_subscription(
                container.id, options=options
            )
        else:
            return await self.get_revoked_seat_by_order(container.id, options=options)

    async def list_by_subscription_id(
        self, subscription_id: UUID, *, options: Options = ()
    ) -> Sequence[CustomerSeat]:
        statement = (
            select(CustomerSeat)
            .where(CustomerSeat.subscription_id == subscription_id)
            .options(*options)
        )
        return await self.get_all(statement)

    async def list_by_order_id(
        self, order_id: UUID, *, options: Options = ()
    ) -> Sequence[CustomerSeat]:
        statement = (
            select(CustomerSeat)
            .where(CustomerSeat.order_id == order_id)
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_by_invitation_token(
        self, token: str, *, options: Options = ()
    ) -> CustomerSeat | None:
        statement = (
            select(CustomerSeat)
            .where(CustomerSeat.invitation_token == token)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def count_assigned_seats_for_subscription(self, subscription_id: UUID) -> int:
        statement = select(func.count(CustomerSeat.id)).where(
            CustomerSeat.subscription_id == subscription_id,
            CustomerSeat.status.in_([SeatStatus.pending, SeatStatus.claimed]),
        )
        result = await self.session.execute(statement)
        return result.scalar_one()

    async def get_available_seats_count(self, subscription_id: UUID) -> int:
        subscription_statement = select(Subscription).where(
            Subscription.id == subscription_id
        )
        subscription_repository = SubscriptionRepository.from_session(self.session)
        subscription = await subscription_repository.get_one_or_none(
            subscription_statement
        )

        if not subscription or subscription.seats is None:
            return 0
        claimed_statement = select(CustomerSeat).where(
            CustomerSeat.subscription_id == subscription_id,
            CustomerSeat.status.in_([SeatStatus.claimed, SeatStatus.pending]),
        )
        claimed_seats = await self.get_all(claimed_statement)

        return max(0, subscription.seats - len(claimed_seats))

    async def get_available_seats_count_for_order(self, order_id: UUID) -> int:
        order_repository = OrderRepository.from_session(self.session)
        order_statement = select(Order).where(Order.id == order_id)
        order = await order_repository.get_one_or_none(order_statement)

        if not order or order.seats is None:
            return 0

        claimed_statement = select(CustomerSeat).where(
            CustomerSeat.order_id == order_id,
            CustomerSeat.status.in_([SeatStatus.claimed, SeatStatus.pending]),
        )
        claimed_seats = await self.get_all(claimed_statement)

        return max(0, order.seats - len(claimed_seats))

    async def list_by_customer_id(
        self, customer_id: UUID, *, options: Options = ()
    ) -> Sequence[CustomerSeat]:
        statement = (
            select(CustomerSeat)
            .where(CustomerSeat.customer_id == customer_id)
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_by_subscription_and_customer(
        self,
        subscription_id: UUID,
        customer_id: UUID,
        *,
        options: Options = (),
    ) -> CustomerSeat | None:
        statement = (
            select(CustomerSeat)
            .where(
                CustomerSeat.subscription_id == subscription_id,
                CustomerSeat.customer_id == customer_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_order_and_customer(
        self,
        order_id: UUID,
        customer_id: UUID,
        *,
        options: Options = (),
    ) -> CustomerSeat | None:
        statement = (
            select(CustomerSeat)
            .where(
                CustomerSeat.order_id == order_id,
                CustomerSeat.customer_id == customer_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_revoked_seat_by_subscription(
        self,
        subscription_id: UUID,
        *,
        options: Options = (),
    ) -> CustomerSeat | None:
        """Get a revoked seat for a subscription that can be reused."""
        statement = (
            select(CustomerSeat)
            .where(
                CustomerSeat.subscription_id == subscription_id,
                CustomerSeat.status == SeatStatus.revoked,
            )
            .options(*options)
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def get_revoked_seat_by_order(
        self,
        order_id: UUID,
        *,
        options: Options = (),
    ) -> CustomerSeat | None:
        """Get a revoked seat for an order that can be reused."""
        statement = (
            select(CustomerSeat)
            .where(
                CustomerSeat.order_id == order_id,
                CustomerSeat.status == SeatStatus.revoked,
            )
            .options(*options)
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def get_by_id(
        self,
        seat_id: UUID,
        *,
        options: Options = (),
    ) -> CustomerSeat | None:
        """Get a seat by ID."""
        statement = (
            select(CustomerSeat).where(CustomerSeat.id == seat_id).options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_id_for_customer(
        self,
        seat_id: UUID,
        customer_id: UUID,
        *,
        options: Options = (),
    ) -> CustomerSeat | None:
        """Get a seat by ID and verify it belongs to a subscription or order owned by the customer."""
        statement = (
            select(CustomerSeat)
            .outerjoin(Subscription, CustomerSeat.subscription_id == Subscription.id)
            .outerjoin(Order, CustomerSeat.order_id == Order.id)
            .where(
                CustomerSeat.id == seat_id,
                (
                    (Subscription.customer_id == customer_id)
                    | (Order.customer_id == customer_id)
                ),
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[CustomerSeat]]:
        """
        Get a statement filtered by authorization.

        Seats are readable by users/organizations who have access to the product's organization.
        Handles both subscription-based and order-based seats.
        """

        statement = (
            self.get_base_statement()
            .outerjoin(Subscription, CustomerSeat.subscription_id == Subscription.id)
            .outerjoin(Order, CustomerSeat.order_id == Order.id)
            .outerjoin(
                Product,
                (Subscription.product_id == Product.id)
                | (Order.product_id == Product.id),
            )
        )

        if is_user(auth_subject):
            user_org_ids = select(UserOrganization.organization_id).where(
                UserOrganization.user_id == auth_subject.subject.id,
                UserOrganization.deleted_at.is_(None),
            )
            statement = statement.where(Product.organization_id.in_(user_org_ids))
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id
            )

        return statement

    async def get_by_id_and_auth_subject(
        self,
        auth_subject: AuthSubject[User | Organization],
        seat_id: UUID,
        *,
        options: Options = (),
    ) -> CustomerSeat | None:
        """Get a seat by ID filtered by auth subject."""
        statement = (
            self.get_readable_statement(auth_subject)
            .where(CustomerSeat.id == seat_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_subscription_and_auth_subject(
        self,
        auth_subject: AuthSubject[User | Organization],
        seat_id: UUID,
        subscription_id: UUID,
        *,
        options: Options = (),
    ) -> CustomerSeat | None:
        """Get a seat by ID and subscription ID filtered by auth subject."""
        statement = (
            self.get_readable_statement(auth_subject)
            .where(
                CustomerSeat.id == seat_id,
                CustomerSeat.subscription_id == subscription_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_active_seat_for_customer(
        self,
        customer_id: UUID,
        *,
        options: Options = (),
    ) -> CustomerSeat | None:
        """
        Get an active (claimed) seat for a customer.

        Used to determine if a customer is a seat holder and should have
        their usage charges routed to the billing manager's subscription.
        """
        statement = (
            select(CustomerSeat)
            .where(
                CustomerSeat.customer_id == customer_id,
                CustomerSeat.status == SeatStatus.claimed,
            )
            .options(*options)
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    def get_eager_options(self) -> Options:
        return (
            joinedload(CustomerSeat.subscription).options(
                joinedload(Subscription.product).joinedload(Product.organization),
                joinedload(Subscription.customer),
            ),
            joinedload(CustomerSeat.order).options(
                joinedload(Order.product),
                joinedload(Order.customer).joinedload(Customer.organization),
            ),
            joinedload(CustomerSeat.customer),
        )

    def get_eager_options_with_prices(self) -> Options:
        return (
            *self.get_eager_options(),
            joinedload(CustomerSeat.subscription).joinedload(
                Subscription.subscription_product_prices
            ),
        )
