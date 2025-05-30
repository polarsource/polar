import random
import secrets
import string
import typing
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any, Literal, TypeAlias, Unpack

import pytest_asyncio
from typing_extensions import TypeIs

from polar.enums import (
    AccountType,
    PaymentProcessor,
    SubscriptionRecurringInterval,
)
from polar.kit.address import Address
from polar.kit.tax import TaxID
from polar.kit.utils import utc_now
from polar.meter.aggregation import (
    Aggregation,
    CountAggregation,
)
from polar.meter.filter import Filter, FilterConjunction
from polar.models import (
    Account,
    Benefit,
    Checkout,
    CheckoutLink,
    CheckoutLinkProduct,
    CheckoutProduct,
    Customer,
    CustomField,
    Discount,
    DiscountProduct,
    Event,
    IssueReward,
    LegacyRecurringProductPriceCustom,
    LegacyRecurringProductPriceFixed,
    LegacyRecurringProductPriceFree,
    Meter,
    Order,
    OrderItem,
    Organization,
    Product,
    ProductBenefit,
    ProductCustomField,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
    ProductPriceMeteredUnit,
    Refund,
    Subscription,
    SubscriptionProductPrice,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import (
    BenefitGrant,
    BenefitGrantScope,
)
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
from polar.models.discount import (
    DiscountDuration,
    DiscountFixed,
    DiscountPercentage,
    DiscountType,
)
from polar.models.event import EventSource
from polar.models.notification_recipient import NotificationRecipient
from polar.models.order import OrderBillingReason, OrderStatus
from polar.models.pledge import Pledge, PledgeState, PledgeType
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceType,
)
from polar.models.subscription import SubscriptionStatus
from polar.models.transaction import Processor, TransactionType
from polar.models.user import OAuthAccount, OAuthPlatform
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
    organization = Organization(
        name=name,
        slug=name,
        avatar_url="https://avatars.githubusercontent.com/u/105373340?s=200&v=4",
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
async def organization_blocked(save_fixture: SaveFixture) -> Organization:
    return await create_organization(save_fixture, blocked_at=utc_now())


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


@pytest_asyncio.fixture
async def user_blocked(save_fixture: SaveFixture) -> User:
    user = User(
        id=uuid.uuid4(),
        email=rstr("test") + "@example.com",
        avatar_url="https://avatars.githubusercontent.com/u/47952?v=4",
        blocked_at=utc_now(),
    )
    await save_fixture(user)
    return user


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
    user_organization = UserOrganization(
        user_id=user.id,
        organization_id=organization.id,
    )
    await save_fixture(user_organization)
    return user_organization


@pytest_asyncio.fixture
async def user_organization_second(
    save_fixture: SaveFixture,
    organization: Organization,
    user_second: User,
) -> UserOrganization:
    user_organization = UserOrganization(
        user_id=user_second.id,
        organization_id=organization.id,
    )
    await save_fixture(user_organization)
    return user_organization


@pytest_asyncio.fixture
async def user_organization_blocked(
    save_fixture: SaveFixture,
    organization_blocked: Organization,
    user: User,
) -> UserOrganization:
    user_organization = UserOrganization(
        user_id=user.id,
        organization_id=organization_blocked.id,
    )
    await save_fixture(user_organization)
    return user_organization


@pytest_asyncio.fixture
async def open_collective_account(save_fixture: SaveFixture, user: User) -> Account:
    account = Account(
        account_type=AccountType.open_collective,
        admin_id=user.id,
        open_collective_slug="polar",
        country="US",
        currency="USD",
        is_details_submitted=True,
        is_charges_enabled=True,
        is_payouts_enabled=True,
        business_type="fiscal_host",
    )
    await save_fixture(account)
    return account


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


PriceFixtureType: TypeAlias = (
    tuple[int]
    | tuple[int | None, int | None, int | None]
    | tuple[None]
    | tuple[Meter, Decimal, int | None]
)


def _is_metered_price_fixture_type(
    price: PriceFixtureType,
) -> TypeIs[tuple[Meter, Decimal, int | None]]:
    return isinstance(price[0], Meter)


async def create_product(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    recurring_interval: SubscriptionRecurringInterval | None,
    name: str = "Product",
    is_archived: bool = False,
    prices: Sequence[PriceFixtureType] = [(1000,)],
    attached_custom_fields: Sequence[tuple[CustomField, bool]] = [],
    is_tax_applicable: bool = True,
) -> Product:
    product = Product(
        name=name,
        description="Description",
        is_tax_applicable=is_tax_applicable,
        recurring_interval=recurring_interval,
        is_archived=is_archived,
        organization=organization,
        stripe_product_id=rstr("PRODUCT_ID"),
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
        stripe_price_id=rstr("PRICE_ID"),
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
        stripe_price_id=rstr("PRICE_ID"),
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
        stripe_price_id=rstr("PRICE_ID"),
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
            stripe_price_id=rstr("PRICE_ID"),
            product=product,
            is_archived=False,
        )
    elif amount_type == ProductPriceAmountType.custom:
        product_price = LegacyRecurringProductPriceCustom(
            price_currency="usd",
            minimum_amount=minimum_amount,
            maximum_amount=maximum_amount,
            preset_amount=preset_amount,
            stripe_price_id=rstr("PRICE_ID"),
            product=product,
            is_archived=False,
        )
    elif amount_type == ProductPriceAmountType.free:
        product_price = LegacyRecurringProductPriceFree(
            stripe_price_id=rstr("PRICE_ID"),
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
    stripe_coupon_id: str = "STRIPE_COUPON_ID",
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
    stripe_coupon_id: str = "STRIPE_COUPON_ID",
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
    stripe_coupon_id: str = "STRIPE_COUPON_ID",
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
        stripe_coupon_id=stripe_coupon_id,
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
    status: OrderStatus = OrderStatus.paid,
    product: Product,
    customer: Customer,
    subtotal_amount: int = 1000,
    tax_amount: int = 0,
    discount_amount: int = 0,
    refunded_amount: int = 0,
    refunded_tax_amount: int = 0,
    subscription: Subscription | None = None,
    stripe_invoice_id: str | None = "INVOICE_ID",
    billing_reason: OrderBillingReason = OrderBillingReason.purchase,
    user_metadata: dict[str, Any] | None = None,
    created_at: datetime | None = None,
    custom_field_data: dict[str, Any] | None = None,
    billing_name: str | None = None,
    billing_address: Address | None = None,
) -> Order:
    order = Order(
        created_at=created_at or utc_now(),
        status=status,
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
        discount_amount=discount_amount,
        refunded_amount=refunded_amount,
        refunded_tax_amount=refunded_tax_amount,
        items=[
            OrderItem(
                label="",
                amount=subtotal_amount,
                tax_amount=tax_amount,
                proration=False,
            )
        ],
        currency="usd",
        billing_reason=billing_reason,
        stripe_invoice_id=stripe_invoice_id,
        billing_name=billing_name,
        billing_address=billing_address,
        customer=customer,
        product=product,
        subscription=subscription,
        custom_field_data=custom_field_data or {},
        user_metadata=user_metadata or {},
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
) -> tuple[Order, Transaction]:
    order = await create_order(
        save_fixture,
        product=product,
        customer=customer,
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
    )
    payment = await create_payment_transaction(
        save_fixture, amount=subtotal_amount, tax_amount=tax_amount, order=order
    )
    return order, payment


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
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    current_period_start: datetime | None = None,
    current_period_end: datetime | None = None,
    discount: Discount | None = None,
    stripe_subscription_id: str | None = "SUBSCRIPTION_ID",
    cancel_at_period_end: bool = False,
    revoke: bool = False,
    user_metadata: dict[str, Any] | None = None,
) -> Subscription:
    prices = prices or product.prices
    now = datetime.now(UTC)
    if not current_period_end:
        current_period_end = now + timedelta(days=30)

    recurring_interval = product.recurring_interval
    if product.is_legacy_recurring_price:
        recurring_interval = product.prices[0].recurring_interval

    ends_at = None
    canceled_at = None
    if revoke:
        ended_at = now
        ends_at = now
        canceled_at = now
        status = SubscriptionStatus.canceled
    elif cancel_at_period_end:
        ends_at = current_period_end
        canceled_at = now

    subscription = Subscription(
        stripe_subscription_id=stripe_subscription_id,
        recurring_interval=recurring_interval,
        status=status,
        current_period_start=(
            now if current_period_start is None else current_period_start
        ),
        current_period_end=current_period_end,
        cancel_at_period_end=cancel_at_period_end,
        canceled_at=canceled_at,
        started_at=started_at,
        ended_at=ended_at,
        ends_at=ends_at,
        customer=customer,
        product=product,
        subscription_product_prices=[
            SubscriptionProductPrice.from_price(price) for price in prices
        ],
        discount=discount,
        user_metadata=user_metadata or {},
    )
    await save_fixture(subscription)

    return subscription


