import contextlib
import typing
import uuid
from collections.abc import AsyncGenerator, AsyncIterator, Sequence

import stripe as stripe_lib
import structlog
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import contains_eager, joinedload, selectinload

from polar.auth.models import Anonymous, AuthSubject
from polar.checkout.schemas import (
    CheckoutConfirm,
    CheckoutCreate,
    CheckoutCreatePublic,
    CheckoutPriceCreate,
    CheckoutProductCreate,
    CheckoutUpdate,
    CheckoutUpdatePublic,
)
from polar.config import settings
from polar.custom_field.data import validate_custom_field_data
from polar.customer.repository import CustomerRepository
from polar.customer_session.service import customer_session as customer_session_service
from polar.discount.service import DiscountNotRedeemableError
from polar.discount.service import discount as discount_service
from polar.enums import PaymentProcessor, SubscriptionRecurringInterval
from polar.exceptions import (
    NotPermitted,
    PaymentNotReady,
    PolarError,
    PolarRequestValidationError,
    ResourceNotFound,
    ValidationError,
)
from polar.integrations.stripe.schemas import ProductType
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.address import Address
from polar.kit.crypto import generate_token
from polar.kit.operator import attrgetter
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
from polar.kit.tax import TaxID, to_stripe_tax_id, validate_tax_id
from polar.locker import Locker
from polar.logging import Logger
from polar.models import (
    Account,
    Checkout,
    CheckoutLink,
    Customer,
    Discount,
    LegacyRecurringProductPriceCustom,
    LegacyRecurringProductPriceFixed,
    Organization,
    Payment,
    PaymentMethod,
    Product,
    ProductPrice,
    Subscription,
    User,
)
from polar.models.checkout import CheckoutStatus
from polar.models.checkout_product import CheckoutProduct
from polar.models.discount import DiscountDuration
from polar.models.order import OrderBillingReason
from polar.models.product_price import ProductPriceAmountType
from polar.models.webhook_endpoint import WebhookEventType
from polar.order.service import order as order_service
from polar.organization.repository import OrganizationRepository
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.guard import (
    is_currency_price,
    is_custom_price,
    is_discount_applicable,
    is_fixed_price,
)
from polar.product.repository import ProductPriceRepository, ProductRepository
from polar.product.service import product as product_service
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import subscription as subscription_service
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from ..kit.tax import InvalidTaxID, TaxCalculationError, calculate_tax
from . import ip_geolocation
from .eventstream import CheckoutEvent, publish_checkout_event
from .repository import CheckoutRepository
from .sorting import CheckoutSortProperty

log: Logger = structlog.get_logger()


class CheckoutError(PolarError): ...


class ExpiredCheckoutError(CheckoutError):
    def __init__(self) -> None:
        message = "This checkout session has expired."
        super().__init__(message, 410)


class AlreadyActiveSubscriptionError(CheckoutError):
    def __init__(self) -> None:
        message = "You already have an active subscription."
        super().__init__(message, 403)


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
    def __init__(self, checkout_id: uuid.UUID) -> None:
        self.checkout_id = checkout_id
        message = f"Checkout {checkout_id} does not exist."
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


class PaymentDoesNotExist(CheckoutError):
    def __init__(self, payment_id: uuid.UUID) -> None:
        self.payment_id = payment_id
        message = f"Payment {payment_id} does not exist."
        super().__init__(message)


class ArchivedPriceCheckout(CheckoutError):
    def __init__(self, checkout: Checkout) -> None:
        self.checkout = checkout
        self.price = checkout.product_price
        message = (
            f"Checkout {checkout.id} has an archived price: {checkout.product_price_id}"
        )
        super().__init__(message)


class IntentNotSucceeded(CheckoutError):
    def __init__(self, checkout: Checkout, intent_id: str) -> None:
        self.checkout = checkout
        self.intent_id = intent_id
        message = f"Intent {intent_id} for {checkout.id} is not successful."
        super().__init__(message)


class NoPaymentMethodOnIntent(CheckoutError):
    def __init__(self, checkout: Checkout, intent_id: str) -> None:
        self.checkout = checkout
        self.intent_id = intent_id
        message = (
            f"Intent {intent_id} for {checkout.id} has no payment method associated."
        )
        super().__init__(message)


class PaymentRequired(CheckoutError):
    def __init__(self, checkout: Checkout) -> None:
        self.checkout = checkout
        message = f"{checkout.id} requires a payment."
        super().__init__(message)


CHECKOUT_CLIENT_SECRET_PREFIX = "polar_c_"


