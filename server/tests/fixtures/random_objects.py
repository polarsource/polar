import random
import secrets
import string
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, Unpack

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
    Article,
    Benefit,
    Checkout,
    CheckoutLink,
    ExternalOrganization,
    Order,
    Organization,
    Product,
    ProductBenefit,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    ProductPriceFree,
    Repository,
    Subscription,
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
from polar.models.donation import Donation
from polar.models.issue import Issue
from polar.models.order import OrderBillingReason
from polar.models.pledge import Pledge, PledgeState, PledgeType
from polar.models.product_price import HasPriceCurrency, ProductPriceType
from polar.models.subscription import SubscriptionStatus
from polar.models.user import OAuthAccount, OAuthPlatform
from tests.fixtures.database import SaveFixture


def rstr(prefix: str) -> str:
    return prefix + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


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
        user_id=user.id,
    )
    await save_fixture(oauth_account)
    return oauth_account


@pytest_asyncio.fixture
async def user_github_oauth(
    save_fixture: SaveFixture,
    user: User,
) -> OAuthAccount:
    return await create_user_github_oauth(save_fixture, user)


@pytest_asyncio.fixture
async def user(
    save_fixture: SaveFixture,
) -> User:
    return await create_user(save_fixture)


async def create_user(
    save_fixture: SaveFixture, stripe_customer_id: str | None = None
) -> User:
    user = User(
        id=uuid.uuid4(),
        email=rstr("test") + "@example.com",
        avatar_url="https://avatars.githubusercontent.com/u/47952?v=4",
        oauth_accounts=[],
        stripe_customer_id=stripe_customer_id,
    )
    await save_fixture(user)
    return user


@pytest_asyncio.fixture
async def user_second(save_fixture: SaveFixture) -> User:
    user = User(
        id=uuid.uuid4(),
        email=rstr("test") + "@example.com",
        avatar_url="https://avatars.githubusercontent.com/u/47952?v=4",
    )
    await save_fixture(user)
    return user


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


async def create_product(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    name: str = "Product",
    is_archived: bool = False,
    prices: Sequence[
        tuple[int, ProductPriceType, SubscriptionRecurringInterval | None]
        | tuple[
            int | None,
            int | None,
            int | None,
            ProductPriceType,
            SubscriptionRecurringInterval | None,
        ]
        | tuple[ProductPriceType, SubscriptionRecurringInterval | None]
    ] = [(1000, ProductPriceType.recurring, SubscriptionRecurringInterval.month)],
) -> Product:
    product = Product(
        name=name,
        description="Description",
        is_archived=is_archived,
        organization_id=organization.id,
        stripe_product_id=rstr("PRODUCT_ID"),
        all_prices=[],
        prices=[],
        product_benefits=[],
        product_medias=[],
    )
    await save_fixture(product)

    for price in prices:
        product_price: ProductPriceFixed | ProductPriceCustom | ProductPriceFree
        if len(price) == 2:
            price_type, recurring_interval = price
            product_price = await create_product_price_free(
                save_fixture,
                product=product,
                type=price_type,
                recurring_interval=recurring_interval,
            )
        elif len(price) == 3:
            amount, price_type, recurring_interval = price
            product_price = await create_product_price_fixed(
                save_fixture,
                product=product,
                amount=amount,
                type=price_type,
                recurring_interval=recurring_interval,
            )
        else:
            (
                minimum_amount,
                maximum_amount,
                preset_amount,
                price_type,
                recurring_interval,
            ) = price
            product_price = await create_product_price_custom(
                save_fixture,
                product=product,
                type=price_type,
                recurring_interval=recurring_interval,
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
    type: ProductPriceType = ProductPriceType.recurring,
    recurring_interval: SubscriptionRecurringInterval
    | None = SubscriptionRecurringInterval.month,
    amount: int = 1000,
    is_archived: bool = False,
) -> ProductPriceFixed:
    price = ProductPriceFixed(
        price_amount=amount,
        price_currency="usd",
        type=type,
        recurring_interval=recurring_interval,
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
    type: ProductPriceType = ProductPriceType.one_time,
    recurring_interval: SubscriptionRecurringInterval | None = None,
    minimum_amount: int | None = None,
    maximum_amount: int | None = None,
    preset_amount: int | None = None,
) -> ProductPriceCustom:
    price = ProductPriceCustom(
        price_currency="usd",
        type=type,
        recurring_interval=recurring_interval,
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
    type: ProductPriceType = ProductPriceType.one_time,
    recurring_interval: SubscriptionRecurringInterval | None = None,
) -> ProductPriceFree:
    price = ProductPriceFree(
        type=type,
        recurring_interval=recurring_interval,
        stripe_price_id=rstr("PRICE_ID"),
        product=product,
    )
    await save_fixture(price)
    return price


