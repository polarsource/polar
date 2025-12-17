import random
import secrets
import string
import typing
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Literal, Unpack

import pytest_asyncio
from typing_extensions import TypeIs

from polar.enums import AccountType, PaymentProcessor, SubscriptionRecurringInterval
from polar.kit.address import Address
from polar.kit.tax import TaxID
from polar.kit.trial import TrialInterval
from polar.kit.utils import utc_now
from polar.meter.aggregation import Aggregation, CountAggregation
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import (
    Account,
    Benefit,
    BillingEntry,
    Checkout,
    CheckoutLink,
    CheckoutLinkProduct,
    CheckoutProduct,
    Customer,
    CustomerSeat,
    CustomField,
    Discount,
    DiscountProduct,
    Dispute,
    Event,
    EventType,
    IssueReward,
    LegacyRecurringProductPriceCustom,
    LegacyRecurringProductPriceFixed,
    LegacyRecurringProductPriceFree,
    Member,
    Meter,
    Order,
    OrderItem,
    Organization,
    Payment,
    PaymentMethod,
    Payout,
    Product,
    ProductBenefit,
    ProductCustomField,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
    ProductPriceMeteredUnit,
    ProductPriceSeatUnit,
    Refund,
    Subscription,
    SubscriptionProductPrice,
    Transaction,
    TrialRedemption,
    User,
    UserOrganization,
    Wallet,
    WalletTransaction,
    WebhookEndpoint,
)
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import (
    BenefitGrant,
    BenefitGrantScope,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.checkout import CheckoutStatus, get_expires_at
from polar.models.custom_field import (
    CustomFieldCheckbox,
    CustomFieldCheckboxProperties,
    CustomFieldNumber,
    CustomFieldNumberProperties,
    CustomFieldProperties,
    CustomFieldSelect,
    CustomFieldSelectProperties,
    CustomFieldText,
    CustomFieldTextProperties,
    CustomFieldType,
)
from polar.models.customer_seat import SeatStatus
from polar.models.discount import (
    DiscountDuration,
    DiscountFixed,
    DiscountPercentage,
    DiscountType,
)
from polar.models.dispute import DisputeAlertProcessor, DisputeStatus
from polar.models.event import EventSource
from polar.models.notification_recipient import NotificationRecipient
from polar.models.order import OrderBillingReasonInternal, OrderStatus
from polar.models.payment import PaymentStatus
from polar.models.payout import PayoutStatus
from polar.models.pledge import Pledge, PledgeState, PledgeType
from polar.models.product_price import ProductPriceAmountType, ProductPriceType
from polar.models.subscription import SubscriptionStatus
from polar.models.transaction import Processor, TransactionType
from polar.models.user import OAuthAccount, OAuthPlatform
from polar.models.wallet import WalletType
from polar.models.webhook_endpoint import WebhookEventType, WebhookFormat
from polar.notification_recipient.schemas import NotificationRecipientPlatform
from tests.fixtures.database import SaveFixture


def rstr(prefix: str) -> str:
    return prefix + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def lstr(suffix: str) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6)) + suffix


async def create_organization(
    save_fixture: SaveFixture, name_prefix: str = "testorg", **kwargs: Any
) -> Organization:
    name = rstr(name_prefix)
    # Create organizations in the past so they are grandfathered for payment readiness
    # unless created_at is explicitly provided
    if "created_at" not in kwargs:
        kwargs["created_at"] = datetime(2025, 7, 1, tzinfo=UTC)

    organization = Organization(
        name=name,
        slug=name,
        customer_invoice_prefix=name.upper(),
        avatar_url="https://avatars.githubusercontent.com/u/105373340?s=200&v=4",
        subscriptions_billing_engine=True,
        **kwargs,
    )
    await save_fixture(organization)
    return organization


@pytest_asyncio.fixture
async def organization(save_fixture: SaveFixture) -> Organization:
    return await create_organization(save_fixture)


@pytest_asyncio.fixture
async def organization_second(save_fixture: SaveFixture) -> Organization:
    return await create_organization(save_fixture)


@pytest_asyncio.fixture
async def second_organization(save_fixture: SaveFixture) -> Organization:
    return await create_organization(save_fixture)


@pytest_asyncio.fixture
async def pledging_organization(save_fixture: SaveFixture) -> Organization:
    return await create_organization(save_fixture, name_prefix="pledging_org")


async def create_oauth_account(
    save_fixture: SaveFixture,
    user: User,
    platform: OAuthPlatform,
) -> OAuthAccount:
    oauth_account = OAuthAccount(
        platform=platform,
        access_token="xxyyzz",
        account_id="xxyyzz",
        account_email="foo@bar.com",
        account_username=rstr("gh_username"),
        user_id=user.id,
    )
    await save_fixture(oauth_account)
    return oauth_account


async def create_user_github_oauth(
    save_fixture: SaveFixture,
    user: User,
) -> OAuthAccount:
    oauth_account = OAuthAccount(
        platform=OAuthPlatform.github,
        access_token="xxyyzz",
        account_id="xxyyzz",
        account_email="foo@bar.com",
        account_username=rstr("gh_username"),
        user=user,
    )
    await save_fixture(oauth_account)
    return oauth_account


@pytest_asyncio.fixture
async def user_github_oauth(
    save_fixture: SaveFixture,
    user: User,
) -> OAuthAccount:
    return await create_user_github_oauth(save_fixture, user)


async def create_user(
    save_fixture: SaveFixture,
    stripe_customer_id: str | None = None,
    email_verified: bool = True,
) -> User:
    user = User(
        id=uuid.uuid4(),
        email=rstr("test") + "@example.com",
        email_verified=email_verified,
        avatar_url="https://avatars.githubusercontent.com/u/47952?v=4",
        oauth_accounts=[],
        stripe_customer_id=stripe_customer_id,
    )
    await save_fixture(user)
    return user


@pytest_asyncio.fixture
async def user(save_fixture: SaveFixture) -> User:
    return await create_user(save_fixture)


@pytest_asyncio.fixture
async def user_second(save_fixture: SaveFixture) -> User:
    return await create_user(save_fixture)


async def create_pledge(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    issue_reference: str = "polarsource/polar/1",
    pledging_organization: Organization | None = None,
    pledging_user: User | None = None,
    state: PledgeState = PledgeState.created,
    type: PledgeType = PledgeType.pay_upfront,
    payment_id: str = "STRIPE_PAYMENT_INTENT",
) -> Pledge:
    amount = secrets.randbelow(100000) + 1
    fee = round(amount * 0.05)
    pledge = Pledge(
        issue_reference=issue_reference,
        organization=organization,
        by_organization=pledging_organization,
        user=pledging_user,
        amount=amount,
        currency="usd",
        fee=fee,
        state=state,
        type=type,
        payment_id=payment_id,
        invoice_id="INVOICE_ID" if type == PledgeType.pay_on_completion else None,
    )
    await save_fixture(pledge)
    return pledge


@pytest_asyncio.fixture
async def pledge(
    save_fixture: SaveFixture,
    organization: Organization,
    pledging_organization: Organization,
) -> Pledge:
    return await create_pledge(
        save_fixture, organization, pledging_organization=pledging_organization
    )