class CheckoutService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        product_id: Sequence[uuid.UUID] | None = None,
        customer_id: Sequence[uuid.UUID] | None = None,
        status: Sequence[CheckoutStatus] | None = None,
        query: str | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[CheckoutSortProperty]] = [
            (CheckoutSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Checkout], int]:
        repository = CheckoutRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).options(
            *repository.get_eager_options(product_load=contains_eager(Checkout.product))
        )

        if organization_id is not None:
            statement = statement.where(Product.organization_id.in_(organization_id))

        if product_id is not None:
            statement = statement.where(Checkout.product_id.in_(product_id))

        if customer_id is not None:
            statement = statement.where(Checkout.customer_id.in_(customer_id))

        if status is not None:
            statement = statement.where(Checkout.status.in_(status))

        if query is not None:
            statement = statement.where(Checkout.customer_email.ilike(f"%{query}%"))

        statement = repository.apply_sorting(statement, sorting)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get_by_id(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Checkout | None:
        repository = CheckoutRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Checkout.id == id)
            .options(
                *repository.get_eager_options(
                    product_load=contains_eager(Checkout.product)
                )
            )
        )
        checkout = await repository.get_one_or_none(statement)

        if checkout is None:
            return None

        if checkout.product.organization.is_blocked():
            raise NotPermitted()

        return checkout

    async def create(
        self,
        session: AsyncSession,
        checkout_create: CheckoutCreate,
        auth_subject: AuthSubject[User | Organization],
        ip_geolocation_client: ip_geolocation.IPGeolocationClient | None = None,
    ) -> Checkout:
        if isinstance(checkout_create, CheckoutPriceCreate):
            products, product, price = await self._get_validated_price(
                session, auth_subject, checkout_create.product_price_id
            )
        elif isinstance(checkout_create, CheckoutProductCreate):
            products, product, price = await self._get_validated_product(
                session, auth_subject, checkout_create.product_id
            )
        else:
            products = await self._get_validated_products(
                session, auth_subject, checkout_create.products
            )
            product = products[0]
            # Select the static price in priority, as it determines the amount and specific behavior, like PWYW
            price = product.get_static_price() or product.prices[0]

        if product.organization.is_blocked():
            raise NotPermitted()

        if checkout_create.amount is not None and is_custom_price(price):
            if (
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

        discount: Discount | None = None
        if checkout_create.discount_id is not None:
            discount = await self._get_validated_discount(
                session, product, price, discount_id=checkout_create.discount_id
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
            except InvalidTaxID as e:
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

        product = await self._eager_load_product(session, product)

        subscription: Subscription | None = None
        customer: Customer | None = None
        customer_repository = CustomerRepository.from_session(session)
        if checkout_create.subscription_id is not None:
            subscription, customer = await self._get_validated_subscription(
                session, checkout_create.subscription_id, product.organization_id
            )
        elif checkout_create.customer_id is not None:
            customer = await customer_repository.get_by_id_and_organization(
                checkout_create.customer_id, product.organization_id
            )
            if customer is None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "customer_id"),
                            "msg": "Customer does not exist.",
                            "input": checkout_create.customer_id,
                        }
                    ]
                )
        elif checkout_create.external_customer_id is not None:
            # Link customer by external ID, if it exists.
            # It not, that's fine': we'll create a new customer on confirm.
            customer = await customer_repository.get_by_external_id_and_organization(
                checkout_create.external_customer_id, product.organization_id
            )

        amount = checkout_create.amount
        currency = None
        if is_fixed_price(price):
            amount = price.price_amount
            currency = price.price_currency
        elif is_custom_price(price):
            currency = price.price_currency
            if amount is None:
                amount = (
                    price.preset_amount
                    or price.minimum_amount
                    or settings.CUSTOM_PRICE_PRESET_FALLBACK
                )
        else:
            amount = 0
            currency = price.price_currency if is_currency_price(price) else "usd"

        custom_field_data = validate_custom_field_data(
            product.attached_custom_fields,
            checkout_create.custom_field_data,
            validate_required=False,
        )

        checkout_products = [
            CheckoutProduct(product=product, order=i)
            for i, product in enumerate(products)
        ]

        require_billing_address = checkout_create.require_billing_address
        customer_billing_address = checkout_create.customer_billing_address
        if customer_billing_address is not None and any(
            (
                customer_billing_address.has_address(),
                customer_billing_address.has_state()
                and customer_billing_address.country not in {"US", "CA"},
            )
        ):
            require_billing_address = True

        checkout = Checkout(
            payment_processor=PaymentProcessor.stripe,
            client_secret=generate_token(prefix=CHECKOUT_CLIENT_SECRET_PREFIX),
            amount=amount,
            currency=currency,
            checkout_products=checkout_products,
            product=product,
            product_price=price,
            discount=discount,
            customer_billing_address=customer_billing_address,
            require_billing_address=require_billing_address,
            customer_tax_id=customer_tax_id,
            subscription=subscription,
            customer=customer,
            custom_field_data=custom_field_data,
            **checkout_create.model_dump(
                exclude={
                    "product_price_id",
                    "product_id",
                    "products",
                    "amount",
                    "require_billing_address",
                    "customer_billing_address",
                    "customer_tax_id",
                    "subscription_id",
                    "custom_field_data",
                },
                by_alias=True,
            ),
        )

        if checkout.customer is not None:
            prefill_attributes = (
                "email",
                "name",
                "billing_address",
                "tax_id",
            )
            for attribute in prefill_attributes:
                checkout_attribute = f"customer_{attribute}"
                if getattr(checkout, checkout_attribute) is None:
                    setattr(
                        checkout,
                        checkout_attribute,
                        getattr(checkout.customer, attribute),
                    )

        if checkout.payment_processor == PaymentProcessor.stripe:
            checkout.payment_processor_metadata = {
                **(checkout.payment_processor_metadata or {}),
                "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
            }
            if checkout.customer and checkout.customer.stripe_customer_id is not None:
                stripe_customer_session = await stripe_service.create_customer_session(
                    checkout.customer.stripe_customer_id
                )
                checkout.payment_processor_metadata = {
                    **(checkout.payment_processor_metadata or {}),
                    "customer_session_client_secret": stripe_customer_session.client_secret,
                }

        session.add(checkout)

        checkout = await self._update_checkout_ip_geolocation(
            session, checkout, ip_geolocation_client
        )

        try:
            checkout = await self._update_checkout_tax(session, checkout)
        # Swallow incomplete tax calculation error: require it only on confirm
        except TaxCalculationError:
            pass

        await session.flush()
        await self._after_checkout_created(session, checkout)

        return checkout

    async def client_create(
        self,
        session: AsyncSession,
        checkout_create: CheckoutCreatePublic,
        auth_subject: AuthSubject[User | Anonymous],
        ip_geolocation_client: ip_geolocation.IPGeolocationClient | None = None,
        ip_address: str | None = None,
    ) -> Checkout:
        product_repository = ProductRepository.from_session(session)
        product = await product_repository.get_by_id(
            checkout_create.product_id, options=product_repository.get_eager_options()
        )

        if product is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Product does not exist.",
                        "input": checkout_create.product_id,
                    }
                ]
            )

        if product.is_archived:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Product is archived.",
                        "input": checkout_create.product_id,
                    }
                ]
            )

        if product.organization.blocked_at is not None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Organization is blocked.",
                        "input": checkout_create.product_id,
                    }
                ]
            )

        price = product.prices[0]

        amount = 0
        currency = "usd"
        if is_fixed_price(price):
            amount = price.price_amount
            currency = price.price_currency
        elif is_custom_price(price):
            currency = price.price_currency
            amount = (
                price.preset_amount
                or price.minimum_amount
                or settings.CUSTOM_PRICE_PRESET_FALLBACK
            )
        elif is_currency_price(price):
            currency = price.price_currency

        checkout = Checkout(
            payment_processor=PaymentProcessor.stripe,
            client_secret=generate_token(prefix=CHECKOUT_CLIENT_SECRET_PREFIX),
            amount=amount,
            currency=currency,
            checkout_products=[CheckoutProduct(product=product, order=0)],
            product=product,
            product_price=price,
            discount=None,
            customer=None,
            subscription=None,
            customer_email=checkout_create.customer_email,
        )

        if checkout.payment_processor == PaymentProcessor.stripe:
            checkout.payment_processor_metadata = {
                **(checkout.payment_processor_metadata or {}),
                "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
            }
            if checkout.customer and checkout.customer.stripe_customer_id is not None:
                stripe_customer_session = await stripe_service.create_customer_session(
                    checkout.customer.stripe_customer_id
                )
                checkout.payment_processor_metadata = {
                    **(checkout.payment_processor_metadata or {}),
                    "customer_session_client_secret": stripe_customer_session.client_secret,
                }

        checkout.customer_ip_address = ip_address
        checkout = await self._update_checkout_ip_geolocation(
            session, checkout, ip_geolocation_client
        )

        try:
            checkout = await self._update_checkout_tax(session, checkout)
        # Swallow incomplete tax calculation error: require it only on confirm
        except TaxCalculationError:
            pass

        session.add(checkout)

        await session.flush()
        await self._after_checkout_created(session, checkout)

        return checkout

    async def checkout_link_create(
        self,
        session: AsyncSession,
        checkout_link: CheckoutLink,
        embed_origin: str | None = None,
        ip_geolocation_client: ip_geolocation.IPGeolocationClient | None = None,
        ip_address: str | None = None,
        **query_metadata: str | None,
    ) -> Checkout:
        products: list[Product] = []
        for product in checkout_link.products:
            if not product.is_archived:
                products.append(product)

        if len(products) == 0:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "products"),
                        "msg": "No valid products.",
                        "input": checkout_link.products,
                    }
                ]
            )

        product = products[0]
        price = product.prices[0]

        amount = 0
        currency = "usd"
        if is_fixed_price(price):
            amount = price.price_amount
            currency = price.price_currency
        elif is_custom_price(price):
            currency = price.price_currency
            amount = (
                price.preset_amount
                or price.minimum_amount
                or settings.CUSTOM_PRICE_PRESET_FALLBACK
            )
        elif is_currency_price(price):
            currency = price.price_currency

        discount: Discount | None = None
        if checkout_link.discount_id is not None:
            try:
                discount = await self._get_validated_discount(
                    session, product, price, discount_id=checkout_link.discount_id
                )
            # If the discount is not valid, just ignore it
            except PolarRequestValidationError:
                pass

        checkout = Checkout(
            client_secret=generate_token(prefix=CHECKOUT_CLIENT_SECRET_PREFIX),
            amount=amount,
            currency=currency,
            allow_discount_codes=checkout_link.allow_discount_codes,
            require_billing_address=checkout_link.require_billing_address,
            checkout_products=[
                CheckoutProduct(product=p, order=i) for i, p in enumerate(products)
            ],
            product=product,
            product_price=price,
            discount=discount,
            embed_origin=embed_origin,
            customer_ip_address=ip_address,
            payment_processor=checkout_link.payment_processor,
            success_url=checkout_link.success_url,
            user_metadata=checkout_link.user_metadata,
        )

        for key, value in query_metadata.items():
            if value is not None and key not in checkout.user_metadata:
                checkout.user_metadata = {
                    **(checkout.user_metadata or {}),
                    key: value,
                }

        if checkout.payment_processor == PaymentProcessor.stripe:
            checkout.payment_processor_metadata = {
                **(checkout.payment_processor_metadata or {}),
                "publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
            }

        session.add(checkout)

        checkout = await self._update_checkout_ip_geolocation(
            session, checkout, ip_geolocation_client
        )

        try:
            checkout = await self._update_checkout_tax(session, checkout)
        # Swallow incomplete tax calculation error: require it only on confirm
        except TaxCalculationError:
            pass

        await session.flush()
        await self._after_checkout_created(session, checkout)

        return checkout

    async def update(
        self,
        session: AsyncSession,
        locker: Locker,
        checkout: Checkout,
        checkout_update: CheckoutUpdate | CheckoutUpdatePublic,
        ip_geolocation_client: ip_geolocation.IPGeolocationClient | None = None,
    ) -> Checkout:
        async with self._lock_checkout_update(session, locker, checkout) as checkout:
            checkout = await self._update_checkout(
                session, checkout, checkout_update, ip_geolocation_client
            )
            try:
                checkout = await self._update_checkout_tax(session, checkout)
            # Swallow incomplete tax calculation error: require it only on confirm
            except TaxCalculationError:
                pass

            await self._after_checkout_updated(session, checkout)
            return checkout

    async def confirm(
        self,
        session: AsyncSession,
        locker: Locker,
        auth_subject: AuthSubject[User | Anonymous],
        checkout: Checkout,
        checkout_confirm: CheckoutConfirm,
    ) -> Checkout:
        async with self._lock_checkout_update(session, locker, checkout) as checkout:
            checkout = await self._update_checkout(session, checkout, checkout_confirm)
            # When redeeming a discount, we need to lock the discount to prevent concurrent redemptions
            if checkout.discount is not None:
                try:
                    async with discount_service.redeem_discount(
                        session, locker, checkout.discount
                    ) as discount_redemption:
                        discount_redemption.checkout = checkout
                        return await self._confirm_inner(
                            session, auth_subject, checkout, checkout_confirm
                        )
                except DiscountNotRedeemableError as e:
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "discount_id"),
                                "msg": "Discount is no longer redeemable.",
                                "input": checkout.discount.id,
                            }
                        ]
                    ) from e

            return await self._confirm_inner(
                session, auth_subject, checkout, checkout_confirm
            )

    async def _confirm_inner(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Anonymous],
        checkout: Checkout,
        checkout_confirm: CheckoutConfirm,
    ) -> Checkout:
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

        # Case where the price was archived after the checkout was created
        if checkout.product_price.is_archived:
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "product_price_id"),
                    "msg": "Price is archived.",
                    "input": checkout.product_price_id,
                }
            )

        # Check if organization can accept payments (only block paid transactions)
        if (
            checkout.is_payment_required
            and not await organization_service.is_organization_ready_for_payment(
                session, checkout.product.organization
            )
        ):
            raise PaymentNotReady()

        required_fields = self._get_required_confirm_fields(checkout)
        for required_field in required_fields:
            if (
                attrgetter(checkout, required_field) is None
                and attrgetter(checkout_confirm, required_field) is None
            ):
                errors.append(
                    {
                        "type": "missing",
                        "loc": ("body", *required_field),
                        "msg": "Field is required.",
                        "input": None,
                    }
                )

        if checkout.require_billing_address or checkout.is_business_customer:
            if (
                checkout.customer_billing_address is None
                or not checkout.customer_billing_address.has_address()
            ):
                errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "customer_billing_address"),
                        "msg": "Full billing address is required.",
                        "input": checkout.customer_billing_address,
                    }
                )

        if (
            checkout.is_payment_form_required
            and checkout_confirm.confirmation_token_id is None
        ):
            errors.append(
                {
                    "type": "missing",
                    "loc": ("body", "confirmation_token_id"),
                    "msg": "Confirmation token is required.",
                    "input": None,
                }
            )

        if len(errors) > 0:
            raise PolarRequestValidationError(errors)

        if checkout.payment_processor == PaymentProcessor.stripe:
            async with self._create_or_update_customer(
                session, auth_subject, checkout
            ) as customer:
                checkout.customer = customer
                stripe_customer_id = customer.stripe_customer_id
                assert stripe_customer_id is not None
                checkout.payment_processor_metadata = {
                    **checkout.payment_processor_metadata,
                    "customer_id": stripe_customer_id,
                }

                if checkout.is_payment_form_required:
                    assert checkout_confirm.confirmation_token_id is not None
                    assert checkout.customer_billing_address is not None
                    intent_metadata: dict[str, str] = {
                        "checkout_id": str(checkout.id),
                        "type": ProductType.product,
                        "tax_amount": str(checkout.tax_amount),
                        "tax_country": checkout.customer_billing_address.country,
                    }
                    if (
                        state
                        := checkout.customer_billing_address.get_unprefixed_state()
                    ) is not None:
                        intent_metadata["tax_state"] = state

                    intent: stripe_lib.PaymentIntent | stripe_lib.SetupIntent
                    try:
                        if checkout.is_payment_required:
                            payment_intent_params: stripe_lib.PaymentIntent.CreateParams = {
                                "amount": checkout.total_amount,
                                "currency": checkout.currency,
                                "automatic_payment_methods": {"enabled": True},
                                "confirm": True,
                                "confirmation_token": checkout_confirm.confirmation_token_id,
                                "customer": stripe_customer_id,
                                "statement_descriptor_suffix": checkout.organization.statement_descriptor,
                                "description": f"{checkout.organization.name} — {checkout.product.name}",
                                "metadata": intent_metadata,
                                "return_url": settings.generate_frontend_url(
                                    f"/checkout/{checkout.client_secret}/confirmation"
                                ),
                            }
                            if checkout.product.is_recurring:
                                payment_intent_params["setup_future_usage"] = (
                                    "off_session"
                                )
                            intent = await stripe_service.create_payment_intent(
                                **payment_intent_params
                            )
                        else:
                            setup_intent_params: stripe_lib.SetupIntent.CreateParams = {
                                "automatic_payment_methods": {"enabled": True},
                                "confirm": True,
                                "confirmation_token": checkout_confirm.confirmation_token_id,
                                "customer": stripe_customer_id,
                                "description": f"{checkout.organization.name} — {checkout.product.name}",
                                "metadata": intent_metadata,
                                "return_url": settings.generate_frontend_url(
                                    f"/checkout/{checkout.client_secret}/confirmation"
                                ),
                            }
                            intent = await stripe_service.create_setup_intent(
                                **setup_intent_params
                            )
                    except stripe_lib.StripeError as e:
                        error = e.error
                        error_type = error.type if error is not None else None
                        error_message = error.message if error is not None else None
                        raise PaymentError(checkout, error_type, error_message) from e
                    else:
                        checkout.payment_processor_metadata = {
                            **checkout.payment_processor_metadata,
                            "intent_client_secret": intent.client_secret,
                            "intent_status": intent.status,
                        }

        if not checkout.is_payment_form_required:
            enqueue_job("checkout.handle_free_success", checkout_id=checkout.id)

        checkout.status = CheckoutStatus.confirmed
        session.add(checkout)

        await self._after_checkout_updated(session, checkout)

        assert checkout.customer is not None
        (
            customer_session_token,
            _,
        ) = await customer_session_service.create_customer_session(
            session, checkout.customer
        )
        checkout.customer_session_token = customer_session_token

        return checkout

    async def handle_success(
        self,
        session: AsyncSession,
        checkout: Checkout,
        payment: Payment | None = None,
        payment_method: PaymentMethod | None = None,
    ) -> Checkout:
        if checkout.status != CheckoutStatus.confirmed:
            raise NotConfirmedCheckout(checkout)

        product_price = checkout.product_price
        if product_price.is_archived:
            raise ArchivedPriceCheckout(checkout)

        product = checkout.product
        subscription: Subscription | None = None
        if product.is_recurring:
            if not product.organization.subscriptions_billing_engine:
                (
                    subscription,
                    _,
                ) = await subscription_service.create_or_update_from_checkout_stripe(
                    session, checkout, payment, payment_method
                )
            else:
                (
                    subscription,
                    created,
                ) = await subscription_service.create_or_update_from_checkout(
                    session, checkout, payment_method
                )
                await order_service.create_from_checkout_subscription(
                    session,
                    checkout,
                    subscription,
                    OrderBillingReason.subscription_create
                    if created
                    else OrderBillingReason.subscription_update,
                    payment,
                )
        else:
            await order_service.create_from_checkout_one_time(
                session, checkout, payment
            )

        repository = CheckoutRepository.from_session(session)
        checkout = await repository.update(
            checkout,
            update_dict={
                "status": CheckoutStatus.succeeded,
                "payment_processor_metadata": {
                    **checkout.payment_processor_metadata,
                    "intent_status": "succeeded",
                },
            },
        )

        await self._after_checkout_updated(session, checkout)

        return checkout

    async def handle_failure(
        self, session: AsyncSession, checkout: Checkout, payment: Payment | None = None
    ) -> Checkout:
        # Checkout is in an unrecoverable status: do nothing
        if checkout.status in {
            CheckoutStatus.expired,
            CheckoutStatus.succeeded,
            CheckoutStatus.failed,
        }:
            return checkout

        # Put back checkout in open state so the customer can try another payment method
        checkout.status = CheckoutStatus.open
        checkout.payment_processor_metadata = {
            k: v
            for k, v in checkout.payment_processor_metadata.items()
            if k not in {"intent_status", "intent_client_secret"}
        }
        session.add(checkout)

        # Make sure to remove the Discount Redemptions
        # To avoid race conditions, we save the Discount Redemption when *confirming*
        # the Checkout.
        # However, if it ultimately fails, we need to free up the Discount Redemption.
        await discount_service.remove_checkout_redemption(session, checkout)

        await self._after_checkout_updated(session, checkout)

        return checkout

    async def get_by_client_secret(
        self, session: AsyncSession, client_secret: str
    ) -> Checkout:
        repository = CheckoutRepository.from_session(session)
        checkout = await repository.get_by_client_secret(
            client_secret, options=repository.get_eager_options()
        )
        if checkout is None:
            raise ResourceNotFound()
        if checkout.is_expired:
            raise ExpiredCheckoutError()
        return checkout

    async def _get_validated_price(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_price_id: uuid.UUID,
    ) -> tuple[Sequence[Product], Product, ProductPrice]:
        product_price_repository = ProductPriceRepository.from_session(session)
        price = await product_price_repository.get_readable_by_id(
            product_price_id,
            auth_subject,
            options=(
                contains_eager(ProductPrice.product).options(
                    joinedload(Product.organization)
                    .joinedload(Organization.account)
                    .joinedload(Account.admin),
                    selectinload(Product.prices),
                ),
            ),
        )

        if price is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_price_id"),
                        "msg": "Price does not exist.",
                        "input": product_price_id,
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
                        "input": product_price_id,
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
                        "input": product_price_id,
                    }
                ]
            )

        return [product], product, price

    async def _get_validated_product(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_id: uuid.UUID,
    ) -> tuple[Sequence[Product], Product, ProductPrice]:
        product = await product_service.get(session, auth_subject, product_id)

        if product is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Product does not exist.",
                        "input": product_id,
                    }
                ]
            )

        if product.is_archived:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "product_id"),
                        "msg": "Product is archived.",
                        "input": product_id,
                    }
                ]
            )

        # Select the static price in priority, as it determines the amount and specific behavior, like PWYW
        price = product.get_static_price() or product.prices[0]

        return [product], product, price

    async def _get_validated_products(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        product_ids: Sequence[uuid.UUID],
    ) -> Sequence[Product]:
        products: list[Product] = []
        errors: list[ValidationError] = []

        for index, product_id in enumerate(product_ids):
            product = await product_service.get(session, auth_subject, product_id)

            if product is None:
                errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "products", index),
                        "msg": "Product does not exist.",
                        "input": product_id,
                    }
                )
                continue

            if product.is_archived:
                errors.append(
                    {
                        "type": "value_error",
                        "loc": ("body", "products", index),
                        "msg": "Product is archived.",
                        "input": product_id,
                    }
                )
                continue

            products.append(product)

        organization_ids = {product.organization_id for product in products}
        if len(organization_ids) > 1:
            errors.append(
                {
                    "type": "value_error",
                    "loc": ("body", "products"),
                    "msg": "Products must all belong to the same organization.",
                    "input": products,
                }
            )

        if len(errors) > 0:
            raise PolarRequestValidationError(errors)

        return products

    @typing.overload
    async def _get_validated_discount(
        self,
        session: AsyncSession,
        product: Product,
        price: ProductPrice,
        *,
        discount_id: uuid.UUID,
    ) -> Discount: ...

    @typing.overload
    async def _get_validated_discount(
        self,
        session: AsyncSession,
        product: Product,
        price: ProductPrice,
        *,
        discount_code: str,
    ) -> Discount: ...

    async def _get_validated_discount(
        self,
        session: AsyncSession,
        product: Product,
        price: ProductPrice,
        *,
        discount_id: uuid.UUID | None = None,
        discount_code: str | None = None,
    ) -> Discount:
        loc_field = "discount_id" if discount_id is not None else "discount_code"

        if not any(is_discount_applicable(price) for price in product.prices):
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", loc_field),
                        "msg": "Discounts are not applicable to this product.",
                        "input": discount_id,
                    }
                ]
            )

        discount: Discount | None = None
        if discount_id is not None:
            discount = await discount_service.get_by_id_and_organization(
                session, discount_id, product.organization, products=[product]
            )
        elif discount_code is not None:
            discount = await discount_service.get_by_code_and_product(
                session, discount_code, product
            )

        if discount is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", loc_field),
                        "msg": "Discount does not exist.",
                        "input": discount_id,
                    }
                ]
            )

        if (
            product.recurring_interval is None
            and not isinstance(
                price,
                LegacyRecurringProductPriceFixed | LegacyRecurringProductPriceCustom,
            )
            and discount.duration == DiscountDuration.repeating
        ):
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", loc_field),
                        "msg": "Discount is not applicable to this product.",
                        "input": discount_id,
                    }
                ]
            )

        return discount

    async def _get_validated_subscription(
        self,
        session: AsyncSession,
        subscription_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> tuple[Subscription, Customer]:
        subscription_repository = SubscriptionRepository.from_session(session)
        subscription = await subscription_repository.get_by_id_and_organization(
            subscription_id,
            organization_id,
            options=(joinedload(Subscription.customer),),
        )

        if subscription is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "subscription_id"),
                        "msg": "Subscription does not exist.",
                        "input": subscription_id,
                    }
                ]
            )

        for price in subscription.prices:
            if price.amount_type != ProductPriceAmountType.free:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "subscription_id"),
                            "msg": "Only free subscriptions can be upgraded.",
                            "input": subscription_id,
                        }
                    ]
                )

        return subscription, subscription.customer

    @contextlib.asynccontextmanager
    async def _lock_checkout_update(
        self, session: AsyncSession, locker: Locker, checkout: Checkout
    ) -> AsyncIterator[Checkout]:
        """
        Set a lock to prevent updating the checkout while confirming.
        We've seen in the wild someone switching pricing while the payment was being made!

        The timeout is purposely set to 10 seconds, a high value.
        We've seen in the past Stripe payment requests taking more than 5 seconds,
        causing the lock to expire while waiting for the payment to complete.
        """
        async with locker.lock(
            f"checkout:{checkout.id}", timeout=10, blocking_timeout=10
        ):
            # Refresh the checkout status: it may have been confirmed while waiting for the lock
            await session.refresh(checkout, {"status"})
            yield checkout

    async def _update_checkout(
        self,
        session: AsyncSession,
        checkout: Checkout,
        checkout_update: CheckoutUpdate | CheckoutUpdatePublic | CheckoutConfirm,
        ip_geolocation_client: ip_geolocation.IPGeolocationClient | None = None,
    ) -> Checkout:
        if checkout.status != CheckoutStatus.open:
            raise NotOpenCheckout(checkout)

        if checkout_update.product_id is not None:
            product_repository = ProductRepository.from_session(session)
            product = await product_repository.get_by_id_and_checkout(
                checkout_update.product_id,
                checkout.id,
                options=product_repository.get_eager_options(),
            )

            if product is None:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "product_id"),
                            "msg": "Product is not available in this checkout.",
                            "input": checkout_update.product_id,
                        }
                    ]
                )

            if product.is_archived:
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": ("body", "product_id"),
                            "msg": "Product is archived.",
                            "input": checkout_update.product_id,
                        }
                    ]
                )

            checkout.product = product

            if checkout_update.product_price_id is not None:
                price = product.get_price(checkout_update.product_price_id)
                if price is None:
                    raise PolarRequestValidationError(
                        [
                            {
                                "type": "value_error",
                                "loc": ("body", "product_price_id"),
                                "msg": "Price is not available in this checkout.",
                                "input": checkout_update.product_price_id,
                            }
                        ]
                    )
            else:
                price = product.prices[0]

            checkout.product_price = price
            checkout.amount = 0
            checkout.currency = "usd"
            if is_fixed_price(price):
                checkout.amount = price.price_amount
                checkout.currency = price.price_currency
            elif is_custom_price(price):
                checkout.amount = (
                    price.preset_amount
                    or price.minimum_amount
                    or settings.CUSTOM_PRICE_PRESET_FALLBACK
                )
                checkout.currency = price.price_currency
            elif is_currency_price(price):
                checkout.currency = price.price_currency

            # When changing product, remove the discount if it's not applicable
            if checkout.discount is not None and not checkout.discount.is_applicable(
                checkout.product
            ):
                checkout.discount = None

        price = checkout.product_price
        if checkout_update.amount is not None and is_custom_price(price):
            if (
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

        if isinstance(checkout_update, CheckoutUpdate):
            if checkout_update.discount_id is not None:
                checkout.discount = await self._get_validated_discount(
                    session,
                    checkout.product,
                    checkout.product_price,
                    discount_id=checkout_update.discount_id,
                )
            # User explicitly removed the discount
            elif "discount_id" in checkout_update.model_fields_set:
                checkout.discount = None
        elif (
            isinstance(checkout_update, CheckoutUpdatePublic)
            and checkout.allow_discount_codes
        ):
            if checkout_update.discount_code is not None:
                discount = await self._get_validated_discount(
                    session,
                    checkout.product,
                    checkout.product_price,
                    discount_code=checkout_update.discount_code,
                )
                checkout.discount = discount
            # User explicitly removed the discount
            elif "discount_code" in checkout_update.model_fields_set:
                checkout.discount = None

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
                except InvalidTaxID as e:
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

        if checkout_update.custom_field_data is not None:
            custom_field_data = validate_custom_field_data(
                checkout.product.attached_custom_fields,
                checkout_update.custom_field_data,
                validate_required=isinstance(checkout_update, CheckoutConfirm),
            )
            checkout.custom_field_data = custom_field_data

        checkout = await self._update_checkout_ip_geolocation(
            session, checkout, ip_geolocation_client
        )

        exclude = {
            "product_id",
            "product_price_id",
            "amount",
            "customer_billing_address",
            "customer_tax_id",
            "custom_field_data",
        }

        if checkout.customer_id is not None:
            exclude.add("customer_email")

        for attr, value in checkout_update.model_dump(
            exclude_unset=True, exclude=exclude, by_alias=True
        ).items():
            setattr(checkout, attr, value)

        session.add(checkout)

        await self._validate_subscription_uniqueness(session, checkout)

        return checkout

    async def _update_checkout_tax(
        self, session: AsyncSession, checkout: Checkout
    ) -> Checkout:
        if not (
            checkout.is_payment_form_required and checkout.product.is_tax_applicable
        ):
            checkout.tax_amount = 0
            checkout.tax_processor_id = None
            return checkout

        if (
            checkout.customer_billing_address is not None
            and checkout.product.stripe_product_id is not None
        ):
            try:
                tax_calculation = await calculate_tax(
                    checkout.id,
                    checkout.currency,
                    checkout.net_amount,
                    checkout.product.stripe_product_id,
                    checkout.customer_billing_address,
                    (
                        [checkout.customer_tax_id]
                        if checkout.customer_tax_id is not None
                        else []
                    ),
                    customer_exempt=False,
                )
                checkout.tax_amount = tax_calculation["amount"]
                checkout.tax_processor_id = tax_calculation["processor_id"]
            except TaxCalculationError:
                checkout.tax_amount = None
                checkout.tax_processor_id = None
                raise
            finally:
                session.add(checkout)

        return checkout

    async def _update_checkout_ip_geolocation(
        self,
        session: AsyncSession,
        checkout: Checkout,
        ip_geolocation_client: ip_geolocation.IPGeolocationClient | None,
    ) -> Checkout:
        if ip_geolocation_client is None:
            return checkout

        if checkout.customer_ip_address is None:
            return checkout

        if checkout.customer_billing_address is not None:
            return checkout

        country = ip_geolocation.get_ip_country(
            ip_geolocation_client, checkout.customer_ip_address
        )
        if country is None:
            return checkout

        try:
            address = Address.model_validate({"country": country})
        except PydanticValidationError:
            return checkout

        checkout.customer_billing_address = address
        session.add(checkout)
        return checkout

    async def _validate_subscription_uniqueness(
        self, session: AsyncSession, checkout: Checkout
    ) -> None:
        organization = checkout.organization

        # Multiple subscriptions allowed
        if organization.allow_multiple_subscriptions:
            return

        # One-time purchase
        if not checkout.product.is_recurring:
            return

        # Subscription upgrade
        if checkout.subscription is not None:
            return

        # No information yet to check customer subscription uniqueness
        if checkout.customer_id is None and checkout.customer_email is None:
            return

        statement = (
            select(Subscription)
            .join(Product, onclause=Product.id == Subscription.product_id)
            .where(
                Product.organization_id == organization.id,
                Subscription.billable.is_(True),
            )
        )
        if checkout.customer is not None:
            statement = statement.where(
                Subscription.customer_id == checkout.customer_id
            )
        elif checkout.customer_email is not None:
            statement = statement.join(
                Customer, onclause=Customer.id == Subscription.customer_id
            ).where(
                func.lower(Customer.email) == checkout.customer_email.lower(),
                Customer.deleted_at.is_(None),
            )

        result = await session.execute(statement)
        existing_subscriptions = result.scalars().all()

        if len(existing_subscriptions) > 0:
            raise AlreadyActiveSubscriptionError()

    def _get_required_confirm_fields(self, checkout: Checkout) -> set[tuple[str, ...]]:
        fields: set[tuple[str, ...]] = {("customer_email",)}
        if checkout.is_payment_form_required:
            fields.update({("customer_name",), ("customer_billing_address",)})
            for (
                address_field,
                required,
            ) in checkout.customer_billing_address_fields.items():
                if required:
                    fields.add(("customer_billing_address", address_field))
        if checkout.is_business_customer:
            fields.update({("customer_billing_name",), ("customer_billing_address",)})
        return fields

    @contextlib.asynccontextmanager
    async def _create_or_update_customer(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Anonymous],
        checkout: Checkout,
    ) -> AsyncGenerator[Customer]:
        repository = CustomerRepository.from_session(session)

        created = False
        customer = checkout.customer

        if customer is None:
            assert checkout.customer_email is not None
            customer = await repository.get_by_email_and_organization(
                checkout.customer_email, checkout.organization.id
            )
            if customer is None:
                customer = Customer(
                    external_id=checkout.external_customer_id,
                    email=checkout.customer_email,
                    email_verified=False,
                    stripe_customer_id=None,
                    organization=checkout.organization,
                    user_metadata={},
                )
                created = True

        stripe_customer_id = customer.stripe_customer_id
        if stripe_customer_id is None:
            create_params: stripe_lib.Customer.CreateParams = {"email": customer.email}
            if checkout.customer_billing_name is not None:
                create_params["name"] = checkout.customer_billing_name
            elif checkout.customer_name is not None:
                create_params["name"] = checkout.customer_name
            if checkout.customer_billing_address is not None:
                create_params["address"] = checkout.customer_billing_address.to_dict()  # type: ignore
            if checkout.customer_tax_id is not None:
                create_params["tax_id_data"] = [
                    to_stripe_tax_id(checkout.customer_tax_id)
                ]
            stripe_customer = await stripe_service.create_customer(**create_params)
            stripe_customer_id = stripe_customer.id
        else:
            update_params: stripe_lib.Customer.ModifyParams = {"email": customer.email}
            if checkout.customer_billing_name is not None:
                update_params["name"] = checkout.customer_billing_name
            elif checkout.customer_name is not None:
                update_params["name"] = checkout.customer_name
            if checkout.customer_billing_address is not None:
                update_params["address"] = checkout.customer_billing_address.to_dict()  # type: ignore
            await stripe_service.update_customer(
                stripe_customer_id,
                tax_id=(
                    to_stripe_tax_id(checkout.customer_tax_id)
                    if checkout.customer_tax_id is not None
                    else None
                ),
                **update_params,
            )

        if checkout.customer_name is not None:
            customer.name = checkout.customer_name
        if checkout.customer_billing_name is not None:
            customer.billing_name = checkout.customer_billing_name
        if checkout.customer_billing_address is not None:
            customer.billing_address = checkout.customer_billing_address
        if checkout.customer_tax_id is not None:
            customer.tax_id = checkout.customer_tax_id

        customer.stripe_customer_id = stripe_customer_id
        customer.user_metadata = {
            **customer.user_metadata,
            **checkout.customer_metadata,
        }

        if created:
            async with repository.create_context(customer, flush=False) as customer:
                yield customer
        else:
            yield await repository.update(customer, flush=True)

    async def _create_ad_hoc_custom_price(
        self, checkout: Checkout, *, idempotency_key: str | None = None
    ) -> stripe_lib.Price:
        assert checkout.product.stripe_product_id is not None
        price_params: stripe_lib.Price.CreateParams = {
            "unit_amount": checkout.amount,
            "currency": checkout.currency,
            "metadata": {
                "product_price_id": str(checkout.product_price_id),
            },
        }
        if checkout.product.is_recurring:
            recurring_interval: SubscriptionRecurringInterval
            if isinstance(checkout.product_price, LegacyRecurringProductPriceCustom):
                recurring_interval = checkout.product_price.recurring_interval
            else:
                assert checkout.product.recurring_interval is not None
                recurring_interval = checkout.product.recurring_interval
            price_params["recurring"] = {
                "interval": recurring_interval.as_literal(),
            }
        return await stripe_service.create_price_for_product(
            checkout.product.stripe_product_id,
            price_params,
            idempotency_key=idempotency_key,
        )

    async def _after_checkout_created(
        self, session: AsyncSession, checkout: Checkout
    ) -> None:
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            checkout.product.organization_id
        )
        assert organization is not None
        await webhook_service.send(
            session, organization, WebhookEventType.checkout_created, checkout
        )

    async def _after_checkout_updated(
        self, session: AsyncSession, checkout: Checkout
    ) -> None:
        await publish_checkout_event(
            checkout.client_secret, CheckoutEvent.updated, {"status": checkout.status}
        )
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(
            checkout.product.organization_id
        )
        if organization is not None:
            events = await webhook_service.send(
                session, organization, WebhookEventType.checkout_updated, checkout
            )
            # No webhook to send, publish the webhook_event immediately
            if len(events) == 0:
                await publish_checkout_event(
                    checkout.client_secret,
                    CheckoutEvent.webhook_event_delivered,
                    {"status": checkout.status},
                )

    async def _eager_load_product(
        self, session: AsyncSession, product: Product
    ) -> Product:
        await session.refresh(
            product,
            {"organization", "prices", "product_medias", "attached_custom_fields"},
        )
        return product


checkout = CheckoutService()
