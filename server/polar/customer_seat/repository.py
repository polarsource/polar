from collections.abc import Sequence
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase
from polar.models import CustomerSeat, Product, Subscription, UserOrganization
from polar.models.customer_seat import SeatStatus
from polar.subscription.repository import SubscriptionRepository

if TYPE_CHECKING:
    from sqlalchemy.orm.strategy_options import _AbstractLoad


class CustomerSeatRepository(RepositoryBase[CustomerSeat]):
    model = CustomerSeat

    async def list_by_subscription_id(
        self, subscription_id: UUID, *, options: tuple["_AbstractLoad", ...] = ()
    ) -> Sequence[CustomerSeat]:
        statement = (
            select(CustomerSeat)
            .where(CustomerSeat.subscription_id == subscription_id)
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_by_invitation_token(
        self, token: str, *, options: tuple["_AbstractLoad", ...] = ()
    ) -> CustomerSeat | None:
        statement = (
            select(CustomerSeat)
            .where(CustomerSeat.invitation_token == token)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

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
            CustomerSeat.status.in_(["claimed", "pending"]),
        )
        claimed_seats = await self.get_all(claimed_statement)

        return max(0, subscription.seats - len(claimed_seats))

    async def list_by_customer_id(
        self, customer_id: UUID, *, options: tuple["_AbstractLoad", ...] = ()
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
        options: tuple["_AbstractLoad", ...] = (),
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

    async def get_revoked_seat_by_subscription(
        self,
        subscription_id: UUID,
        *,
        options: tuple["_AbstractLoad", ...] = (),
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

    async def get_by_id(
        self,
        seat_id: UUID,
        *,
        options: tuple["_AbstractLoad", ...] = (),
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
        options: tuple["_AbstractLoad", ...] = (),
    ) -> CustomerSeat | None:
        """Get a seat by ID and verify it belongs to a subscription owned by the customer."""
        statement = (
            select(CustomerSeat)
            .join(Subscription, CustomerSeat.subscription_id == Subscription.id)
            .where(
                CustomerSeat.id == seat_id,
                Subscription.customer_id == customer_id,
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
        """
        statement = (
            self.get_base_statement()
            .join(Subscription, CustomerSeat.subscription_id == Subscription.id)
            .join(Product, Subscription.product_id == Product.id)
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Product.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id,
            )

        return statement

    async def get_by_id_and_auth_subject(
        self,
        auth_subject: AuthSubject[User | Organization],
        seat_id: UUID,
        *,
        options: tuple["_AbstractLoad", ...] = (),
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
        options: tuple["_AbstractLoad", ...] = (),
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
        options: tuple["_AbstractLoad", ...] = (),
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

    def get_eager_options(self) -> tuple["_AbstractLoad", ...]:
        return (
            joinedload(CustomerSeat.subscription)
            .joinedload(Subscription.product)
            .joinedload(Product.organization),
            joinedload(CustomerSeat.subscription).joinedload(Subscription.customer),
            joinedload(CustomerSeat.customer),
        )

    def get_eager_options_with_prices(self) -> tuple["_AbstractLoad", ...]:
        return (
            *self.get_eager_options(),
            joinedload(CustomerSeat.subscription).joinedload(
                Subscription.subscription_product_prices
            ),
        )