@pytest_asyncio.fixture
async def user_organization(
    save_fixture: SaveFixture,
    organization: Organization,
    user: User,
) -> UserOrganization:
    user_organization = UserOrganization(user=user, organization=organization)
    await save_fixture(user_organization)
    return user_organization


@pytest_asyncio.fixture
async def user_organization_second(
    save_fixture: SaveFixture,
    organization: Organization,
    user_second: User,
) -> UserOrganization:
    user_organization = UserOrganization(user=user_second, organization=organization)
    await save_fixture(user_organization)
    return user_organization


@typing.overload
async def create_custom_field(
    save_fixture: SaveFixture,
    *,
    type: typing.Literal[CustomFieldType.text],
    slug: str,
    organization: Organization,
    name: str = "Custom Field",
    properties: CustomFieldTextProperties | None = None,
) -> CustomFieldText: ...
@typing.overload
async def create_custom_field(
    save_fixture: SaveFixture,
    *,
    type: typing.Literal[CustomFieldType.number],
    slug: str,
    organization: Organization,
    name: str = "Custom Field",
    properties: CustomFieldNumberProperties | None = None,
) -> CustomFieldNumber: ...
@typing.overload
async def create_custom_field(
    save_fixture: SaveFixture,
    *,
    type: typing.Literal[CustomFieldType.checkbox],
    slug: str,
    organization: Organization,
    name: str = "Custom Field",
    properties: CustomFieldCheckboxProperties | None = None,
) -> CustomFieldCheckbox: ...
@typing.overload
async def create_custom_field(
    save_fixture: SaveFixture,
    *,
    type: typing.Literal[CustomFieldType.select],
    slug: str,
    organization: Organization,
    name: str = "Custom Field",
    properties: CustomFieldSelectProperties | None = None,
) -> CustomFieldSelect: ...
async def create_custom_field(
    save_fixture: SaveFixture,
    *,
    type: CustomFieldType,
    slug: str,
    organization: Organization,
    name: str = "Custom Field",
    properties: CustomFieldProperties | None = None,
) -> CustomField:
    model = type.get_model()
    custom_field = model(
        type=type,
        slug=slug,
        name=name,
        properties=properties or {},
        organization=organization,
    )
    await save_fixture(custom_field)
    return custom_field


type PriceFixtureType = (
    tuple[int]
    | tuple[int | None, int | None, int | None]
    | tuple[None]
    | tuple[Meter, Decimal, int | None]
    | tuple[Literal["seat"], int]
)


def _is_metered_price_fixture_type(
    price: PriceFixtureType,
) -> TypeIs[tuple[Meter, Decimal, int | None]]:
    return isinstance(price[0], Meter)


def _is_seat_price_fixture_type(
    price: PriceFixtureType,
) -> TypeIs[tuple[Literal["seat"], int]]:
    return len(price) == 2 and price[0] == "seat"


async def create_product(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    recurring_interval: SubscriptionRecurringInterval | None,
    recurring_interval_count: int | None = 1,
    name: str = "Product",
    is_archived: bool = False,
    prices: Sequence[PriceFixtureType] = [(1000,)],
    attached_custom_fields: Sequence[tuple[CustomField, bool]] = [],
    trial_interval: TrialInterval | None = None,
    trial_interval_count: int | None = None,
    is_tax_applicable: bool = True,
) -> Product:
    recurring_interval_count = (
        None if recurring_interval is None else recurring_interval_count
    )
    product = Product(
        name=name,
        description="Description",
        is_tax_applicable=is_tax_applicable,
        recurring_interval=recurring_interval,
        recurring_interval_count=recurring_interval_count,
        is_archived=is_archived,
        organization=organization,
        trial_interval=trial_interval,
        trial_interval_count=trial_interval_count,
        all_prices=[],
        prices=[],
        product_benefits=[],
        product_medias=[],
        attached_custom_fields=[
            ProductCustomField(custom_field=custom_field, required=required, order=i)
            for i, (custom_field, required) in enumerate(attached_custom_fields)
        ],
    )
    await save_fixture(product)

    for price in prices:
        product_price: (
            ProductPriceFixed
            | ProductPriceCustom
            | ProductPriceFree
            | ProductPriceMeteredUnit
            | ProductPriceSeatUnit
        )
        if len(price) == 1:
            (amount,) = price
            if amount is None:
                product_price = await create_product_price_free(
                    save_fixture, product=product
                )
            else:
                product_price = await create_product_price_fixed(
                    save_fixture, product=product, amount=amount
                )
        elif _is_metered_price_fixture_type(price):
            meter, unit_amount, cap_amount = price
            product_price = await create_product_price_metered_unit(
                save_fixture,
                product=product,
                meter=meter,
                unit_amount=unit_amount,
                cap_amount=cap_amount,
            )
        elif _is_seat_price_fixture_type(price):
            _, price_per_seat = price
            product_price = await create_product_price_seat_unit(
                save_fixture,
                product=product,
                price_per_seat=price_per_seat,
            )
        else:
            (
                minimum_amount,
                maximum_amount,
                preset_amount,
            ) = price
            product_price = await create_product_price_custom(
                save_fixture,
                product=product,
                minimum_amount=minimum_amount,
                maximum_amount=maximum_amount,
                preset_amount=preset_amount,
            )

        product.prices.append(product_price)
        product.all_prices.append(product_price)

    return product


async def create_product_price_fixed(
    save_fixture: SaveFixture,
    *,
    product: Product,
    amount: int = 1000,
    is_archived: bool = False,
) -> ProductPriceFixed:
    price = ProductPriceFixed(
        price_amount=amount,
        price_currency="usd",
        product=product,
        is_archived=is_archived,
    )
    await save_fixture(price)
    return price


async def create_product_price_custom(
    save_fixture: SaveFixture,
    *,
    product: Product,
    minimum_amount: int | None = None,
    maximum_amount: int | None = None,
    preset_amount: int | None = None,
) -> ProductPriceCustom:
    price = ProductPriceCustom(
        price_currency="usd",
        minimum_amount=minimum_amount,
        maximum_amount=maximum_amount,
        preset_amount=preset_amount,
        product=product,
    )
    await save_fixture(price)
    return price


async def create_product_price_free(
    save_fixture: SaveFixture,
    *,
    product: Product,
) -> ProductPriceFree:
    price = ProductPriceFree(
        product=product,
    )
    await save_fixture(price)
    return price


async def create_product_price_metered_unit(
    save_fixture: SaveFixture,
    *,
    product: Product,
    meter: Meter,
    unit_amount: Decimal = Decimal(100),
    cap_amount: int | None = None,
) -> ProductPriceMeteredUnit:
    price = ProductPriceMeteredUnit(
        price_currency="usd",
        unit_amount=unit_amount,
        cap_amount=cap_amount,
        meter=meter,
        product=product,
    )
    assert price.amount_type == ProductPriceAmountType.metered_unit
    await save_fixture(price)
    return price