async def create_order(
    save_fixture: SaveFixture,
    *,
    product: Product,
    user: User,
    product_price: ProductPrice | None = None,
    subscription: Subscription | None = None,
    amount: int = 1000,
    tax_amount: int = 0,
    stripe_invoice_id: str | None = "INVOICE_ID",
    billing_reason: OrderBillingReason = OrderBillingReason.purchase,
    created_at: datetime | None = None,
) -> Order:
    order = Order(
        created_at=created_at or utc_now(),
        amount=amount,
        tax_amount=tax_amount,
        currency="usd",
        billing_reason=billing_reason,
        stripe_invoice_id=stripe_invoice_id,
        user=user,
        product=product,
        product_price=product_price
        if product_price is not None
        else product.prices[0]
        if product.prices
        else None,
        subscription=subscription,
    )
    await save_fixture(order)
    return order


async def create_benefit(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    type: BenefitType = BenefitType.custom,
    is_tax_applicable: bool | None = None,
    description: str = "Benefit",
    selectable: bool = True,
    deletable: bool = True,
    properties: dict[str, Any] = {"note": None},
) -> Benefit:
    benefit = Benefit(
        type=type,
        description=description,
        is_tax_applicable=is_tax_applicable if is_tax_applicable is not None else False,
        organization=organization,
        selectable=selectable,
        deletable=deletable,
        properties=properties,
    )
    await save_fixture(benefit)
    return benefit


async def add_product_benefits(
    save_fixture: SaveFixture,
    *,
    product: Product,
    benefits: list[Benefit],
) -> Product:
    product.product_benefits = []
    for order, benefit in enumerate(benefits):
        product.product_benefits.append(ProductBenefit(benefit=benefit, order=order))
    await save_fixture(product)
    return product


async def create_subscription(
    save_fixture: SaveFixture,
    *,
    product: Product,
    price: ProductPrice | None = None,
    user: User,
    status: SubscriptionStatus = SubscriptionStatus.incomplete,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    current_period_start: datetime | None = None,
    current_period_end: datetime | None = None,
    stripe_subscription_id: str | None = "SUBSCRIPTION_ID",
) -> Subscription:
    price = price or product.prices[0] if product.prices else None
    now = datetime.now(UTC)
    subscription = Subscription(
        stripe_subscription_id=stripe_subscription_id,
        amount=price.price_amount if isinstance(price, ProductPriceFixed) else None,
        currency=price.price_currency
        if price is not None and isinstance(price, HasPriceCurrency)
        else None,
        recurring_interval=price.recurring_interval
        if price is not None
        else SubscriptionRecurringInterval.month,
        status=status,
        current_period_start=now
        if current_period_start is None
        else current_period_start,
        current_period_end=(now + timedelta(days=30))
        if current_period_end is None
        else current_period_end,
        cancel_at_period_end=False,
        started_at=started_at,
        ended_at=ended_at,
        user=user,
        product=product,
        price=price,
    )
    await save_fixture(subscription)
    return subscription


async def create_active_subscription(
    save_fixture: SaveFixture,
    *,
    product: Product,
    price: ProductPrice | None = None,
    user: User,
    organization: Organization | None = None,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    stripe_subscription_id: str | None = "SUBSCRIPTION_ID",
) -> Subscription:
    return await create_subscription(
        save_fixture,
        product=product,
        price=price,
        user=user,
        status=SubscriptionStatus.active,
        started_at=started_at or utc_now(),
        ended_at=ended_at,
        stripe_subscription_id=stripe_subscription_id,
    )