async def create_active_subscription(
    save_fixture: SaveFixture,
    *,
    product: Product,
    prices: Sequence[ProductPrice] | None = None,
    customer: Customer,
    organization: Organization | None = None,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    stripe_subscription_id: str | None = "SUBSCRIPTION_ID",
    user_metadata: dict[str, Any] | None = None,
) -> Subscription:
    return await create_subscription(
        save_fixture,
        product=product,
        prices=prices,
        customer=customer,
        status=SubscriptionStatus.active,
        started_at=started_at or utc_now(),
        ended_at=ended_at,
        stripe_subscription_id=stripe_subscription_id,
        user_metadata=user_metadata or {},
    )


async def create_canceled_subscription(
    save_fixture: SaveFixture,
    *,
    product: Product,
    prices: Sequence[ProductPrice] | None = None,
    customer: Customer,
    stripe_subscription_id: str | None = "SUBSCRIPTION_ID",
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
        stripe_subscription_id=stripe_subscription_id,
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
    customer_metadata: dict[str, Any] = {},
    payment_processor_metadata: dict[str, Any] = {},
    amount: int | None = None,
    tax_amount: int | None = None,
    currency: str | None = None,
    customer: Customer | None = None,
    subscription: Subscription | None = None,
    discount: Discount | None = None,
) -> Checkout:
    product = product or products[0]
    price = price or product.prices[0]

    if isinstance(price, ProductPriceFixed):
        amount = price.price_amount
        currency = price.price_currency
    elif isinstance(price, ProductPriceCustom):
        amount = amount or 10_00
        currency = price.price_currency
    else:
        amount = 0
        currency = "usd"

    checkout = Checkout(
        payment_processor=payment_processor,
        status=status,
        expires_at=expires_at or get_expires_at(),
        client_secret=client_secret
        or rstr(
            "CHECKOUT_CLIENT_SECRET",
        ),
        user_metadata=user_metadata,
        customer_metadata=customer_metadata,
        payment_processor_metadata=payment_processor_metadata,
        amount=amount,
        tax_amount=tax_amount,
        currency=currency,
        product_price=price,
        product=product,
        checkout_products=[
            CheckoutProduct(product=p, order=i) for i, p in enumerate(products)
        ],
        customer=customer,
        subscription=subscription,
        discount=discount,
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
            user_id=user.id, organization_id=organization_second.id
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
    **scope: Unpack[BenefitGrantScope],
) -> BenefitGrant:
    grant = BenefitGrant(benefit=benefit, customer=customer, **scope)
    if granted is not None:
        grant.set_granted() if granted else grant.set_revoked()
    if properties is not None:
        grant.properties = properties
    await save_fixture(grant)
    return grant


