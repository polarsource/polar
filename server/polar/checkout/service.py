import uuid
from collections.abc import Sequence
from typing import Any, cast

import stripe as stripe_lib
import structlog
from sqlalchemy import Select, UnaryExpression, asc, desc, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import AuthSubject, is_organization, is_user
from polar.checkout.schemas import (
    CheckoutConfirm,
    CheckoutCreate,
    CheckoutUpdate,
    CheckoutUpdatePublic,
)
from polar.checkout.tax import TaxID, to_stripe_tax_id, validate_tax_id
from polar.config import settings
from polar.enums import PaymentProcessor
from polar.eventstream.service import publish
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.kit.crypto import generate_token
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import (
    Checkout,
    Organization,
    Product,
    ProductPriceCustom,
    ProductPriceFixed,
    User,
    UserOrganization,
)
from polar.models.checkout import CheckoutStatus
from polar.models.product_price import ProductPriceFree
from polar.postgres import AsyncSession
from polar.product.service.product import product as product_service
from polar.product.service.product_price import product_price as product_price_service

from .sorting import CheckoutSortProperty
from .tax import TaxCalculationError, calculate_tax

log: Logger = structlog.get_logger()


class CheckoutError(PolarError): ...


class PaymentError(CheckoutError):
    def __init__(
        self, checkout: Checkout, error_type: str | None, error: str | None
    ) -> None:
        self.checkout = checkout
        self.error_type = error_type
        self.error = error
        message = (
            f"The payment failed{f': {error}' if error else '.'} "
            "Please try again with a different payment method."
        )
        super().__init__(message, 400)


class CheckoutDoesNotExist(CheckoutError):
    def __init__(self, checkout_id: uuid.UUID, payment_intent_id: str) -> None:
        self.checkout_id = checkout_id
        self.payment_intent_id = payment_intent_id
        message = (
            f"Checkout {checkout_id} from "
            f"payment intent {payment_intent_id} does not exist."
        )
        super().__init__(message)


class NotOpenCheckout(CheckoutError):
    def __init__(self, checkout: Checkout) -> None:
        self.checkout = checkout
        self.status = checkout.status
        message = f"Checkout {checkout.id} is not open: {checkout.status}"
        super().__init__(message, 403)


class NotConfirmedCheckout(CheckoutError):
    def __init__(self, checkout: Checkout) -> None:
        self.checkout = checkout
        self.status = checkout.status
        message = f"Checkout {checkout.id} is not confirmed: {checkout.status}"
        super().__init__(message)


class PaymentIntentNotSucceeded(CheckoutError):
    def __init__(self, checkout: Checkout, payment_intent_id: str) -> None:
        self.checkout = checkout
        self.payment_intent_id = payment_intent_id
        message = (
            f"Payment intent {payment_intent_id} for {checkout.id} is not successful."
        )
        super().__init__(message)


class NoCustomerOnPaymentIntent(CheckoutError):
    def __init__(self, checkout: Checkout, payment_intent_id: str) -> None:
        self.checkout = checkout
        self.payment_intent_id = payment_intent_id
        message = (
            f"Payment intent {payment_intent_id} "
            f"for {checkout.id} has no customer associated."
        )
        super().__init__(message)


class NoPaymentMethodOnPaymentIntent(CheckoutError):
    def __init__(self, checkout: Checkout, payment_intent_id: str) -> None:
        self.checkout = checkout
        self.payment_intent_id = payment_intent_id
        message = (
            f"Payment intent {payment_intent_id} "
            f"for {checkout.id} has no payment method associated."
        )
        super().__init__(message)


CHECKOUT_CLIENT_SECRET_PREFIX = "polar_c_"