async def create_product_price_seat_unit(
    save_fixture: SaveFixture,
    *,
    product: Product,
    price_per_seat: int = 1000,
) -> ProductPriceSeatUnit:
    price = ProductPriceSeatUnit(
        price_currency="usd",
        seat_tiers={
            "tiers": [
                {
                    "min_seats": 1,
                    "max_seats": None,
                    "price_per_seat": price_per_seat,
                }
            ]
        },
        product=product,
    )
    assert price.amount_type == ProductPriceAmountType.seat_based
    await save_fixture(price)
    return price


@typing.overload
async def create_legacy_recurring_product_price(
    save_fixture: SaveFixture,
    *,
    amount_type: Literal[ProductPriceAmountType.fixed],
    product: Product,
    recurring_interval: SubscriptionRecurringInterval,
    amount: int = 1000,
) -> LegacyRecurringProductPriceFixed: ...


@typing.overload
async def create_legacy_recurring_product_price(
    save_fixture: SaveFixture,
    *,
    amount_type: Literal[ProductPriceAmountType.custom],
    product: Product,
    recurring_interval: SubscriptionRecurringInterval,
    minimum_amount: int | None = None,
    maximum_amount: int | None = None,
    preset_amount: int | None = None,
) -> LegacyRecurringProductPriceCustom: ...


@typing.overload
async def create_legacy_recurring_product_price(
    save_fixture: SaveFixture,
    *,
    amount_type: Literal[ProductPriceAmountType.free],
    product: Product,
    recurring_interval: SubscriptionRecurringInterval,
) -> LegacyRecurringProductPriceFree: ...


async def create_legacy_recurring_product_price(
    save_fixture: SaveFixture,
    *,
    amount_type: ProductPriceAmountType,
    product: Product,
    recurring_interval: SubscriptionRecurringInterval,
    amount: int | None = 1000,
    minimum_amount: int | None = None,
    maximum_amount: int | None = None,
    preset_amount: int | None = None,
) -> (
    LegacyRecurringProductPriceFixed
    | LegacyRecurringProductPriceCustom
    | LegacyRecurringProductPriceFree
):
    product_price: (
        LegacyRecurringProductPriceFixed
        | LegacyRecurringProductPriceCustom
        | LegacyRecurringProductPriceFree
    )
    if amount_type == ProductPriceAmountType.fixed:
        product_price = LegacyRecurringProductPriceFixed(
            price_amount=amount,
            price_currency="usd",
            product=product,
            is_archived=False,
        )
    elif amount_type == ProductPriceAmountType.custom:
        product_price = LegacyRecurringProductPriceCustom(
            price_currency="usd",
            minimum_amount=minimum_amount,
            maximum_amount=maximum_amount,
            preset_amount=preset_amount,
            product=product,
            is_archived=False,
        )
    elif amount_type == ProductPriceAmountType.free:
        product_price = LegacyRecurringProductPriceFree(
            product=product,
            is_archived=False,
        )

    product_price.type = ProductPriceType.recurring
    product_price.recurring_interval = recurring_interval

    await save_fixture(product_price)
    return product_price


@typing.overload
async def create_discount(
    save_fixture: SaveFixture,
    *,
    type: typing.Literal[DiscountType.fixed],
    amount: int,
    currency: str,
    duration: DiscountDuration,
    organization: Organization,
    name: str = "Discount",
    code: str | None = None,
    duration_in_months: int | None = None,
    starts_at: datetime | None = None,
    ends_at: datetime | None = None,
    max_redemptions: int | None = None,
    products: list[Product] | None = None,
) -> DiscountFixed: ...
@typing.overload
async def create_discount(
    save_fixture: SaveFixture,
    *,
    type: typing.Literal[DiscountType.percentage],
    basis_points: int,
    duration: DiscountDuration,
    organization: Organization,
    name: str = "Discount",
    code: str | None = None,
    duration_in_months: int | None = None,
    starts_at: datetime | None = None,
    ends_at: datetime | None = None,
    max_redemptions: int | None = None,
    products: list[Product] | None = None,
) -> DiscountPercentage: ...
async def create_discount(
    save_fixture: SaveFixture,
    *,
    type: DiscountType,
    amount: int | None = None,
    currency: str | None = None,
    basis_points: int | None = None,
    duration: DiscountDuration,
    organization: Organization,
    name: str = "Discount",
    code: str | None = None,
    duration_in_months: int | None = None,
    starts_at: datetime | None = None,
    ends_at: datetime | None = None,
    max_redemptions: int | None = None,
    products: list[Product] | None = None,
) -> Discount:
    model = type.get_model()
    custom_field = model(
        name=name,
        type=type,
        code=code,
        duration=duration,
        duration_in_months=duration_in_months,
        organization=organization,
        starts_at=starts_at,
        ends_at=ends_at,
        discount_products=[],
        max_redemptions=max_redemptions,
        redemptions_count=0,
    )
    if isinstance(custom_field, DiscountFixed):
        assert amount is not None
        assert currency is not None
        custom_field.amount = amount
        custom_field.currency = currency
    elif isinstance(custom_field, DiscountPercentage):
        assert basis_points is not None
        custom_field.basis_points = basis_points

    if products is not None:
        for product in products:
            custom_field.discount_products.append(DiscountProduct(product=product))

    await save_fixture(custom_field)
    return custom_field


@pytest_asyncio.fixture
async def discount_fixed_once(
    save_fixture: SaveFixture, organization: Organization
) -> DiscountFixed:
    return await create_discount(
        save_fixture,
        type=DiscountType.fixed,
        amount=1000,
        currency="usd",
        duration=DiscountDuration.once,
        organization=organization,
        code="DISCOUNTFIXEDONCE",
    )


@pytest_asyncio.fixture
async def discount_percentage_50(
    save_fixture: SaveFixture, organization: Organization
) -> DiscountPercentage:
    return await create_discount(
        save_fixture,
        type=DiscountType.percentage,
        basis_points=5_000,
        duration=DiscountDuration.once,
        organization=organization,
        code="DISCOUNTPERCENTAGE50",
    )


@pytest_asyncio.fixture
async def discount_percentage_100(
    save_fixture: SaveFixture, organization: Organization
) -> DiscountPercentage:
    return await create_discount(
        save_fixture,
        type=DiscountType.percentage,
        basis_points=10_000,
        duration=DiscountDuration.once,
        organization=organization,
        code="DISCOUNTPERCENTAGE100",
    )


async def create_customer(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    external_id: str | None = None,
    email: str = "customer@example.com",
    email_verified: bool = False,
    name: str = "Customer",
    stripe_customer_id: str | None = "STRIPE_CUSTOMER_ID",
    billing_address: Address | None = None,
    tax_id: TaxID | None = None,
    user_metadata: dict[str, Any] = {},
) -> Customer:
    customer = Customer(
        external_id=external_id,
        email=email,
        email_verified=email_verified,
        name=name,
        stripe_customer_id=stripe_customer_id,
        organization=organization,
        billing_address=billing_address,
        tax_id=tax_id,
        user_metadata=user_metadata,
    )
    await save_fixture(customer)
    return customer


