import uuid

from polar.authz.service import AccessType, Authz
from polar.exceptions import NotPermitted, PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.services import ResourceService
from polar.models import SubscriptionTier, User

from ..schemas import SubscriptionTierCreate, SubscriptionTierUpdate
from .subscription_group import subscription_group as subscription_group_service


class SubscriptionTierError(PolarError):
    ...


class SubscriptionGroupDoesNotExist(SubscriptionTierError):
    def __init__(self, subscription_group_id: uuid.UUID) -> None:
        self.subscription_group_id = subscription_group_id
        message = f"Subscription Group with id {subscription_group_id} does not exist."
        super().__init__(message, 422)


class SubscriptionTierService(
    ResourceService[SubscriptionTier, SubscriptionTierCreate, SubscriptionTierUpdate]
):
    async def user_create(
        self,
        session: AsyncSession,
        authz: Authz,
        create_schema: SubscriptionTierCreate,
        user: User,
    ) -> SubscriptionTier:
        subscription_group = (
            await subscription_group_service.get_with_organization_or_repository(
                session, create_schema.subscription_group_id
            )
        )
        if subscription_group is None or not await authz.can(
            user, AccessType.write, subscription_group
        ):
            raise SubscriptionGroupDoesNotExist(create_schema.subscription_group_id)

        # TODO: Stripe integration here

        return await super().create(session, create_schema)

    async def user_update(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier: SubscriptionTier,
        update_schema: SubscriptionTierUpdate,
        user: User,
    ) -> SubscriptionTier:
        subscription_group = (
            await subscription_group_service.get_with_organization_or_repository(
                session, subscription_tier.subscription_group_id
            )
        )
        if subscription_group is None or not await authz.can(
            user, AccessType.write, subscription_group
        ):
            raise NotPermitted()

        if (
            update_schema.price_amount is not None
            and update_schema.price_amount != subscription_tier.price_amount
        ):
            """TODO: Archive price in Stripe and create a new one"""

        return await self.update(
            session, subscription_tier, update_schema, exclude_unset=True
        )

    async def archive(
        self,
        session: AsyncSession,
        authz: Authz,
        subscription_tier: SubscriptionTier,
        user: User,
    ) -> SubscriptionTier:
        subscription_group = (
            await subscription_group_service.get_with_organization_or_repository(
                session, subscription_tier.subscription_group_id
            )
        )
        if subscription_group is None or not await authz.can(
            user, AccessType.write, subscription_group
        ):
            raise NotPermitted()

        # TODO: Archive product and price in Stripe

        return await subscription_tier.update(session, is_archived=True)


subscription_tier = SubscriptionTierService(SubscriptionTier)