class CheckoutService(ResourceServiceReader[Checkout]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CheckoutSortProperty]] = [
            (CheckoutSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Checkout], int]:
        statement = self._get_readable_checkout_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(Product.organization_id.in_(organization_id))

        if product_id is not None:
            statement = statement.where(Checkout.product_id.in_(product_id))

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == CheckoutSortProperty.created_at:
                order_by_clauses.append(clause_function(Checkout.created_at))
            elif criterion == CheckoutSortProperty.expires_at:
                order_by_clauses.append(clause_function(Checkout.expires_at))
        statement = statement.order_by(*order_by_clauses)

        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Checkout | None:
        statement = self._get_readable_checkout_statement(auth_subject).where(
            Checkout.id == id
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def create(
        self,
        session: AsyncSession,
        checkout_create: CheckoutCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Checkout:
        price = await product_price_service.get_writable_by_id(
            session, checkout_create.product_price_id, auth_subject
        )

        if price is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_price_id"),
                        "msg": "Price does not exist.",
                        "input": checkout_create.product_price_id,
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
                        "input": checkout_create.product_price_id,
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
                        "input": checkout_create.product_price_id,
                    }
                ]
            )

        if checkout_create.amount is not None:
            if not isinstance(price, ProductPriceCustom):
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "amount"),
                            "msg": "Amount can only be set on custom prices.",
                            "input": checkout_create.amount,
                        }
                    ]
                )
            elif (
                price.minimum_amount is not None
                and checkout_create.amount < price.minimum_amount
            ):
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "greater_than_equal",
                            "loc": ("body", "amount"),
                            "msg": "Amount is below minimum.",
                            "input": checkout_create.amount,
                            "ctx": {"ge": price.minimum_amount},
                        }
                    ]
                )
            elif (
                price.maximum_amount is not None
                and checkout_create.amount > price.maximum_amount
            ):
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "less_than_equal",
                            "loc": ("body", "amount"),
                            "msg": "Amount is above maximum.",
                            "input": checkout_create.amount,
                            "ctx": {"le": price.maximum_amount},
                        }
                    ]
                )

        customer_tax_id: TaxID | None = None
        if checkout_create.customer_tax_id is not None:
            if checkout_create.customer_billing_address is None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "missing",
                            "loc": ("body", "customer_billing_address"),
                            "msg": "Country is required to validate tax ID.",
                            "input": None,
                        }
                    ]
                )
            try:
                customer_tax_id = validate_tax_id(
                    checkout_create.customer_tax_id,
                    checkout_create.customer_billing_address.country,
                )
            except ValueError as e:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "customer_tax_id"),
                            "msg": "Invalid tax ID.",
                            "input": checkout_create.customer_tax_id,
                        }
                    ]
                ) from e

        product = cast(Product, await product_service.get_loaded(session, product.id))

        amount = checkout_create.amount
        currency = None
        if isinstance(price, ProductPriceFixed):
            amount = price.price_amount
            currency = price.price_currency
        elif isinstance(price, ProductPriceCustom):
            currency = price.price_currency
            if amount is None:
                amount = price.preset_amount

        checkout = Checkout(
            client_secret=generate_token(prefix=CHECKOUT_CLIENT_SECRET_PREFIX),
            amount=amount,
            currency=currency,
            user_metadata=checkout_create.metadata,
            product=product,
            product_price=price,
            customer_billing_address=checkout_create.customer_billing_address,
            customer_tax_id=customer_tax_id,
            **checkout_create.model_dump(
                exclude={
                    "product_price_id",
                    "amount",
                    "customer_billing_address",
                    "customer_tax_id",
                    "metadata",
                }
            ),
        )
        session.add(checkout)

        try:
            checkout = await self._update_checkout_tax(session, checkout)
        # Swallow incomplete tax calculation error: require it only on confirm
        except TaxCalculationError:
            pass

        return checkout

    async def update(
        self,
        session: AsyncSession,
        checkout: Checkout,
        checkout_update: CheckoutUpdate | CheckoutUpdatePublic,
    ) -> Checkout:
        checkout = await self._update_checkout(session, checkout, checkout_update)
        try:
            checkout = await self._update_checkout_tax(session, checkout)
        # Swallow incomplete tax calculation error: require it only on confirm
        except TaxCalculationError:
            pass
        return checkout

    async def confirm(
        self,
        session: AsyncSession,
        checkout: Checkout,
        checkout_confirm: CheckoutConfirm,
    ) -> Checkout:
        checkout = await self._update_checkout(session, checkout, checkout_confirm)

        errors: list[ValidationError] = []
        try:
            checkout = await self._update_checkout_tax(session, checkout)
        except TaxCalculationError as e:
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "customer_billing_address"),
                    "msg": e.message,
                    "input": None,
                }
            )

        if checkout.amount is None and isinstance(
            checkout.product_price, ProductPriceCustom
        ):
            errors.append(
                {
                    "type": "missing",
                    "loc": ("body", "amount"),
                    "msg": "Amount is required for custom prices.",
                    "input": None,
                }
            )

        for required_field in [
            "customer_name",
            "customer_email",
            "customer_billing_address",
        ]:
            if getattr(checkout, required_field) is None:
                errors.append(
                    {
                        "type": "missing",
                        "loc": ("body", required_field),
                        "msg": "Field is required.",
                        "input": None,
                    }
                )

        if len(errors) > 0:
            raise PolarRequestValidationError(errors)

        assert checkout.customer_name is not None
        assert checkout.customer_email is not None
        assert checkout.customer_billing_address is not None
        assert checkout.tax_amount is not None

        if checkout.payment_processor == PaymentProcessor.stripe:
            stripe_customer = stripe_service.create_customer(
                name=checkout.customer_name,
                email=checkout.customer_email,
                address=checkout.customer_billing_address.to_dict(),  # type: ignore
                tax_id_data=[]
                if checkout.customer_tax_id is None
                else [to_stripe_tax_id(checkout.customer_tax_id)],
            )
            payment_intent_metadata: dict[str, str] = {
                "checkout_id": str(checkout.id),
                "type": ProductType.product,
                "tax_amount": str(checkout.tax_amount),
                "tax_country": checkout.customer_billing_address.country,
            }
            if (
                state := checkout.customer_billing_address.get_unprefixed_state()
            ) is not None:
                payment_intent_metadata["tax_state"] = state
            payment_intent_params: stripe_lib.PaymentIntent.CreateParams = {
                "amount": checkout.total_amount or 0,
                "currency": checkout.currency or "usd",
                "automatic_payment_methods": {"enabled": True},
                "confirm": True,
                "confirmation_token": checkout_confirm.confirmation_token_id,
                "customer": stripe_customer.id,
                "metadata": payment_intent_metadata,
                "return_url": settings.generate_frontend_url(
                    f"/checkout/{checkout.client_secret}/confirmation"
                ),
            }
            if checkout.product_price.is_recurring:
                payment_intent_params["setup_future_usage"] = "off_session"

            try:
                payment_intent = stripe_service.create_payment_intent(
                    **payment_intent_params
                )
            except stripe_lib.StripeError as e:
                error = e.error
                error_type = error.type if error is not None else None
                error_message = error.message if error is not None else None
                raise PaymentError(checkout, error_type, error_message)

            checkout.payment_processor_metadata = {
                **checkout.payment_processor_metadata,
                "payment_intent_client_secret": payment_intent.client_secret,
                "payment_intent_status": payment_intent.status,
            }

        checkout.status = CheckoutStatus.confirmed
        session.add(checkout)
        return checkout

    async def handle_stripe_success(
        self,
        session: AsyncSession,
        checkout_id: uuid.UUID,
        payment_intent: stripe_lib.PaymentIntent,
    ) -> Checkout:
        checkout = await self.get(session, checkout_id)

        if checkout is None:
            raise CheckoutDoesNotExist(checkout_id, payment_intent.id)

        if checkout.status != CheckoutStatus.confirmed:
            raise NotConfirmedCheckout(checkout)

        if payment_intent.status != "succeeded":
            raise PaymentIntentNotSucceeded(checkout, payment_intent.id)

        if payment_intent.customer is None:
            raise NoCustomerOnPaymentIntent(checkout, payment_intent.id)

        if payment_intent.payment_method is None:
            raise NoPaymentMethodOnPaymentIntent(checkout, payment_intent.id)

        stripe_customer_id = get_expandable_id(payment_intent.customer)
        stripe_payment_method_id = get_expandable_id(payment_intent.payment_method)
        product_price = checkout.product_price
        metadata = {
            "type": ProductType.product,
            "product_id": str(checkout.product_id),
            "product_price_id": str(checkout.product_price_id),
        }
        idempotency_key = f"checkout_{checkout.id}"

        stripe_price_id = product_price.stripe_price_id
        # For pay-what-you-want prices, we need to generate a dedicated price in Stripe
        if isinstance(product_price, ProductPriceCustom):
            assert checkout.amount is not None
            assert checkout.currency is not None
            assert checkout.product.stripe_product_id is not None
            price_params: stripe_lib.Price.CreateParams = {
                "unit_amount": checkout.amount,
                "currency": checkout.currency,
                "metadata": {
                    "product_price_id": str(checkout.product_price_id),
                },
            }
            if product_price.is_recurring:
                price_params["recurring"] = {
                    "interval": product_price.recurring_interval.as_literal(),
                }
            stripe_custom_price = stripe_service.create_price_for_product(
                checkout.product.stripe_product_id,
                price_params,
                idempotency_key=f"{idempotency_key}_price",
            )
            stripe_price_id = stripe_custom_price.id

        if product_price.is_recurring:
            stripe_subscription, stripe_invoice = (
                stripe_service.create_out_of_band_subscription(
                    customer=stripe_customer_id,
                    currency=checkout.currency or "usd",
                    price=stripe_price_id,
                    metadata=metadata,
                    invoice_metadata={"payment_intent_id": payment_intent.id},
                    idempotency_key=idempotency_key,
                )
            )
            stripe_service.set_automatically_charged_subscription(
                stripe_subscription.id,
                stripe_payment_method_id,
                idempotency_key=f"{idempotency_key}_subscription_auto_charge",
            )
        else:
            stripe_invoice = stripe_service.create_out_of_band_invoice(
                customer=stripe_customer_id,
                currency=checkout.currency or "usd",
                price=stripe_price_id,
                metadata={
                    **metadata,
                    "payment_intent_id": payment_intent.id,
                },
                idempotency_key=idempotency_key,
            )

        # Sanity check to make sure we didn't mess up the amount.
        # Don't raise an error so the order can be successfully completed nonetheless.
        if stripe_invoice.total != payment_intent.amount:
            log.error(
                "Mismatch between payment intent and invoice amount",
                checkout=checkout.id,
                payment_intent=payment_intent.id,
                invoice=stripe_invoice.id,
            )

        checkout.status = CheckoutStatus.succeeded
        session.add(checkout)

        await publish(
            "checkout.updated", {}, checkout_client_secret=checkout.client_secret
        )

        return checkout

    async def handle_stripe_failure(
        self,
        session: AsyncSession,
        checkout_id: uuid.UUID,
        payment_intent: stripe_lib.PaymentIntent,
    ) -> Checkout:
        checkout = await self.get(session, checkout_id)

        if checkout is None:
            raise CheckoutDoesNotExist(checkout_id, payment_intent.id)

        # Checkout is not confirmed: do nothing
        # This is the case of an immediate failure, e.g. card declined
        # In this case, the checkout is still open and the user can retry
        if checkout.status != CheckoutStatus.confirmed:
            return checkout

        checkout.status = CheckoutStatus.failed
        session.add(checkout)

        await publish(
            "checkout.updated", {}, checkout_client_secret=checkout.client_secret
        )

        return checkout

    async def get_by_client_secret(
        self, session: AsyncSession, client_secret: str
    ) -> Checkout | None:
        statement = (
            select(Checkout)
            .where(
                Checkout.deleted_at.is_(None),
                Checkout.expires_at > utc_now(),
                Checkout.client_secret == client_secret,
            )
            .join(Checkout.product)
            .options(
                contains_eager(Checkout.product).options(
                    joinedload(Product.organization), joinedload(Product.product_medias)
                )
            )
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def _update_checkout(
        self,
        session: AsyncSession,
        checkout: Checkout,
        checkout_update: CheckoutUpdate | CheckoutUpdatePublic,
    ) -> Checkout:
        if checkout.status != CheckoutStatus.open:
            raise NotOpenCheckout(checkout)

        if checkout_update.product_price_id is not None:
            price = await product_price_service.get_by_id(
                session, checkout_update.product_price_id
            )
            if (
                price is None
                or price.product.organization_id != checkout.product.organization_id
            ):
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "product_price_id"),
                            "msg": "Price does not exist.",
                            "input": checkout_update.product_price_id,
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
                            "input": checkout_update.product_price_id,
                        }
                    ]
                )

            if price.product_id != checkout.product_id:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "product_price_id"),
                            "msg": "Price does not belong to the product.",
                            "input": checkout_update.product_price_id,
                        }
                    ]
                )

            checkout.product_price = price
            if isinstance(price, ProductPriceFixed):
                checkout.amount = price.price_amount
                checkout.currency = price.price_currency
            elif isinstance(price, ProductPriceCustom):
                checkout.currency = price.price_currency
            elif isinstance(price, ProductPriceFree):
                checkout.amount = None
                checkout.currency = None

        if checkout_update.amount is not None:
            price = checkout.product_price
            if not isinstance(price, ProductPriceCustom):
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "amount"),
                            "msg": "Amount can only be set on custom prices.",
                            "input": checkout_update.amount,
                        }
                    ]
                )
            elif (
                price.minimum_amount is not None
                and checkout_update.amount < price.minimum_amount
            ):
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "greater_than_equal",
                            "loc": ("body", "amount"),
                            "msg": "Amount is below minimum.",
                            "input": checkout_update.amount,
                            "ctx": {"ge": price.minimum_amount},
                        }
                    ]
                )
            elif (
                price.maximum_amount is not None
                and checkout_update.amount > price.maximum_amount
            ):
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "less_than_equal",
                            "loc": ("body", "amount"),
                            "msg": "Amount is above maximum.",
                            "input": checkout_update.amount,
                            "ctx": {"le": price.maximum_amount},
                        }
                    ]
                )

            checkout.amount = checkout_update.amount

        if checkout_update.customer_billing_address:
            checkout.customer_billing_address = checkout_update.customer_billing_address

        if (
            checkout_update.customer_tax_id is None
            and "customer_tax_id" in checkout_update.model_fields_set
        ):
            checkout.customer_tax_id = None
        else:
            customer_tax_id_number = (
                checkout_update.customer_tax_id or checkout.customer_tax_id_number
            )
            if customer_tax_id_number is not None:
                customer_billing_address = (
                    checkout_update.customer_billing_address
                    or checkout.customer_billing_address
                )
                if customer_billing_address is None:
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "missing",
                                "loc": ("body", "customer_billing_address"),
                                "msg": "Country is required to validate tax ID.",
                                "input": None,
                            }
                        ]
                    )
                try:
                    checkout.customer_tax_id = validate_tax_id(
                        customer_tax_id_number, customer_billing_address.country
                    )
                except ValueError as e:
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "customer_tax_id"),
                                "msg": "Invalid tax ID.",
                                "input": customer_tax_id_number,
                            }
                        ]
                    ) from e

        if (
            isinstance(checkout_update, CheckoutUpdate)
            and checkout_update.metadata is not None
        ):
            checkout.user_metadata = checkout_update.metadata

        for attr, value in checkout_update.model_dump(
            exclude_unset=True,
            exclude={
                "product_price_id",
                "amount",
                "customer_billing_address",
                "customer_tax_id",
                "metadata",
            },
        ).items():
            setattr(checkout, attr, value)

        session.add(checkout)
        return checkout

    async def _update_checkout_tax(
        self, session: AsyncSession, checkout: Checkout
    ) -> Checkout:
        if (
            checkout.currency is not None
            and checkout.amount is not None
            and checkout.customer_billing_address is not None
            and checkout.product.stripe_product_id is not None
        ):
            try:
                tax_amount = await calculate_tax(
                    checkout.currency,
                    checkout.amount,
                    str(checkout.id),
                    checkout.product.stripe_product_id,
                    checkout.customer_billing_address,
                    [checkout.customer_tax_id]
                    if checkout.customer_tax_id is not None
                    else [],
                )
                checkout.tax_amount = tax_amount
            except TaxCalculationError:
                checkout.tax_amount = None
                raise
            finally:
                session.add(checkout)

        return checkout

    def _get_readable_checkout_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Checkout]]:
        statement = (
            select(Checkout)
            .where(Checkout.deleted_at.is_(None))
            .join(Checkout.product)
            .options(contains_eager(Checkout.product))
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


checkout = CheckoutService(Checkout)
