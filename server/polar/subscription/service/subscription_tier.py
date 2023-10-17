import uuid

from polar.auth.dependencies import AuthMethod
from polar.authz.service import AccessType, Authz, Subject
from polar.exceptions import NotPermitted, PolarError
from polar.integrations.stripe.service import StripeError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.services import ResourceService
from polar.models import SubscriptionTier, User

from ..schemas import SubscribeSession, SubscriptionTierCreate, SubscriptionTierUpdate
from .subscription_group import subscription_group as subscription_group_service


class SubscriptionTierError(PolarError):
    ...


class SubscriptionGroupDoesNotExist(SubscriptionTierError):
    def __init__(self, subscription_group_id: uuid.UUID) -> None:
        self.subscription_group_id = subscription_group_id
        message = f"Subscription Group with id {subscription_group_id} does not exist."
        super().__init__(message, 422)


class ArchivedSubscriptionTier(SubscriptionTierError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = "This subscription tier is archived."
        super().__init__(message, 404)


class NotAddedToStripeSubscriptionTier(SubscriptionTierError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = "This subscription tier has not beed synced with Stripe."
        super().__init__(message, 500)


class NoAssociatedPayoutAccount(SubscriptionTierError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization = organization_id
        message = (
            "A payout account should be configured for this organization "
            "before being able to accept subscriptions."
        )
        super().__init__(message, 400)


class SubscriptionTierService(
    ResourceService[SubscriptionTier, SubscriptionTierCreate, SubscriptionTierUpdate]
):
    async def get_by_stripe_product_id(
        self, session: AsyncSession, stripe_product_id: str
    ) -> SubscriptionTier | None:
        return await self.get_by(session, stripe_product_id=stripe_product_id)

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

        nested = await session.begin_nested()
        subscription_tier = await self.model.create(
            session, **create_schema.dict(), autocommit=False
        )
        await session.flush()
        assert subscription_tier.id is not None

        try:
            product = stripe_service.create_product_with_price(
                create_schema.name,
                price_amount=create_schema.price_amount,
                price_currency=create_schema.price_currency,
                description=create_schema.description,
                metadata={
                    "subscription_tier_id": str(subscription_tier.id),
                    "subscription_group_id": str(subscription_group.id),
                    "organization_id": str(subscription_group.organization_id),
                    "organization_name": subscription_group.organization.name
                    if subscription_group.organization is not None
                    else None,
                    "repository_id": str(subscription_group.repository_id),
                    "repository_name": subscription_group.repository.name
                    if subscription_group.repository is not None
                    else None,
                },
            )
        except StripeError:
            await nested.rollback()
            raise

        subscription_tier.stripe_product_id = product.stripe_id
        subscription_tier.stripe_price_id = product.default_price

        await session.commit()
        return subscription_tier

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
            and subscription_tier.stripe_product_id is not None
            and subscription_tier.stripe_price_id is not None
            and update_schema.price_amount != subscription_tier.price_amount
        ):
            new_price = stripe_service.create_price_for_product(
                subscription_tier.stripe_product_id,
                update_schema.price_amount,
                subscription_tier.price_currency,
                set_default=True,
            )
            stripe_service.archive_price(subscription_tier.stripe_price_id)
            subscription_tier.stripe_price_id = new_price.stripe_id

        return await subscription_tier.update(
            session, **update_schema.dict(exclude_unset=True)
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

        if subscription_tier.stripe_product_id is not None:
            stripe_service.archive_product(subscription_tier.stripe_product_id)

        return await subscription_tier.update(session, is_archived=True)

    async def create_subscribe_session(
        self,
        session: AsyncSession,
        subscription_tier: SubscriptionTier,
        success_url: str,
        auth_subject: Subject,
        auth_method: AuthMethod | None,
        *,
        customer_email: str | None = None,
    ) -> SubscribeSession:
        if subscription_tier.is_archived:
            raise ArchivedSubscriptionTier(subscription_tier.id)

        if subscription_tier.stripe_price_id is None:
            raise NotAddedToStripeSubscriptionTier(subscription_tier.id)

        subscription_group = (
            await subscription_group_service.get_with_organization_or_repository(
                session, subscription_tier.subscription_group_id
            )
        )
        assert subscription_group is not None
        account = await subscription_group_service.get_managing_organization_account(
            session, subscription_group
        )
        if account is None:
            raise NoAssociatedPayoutAccount(subscription_group.managing_organization_id)

        customer_options: dict[str, str] = {}
        # Set the customer only from a cookie-based authentication!
        # With the PAT, it's probably a call from the maintainer who wants to redirect
        # the backer they bring from their own website.
        if (
            auth_method == AuthMethod.COOKIE
            and isinstance(auth_subject, User)
            and auth_subject.stripe_customer_id is not None
        ):
            customer_options["customer"] = auth_subject.stripe_customer_id
        elif customer_email is not None:
            customer_options["customer_email"] = customer_email

        metadata: dict[str, str] = {"subscription_tier_id": str(subscription_tier.id)}

        checkout_session = stripe_service.create_subscription_checkout_session(
            subscription_tier.stripe_price_id,
            success_url,
            **customer_options,
            metadata=metadata,
        )

        return SubscribeSession(
            id=checkout_session.stripe_id,
            url=checkout_session.url,
            customer_email=checkout_session.customer_details["email"]
            if checkout_session.customer_details
            else checkout_session.customer_email,
            customer_name=checkout_session.customer_details["name"]
            if checkout_session.customer_details
            else None,
            subscription_tier=subscription_tier,  # type: ignore
        )

    async def get_subscribe_session(
        self, session: AsyncSession, id: str
    ) -> SubscribeSession:
        checkout_session = stripe_service.get_checkout_session(id)

        subscription_tier_id = checkout_session.metadata["subscription_tier_id"]
        subscription_tier = await self.get(session, uuid.UUID(subscription_tier_id))
        assert subscription_tier is not None

        return SubscribeSession(
            id=checkout_session.stripe_id,
            url=checkout_session.url,
            customer_email=checkout_session.customer_details["email"]
            if checkout_session.customer_details
            else checkout_session.customer_email,
            customer_name=checkout_session.customer_details["name"]
            if checkout_session.customer_details
            else None,
            subscription_tier=subscription_tier,  # type: ignore
        )


subscription_tier = SubscriptionTierService(SubscriptionTier)
