import uuid
from typing import cast

import stripe as stripe_lib

from polar.auth.models import Anonymous, AuthSubject, is_direct_user, is_user
from polar.exceptions import PolarError, PolarRequestValidationError, ResourceNotFound
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.models import Product, User
from polar.postgres import AsyncSession
from polar.product.service.product import product as product_service
from polar.product.service.product_price import product_price as product_price_service
from polar.subscription.service import subscription as subscription_service

from .schemas import Checkout, CheckoutCreate


class CheckoutError(PolarError): ...


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
                        "loc": ("body", "product_price_id"),
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
                        "loc": ("body", "product_price_id"),
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
                        "loc": ("body", "product_price_id"),
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

        if is_user(auth_subject) and create_schema.subscription_id is not None:
            subscription = await subscription_service.get(
                session, create_schema.subscription_id
            )
            if (
                subscription is not None
                and subscription.user_id == auth_subject.subject.id
            ):
                metadata["subscription_id"] = str(subscription.id)

        customer_options: dict[str, str] = {}
        if is_direct_user(auth_subject):
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


checkout = CheckoutService()