async def create_order(
    save_fixture: SaveFixture,
    *,
    customer: Customer,
    status: OrderStatus = OrderStatus.paid,
    product: Product | None = None,
    subtotal_amount: int = 1000,
    tax_amount: int = 0,
    discount_amount: int = 0,
    refunded_amount: int = 0,
    refunded_tax_amount: int = 0,
    applied_balance_amount: int = 0,
    currency: str = "usd",
    order_items: list[OrderItem] | None = None,
    subscription: Subscription | None = None,
    billing_reason: OrderBillingReasonInternal = OrderBillingReasonInternal.purchase,
    user_metadata: dict[str, Any] | None = None,
    created_at: datetime | None = None,
    custom_field_data: dict[str, Any] | None = None,
    billing_name: str | None = None,
    billing_address: Address | None = None,
    invoice_number: str | None = None,
    checkout: Checkout | None = None,
    discount: Discount | None = None,
    next_payment_attempt_at: datetime | None = None,
    payment_lock_acquired_at: datetime | None = None,
) -> Order:
    if order_items is None:
        order_items = [
            OrderItem(
                label="",
                amount=subtotal_amount,
                tax_amount=tax_amount,
                proration=False,
            )
        ]

    order = Order(
        created_at=created_at or utc_now(),
        status=status,
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        refunded_amount=refunded_amount,
        refunded_tax_amount=refunded_tax_amount,
        applied_balance_amount=applied_balance_amount,
        items=order_items,
        currency=currency,
        billing_reason=billing_reason,
        billing_name=billing_name,
        billing_address=billing_address,
        invoice_number=invoice_number or rstr("INV-"),
        customer=customer,
        product=product,
        subscription=subscription,
        checkout=checkout,
        discount=discount,
        custom_field_data=custom_field_data or {},
        user_metadata=user_metadata or {},
        next_payment_attempt_at=next_payment_attempt_at,
        payment_lock_acquired_at=payment_lock_acquired_at,
    )
    await save_fixture(order)
    return order


async def create_order_and_payment(
    save_fixture: SaveFixture,
    *,
    product: Product,
    customer: Customer,
    subtotal_amount: int,
    tax_amount: int,
    applied_balance_amount: int = 0,
) -> tuple[Order, Payment, Transaction]:
    order = await create_order(
        save_fixture,
        product=product,
        customer=customer,
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
        applied_balance_amount=applied_balance_amount,
    )
    payment = await create_payment(
        save_fixture,
        customer.organization,
        amount=subtotal_amount + tax_amount + applied_balance_amount,
        order=order,
    )
    transaction = await create_payment_transaction(
        save_fixture,
        amount=subtotal_amount + applied_balance_amount,
        tax_amount=tax_amount,
        order=order,
        charge_id=payment.processor_id,
    )
    return order, payment, transaction


async def create_order_with_seats(
    save_fixture: SaveFixture,
    *,
    product: Product,
    customer: Customer,
    seats: int = 5,
    **kwargs: Any,
) -> Order:
    is_seat_based = any(
        price.amount_type == ProductPriceAmountType.seat_based
        for price in product.all_prices
    )
    assert is_seat_based, "Product must be seat-based"
    order = await create_order(
        save_fixture, product=product, customer=customer, **kwargs
    )
    order.seats = seats
    await save_fixture(order)
    return order


async def create_benefit(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    type: BenefitType = BenefitType.custom,
    is_tax_applicable: bool = True,
    description: str = "Benefit",
    selectable: bool = True,
    deletable: bool = True,
    properties: dict[str, Any] = {"note": None},
) -> Benefit:
    benefit = Benefit(
        type=type,
        description=description,
        is_tax_applicable=is_tax_applicable,
        organization=organization,
        selectable=selectable,
        deletable=deletable,
        properties=properties,
    )
    await save_fixture(benefit)
    return benefit


async def set_product_benefits(
    save_fixture: SaveFixture,
    *,
    product: Product,
    benefits: list[Benefit],
) -> Product:
    product.product_benefits = []
    await save_fixture(product)
    for order, benefit in enumerate(benefits):
        product.product_benefits.append(ProductBenefit(benefit=benefit, order=order))
    await save_fixture(product)
    return product


async def create_subscription(
    save_fixture: SaveFixture,
    *,
    product: Product,
    prices: Sequence[ProductPrice] | None = None,
    customer: Customer,
    payment_method: PaymentMethod | None = None,
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
    tax_exempted: bool = False,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    ends_at: datetime | None = None,
    current_period_start: datetime | None = None,
    current_period_end: datetime | None = None,
    trial_start: datetime | None = None,
    trial_end: datetime | None = None,
    discount: Discount | None = None,
    cancel_at_period_end: bool = False,
    revoke: bool = False,
    user_metadata: dict[str, Any] | None = None,
    scheduler_locked_at: datetime | None = None,
    seats: int | None = None,
    past_due_at: datetime | None = None,
) -> Subscription:
    prices = prices or product.prices

    recurring_interval = product.recurring_interval
    recurring_interval_count = product.recurring_interval_count
    if product.is_legacy_recurring_price:
        recurring_interval = product.prices[0].recurring_interval
        recurring_interval_count = 1
    if not recurring_interval:
        recurring_interval = SubscriptionRecurringInterval.month
    if not recurring_interval_count:
        recurring_interval_count = 1

    now = datetime.now(UTC)
    if not current_period_start:
        current_period_start = now
    if not current_period_end:
        current_period_end = recurring_interval.get_next_period(
            current_period_start, recurring_interval_count
        )

    canceled_at = None
    if ends_at is None:
        if revoke:
            ended_at = now
            ends_at = now
            canceled_at = now
            status = SubscriptionStatus.canceled
        elif cancel_at_period_end:
            ends_at = current_period_end
            canceled_at = now

    subscription = Subscription(
        recurring_interval=recurring_interval,
        recurring_interval_count=recurring_interval_count,
        status=status,
        tax_exempted=tax_exempted,
        current_period_start=current_period_start,
        current_period_end=current_period_end,
        trial_start=trial_start,
        trial_end=trial_end,
        cancel_at_period_end=cancel_at_period_end,
        canceled_at=canceled_at,
        started_at=started_at,
        ended_at=ended_at,
        ends_at=ends_at,
        customer=customer,
        product=product,
        payment_method=payment_method,
        subscription_product_prices=[
            SubscriptionProductPrice.from_price(price, seats=seats) for price in prices
        ],
        discount=discount,
        user_metadata=user_metadata or {},
        scheduler_locked_at=scheduler_locked_at,
        seats=seats,
        past_due_at=past_due_at,
    )
    await save_fixture(subscription)

    return subscription


async def create_trialing_subscription(
    save_fixture: SaveFixture,
    *,
    product: Product,
    trial_interval: TrialInterval = TrialInterval.month,
    trial_interval_count: int = 1,
    prices: Sequence[ProductPrice] | None = None,
    customer: Customer,
    tax_exempted: bool = False,
    discount: Discount | None = None,
    user_metadata: dict[str, Any] | None = None,
    scheduler_locked_at: datetime | None = None,
) -> Subscription:
    now = utc_now()
    trial_start = now
    trial_end = trial_interval.get_end(now, trial_interval_count)

    return await create_subscription(
        save_fixture,
        product=product,
        prices=prices,
        customer=customer,
        tax_exempted=tax_exempted,
        discount=discount,
        status=SubscriptionStatus.trialing,
        started_at=now,
        ended_at=None,
        current_period_start=trial_start,
        current_period_end=trial_end,
        trial_start=trial_start,
        trial_end=trial_end,
        user_metadata=user_metadata or {},
        scheduler_locked_at=scheduler_locked_at,
    )


