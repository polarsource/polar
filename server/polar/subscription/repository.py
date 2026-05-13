from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TYPE_CHECKING
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import Select, and_, case, cast, or_, select
from sqlalchemy.orm import contains_eager
from sqlalchemy.orm.strategy_options import joinedload, selectinload

from polar.auth.models import (
    AuthSubject,
    Member,
    Organization,
    User,
    is_customer,
    is_member,
    is_organization,
    is_user,
)
from polar.auth.models import (
    Customer as AuthCustomer,
)
from polar.enums import SubscriptionRecurringInterval
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import (
    Customer,
    CustomerSeat,
    Discount,
    Product,
    ProductPrice,
    ProductPriceMeteredUnit,
    Subscription,
    SubscriptionMeter,
    SubscriptionProductPrice,
    SubscriptionUpdate,
    UserOrganization,
)
from polar.models.customer_seat import SeatStatus
from polar.models.email_log import EmailLog, EmailLogStatus
from polar.models.subscription import SubscriptionStatus
from polar.product.guard import is_metered_price

from .sorting import SubscriptionSortProperty

if TYPE_CHECKING:
    from sqlalchemy.orm.strategy_options import _AbstractLoad


@dataclass
class CustomerSubscriptionProductPrice:
    """
    Result of looking up a customer's subscription product price for a meter.

    Contains the paying customer ID (which may be different from the queried customer
    if they are a seat holder) and the associated subscription product price.

    The full customer object can be accessed via subscription_product_price.subscription.customer.
    """

    customer_id: UUID
    subscription_product_price: SubscriptionProductPrice


