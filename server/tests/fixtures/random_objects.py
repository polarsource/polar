import random
import secrets
import string
import typing
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, Unpack

import pytest_asyncio

from polar.enums import (
    AccountType,
    PaymentProcessor,
    Platforms,
    SubscriptionRecurringInterval,
)
from polar.kit.utils import utc_now
from polar.models import (
    Account,
    AdvertisementCampaign,
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
    ExternalOrganization,
    IssueReward,
    LegacyRecurringProductPriceCustom,
    LegacyRecurringProductPriceFixed,
    LegacyRecurringProductPriceFree,
    Order,
    Organization,
    Product,
    ProductBenefit,
    ProductCustomField,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
    Refund,
    Repository,
    Subscription,
    Transaction,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from polar.models.benefit_grant import (
    BenefitGrant,
    BenefitGrantProperties,
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
from polar.models.issue import Issue
from polar.models.order import OrderBillingReason
from polar.models.pledge import Pledge, PledgeState, PledgeType
from polar.models.product_price import (
    HasPriceCurrency,
    ProductPriceAmountType,
    ProductPriceType,
)
from polar.models.subscription import SubscriptionStatus
from polar.models.transaction import Processor, TransactionType
from polar.models.user import OAuthAccount, OAuthPlatform
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


async def create_external_organization(
    save_fixture: SaveFixture, *, organization: Organization | None = None
) -> ExternalOrganization:
    external_organization = ExternalOrganization(
        platform=Platforms.github,
        name=rstr("testorg"),
        external_id=secrets.randbelow(100000),
        avatar_url="https://avatars.githubusercontent.com/u/105373340?s=200&v=4",
        is_personal=False,
        installation_id=secrets.randbelow(100000),
        installation_created_at=datetime.now(),
        installation_updated_at=datetime.now(),
        installation_suspended_at=None,
        organization=organization,
    )
    await save_fixture(external_organization)
    return external_organization


@pytest_asyncio.fixture
async def external_organization(save_fixture: SaveFixture) -> ExternalOrganization:
    return await create_external_organization(save_fixture)


@pytest_asyncio.fixture
async def external_organization_linked(
    save_fixture: SaveFixture, organization: Organization
) -> ExternalOrganization:
    return await create_external_organization(save_fixture, organization=organization)


@pytest_asyncio.fixture
async def repository(
    save_fixture: SaveFixture, external_organization: ExternalOrganization
) -> Repository:
    return await create_repository(save_fixture, external_organization, is_private=True)


@pytest_asyncio.fixture
async def repository_linked(
    save_fixture: SaveFixture, external_organization_linked: ExternalOrganization
) -> Repository:
    return await create_repository(
        save_fixture, external_organization_linked, is_private=False
    )


@pytest_asyncio.fixture
async def public_repository(
    save_fixture: SaveFixture, external_organization: ExternalOrganization
) -> Repository:
    return await create_repository(
        save_fixture, external_organization, is_private=False
    )


@pytest_asyncio.fixture
async def public_repository_linked(
    save_fixture: SaveFixture, external_organization_linked: ExternalOrganization
) -> Repository:
    return await create_repository(
        save_fixture, external_organization_linked, is_private=False
    )


async def create_repository(
    save_fixture: SaveFixture,
    external_organization: ExternalOrganization,
    is_private: bool = True,
) -> Repository:
    repository = Repository(
        platform=Platforms.github,
        name=rstr("testrepo"),
        organization_id=external_organization.id,
        external_id=secrets.randbelow(100000),
        is_private=is_private,
    )
    await save_fixture(repository)
    return repository


@pytest_asyncio.fixture
async def issue(
    save_fixture: SaveFixture,
    external_organization: ExternalOrganization,
    repository: Repository,
) -> Issue:
    return await create_issue(save_fixture, external_organization, repository)


@pytest_asyncio.fixture
async def issue_linked(
    save_fixture: SaveFixture,
    external_organization_linked: ExternalOrganization,
    repository_linked: Repository,
) -> Issue:
    return await create_issue(
        save_fixture, external_organization_linked, repository_linked
    )


async def create_issue(
    save_fixture: SaveFixture,
    external_organization: ExternalOrganization,
    repository: Repository,
) -> Issue:
    issue = Issue(
        id=uuid.uuid4(),
        organization=external_organization,
        repository=repository,
        title="issue title",
        number=secrets.randbelow(100000),
        platform=Platforms.github,
        external_id=secrets.randbelow(100000),
        state="open",
        issue_created_at=datetime.now(),
        issue_modified_at=datetime.now(),
        external_lookup_key=str(uuid.uuid4()),  # not realistic
        issue_has_in_progress_relationship=False,
        issue_has_pull_request_relationship=False,
    )
    await save_fixture(issue)
    return issue


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
    external_organization: ExternalOrganization,
    repository: Repository,
    issue: Issue,
    *,
    pledging_organization: Organization | None = None,
    pledging_user: User | None = None,
    state: PledgeState = PledgeState.created,
    type: PledgeType = PledgeType.pay_upfront,
    payment_id: str = "STRIPE_PAYMENT_INTENT",
) -> Pledge:
    amount = secrets.randbelow(100000) + 1
    fee = round(amount * 0.05)
    pledge = Pledge(
        id=uuid.uuid4(),
        by_organization=pledging_organization,
        user=pledging_user,
        issue=issue,
        to_repository=repository,
        to_organization=external_organization,
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


async def create_user_pledge(
    save_fixture: SaveFixture,
    external_organization: ExternalOrganization,
    repository: Repository,
    issue: Issue,
    *,
    pledging_user: User,
    state: PledgeState = PledgeState.created,
    type: PledgeType = PledgeType.pay_upfront,
    amount: int = secrets.randbelow(100000) + 1,
) -> Pledge:
    fee = round(amount * 0.05)
    pledge = Pledge(
        id=uuid.uuid4(),
        user=pledging_user,
        created_by_user=pledging_user,
        issue=issue,
        to_repository=repository,
        to_organization=external_organization,
        amount=amount,
        currency="usd",
        fee=fee,
        state=state,
        type=type,
        invoice_id="INVOICE_ID" if type == PledgeType.pay_on_completion else None,
    )
    await save_fixture(pledge)
    return pledge


@pytest_asyncio.fixture
async def pledge(
    save_fixture: SaveFixture,
    external_organization: ExternalOrganization,
    repository: Repository,
    issue: Issue,
    pledging_organization: Organization,
) -> Pledge:
    return await create_pledge(
        save_fixture,
        external_organization,
        repository,
        issue,
        pledging_organization=pledging_organization,
    )


@pytest_asyncio.fixture
async def pledge_linked(
    save_fixture: SaveFixture,
    external_organization_linked: ExternalOrganization,
    repository_linked: Repository,
    issue_linked: Issue,
    pledging_organization: Organization,
) -> Pledge:
    return await create_pledge(
        save_fixture,
        external_organization_linked,
        repository_linked,
        issue_linked,
        pledging_organization=pledging_organization,
    )


@pytest_asyncio.fixture
async def pledge_by_user(
    save_fixture: SaveFixture,
    external_organization: ExternalOrganization,
    repository: Repository,
    issue: Issue,
) -> Pledge:
    user = await create_user(save_fixture)

    amount = secrets.randbelow(100000) + 1
    fee = round(amount * 0.05)
    pledge = Pledge(
        id=uuid.uuid4(),
        issue=issue,
        to_repository=repository,
        to_organization=external_organization,
        user=user,
        amount=amount,
        currency="usd",
        fee=fee,
        state=PledgeState.created,
        type=PledgeType.pay_upfront,
    )
    await save_fixture(pledge)
    return pledge


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


async def create_product(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    recurring_interval: SubscriptionRecurringInterval | None,
    name: str = "Product",
    is_archived: bool = False,
    prices: Sequence[
        tuple[int] | tuple[int | None, int | None, int | None] | tuple[None]
    ] = [(1000,)],
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
        product_price: ProductPriceFixed | ProductPriceCustom | ProductPriceFree
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
    email: str = "customer@example.com",
    email_verified: bool = False,
    name: str = "Customer",
    stripe_customer_id: str = "STRIPE_CUSTOMER_ID",
    user_metadata: dict[str, Any] = {},
) -> Customer:
    customer = Customer(
        email=email,
        email_verified=email_verified,
        name=name,
        stripe_customer_id=stripe_customer_id,
        organization=organization,
        user_metadata=user_metadata,
    )
    await save_fixture(customer)
    return customer


async def create_order(
    save_fixture: SaveFixture,
    *,
    product: Product,
    customer: Customer,
    product_price: ProductPrice | None = None,
    subscription: Subscription | None = None,
    amount: int = 1000,
    tax_amount: int = 0,
    stripe_invoice_id: str | None = "INVOICE_ID",
    billing_reason: OrderBillingReason = OrderBillingReason.purchase,
    created_at: datetime | None = None,
    custom_field_data: dict[str, Any] | None = None,
) -> Order:
    if product_price is None and product.prices:
        product_price = product.prices[0]

    order = Order(
        created_at=created_at or utc_now(),
        amount=amount,
        tax_amount=tax_amount,
        currency="usd",
        billing_reason=billing_reason,
        stripe_invoice_id=stripe_invoice_id,
        customer=customer,
        product=product,
        product_price=product_price,
        subscription=subscription,
        custom_field_data=custom_field_data or {},
    )
    await save_fixture(order)
    return order


async def create_order_and_payment(
    save_fixture: SaveFixture,
    *,
    product: Product,
    customer: Customer,
    amount: int,
    tax_amount: int,
) -> tuple[Order, Transaction]:
    order = await create_order(
        save_fixture,
        product=product,
        customer=customer,
        amount=amount,
        tax_amount=tax_amount,
    )
    payment = await create_payment_transaction(
        save_fixture, amount=amount, tax_amount=tax_amount, order=order
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
    price: ProductPrice | None = None,
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
) -> Subscription:
    price = price or product.prices[0] if product.prices else None
    now = datetime.now(UTC)
    if not current_period_end:
        current_period_end = now + timedelta(days=30)

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
        amount=price.price_amount if isinstance(price, ProductPriceFixed) else None,
        currency=(
            price.price_currency
            if price is not None and isinstance(price, HasPriceCurrency)
            else None
        ),
        recurring_interval=price.recurring_interval
        if isinstance(
            price,
            LegacyRecurringProductPriceFixed
            | LegacyRecurringProductPriceCustom
            | LegacyRecurringProductPriceFree,
        )
        else product.recurring_interval,
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
        price=price,
        discount=discount,
    )
    await save_fixture(subscription)
    return subscription


async def create_active_subscription(
    save_fixture: SaveFixture,
    *,
    product: Product,
    price: ProductPrice | None = None,
    customer: Customer,
    organization: Organization | None = None,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    stripe_subscription_id: str | None = "SUBSCRIPTION_ID",
) -> Subscription:
    return await create_subscription(
        save_fixture,
        product=product,
        price=price,
        customer=customer,
        status=SubscriptionStatus.active,
        started_at=started_at or utc_now(),
        ended_at=ended_at,
        stripe_subscription_id=stripe_subscription_id,
    )


async def create_canceled_subscription(
    save_fixture: SaveFixture,
    *,
    product: Product,
    price: ProductPrice | None = None,
    customer: Customer,
    stripe_subscription_id: str | None = "SUBSCRIPTION_ID",
    cancel_at_period_end: bool = True,
    revoke: bool = False,
) -> Subscription:
    return await create_subscription(
        save_fixture,
        product=product,
        price=price,
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
        currency = price.price_currency
    else:
        amount = None
        currency = None

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
    properties: BenefitGrantProperties | None = None,
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


async def create_advertisement_campaign(
    save_fixture: SaveFixture, *, user: User
) -> AdvertisementCampaign:
    advertisement_campaign = AdvertisementCampaign(
        user=user,
        image_url="https://example.com/img.jpg",
        text="",
        link_url="https://example.com",
    )
    await save_fixture(advertisement_campaign)
    return advertisement_campaign


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
    name: str = "test",
    timestamp: datetime | None = None,
    customer: Customer | None = None,
    external_customer_id: str | None = None,
    metadata: dict[str, str | int | bool] | None = None,
) -> Event:
    event = Event(
        timestamp=timestamp or utc_now(),
        name=name,
        customer=customer,
        external_customer_id=external_customer_id,
        organization=organization,
        user_metadata=metadata or {},
    )
    await save_fixture(event)
    return event