async def create_active_subscription(
    save_fixture: SaveFixture,
    *,
    product: Product,
    prices: Sequence[ProductPrice] | None = None,
    customer: Customer,
    payment_method: PaymentMethod | None = None,
    tax_exempted: bool = False,
    discount: Discount | None = None,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    cancel_at_period_end: bool = False,
    current_period_start: datetime | None = None,
    current_period_end: datetime | None = None,
    user_metadata: dict[str, Any] | None = None,
    scheduler_locked_at: datetime | None = None,
) -> Subscription:
    return await create_subscription(
        save_fixture,
        product=product,
        prices=prices,
        customer=customer,
        tax_exempted=tax_exempted,
        discount=discount,
        payment_method=payment_method,
        status=SubscriptionStatus.active,
        started_at=started_at or utc_now(),
        ended_at=ended_at,
        current_period_start=current_period_start,
        current_period_end=current_period_end,
        cancel_at_period_end=cancel_at_period_end,
        user_metadata=user_metadata or {},
        scheduler_locked_at=scheduler_locked_at,
    )


async def create_canceled_subscription(
    save_fixture: SaveFixture,
    *,
    product: Product,
    prices: Sequence[ProductPrice] | None = None,
    customer: Customer,
    cancel_at_period_end: bool = True,
    revoke: bool = False,
) -> Subscription:
    return await create_subscription(
        save_fixture,
        product=product,
        prices=prices,
        customer=customer,
        status=SubscriptionStatus.active,
        started_at=utc_now(),
        cancel_at_period_end=cancel_at_period_end,
        revoke=revoke,
    )


@pytest_asyncio.fixture
async def product(save_fixture: SaveFixture, organization: Organization) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
    )


@pytest_asyncio.fixture
async def product_one_time(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
    )


@pytest_asyncio.fixture
async def product_one_time_custom_price(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        prices=[(None, None, None)],
    )


@pytest_asyncio.fixture
async def product_one_time_free_price(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        prices=[(None,)],
    )


@pytest_asyncio.fixture
async def product_recurring_custom_price(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(None, None, None)],
    )


@pytest_asyncio.fixture
async def product_recurring_monthly_and_yearly(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    product = await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=None,
        prices=[],
    )

    monthly_price = await create_legacy_recurring_product_price(
        save_fixture,
        amount_type=ProductPriceAmountType.fixed,
        product=product,
        recurring_interval=SubscriptionRecurringInterval.month,
    )
    product.prices.append(monthly_price)
    product.all_prices.append(monthly_price)

    yearly_price = await create_legacy_recurring_product_price(
        save_fixture,
        amount_type=ProductPriceAmountType.fixed,
        product=product,
        recurring_interval=SubscriptionRecurringInterval.year,
    )
    product.prices.append(yearly_price)
    product.all_prices.append(yearly_price)

    await save_fixture(product)
    return product


@pytest_asyncio.fixture
async def product_recurring_free_price(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(None,)],
    )


@pytest_asyncio.fixture
async def product_recurring_metered(
    save_fixture: SaveFixture, organization: Organization, meter: Meter
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(meter, Decimal(100), None)],
    )


@pytest_asyncio.fixture
async def product_recurring_fixed_and_metered(
    save_fixture: SaveFixture, organization: Organization, meter: Meter
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(meter, Decimal(100), None), (2000,)],
    )


@pytest_asyncio.fixture
async def product_recurring_trial(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        trial_interval=TrialInterval.month,
        trial_interval_count=1,
    )


@pytest_asyncio.fixture
async def product_recurring_every_second_month(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        recurring_interval_count=2,
    )


@pytest_asyncio.fixture
async def product_second(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(2000,)],
    )


@pytest_asyncio.fixture
async def product_organization_second(
    save_fixture: SaveFixture, organization_second: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization_second,
        recurring_interval=SubscriptionRecurringInterval.month,
    )


@pytest_asyncio.fixture
async def products(
    product: Product,
    product_second: Product,
    product_organization_second: Product,
) -> list[Product]:
    return [product, product_second, product_organization_second]


async def create_checkout(
    save_fixture: SaveFixture,
    *,
    products: list[Product],
    product: Product | None = None,
    price: ProductPrice | None = None,
    payment_processor: PaymentProcessor = PaymentProcessor.stripe,
    status: CheckoutStatus = CheckoutStatus.open,
    expires_at: datetime | None = None,
    client_secret: str | None = None,
    user_metadata: dict[str, Any] = {},
    external_customer_id: str | None = None,
    customer_metadata: dict[str, Any] = {},
    payment_processor_metadata: dict[str, Any] = {},
    amount: int | None = None,
    tax_amount: int | None = None,
    currency: str | None = None,
    customer: Customer | None = None,
    subscription: Subscription | None = None,
    discount: Discount | None = None,
    trial_interval: TrialInterval | None = None,
    trial_interval_count: int | None = None,
    seats: int | None = None,
    require_billing_address: bool = False,
    customer_billing_address: Address | None = None,
) -> Checkout:
    product = product or products[0]
    price = price or product.prices[0]

    if isinstance(price, ProductPriceFixed):
        amount = price.price_amount
        currency = price.price_currency
    elif isinstance(price, ProductPriceCustom):
        amount = amount or 10_00
        currency = price.price_currency
    elif isinstance(price, ProductPriceSeatUnit):
        seat_count = seats or 1
        amount = price.calculate_amount(seat_count)
        currency = price.price_currency
    else:
        amount = 0
        currency = "usd"

    trial_end: datetime | None = None
    if trial_interval is not None and trial_interval_count is not None:
        trial_end = trial_interval.get_end(utc_now(), trial_interval_count)

    checkout = Checkout(
        payment_processor=payment_processor,
        status=status,
        expires_at=expires_at or get_expires_at(),
        client_secret=client_secret
        or rstr(
            "CHECKOUT_CLIENT_SECRET",
        ),
        user_metadata=user_metadata,
        external_customer_id=external_customer_id,
        customer_metadata=customer_metadata,
        payment_processor_metadata=payment_processor_metadata,
        amount=amount,
        tax_amount=tax_amount,
        currency=currency,
        organization=product.organization,
        product_price=price,
        product=product,
        checkout_products=[
            CheckoutProduct(product=p, order=i, ad_hoc_prices=[])
            for i, p in enumerate(products)
        ],
        customer=customer,
        subscription=subscription,
        discount=discount,
        trial_interval=trial_interval,
        trial_interval_count=trial_interval_count,
        trial_end=trial_end,
        seats=seats,
        require_billing_address=require_billing_address,
        customer_billing_address=customer_billing_address,
    )
    await save_fixture(checkout)
    return checkout


