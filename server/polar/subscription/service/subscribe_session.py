import uuid

from polar.auth.dependencies import AuthMethod
from polar.authz.service import AccessType, Anonymous, Authz, Subject
from polar.exceptions import NotPermitted, PolarError, ResourceNotFound, Unauthorized
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.db.postgres import AsyncSession
from polar.models import (
    SubscriptionTier,
    SubscriptionTierPrice,
    User,
)
from polar.models.organization import Organization
from polar.models.subscription_tier import SubscriptionTierType
from polar.organization.service import organization as organization_service

from ..schemas import SubscribeSession
from .subscription import subscription as subscription_service
from .subscription_tier import subscription_tier as subscription_tier_service


class SubscribeSessionError(PolarError):
    ...


class FreeSubscriptionTier(SubscribeSessionError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = (
            "The free subscription tier can't be subscribed "
            "through a subscribe session. "
            "You should directly create a subscription with this tier."
        )
        super().__init__(message, 403)


class ArchivedSubscriptionTier(SubscribeSessionError):
    def __init__(self, subscription_tier_id: uuid.UUID) -> None:
        self.subscription_tier_id = subscription_tier_id
        message = "This subscription tier is archived."
        super().__init__(message, 404)


class AlreadySubscribed(SubscribeSessionError):
    def __init__(
        self,
        *,
        user_id: uuid.UUID,
        organization_id: uuid.UUID | None = None,
        repository_id: uuid.UUID | None = None,
    ) -> None:
        self.user_id = user_id
        self.organization_id = organization_id
        self.repository_id = repository_id
        message = (
            "You're already subscribed to one of the tier "
            "of this organization or repository."
        )
        super().__init__(message, 400)


class SubscribeSessionService:
    async def create_subscribe_session(
        self,
        session: AsyncSession,
        subscription_tier: SubscriptionTier,
        price: SubscriptionTierPrice,
        success_url: str,
        auth_subject: Subject,
        auth_method: AuthMethod | None,
        authz: Authz,
        *,
        customer_email: str | None = None,
        organization_id: uuid.UUID | None = None,
    ) -> SubscribeSession:
        subscription_tier = (
            await subscription_tier_service.with_organization_or_repository(
                session, subscription_tier
            )
        )

        if subscription_tier.type == SubscriptionTierType.free:
            raise FreeSubscriptionTier(subscription_tier.id)

        if subscription_tier.is_archived:
            raise ArchivedSubscriptionTier(subscription_tier.id)

        metadata: dict[str, str] = {
            "subscription_tier_id": str(subscription_tier.id),
            "subscription_tier_price_id": str(price.id),
        }

        organization = (
            await self._get_organization(session, authz, auth_subject, organization_id)
            if organization_id is not None
            else None
        )

        if organization is not None:
            metadata["organization_subscriber_id"] = str(organization.id)
        if auth_method == AuthMethod.COOKIE and isinstance(auth_subject, User):
            metadata["user_id"] = str(auth_subject.id)

        if (
            auth_method == AuthMethod.COOKIE
            and isinstance(auth_subject, User)
            and organization is None
        ):
            existing_subscriptions = (
                await subscription_service.get_active_user_subscriptions(
                    session,
                    auth_subject,
                    organization_id=subscription_tier.organization_id,
                    repository_id=subscription_tier.repository_id,
                )
            )
            # Trying to upgrade from a Free subscription, set it in metadata for
            # reconciliation when receiving Stripe Webhook
            if len(existing_subscriptions) > 0:
                try:
                    free_subscription_upgrade = next(
                        subscription
                        for subscription in existing_subscriptions
                        if subscription.subscription_tier.type
                        == SubscriptionTierType.free
                    )
                except StopIteration as e:
                    # Prevent authenticated user to subscribe to another plan
                    # from the same organization/repository
                    raise AlreadySubscribed(
                        user_id=auth_subject.id,
                        organization_id=subscription_tier.organization_id,
                        repository_id=subscription_tier.repository_id,
                    ) from e
                else:
                    metadata["subscription_id"] = str(free_subscription_upgrade.id)

        customer_options: dict[str, str] = {}
        if organization is not None and organization.stripe_customer_id is not None:
            customer_options["customer"] = organization.stripe_customer_id
        # Set the customer only from a cookie-based authentication!
        # With the PAT, it's probably a call from the maintainer who wants to redirect
        # the backer they bring from their own website.
        elif auth_method == AuthMethod.COOKIE and isinstance(auth_subject, User):
            if auth_subject.stripe_customer_id is not None:
                customer_options["customer"] = auth_subject.stripe_customer_id
            else:
                customer_options["customer_email"] = auth_subject.email
        elif customer_email is not None:
            customer_options["customer_email"] = customer_email

        checkout_session = stripe_service.create_subscription_checkout_session(
            price.stripe_price_id,
            success_url,
            is_tax_applicable=subscription_tier.is_tax_applicable,
            **customer_options,
            metadata=metadata,
            subscription_metadata=metadata,
        )

        return SubscribeSession.from_db(checkout_session, subscription_tier, price)

    async def get_subscribe_session(
        self, session: AsyncSession, id: str
    ) -> SubscribeSession:
        checkout_session = stripe_service.get_checkout_session(id)

        if checkout_session.metadata is None:
            raise ResourceNotFound()

        try:
            subscription_tier_id = checkout_session.metadata["subscription_tier_id"]
            subscription_tier_price_id = checkout_session.metadata[
                "subscription_tier_price_id"
            ]
        except KeyError:
            raise ResourceNotFound()

        subscription_tier = await subscription_tier_service.get(
            session, uuid.UUID(subscription_tier_id)
        )

        if subscription_tier is None:
            raise ResourceNotFound()

        subscription_tier = (
            await subscription_tier_service.with_organization_or_repository(
                session, subscription_tier
            )
        )

        price = subscription_tier.get_price(uuid.UUID(subscription_tier_price_id))
        if price is None:
            raise ResourceNotFound()

        return SubscribeSession.from_db(checkout_session, subscription_tier, price)

    async def _get_organization(
        self,
        session: AsyncSession,
        authz: Authz,
        auth_subject: Subject,
        organization_id: uuid.UUID,
    ) -> Organization:
        if isinstance(auth_subject, Anonymous):
            raise Unauthorized()

        organization = await organization_service.get(session, organization_id)
        if organization is None or not (
            await authz.can(auth_subject, AccessType.write, organization)
        ):
            raise NotPermitted()

        return organization


subscribe_session = SubscribeSessionService()
