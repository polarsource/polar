import uuid
from typing import cast

import stripe as stripe_lib

from polar.auth.models import Anonymous, AuthMethod, AuthSubject, is_user
from polar.checkout.schemas import Checkout, CheckoutCreate
from polar.exceptions import PolarError, PolarRequestValidationError, ResourceNotFound
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.models import Product, Subscription, User
from polar.models.product import SubscriptionTierType
from polar.postgres import AsyncSession
from polar.product.service.product import product as product_service
from polar.product.service.product_price import product_price as product_price_service
from polar.subscription.service import subscription as subscription_service


class CheckoutError(PolarError): ...


class AlreadySubscribed(CheckoutError):
    def __init__(self, *, user_id: uuid.UUID, organization_id: uuid.UUID) -> None:
        self.user_id = user_id
        self.organization_id = organization_id
        message = "You're already subscribed to one of the tier of this organization."
        super().__init__(message, 403)


class CheckoutService:
    async def create(
        self,
        session: AsyncSession,
        create_schema: CheckoutCreate,
        auth_subject: AuthSubject[User | Anonymous],
    ) -> Checkout:
        price = await product_price_service.get_by_id(
            session, create_schema.product_price_id
        )

        if price is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "price_id"),
                        "msg": "Price does not exist.",
                        "input": create_schema.product_price_id,
                    }
                ]
            )

        if price.is_archived:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "price_id"),
                        "msg": "Price is archived.",
                        "input": create_schema.product_price_id,
                    }
                ]
            )

        product = price.product
        if product.is_archived:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "price_id"),
                        "msg": "Product is archived.",
                        "input": create_schema.product_price_id,
                    }
                ]
            )

        product = cast(Product, await product_service.get_loaded(session, product.id))

        metadata: dict[str, str] = {
            "type": ProductType.product,
            "product_id": str(product.id),
            "product_price_id": str(price.id),
        }

        if price.is_recurring:
            free_subscription_upgrade = await self._check_existing_subscriptions(
                session, auth_subject, product
            )
            if free_subscription_upgrade is not None:
                metadata["subscription_id"] = str(free_subscription_upgrade.id)

        customer_options: dict[str, str] = {}
        # Set the customer only from a cookie-based authentication!
        # With the PAT, it's probably a call from the maintainer who wants to redirect
        # the backer they bring from their own website.
        if is_user(auth_subject) and auth_subject.method == AuthMethod.COOKIE:
            user = auth_subject.subject
            metadata["user_id"] = str(user.id)
            if user.stripe_customer_id is not None:
                customer_options["customer"] = user.stripe_customer_id
            else:
                customer_options["customer_email"] = user.email
        elif create_schema.customer_email is not None:
            customer_options["customer_email"] = create_schema.customer_email

        checkout_session = stripe_service.create_checkout_session(
            price.stripe_price_id,
            str(create_schema.success_url),
            is_subscription=price.is_recurring,
            is_tax_applicable=product.is_tax_applicable,
            **customer_options,
            metadata=metadata,
            subscription_metadata=metadata,
        )

        return Checkout(
            id=checkout_session.id,
            url=checkout_session.url,
            customer_email=checkout_session.customer_details["email"]
            if checkout_session.customer_details
            else checkout_session.customer_email,
            customer_name=checkout_session.customer_details["name"]
            if checkout_session.customer_details
            else None,
            product=product,  # type: ignore
            product_price=price,  # type: ignore
        )

    async def get_by_id(self, session: AsyncSession, id: str) -> Checkout:
        try:
            checkout_session = stripe_service.get_checkout_session(id)
        except stripe_lib.InvalidRequestError as e:
            raise ResourceNotFound() from e

        if checkout_session.metadata is None:
            raise ResourceNotFound()

        try:
            product_id = checkout_session.metadata["product_id"]
            product_price_id = checkout_session.metadata["product_price_id"]
        except KeyError as e:
            raise ResourceNotFound() from e

        product_price = await product_price_service.get_by_id(
            session, uuid.UUID(product_price_id)
        )
        if product_price is None:
            raise ResourceNotFound()

        product = await product_service.get_loaded(session, uuid.UUID(product_id))
        if product is None:
            raise ResourceNotFound()
        assert product.id == product_price.product_id

        return Checkout(
            id=checkout_session.id,
            url=checkout_session.url,
            customer_email=checkout_session.customer_details["email"]
            if checkout_session.customer_details
            else checkout_session.customer_email,
            customer_name=checkout_session.customer_details["name"]
            if checkout_session.customer_details
            else None,
            product=product,  # type: ignore
            product_price=product_price,  # type: ignore
        )

    async def _check_existing_subscriptions(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Anonymous],
        product: Product,
    ) -> Subscription | None:
        """
        Check that the user doesn't already have a subscription, unless it's on the
        free tier.
        """
        if is_user(auth_subject) and auth_subject.method == AuthMethod.COOKIE:
            existing_subscriptions = (
                await subscription_service.get_active_user_subscriptions(
                    session,
                    auth_subject.subject,
                    organization_id=product.organization_id,
                )
            )
            # Trying to upgrade from a Free subscription, set it in metadata for
            # reconciliation when receiving Stripe Webhook
            if len(existing_subscriptions) > 0:
                try:
                    free_subscription_upgrade = next(
                        subscription
                        for subscription in existing_subscriptions
                        if subscription.product.type == SubscriptionTierType.free
                    )
                except StopIteration as e:
                    # Prevent authenticated user to subscribe to another plan
                    # from the same organization
                    raise AlreadySubscribed(
                        user_id=auth_subject.subject.id,
                        organization_id=product.organization_id,
                    ) from e
                else:
                    return free_subscription_upgrade
        return None


checkout = CheckoutService()