async def create_checkout_link(
    save_fixture: SaveFixture,
    *,
    payment_processor: PaymentProcessor = PaymentProcessor.stripe,
    products: Sequence[Product],
    discount: Discount | None = None,
    client_secret: str | None = None,
    success_url: str | None = None,
    trial_interval: TrialInterval | None = None,
    trial_interval_count: int | None = None,
    user_metadata: dict[str, Any] = {},
) -> CheckoutLink:
    checkout_link = CheckoutLink(
        payment_processor=payment_processor,
        client_secret=client_secret
        or rstr(
            "CHECKOUT_CLIENT_SECRET",
        ),
        success_url=success_url,
        organization=products[0].organization,
        checkout_link_products=[
            CheckoutLinkProduct(product=p, order=i) for i, p in enumerate(products)
        ],
        discount=discount,
        trial_interval=trial_interval,
        trial_interval_count=trial_interval_count,
        user_metadata=user_metadata,
    )
    await save_fixture(checkout_link)
    return checkout_link


@pytest_asyncio.fixture
async def benefit_organization(
    save_fixture: SaveFixture, organization: Organization
) -> Benefit:
    return await create_benefit(save_fixture, organization=organization)


@pytest_asyncio.fixture
async def benefit_organization_second(
    save_fixture: SaveFixture, organization: Organization
) -> Benefit:
    return await create_benefit(save_fixture, organization=organization)


@pytest_asyncio.fixture
async def benefit_organization_third(
    save_fixture: SaveFixture, organization: Organization
) -> Benefit:
    return await create_benefit(save_fixture, organization=organization)


@pytest_asyncio.fixture
async def benefits(
    benefit_organization: Benefit,
    benefit_organization_second: Benefit,
    benefit_organization_third: Benefit,
) -> list[Benefit]:
    return [
        benefit_organization,
        benefit_organization_second,
        benefit_organization_third,
    ]


@pytest_asyncio.fixture
async def organization_account(
    save_fixture: SaveFixture, organization: Organization, user: User
) -> Account:
    account = Account(
        account_type=AccountType.stripe,
        admin_id=user.id,
        country="US",
        currency="USD",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        stripe_id="STRIPE_ACCOUNT_ID",
    )
    await save_fixture(account)
    organization.account = account
    await save_fixture(organization)
    return account


@pytest_asyncio.fixture
async def organization_second_members(
    save_fixture: SaveFixture, organization_second: Organization
) -> list[User]:
    users: list[User] = []
    for _ in range(5):
        user = await create_user(save_fixture)
        user_organization = UserOrganization(
            user=user, organization=organization_second
        )
        await save_fixture(user_organization)
        users.append(user)
    return users


@pytest_asyncio.fixture
async def customer(
    save_fixture: SaveFixture,
    organization: Organization,
) -> Customer:
    return await create_customer(
        save_fixture,
        organization=organization,
        email=lstr("customer@example.com"),
        stripe_customer_id=lstr("STRIPE_CUSTOMER_ID"),
    )


@pytest_asyncio.fixture
async def customer_second(
    save_fixture: SaveFixture,
    organization: Organization,
) -> Customer:
    return await create_customer(
        save_fixture,
        organization=organization,
        email=lstr("customer.second@example.com"),
        stripe_customer_id=lstr("STRIPE_CUSTOMER_ID_2"),
    )


@pytest_asyncio.fixture
async def customer_external_id(
    save_fixture: SaveFixture,
    organization: Organization,
) -> Customer:
    return await create_customer(
        save_fixture,
        organization=organization,
        external_id=lstr("CUSTOMER_EXTERNAL_ID"),
        email=lstr("customer.external_id@example.com"),
        stripe_customer_id=lstr("STRIPE_CUSTOMER_ID_3"),
    )


@pytest_asyncio.fixture
async def customer_organization_second(
    save_fixture: SaveFixture,
    organization_second: Organization,
) -> Customer:
    return await create_customer(
        save_fixture,
        organization=organization_second,
        email=lstr("customer.organization_second@example.com"),
        stripe_customer_id=lstr("STRIPE_CUSTOMER_ID_4"),
    )