class SubscriptionRepository(
    RepositorySortingMixin[Subscription, SubscriptionSortProperty],
    RepositorySoftDeletionIDMixin[Subscription, UUID],
    RepositorySoftDeletionMixin[Subscription],
    RepositoryBase[Subscription],
):
    model = Subscription

    async def list_active_by_customer(
        self, customer_id: UUID, *, options: Options = ()
    ) -> Sequence[Subscription]:
        statement = (
            self.get_base_statement()
            .where(
                Subscription.customer_id == customer_id,
                Subscription.active.is_(True),
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_all_by_customer(
        self, customer_id: UUID, *, options: Options = ()
    ) -> Sequence[Subscription]:
        statement = (
            self.get_base_statement(include_deleted=True)
            .where(Subscription.customer_id == customer_id)
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_ids_by_product(self, product_id: UUID) -> Sequence[UUID]:
        statement = select(Subscription.id).where(
            Subscription.product_id == product_id,
            Subscription.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        return result.scalars().all()

    async def get_by_id_and_organization(
        self,
        id: UUID,
        organization_id: UUID,
        *,
        options: Options = (),
    ) -> Subscription | None:
        statement = (
            self.get_base_statement()
            .join(Product)
            .where(
                Subscription.id == id,
                Product.organization_id == organization_id,
            )
            .options(contains_eager(Subscription.product), *options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_checkout_id(
        self, checkout_id: UUID, *, options: Options = ()
    ) -> Subscription | None:
        statement = (
            self.get_base_statement()
            .where(Subscription.checkout_id == checkout_id)
            .options(*options)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    def get_eager_options(
        self, *, product_load: "_AbstractLoad | None" = None
    ) -> Options:
        if product_load is None:
            product_load = joinedload(Subscription.product)
        return (
            joinedload(Subscription.customer).joinedload(Customer.organization),
            product_load.options(
                joinedload(Product.organization),
                selectinload(Product.product_medias),
                selectinload(Product.attached_custom_fields),
            ),
            selectinload(Subscription.meters).joinedload(SubscriptionMeter.meter),
            joinedload(Subscription.pending_update),
        )

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization | Customer | Member]
    ) -> Select[tuple[Subscription]]:
        statement = self.get_base_statement().join(Product)

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Product.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.is_deleted.is_(False),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Product.organization_id == auth_subject.subject.id,
            )
        elif is_customer(auth_subject):
            customer = auth_subject.subject
            statement = statement.where(
                Subscription.customer_id == customer.id,
                Subscription.is_deleted.is_(False),
            )
        elif is_member(auth_subject):
            member = auth_subject.subject
            statement = statement.where(
                Subscription.customer_id == member.customer_id,
                Subscription.is_deleted.is_(False),
            )

        return statement

    def get_claimed_subscriptions_statement(
        self, auth_subject: AuthSubject[AuthCustomer | Member]
    ) -> Select[tuple[Subscription]]:
        """Get subscriptions where the customer has a claimed seat."""
        statement = self.get_base_statement().join(
            CustomerSeat, CustomerSeat.subscription_id == Subscription.id
        )

        if is_member(auth_subject):
            statement = statement.where(
                CustomerSeat.member_id == auth_subject.subject.id,
                CustomerSeat.status == SeatStatus.claimed,
            )
        else:
            statement = statement.where(
                CustomerSeat.customer_id == auth_subject.subject.id,
                CustomerSeat.status == SeatStatus.claimed,
            )

        return statement

    async def get_subscriptions_needing_renewal_reminder(
        self,
        now: datetime,
        reminder_window_end: datetime,
        *,
        options: Options = (),
    ) -> Sequence[Subscription]:
        """
        Find active subscriptions with long billing cycles (> 180 days)
        whose current_period_end is within the next 7 days,
        and where no matching EmailLog row exists for dedup.
        """
        # Long billing cycle conditions:
        # - year (any count)
        # - month with count >= 6
        # - week with count >= 25
        # - day with count >= 180
        long_cycle_condition = or_(
            Subscription.recurring_interval == SubscriptionRecurringInterval.year,
            and_(
                Subscription.recurring_interval == SubscriptionRecurringInterval.month,
                Subscription.recurring_interval_count >= 6,
            ),
            and_(
                Subscription.recurring_interval == SubscriptionRecurringInterval.week,
                Subscription.recurring_interval_count >= 25,
            ),
            and_(
                Subscription.recurring_interval == SubscriptionRecurringInterval.day,
                Subscription.recurring_interval_count >= 180,
            ),
        )

        # Dedup: NOT EXISTS in email_logs for this subscription + template
        dedup_subquery = (
            select(EmailLog.id)
            .where(
                EmailLog.email_template == "subscription_renewal_reminder",
                EmailLog.status == EmailLogStatus.sent,
                EmailLog.email_props["subscription"]["id"].as_string()
                == cast(Subscription.id, sa.String),
                EmailLog.email_props["renewal_date"].as_string()
                == sa.func.to_char(Subscription.current_period_end, "MM/DD/YYYY"),
            )
            .correlate(Subscription)
            .exists()
        )

        statement = (
            self.get_base_statement()
            .where(
                Subscription.status == SubscriptionStatus.active,
                Subscription.cancel_at_period_end.is_(False),
                Subscription.current_period_end.isnot(None),
                Subscription.current_period_end > now,
                Subscription.current_period_end <= reminder_window_end,
                long_cycle_condition,
                ~dedup_subquery,
            )
            .options(*options)
        )
        return await self.get_all(statement)

    async def get_subscriptions_needing_trial_conversion_reminder(
        self,
        now: datetime,
        *,
        options: Options = (),
    ) -> Sequence[Subscription]:
        """
        Find trialing subscriptions whose trial ends within the appropriate
        window, and where no matching EmailLog row exists for dedup.

        - Trials >= 3 days: send reminder 3 days before trial ends
        - Trials >= 1 day but < 3 days: send reminder 1 day before trial ends
        - Trials < 1 day: skip entirely
        """
        one_day_from_now = now + timedelta(days=1)
        three_days_from_now = now + timedelta(days=3)

        # Dedup: NOT EXISTS in email_logs for this subscription + template
        dedup_subquery = (
            select(EmailLog.id)
            .where(
                EmailLog.email_template == "subscription_trial_conversion_reminder",
                EmailLog.status == EmailLogStatus.sent,
                EmailLog.email_props["subscription"]["id"].as_string()
                == cast(Subscription.id, sa.String),
                EmailLog.email_props["conversion_date"].as_string()
                == sa.func.to_char(Subscription.trial_end, "MM/DD/YYYY"),
            )
            .correlate(Subscription)
            .exists()
        )

        # Trial duration condition:
        # If trial >= 3 days: trial_end within next 3 days
        # If trial >= 1 day but < 3 days: trial_end within next 1 day
        trial_duration = sa.func.extract(
            "epoch", Subscription.trial_end - Subscription.trial_start
        )
        three_days_seconds = 3 * 24 * 60 * 60
        one_day_seconds = 1 * 24 * 60 * 60

        trial_window_condition = or_(
            # Long trials (>= 3 days): remind 3 days before
            and_(
                trial_duration >= three_days_seconds,
                Subscription.trial_end > now,
                Subscription.trial_end <= three_days_from_now,
            ),
            # Short trials (>= 1 day, < 3 days): remind 1 day before
            and_(
                trial_duration >= one_day_seconds,
                trial_duration < three_days_seconds,
                Subscription.trial_end > now,
                Subscription.trial_end <= one_day_from_now,
            ),
        )

        statement = (
            self.get_base_statement()
            .where(
                Subscription.status == SubscriptionStatus.trialing,
                Subscription.cancel_at_period_end.is_(False),
                Subscription.trial_start.isnot(None),
                Subscription.trial_end.isnot(None),
                trial_window_condition,
                ~dedup_subquery,
            )
            .options(*options)
        )
        return await self.get_all(statement)

    def get_sorting_clause(self, property: SubscriptionSortProperty) -> SortingClause:
        match property:
            case SubscriptionSortProperty.customer:
                return Customer.email
            case SubscriptionSortProperty.status:
                return case(
                    (Subscription.status == SubscriptionStatus.incomplete, 1),
                    (
                        Subscription.status == SubscriptionStatus.incomplete_expired,
                        2,
                    ),
                    (Subscription.status == SubscriptionStatus.trialing, 3),
                    (
                        Subscription.status == SubscriptionStatus.active,
                        case(
                            (Subscription.cancel_at_period_end.is_(False), 4),
                            (Subscription.cancel_at_period_end.is_(True), 5),
                        ),
                    ),
                    (Subscription.status == SubscriptionStatus.past_due, 6),
                    (Subscription.status == SubscriptionStatus.canceled, 7),
                    (Subscription.status == SubscriptionStatus.unpaid, 8),
                )
            case SubscriptionSortProperty.started_at:
                return Subscription.started_at
            case SubscriptionSortProperty.ended_at:
                return Subscription.ended_at
            case SubscriptionSortProperty.ends_at:
                return Subscription.ends_at
            case SubscriptionSortProperty.current_period_end:
                return Subscription.current_period_end
            case SubscriptionSortProperty.amount:
                return case(
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.year,
                        Subscription.amount / 12,
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.month,
                        Subscription.amount,
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.week,
                        Subscription.amount * 4,
                    ),
                    (
                        Subscription.recurring_interval
                        == SubscriptionRecurringInterval.day,
                        Subscription.amount * 30,
                    ),
                )
            case SubscriptionSortProperty.product:
                return Product.name
            case SubscriptionSortProperty.discount:
                return Discount.name


class SubscriptionProductPriceRepository(
    RepositorySoftDeletionIDMixin[SubscriptionProductPrice, UUID],
    RepositorySoftDeletionMixin[SubscriptionProductPrice],
    RepositoryBase[SubscriptionProductPrice],
):
    model = SubscriptionProductPrice

    async def get_by_customer_and_meter(
        self, customer_id: UUID, meter_id: UUID
    ) -> CustomerSubscriptionProductPrice | None:
        """
        Get the paying customer and subscription product price for a customer and meter.

        If the customer has a direct subscription with the meter, returns that.
        If the customer is a seat holder, returns the billing manager's subscription.
        """
        result = await self._get_direct_subscription_price(customer_id, meter_id)
        if result is not None:
            return result

        return await self._get_seat_subscription_price(customer_id, meter_id)

    async def _get_direct_subscription_price(
        self, customer_id: UUID, meter_id: UUID
    ) -> CustomerSubscriptionProductPrice | None:
        statement = (
            self.get_base_statement()
            .join(
                ProductPrice,
                SubscriptionProductPrice.product_price_id == ProductPrice.id,
            )
            .join(
                Subscription,
                Subscription.id == SubscriptionProductPrice.subscription_id,
            )
            .where(
                ProductPrice.is_metered.is_(True),
                ProductPriceMeteredUnit.meter_id == meter_id,
                Subscription.billable.is_(True),
                Subscription.customer_id == customer_id,
            )
            # In case customer has several subscriptions, take the earliest one
            .order_by(Subscription.started_at.asc())
            .limit(1)
            .options(
                contains_eager(SubscriptionProductPrice.product_price),
                contains_eager(SubscriptionProductPrice.subscription).joinedload(
                    Subscription.customer
                ),
            )
        )

        subscription_product_price = await self.get_one_or_none(statement)
        if subscription_product_price is None:
            return None

        return CustomerSubscriptionProductPrice(
            customer_id=subscription_product_price.subscription.customer_id,
            subscription_product_price=subscription_product_price,
        )

    async def _get_seat_subscription_price(
        self, customer_id: UUID, meter_id: UUID
    ) -> CustomerSubscriptionProductPrice | None:
        """
        Get subscription product price for a customer who is a seat holder.

        Returns the billing manager's subscription if the seat holder has access
        to a metered price for the specified meter.
        """
        seat = await self._get_active_seat_for_customer(customer_id)
        if seat is None or seat.subscription is None:
            return None

        # Find matching metered price in billing manager's subscription
        assert seat.subscription is not None
        metered_price = self._find_metered_price_in_subscription(
            seat.subscription, meter_id
        )
        if metered_price is None:
            return None

        return CustomerSubscriptionProductPrice(
            customer_id=seat.subscription.customer_id,
            subscription_product_price=metered_price,
        )

    async def _get_active_seat_for_customer(
        self, customer_id: UUID
    ) -> CustomerSeat | None:
        """Get the active seat for a customer, with subscription data eagerly loaded."""
        statement = (
            select(CustomerSeat)
            .where(
                CustomerSeat.customer_id == customer_id,
                CustomerSeat.status == SeatStatus.claimed,
            )
            .options(
                joinedload(CustomerSeat.subscription).options(
                    joinedload(Subscription.customer),
                    joinedload(Subscription.subscription_product_prices).options(
                        joinedload(SubscriptionProductPrice.product_price),
                        # Load the back-reference to satisfy lazy='raise_on_sql'
                        # This points to the same Subscription already being loaded above
                        joinedload(SubscriptionProductPrice.subscription),
                    ),
                )
            )
            .limit(1)
        )
        return await self.session.scalar(statement)

    def _find_metered_price_in_subscription(
        self, subscription: Subscription, meter_id: UUID
    ) -> SubscriptionProductPrice | None:
        """
        Find a metered price for the given meter in a subscription.

        Returns None if no matching metered price is found.
        """
        for spp in subscription.subscription_product_prices:
            if (
                is_metered_price(spp.product_price)
                and spp.product_price.meter_id == meter_id
            ):
                return spp
        return None


class SubscriptionUpdateRepository(
    RepositorySoftDeletionIDMixin[SubscriptionUpdate, UUID],
    RepositorySoftDeletionMixin[SubscriptionUpdate],
    RepositoryBase[SubscriptionUpdate],
):
    model = SubscriptionUpdate

    async def upsert(
        self, object: SubscriptionUpdate, *, flush: bool = False
    ) -> SubscriptionUpdate:
        existing = await self.get_unapplied_by_subscription_id(object.subscription_id)
        if existing is None:
            return await self.create(object, flush=flush)

        existing.applies_at = object.applies_at
        existing.product = object.product
        existing.new_cycle_start = object.new_cycle_start
        existing.new_cycle_end = object.new_cycle_end
        existing.seats = object.seats
        return await self.update(existing, flush=flush)

    async def soft_delete_unapplied_by_subscription_id(
        self, subscription_id: UUID
    ) -> None:
        existing = await self.get_unapplied_by_subscription_id(subscription_id)
        if existing is not None:
            await self.soft_delete(existing)

    async def get_unapplied_by_subscription_id(
        self, subscription_id: UUID, *, options: Options = ()
    ) -> SubscriptionUpdate | None:
        statement = (
            self.get_base_statement()
            .where(
                SubscriptionUpdate.subscription_id == subscription_id,
                SubscriptionUpdate.applied_at.is_(None),
                SubscriptionUpdate.is_deleted.is_(False),
            )
            .limit(1)
            .options(*options)
        )
        return await self.get_one_or_none(statement)