async def create_refund(
    save_fixture: SaveFixture,
    order: Order,
    *,
    status: str = "succeeded",
    processor: PaymentProcessor = PaymentProcessor.stripe,
    amount: int = 1000,
    tax_amount: int = 0,
    reason: str = "customer_request",
    processor_id: str = "STRIPE_REFUND_ID",
    processor_reason: str = "requested_by_customer",
    processor_balance_transaction_id: str = "STRIPE_BALANCE_TRANSACTION_ID",
) -> Refund:
    refund = Refund(
        status=status,
        reason=reason,
        amount=amount,
        tax_amount=tax_amount,
        currency="usd",
        order_id=order.id,
        subscription_id=order.subscription_id,
        customer_id=order.customer_id,
        organization_id=order.product.organization_id,
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
    refund_id: str | None = "STRIPE_REFUND_ID",
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
        refund_id=refund_id,
        pledge=pledge,
        order=order,
        issue_reward=issue_reward,
    )
    await save_fixture(transaction)
    return transaction


async def create_dispute_transaction(
    save_fixture: SaveFixture,
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
        dispute_id=dispute_id,
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


async def create_event(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    source: EventSource = EventSource.user,
    name: str = "test",
    timestamp: datetime | None = None,
    customer: Customer | None = None,
    external_customer_id: str | None = None,
    metadata: dict[str, str | int | bool | float] | None = None,
) -> Event:
    event = Event(
        timestamp=timestamp or utc_now(),
        source=source,
        name=name,
        customer_id=customer.id if customer else None,
        external_customer_id=external_customer_id,
        organization=organization,
        user_metadata=metadata or {},
    )
    await save_fixture(event)
    return event


METER_ID = uuid.uuid4()


async def create_meter(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    id: uuid.UUID = METER_ID,
    name: str = "My Meter",
    filter: Filter = Filter(conjunction=FilterConjunction.and_, clauses=[]),
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