@pytest_asyncio.fixture
async def subscription(
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> Subscription:
    return await create_subscription(save_fixture, product=product, customer=customer)


async def create_benefit_grant(
    save_fixture: SaveFixture,
    customer: Customer,
    benefit: Benefit,
    granted: bool | None = None,
    properties: dict[str, Any] | None = None,
    member: Member | None = None,
    **scope: Unpack[BenefitGrantScope],
) -> BenefitGrant:
    grant = BenefitGrant(benefit=benefit, customer=customer, member=member, **scope)
    if granted is not None:
        grant.set_granted() if granted else grant.set_revoked()
    if properties is not None:
        grant.properties = properties
    await save_fixture(grant)
    return grant


async def create_refund(
    save_fixture: SaveFixture,
    order: Order,
    payment: Payment,
    *,
    status: str = "succeeded",
    processor: PaymentProcessor = PaymentProcessor.stripe,
    amount: int = 1000,
    tax_amount: int = 0,
    currency: str = "usd",
    reason: str = "customer_request",
    processor_id: str = "STRIPE_REFUND_ID",
    processor_reason: str = "requested_by_customer",
    processor_balance_transaction_id: str = "STRIPE_BALANCE_TRANSACTION_ID",
    dispute: Dispute | None = None,
) -> Refund:
    refund = Refund(
        status=status,
        reason=reason,
        amount=amount,
        tax_amount=tax_amount,
        currency=currency,
        payment=payment,
        order=order,
        subscription=order.subscription,
        customer=order.customer,
        organization=order.organization,
        dispute=dispute,
        processor=processor,
        processor_id=processor_id,
        processor_reason=processor_reason,
        processor_balance_transaction_id=processor_balance_transaction_id,
    )
    await save_fixture(refund)
    return refund


async def create_payment_transaction(
    save_fixture: SaveFixture,
    *,
    processor: Processor = Processor.stripe,
    currency: str = "usd",
    amount: int = 1000,
    tax_amount: int = 0,
    charge_id: str | None = "STRIPE_CHARGE_ID",
    pledge: Pledge | None = None,
    order: Order | None = None,
    issue_reward: IssueReward | None = None,
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.payment,
        account=None,
        processor=processor,
        currency=currency,
        amount=amount,
        tax_amount=tax_amount,
        account_currency=currency,
        account_amount=amount,
        charge_id=charge_id,
        pledge=pledge,
        order=order,
        issue_reward=issue_reward,
    )
    await save_fixture(transaction)
    return transaction


async def create_refund_transaction(
    save_fixture: SaveFixture,
    *,
    processor: Processor = Processor.stripe,
    amount: int = -1000,
    charge_id: str = "STRIPE_CHARGE_ID",
    refund: Refund | None = None,
    pledge: Pledge | None = None,
    order: Order | None = None,
    issue_reward: IssueReward | None = None,
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.refund,
        account=None,
        processor=processor,
        currency="usd",
        amount=amount,
        account_currency="usd",
        account_amount=amount,
        tax_amount=0,
        charge_id=charge_id,
        refund=refund,
        pledge=pledge,
        order=order,
        issue_reward=issue_reward,
    )
    await save_fixture(transaction)
    return transaction


async def create_dispute_transaction(
    save_fixture: SaveFixture,
    dispute: Dispute,
    *,
    processor: Processor = Processor.stripe,
    currency: str = "usd",
    amount: int = 1000,
    charge_id: str | None = "STRIPE_CHARGE_ID",
    dispute_id: str | None = "STRIPE_DISPUTE_ID",
    pledge: Pledge | None = None,
    order: Order | None = None,
    issue_reward: IssueReward | None = None,
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.dispute,
        processor=processor,
        currency=currency,
        amount=amount,
        account_currency=currency,
        account_amount=amount,
        tax_amount=0,
        charge_id=charge_id,
        dispute=dispute,
        pledge=pledge,
        order=order,
        issue_reward=issue_reward,
    )
    await save_fixture(transaction)
    return transaction


async def create_balance_transaction(
    save_fixture: SaveFixture,
    *,
    account: Account,
    currency: str = "usd",
    amount: int = 1000,
    payment_transaction: Transaction | None = None,
    balance_reversal_transaction: Transaction | None = None,
    payout_transaction: Transaction | None = None,
) -> Transaction:
    transaction = Transaction(
        type=TransactionType.balance,
        account=account,
        processor=None,
        currency=currency,
        amount=amount,
        account_currency=currency,
        account_amount=amount,
        tax_amount=0,
        payment_transaction=payment_transaction,
        balance_reversal_transaction=balance_reversal_transaction,
        payout_transaction=payout_transaction,
    )
    await save_fixture(transaction)
    return transaction


METER_ID = uuid.uuid4()
METER_TEST_EVENT = "TEST_EVENT"


async def create_event(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    source: EventSource = EventSource.user,
    name: str = METER_TEST_EVENT,
    timestamp: datetime | None = None,
    customer: Customer | None = None,
    external_customer_id: str | None = None,
    external_id: str | None = None,
    parent_id: uuid.UUID | None = None,
    metadata: dict[str, str | int | bool | float | Any] | None = None,
    event_type: EventType | None = None,
) -> Event:
    event = Event(
        timestamp=timestamp or utc_now(),
        source=source,
        name=name,
        customer_id=customer.id if customer else None,
        external_customer_id=external_customer_id,
        external_id=external_id,
        parent_id=parent_id,
        organization=organization,
        user_metadata=metadata or {},
        event_type_id=event_type.id if event_type else None,
    )
    await save_fixture(event)
    return event


async def create_meter(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    id: uuid.UUID = METER_ID,
    name: str = "My Meter",
    filter: Filter = Filter(
        conjunction=FilterConjunction.and_,
        clauses=[
            FilterClause(
                property="name", operator=FilterOperator.eq, value=METER_TEST_EVENT
            )
        ],
    ),
    aggregation: Aggregation = CountAggregation(),
    last_billed_event: Event | None = None,
) -> Meter:
    meter = Meter(
        id=id,
        name=name,
        organization=organization,
        filter=filter,
        aggregation=aggregation,
        last_billed_event=last_billed_event,
    )
    await save_fixture(meter)
    return meter


@pytest_asyncio.fixture
async def meter(save_fixture: SaveFixture, organization: Organization) -> Meter:
    return await create_meter(save_fixture, organization=organization)


async def create_notification_recipient(
    save_fixture: SaveFixture,
    *,
    user: User,
    expo_push_token: str,
    platform: NotificationRecipientPlatform = NotificationRecipientPlatform.ios,
) -> NotificationRecipient:
    notification_recipient = NotificationRecipient(
        platform=platform,
        expo_push_token=expo_push_token,
        user_id=user.id,
    )
    await save_fixture(notification_recipient)
    return notification_recipient


async def create_payout(
    save_fixture: SaveFixture,
    *,
    account: Account,
    transaction: Transaction | None = None,
    status: PayoutStatus = PayoutStatus.pending,
    amount: int = 1000,
    fees_amount: int = 0,
    currency: str = "usd",
    account_currency: str = "usd",
    account_amount: int = 1000,
    created_at: datetime | None = None,
    invoice_number: str | None = None,
) -> Payout:
    payout = Payout(
        created_at=created_at,
        account=account,
        status=status,
        processor=account.account_type,
        currency=currency,
        amount=amount,
        fees_amount=fees_amount,
        account_currency=account_currency,
        account_amount=account_amount,
        transaction=transaction,
        invoice_number=invoice_number or rstr("POLAR-"),
    )
    await save_fixture(payout)
    return payout


async def create_account(
    save_fixture: SaveFixture,
    organization: Organization,
    user: User,
    *,
    status: Account.Status = Account.Status.ACTIVE,
    country: str = "US",
    currency: str = "usd",
    account_type: AccountType = AccountType.stripe,
    stripe_id: str = "STRIPE_ID",
    processor_fees_applicable: bool = True,
    fee_basis_points: int | None = None,
    fee_fixed: int | None = None,
    is_payouts_enabled: bool = True,
    billing_name: str | None = None,
    billing_address: Address | None = None,
) -> Account:
    account = Account(
        status=status,
        account_type=account_type,
        admin_id=user.id,
        country=country,
        currency=currency,
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=is_payouts_enabled,
        processor_fees_applicable=processor_fees_applicable,
        stripe_id=stripe_id,
        _platform_fee_percent=fee_basis_points,
        _platform_fee_fixed=fee_fixed,
        billing_name=billing_name,
        billing_address=billing_address,
    )
    await save_fixture(account)
    organization.account = account
    await save_fixture(organization)
    return account


@pytest_asyncio.fixture
async def account(
    save_fixture: SaveFixture, organization: Organization, user: User
) -> Account:
    return await create_account(save_fixture, organization, user)


async def create_payment(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    processor: PaymentProcessor = PaymentProcessor.stripe,
    status: PaymentStatus = PaymentStatus.succeeded,
    amount: int = 1000,
    currency: str = "usd",
    method: str = "card",
    method_metadata: dict[str, Any] = {},
    customer_email: str | None = "customer@example.com",
    processor_id: str | None = None,
    decline_reason: str | None = None,
    decline_message: str | None = None,
    risk_level: str | None = None,
    risk_score: int | None = None,
    checkout: Checkout | None = None,
    order: Order | None = None,
) -> Payment:
    payment = Payment(
        processor=processor,
        status=status,
        amount=amount,
        currency=currency,
        method=method,
        method_metadata=method_metadata,
        customer_email=customer_email,
        processor_id=processor_id or rstr("PAYMENT_PROCESSOR_ID"),
        decline_reason=decline_reason,
        decline_message=decline_message,
        risk_level=risk_level,
        risk_score=risk_score,
        organization=organization,
        checkout=checkout,
        order=order,
    )
    await save_fixture(payment)
    return payment


@pytest_asyncio.fixture
async def payment(save_fixture: SaveFixture, organization: Organization) -> Payment:
    return await create_payment(save_fixture, organization)


async def create_payment_method(
    save_fixture: SaveFixture,
    customer: Customer,
    *,
    processor: PaymentProcessor = PaymentProcessor.stripe,
    processor_id: str | None = None,
    type: str = "card",
    method_metadata: dict[str, Any] = {},
) -> PaymentMethod:
    payment_method = PaymentMethod(
        processor=processor,
        processor_id=processor_id or rstr("PAYMENT_METHOD_PROCESSOR_ID"),
        type=type,
        method_metadata=method_metadata,
        customer=customer,
    )
    await save_fixture(payment_method)
    return payment_method


@pytest_asyncio.fixture
async def payment_method(
    save_fixture: SaveFixture, customer: Customer
) -> PaymentMethod:
    return await create_payment_method(save_fixture, customer)


async def create_billing_entry(
    save_fixture: SaveFixture,
    *,
    type: BillingEntryType,
    customer: Customer,
    product_price: ProductPrice,
    event: Event | None = None,
    start_timestamp: datetime | None = None,
    end_timestamp: datetime | None = None,
    direction: BillingEntryDirection = BillingEntryDirection.debit,
    amount: int | None = None,
    discount_amount: int | None = None,
    currency: str | None = None,
    subscription: Subscription | None = None,
    order_item: OrderItem | None = None,
) -> BillingEntry:
    if event is None:
        event = await create_event(
            save_fixture,
            organization=customer.organization,
            name="Billing Entry",
            customer=customer,
        )

    if start_timestamp is None:
        start_timestamp = event.timestamp

    if end_timestamp is None:
        end_timestamp = event.timestamp

    billing_entry = BillingEntry(
        start_timestamp=start_timestamp,
        end_timestamp=end_timestamp,
        type=type,
        direction=direction,
        amount=amount,
        discount_amount=discount_amount,
        currency=currency,
        customer=customer,
        product_price=product_price,
        subscription=subscription,
        event=event,
        order_item=order_item,
    )
    await save_fixture(billing_entry)
    return billing_entry


async def create_customer_seat(
    save_fixture: SaveFixture,
    *,
    subscription: Subscription | None = None,
    order: Order | None = None,
    status: SeatStatus = SeatStatus.pending,
    customer: Customer | None = None,
    invitation_token: str | None = None,
    metadata: dict[str, Any] | None = None,
    claimed_at: datetime | None = None,
    revoked_at: datetime | None = None,
) -> CustomerSeat:
    if subscription is None and order is None:
        raise ValueError("Either subscription or order must be provided")
    if subscription is not None and order is not None:
        raise ValueError("Only one of subscription or order can be provided")

    if invitation_token is None and status == SeatStatus.pending:
        invitation_token = secrets.token_urlsafe(32)

    seat_data = {
        "status": status,
        "customer_id": customer.id if customer else None,
        "invitation_token": invitation_token,
        "claimed_at": claimed_at,
        "revoked_at": revoked_at,
        "seat_metadata": metadata or {},
    }

    if subscription is not None:
        seat_data["subscription_id"] = subscription.id
    elif order is not None:
        seat_data["order_id"] = order.id

    seat = CustomerSeat(**seat_data)
    await save_fixture(seat)
    return seat


async def create_subscription_with_seats(
    save_fixture: SaveFixture,
    *,
    product: Product,
    customer: Customer,
    seats: int = 5,
    **kwargs: Any,
) -> Subscription:
    is_seat_based = any(
        price.amount_type == ProductPriceAmountType.seat_based
        for price in product.all_prices
    )
    assert is_seat_based, "Product must be seat-based"
    # Default to active status if not specified, so subscription is billable
    if "status" not in kwargs:
        kwargs["status"] = SubscriptionStatus.active
    if "started_at" not in kwargs:
        kwargs["started_at"] = utc_now()
    subscription = await create_subscription(
        save_fixture, product=product, customer=customer, seats=seats, **kwargs
    )
    return subscription


async def create_wallet(
    save_fixture: SaveFixture,
    *,
    customer: Customer,
    type: WalletType,
    currency: str = "usd",
) -> Wallet:
    wallet = Wallet(
        type=type,
        customer=customer,
        currency=currency,
    )
    await save_fixture(wallet)
    return wallet


async def create_wallet_transaction(
    save_fixture: SaveFixture,
    *,
    wallet: Wallet,
    amount: int,
    tax_amount: int = 0,
    tax_calculation_processor_id: str | None = None,
) -> WalletTransaction:
    wallet_transaction = WalletTransaction(
        wallet=wallet,
        amount=amount,
        currency=wallet.currency,
        tax_amount=tax_amount,
        tax_calculation_processor_id=tax_calculation_processor_id,
    )
    await save_fixture(wallet_transaction)
    return wallet_transaction


async def create_wallet_billing(
    save_fixture: SaveFixture,
    *,
    customer: Customer,
    currency: str = "usd",
    initial_balance: int = 0,
) -> Wallet:
    wallet = await create_wallet(
        save_fixture,
        type=WalletType.billing,
        currency=currency,
        customer=customer,
    )
    if initial_balance != 0:
        await create_wallet_transaction(
            save_fixture,
            wallet=wallet,
            amount=initial_balance,
        )

    return wallet


async def create_trial_redemption(
    save_fixture: SaveFixture,
    *,
    customer: Customer,
    customer_email: str,
    product: Product | None = None,
    payment_method_fingerprint: str | None = None,
) -> TrialRedemption:
    trial_redemption = TrialRedemption(
        customer_email=customer_email,
        payment_method_fingerprint=payment_method_fingerprint,
        customer=customer,
        product=product,
    )
    await save_fixture(trial_redemption)
    return trial_redemption


async def create_event_type(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    name: str = "test.event",
    label: str = "Test Event",
) -> EventType:
    event_type = EventType(
        name=name,
        label=label,
        organization_id=organization.id,
    )
    await save_fixture(event_type)
    return event_type


@pytest_asyncio.fixture
async def event_type(
    save_fixture: SaveFixture,
    organization: Organization,
) -> EventType:
    return await create_event_type(save_fixture, organization=organization)


async def create_webhook_endpoint(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    events: list[WebhookEventType] | None = None,
) -> WebhookEndpoint:
    webhook_endpoint = WebhookEndpoint(
        url="https://example.com/webhook",
        format=WebhookFormat.raw,
        secret="SECRET",
        events=events or list(WebhookEventType),
        organization=organization,
    )
    await save_fixture(webhook_endpoint)
    return webhook_endpoint


async def create_dispute(
    save_fixture: SaveFixture,
    order: Order,
    payment: Payment,
    *,
    status: DisputeStatus = DisputeStatus.needs_response,
    amount: int = 1000,
    tax_amount: int = 0,
    currency: str = "usd",
    payment_processor: PaymentProcessor | None = PaymentProcessor.stripe,
    payment_processor_id: str | None = "STRIPE_DISPUTE_ID",
    alert_processor: DisputeAlertProcessor | None = None,
    alert_processor_id: str | None = None,
) -> Dispute:
    dispute = Dispute(
        status=status,
        amount=amount,
        tax_amount=tax_amount,
        currency=currency,
        payment_processor=payment_processor,
        payment_processor_id=payment_processor_id,
        dispute_alert_processor=alert_processor,
        dispute_alert_processor_id=alert_processor_id,
        order=order,
        payment=payment,
    )
    await save_fixture(dispute)
    return dispute