@pytest_asyncio.fixture
async def product(save_fixture: SaveFixture, organization: Organization) -> Product:
    return await create_product(save_fixture, organization=organization)


@pytest_asyncio.fixture
async def product_one_time(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        prices=[(1000, ProductPriceType.one_time, None)],
    )


@pytest_asyncio.fixture
async def product_one_time_custom_price(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        prices=[(None, None, None, ProductPriceType.one_time, None)],
    )


@pytest_asyncio.fixture
async def product_one_time_free_price(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        prices=[(ProductPriceType.one_time, None)],
    )


@pytest_asyncio.fixture
async def product_recurring_custom_price(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        prices=[
            (
                None,
                None,
                None,
                ProductPriceType.recurring,
                SubscriptionRecurringInterval.month,
            )
        ],
    )


@pytest_asyncio.fixture
async def product_recurring_free_price(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        prices=[
            (
                ProductPriceType.recurring,
                SubscriptionRecurringInterval.month,
            )
        ],
    )


@pytest_asyncio.fixture
async def product_second(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        prices=[
            (2000, ProductPriceType.recurring, SubscriptionRecurringInterval.month)
        ],
    )


@pytest_asyncio.fixture
async def product_organization_second(
    save_fixture: SaveFixture, organization_second: Organization
) -> Product:
    return await create_product(save_fixture, organization=organization_second)


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
    price: ProductPrice,
    payment_processor: PaymentProcessor = PaymentProcessor.stripe,
    status: CheckoutStatus = CheckoutStatus.open,
    expires_at: datetime | None = None,
    client_secret: str | None = None,
    user_metadata: dict[str, Any] = {},
    payment_processor_metadata: dict[str, Any] = {},
    amount: int | None = None,
    tax_amount: int | None = None,
    currency: str | None = None,
    customer: User | None = None,
) -> Checkout:
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
        payment_processor_metadata=payment_processor_metadata,
        amount=amount,
        tax_amount=tax_amount,
        currency=currency,
        product_price=price,
        product=price.product,
        customer=customer,
    )
    await save_fixture(checkout)
    return checkout


async def create_checkout_link(
    save_fixture: SaveFixture,
    *,
    price: ProductPrice,
    payment_processor: PaymentProcessor = PaymentProcessor.stripe,
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
        product_price=price,
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
async def subscription(
    save_fixture: SaveFixture,
    product: Product,
    user: User,
) -> Subscription:
    return await create_subscription(save_fixture, product=product, user=user)


async def create_benefit_grant(
    save_fixture: SaveFixture,
    user: User,
    benefit: Benefit,
    granted: bool | None = None,
    properties: BenefitGrantProperties | None = None,
    **scope: Unpack[BenefitGrantScope],
) -> BenefitGrant:
    grant = BenefitGrant(benefit=benefit, user=user, **scope)
    if granted is not None:
        grant.set_granted() if granted else grant.set_revoked()
    if properties is not None:
        grant.properties = properties
    await save_fixture(grant)
    return grant


@pytest_asyncio.fixture
async def article(
    save_fixture: SaveFixture,
    organization: Organization,
    user: User,
) -> Article:
    article = Article(
        id=uuid.uuid4(),
        slug="test",
        title="test",
        body="test!",
        organization=organization,
        user=user,
    )
    await save_fixture(article)
    return article


async def create_donation(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    by_user: User | None = None,
    by_organization: Organization | None = None,
    on_behalf_of_organization: Organization | None = None,
) -> Donation:
    amount = secrets.randbelow(100000) + 1
    donation = Donation(
        to_organization=organization,
        payment_id=rstr("payment_id_"),
        charge_id=rstr("charge_id_"),
        email="donor@example.com",
        amount=amount,
        currency="usd",
        amount_received=amount,
        by_user=by_user,
        by_organization=by_organization,
        on_behalf_of_organization=on_behalf_of_organization,
    )
    await save_fixture(donation)
    return donation


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
