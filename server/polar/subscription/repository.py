from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.orm import contains_eager

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import (
    Product,
    ProductPrice,
    ProductPriceMeteredUnit,
    Subscription,
    SubscriptionProductPrice,
)


class SubscriptionRepository(
    RepositorySoftDeletionIDMixin[Subscription, UUID],
    RepositorySoftDeletionMixin[Subscription],
    RepositoryBase[Subscription],
):
    model = Subscription

    async def list_active_by_customer(
        self, customer_id: UUID
    ) -> Sequence[Subscription]:
        statement = self.get_base_statement().where(
            Subscription.customer_id == customer_id,
            Subscription.active.is_(True),
        )
        return await self.get_all(statement)

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

    async def get_by_stripe_subscription_id(
        self, stripe_subscription_id: str, *, options: Options = ()
    ) -> Subscription | None:
        statement = (
            self.get_base_statement()
            .where(Subscription.stripe_subscription_id == stripe_subscription_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)


class SubscriptionProductPriceRepository(
    RepositorySoftDeletionIDMixin[SubscriptionProductPrice, UUID],
    RepositorySoftDeletionMixin[SubscriptionProductPrice],
    RepositoryBase[SubscriptionProductPrice],
):
    model = SubscriptionProductPrice

    async def get_by_customer_and_meter(
        self, customer_id: UUID, meter_id: UUID
    ) -> SubscriptionProductPrice | None:
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
                contains_eager(SubscriptionProductPrice.subscription),
            )
        )

        return await self.get_one_or_none(statement)
