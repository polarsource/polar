import random
import secrets
import string
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Unpack

import pytest_asyncio

from polar.enums import AccountType, Platforms
from polar.kit.utils import utc_now
from polar.models import (
    Account,
    Benefit,
    Order,
    Organization,
    Product,
    ProductBenefit,
    ProductPrice,
    Repository,
    Subscription,
    User,
    UserOrganization,
)
from polar.models.article import Article
from polar.models.benefit import (
    BenefitType,
)
from polar.models.benefit_grant import BenefitGrant, BenefitGrantScope
from polar.models.donation import Donation
from polar.models.issue import Issue
from polar.models.pledge import Pledge, PledgeState, PledgeType
from polar.models.product import SubscriptionTierType
from polar.models.product_price import ProductPriceRecurringInterval, ProductPriceType
from polar.models.pull_request import PullRequest
from polar.models.subscription import SubscriptionStatus
from polar.models.user import OAuthAccount, OAuthPlatform
from tests.fixtures.database import SaveFixture


def rstr(prefix: str) -> str:
    return prefix + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@pytest_asyncio.fixture(scope="function")
async def organization(save_fixture: SaveFixture) -> Organization:
    return await create_organization(save_fixture)


@pytest_asyncio.fixture(scope="function")
async def organization_second(save_fixture: SaveFixture) -> Organization:
    return await create_organization(save_fixture)


@pytest_asyncio.fixture(scope="function")
async def second_organization(save_fixture: SaveFixture) -> Organization:
    return await create_organization(save_fixture)


@pytest_asyncio.fixture()
async def organization_blocked(save_fixture: SaveFixture) -> Organization:
    organization = Organization(
        platform=Platforms.github,
        name=rstr("testorg"),
        external_id=secrets.randbelow(100000),
        avatar_url="https://avatars.githubusercontent.com/u/105373340?s=200&v=4",
        is_personal=True,
        installation_id=secrets.randbelow(100000),
        installation_created_at=datetime.now(),
        installation_updated_at=datetime.now(),
        installation_suspended_at=None,
        created_from_user_maintainer_upgrade=True,
        blocked_at=utc_now(),
    )
    await save_fixture(organization)
    return organization


async def create_organization(save_fixture: SaveFixture) -> Organization:
    organization = Organization(
        platform=Platforms.github,
        name=rstr("testorg"),
        external_id=secrets.randbelow(100000),
        avatar_url="https://avatars.githubusercontent.com/u/105373340?s=200&v=4",
        is_personal=False,
        installation_id=secrets.randbelow(100000),
        installation_created_at=datetime.now(),
        installation_updated_at=datetime.now(),
        installation_suspended_at=None,
    )
    await save_fixture(organization)
    return organization


@pytest_asyncio.fixture(scope="function")
async def pledging_organization(save_fixture: SaveFixture) -> Organization:
    organization = Organization(
        platform=Platforms.github,
        name=rstr("pledging_org"),
        external_id=secrets.randbelow(100000),
        avatar_url="https://avatars.githubusercontent.com/u/105373340?s=200&v=4",
        is_personal=False,
        installation_id=secrets.randbelow(100000),
        installation_created_at=datetime.now(),
        installation_updated_at=datetime.now(),
        installation_suspended_at=None,
    )
    await save_fixture(organization)
    return organization


@pytest_asyncio.fixture(scope="function")
async def repository(
    save_fixture: SaveFixture, organization: Organization
) -> Repository:
    return await create_repository(save_fixture, organization, is_private=True)


@pytest_asyncio.fixture(scope="function")
async def public_repository(
    save_fixture: SaveFixture, organization: Organization
) -> Repository:
    return await create_repository(save_fixture, organization, is_private=False)


async def create_repository(
    save_fixture: SaveFixture, organization: Organization, is_private: bool = True
) -> Repository:
    repository = Repository(
        platform=Platforms.github,
        name=rstr("testrepo"),
        organization_id=organization.id,
        external_id=secrets.randbelow(100000),
        is_private=is_private,
    )
    await save_fixture(repository)
    return repository


@pytest_asyncio.fixture(scope="function")
async def issue(
    save_fixture: SaveFixture, organization: Organization, repository: Repository
) -> Issue:
    return await create_issue(save_fixture, organization, repository)


async def create_issue(
    save_fixture: SaveFixture, organization: Organization, repository: Repository
) -> Issue:
    issue = Issue(
        id=uuid.uuid4(),
        organization_id=organization.id,
        repository_id=repository.id,
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


@pytest_asyncio.fixture(scope="function")
async def user_github_oauth(
    save_fixture: SaveFixture,
    user: User,
) -> OAuthAccount:
    return await create_user_github_oauth(save_fixture, user)


@pytest_asyncio.fixture(scope="function")
async def user(
    save_fixture: SaveFixture,
) -> User:
    return await create_user(save_fixture)


async def create_user(save_fixture: SaveFixture) -> User:
    user = User(
        id=uuid.uuid4(),
        username=rstr("DEPRECATED_testuser"),
        email=rstr("test") + "@example.com",
        avatar_url="https://avatars.githubusercontent.com/u/47952?v=4",
        oauth_accounts=[],
    )
    await save_fixture(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def user_second(save_fixture: SaveFixture) -> User:
    user = User(
        id=uuid.uuid4(),
        username=rstr("DEPRECATED_testuser"),
        email=rstr("test") + "@example.com",
        avatar_url="https://avatars.githubusercontent.com/u/47952?v=4",
    )
    await save_fixture(user)
    return user


@pytest_asyncio.fixture()
async def user_blocked(save_fixture: SaveFixture) -> User:
    user = User(
        id=uuid.uuid4(),
        username=rstr("DEPRECATED_testuser"),
        email=rstr("test") + "@example.com",
        avatar_url="https://avatars.githubusercontent.com/u/47952?v=4",
        blocked_at=utc_now(),
    )
    await save_fixture(user)
    return user


async def create_pledge(
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    pledging_organization: Organization,
    *,
    state: PledgeState = PledgeState.created,
    type: PledgeType = PledgeType.pay_upfront,
) -> Pledge:
    amount = secrets.randbelow(100000) + 1
    fee = round(amount * 0.05)
    pledge = Pledge(
        id=uuid.uuid4(),
        by_organization_id=pledging_organization.id,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=amount,
        fee=fee,
        state=state,
        type=type,
        invoice_id="INVOICE_ID" if type == PledgeType.pay_on_completion else None,
    )
    await save_fixture(pledge)
    return pledge


async def create_user_pledge(
    save_fixture: SaveFixture,
    organization: Organization,
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
        by_user_id=pledging_user.id,
        created_by_user_id=pledging_user.id,
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        amount=amount,
        fee=fee,
        state=state,
        type=type,
        invoice_id="INVOICE_ID" if type == PledgeType.pay_on_completion else None,
    )
    await save_fixture(pledge)
    return pledge


@pytest_asyncio.fixture(scope="function")
async def pledge(
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
    pledging_organization: Organization,
) -> Pledge:
    return await create_pledge(
        save_fixture, organization, repository, issue, pledging_organization
    )


@pytest_asyncio.fixture(scope="function")
async def pledge_by_user(
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
    issue: Issue,
) -> Pledge:
    user = await create_user(save_fixture)

    amount = secrets.randbelow(100000) + 1
    fee = round(amount * 0.05)
    pledge = Pledge(
        id=uuid.uuid4(),
        issue_id=issue.id,
        repository_id=repository.id,
        organization_id=organization.id,
        by_user_id=user.id,
        amount=amount,
        fee=fee,
        state=PledgeState.created,
        type=PledgeType.pay_upfront,
    )
    await save_fixture(pledge)
    return pledge


@pytest_asyncio.fixture(scope="function")
async def pull_request(
    save_fixture: SaveFixture,
    organization: Organization,
    repository: Repository,
) -> PullRequest:
    pr = PullRequest(
        id=uuid.uuid4(),
        repository_id=repository.id,
        organization_id=organization.id,
        number=secrets.randbelow(5000),
        external_id=secrets.randbelow(5000),
        title="PR Title",
        author={
            "login": "pr_creator_login",
            "avatar_url": "http://example.com/avatar.jpg",
            "html_url": "https://github.com/pr_creator_login",
            "id": 47952,
        },
        platform=Platforms.github,
        state="open",
        issue_created_at=datetime.now(),
        issue_modified_at=datetime.now(),
        commits=1,
        additions=2,
        deletions=3,
        changed_files=4,
        is_draft=False,
        is_rebaseable=True,
        is_mergeable=True,
        is_merged=False,
        review_comments=5,
        maintainer_can_modify=True,
        merged_at=None,
        merge_commit_sha=None,
        body="x",
    )
    await save_fixture(pr)
    return pr


@pytest_asyncio.fixture(scope="function")
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


@pytest_asyncio.fixture(scope="function")
async def user_organization_admin(
    save_fixture: SaveFixture,
    organization: Organization,
    user: User,
) -> UserOrganization:
    user_organization = UserOrganization(
        user_id=user.id,
        organization_id=organization.id,
        is_admin=True,
    )
    await save_fixture(user_organization)
    return user_organization


@pytest_asyncio.fixture(scope="function")
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


@pytest_asyncio.fixture()
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
    type: SubscriptionTierType = SubscriptionTierType.individual,
    organization: Organization,
    name: str = "Product",
    is_highlighted: bool = False,
    is_archived: bool = False,
    prices: list[tuple[int, ProductPriceType, ProductPriceRecurringInterval | None]] = [
        (1000, ProductPriceType.recurring, ProductPriceRecurringInterval.month)
    ],
) -> Product:
    product = Product(
        type=type,
        name=name,
        description="Description",
        is_highlighted=is_highlighted,
        is_archived=is_archived,
        organization_id=organization.id,
        stripe_product_id=rstr("PRODUCT_ID"),
        all_prices=[],
        prices=[],
        product_benefits=[],
    )

    for price, price_type, recurring_interval in prices:
        product_price = await create_product_price(
            save_fixture,
            product=product,
            amount=price,
            type=price_type,
            recurring_interval=recurring_interval,
        )
        product.prices.append(product_price)
        product.all_prices.append(product_price)

    await save_fixture(product)
    return product


async def create_product_price(
    save_fixture: SaveFixture,
    *,
    product: Product,
    type: ProductPriceType = ProductPriceType.recurring,
    recurring_interval: ProductPriceRecurringInterval
    | None = ProductPriceRecurringInterval.month,
    amount: int = 1000,
) -> ProductPrice:
    price = ProductPrice(
        price_amount=amount,
        price_currency="usd",
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
    stripe_invoice_id: str = "INVOICE_ID",
    created_at: datetime | None = None,
) -> Order:
    order = Order(
        created_at=created_at or utc_now(),
        amount=amount,
        tax_amount=tax_amount,
        currency="usd",
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
    type: BenefitType = BenefitType.custom,
    is_tax_applicable: bool | None = None,
    organization: Organization | None = None,
    description: str = "Subscription Benefit",
    selectable: bool = True,
    deletable: bool = True,
    properties: dict[str, Any] = {"note": None},
) -> Benefit:
    benefit = Benefit(
        type=type,
        description=description,
        is_tax_applicable=is_tax_applicable if is_tax_applicable is not None else False,
        organization_id=organization.id if organization is not None else None,
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
    now = datetime.now(UTC)
    subscription = Subscription(
        stripe_subscription_id=stripe_subscription_id,
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
        price=price
        if price is not None
        else product.prices[0]
        if product.prices
        else None,
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
async def subscription_tier_free(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        type=SubscriptionTierType.free,
        organization=organization,
        prices=[],
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
async def product_second(
    save_fixture: SaveFixture, organization: Organization
) -> Product:
    return await create_product(save_fixture, organization=organization)


@pytest_asyncio.fixture
async def product_organization_second(
    save_fixture: SaveFixture, organization_second: Organization
) -> Product:
    return await create_product(save_fixture, organization=organization_second)


@pytest_asyncio.fixture
async def products(
    subscription_tier_free: Product,
    product: Product,
    product_second: Product,
    product_organization_second: Product,
) -> list[Product]:
    return [
        subscription_tier_free,
        product,
        product_second,
        product_organization_second,
    ]


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
async def organization_second_admin(
    save_fixture: SaveFixture, organization_second: Organization, user_second: User
) -> User:
    user_organization = UserOrganization(
        user_id=user_second.id,
        organization_id=organization_second.id,
        is_admin=True,
    )
    await save_fixture(user_organization)
    return user_second


@pytest_asyncio.fixture
async def organization_second_members(
    save_fixture: SaveFixture, organization_second: Organization
) -> list[User]:
    users: list[User] = []
    for _ in range(5):
        user = await create_user(save_fixture)
        user_organization = UserOrganization(
            user_id=user.id,
            organization_id=organization_second.id,
            is_admin=False,
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
    **scope: Unpack[BenefitGrantScope],
) -> BenefitGrant:
    grant = BenefitGrant(benefit=benefit, user=user, **scope)
    if granted is not None:
        grant.set_granted() if granted else grant.set_revoked()
    await save_fixture(grant)
    return grant


@pytest_asyncio.fixture(scope="function")
async def article(
    save_fixture: SaveFixture,
    organization: Organization,
    user: User,
) -> Article:
    article = Article(
        id=uuid.uuid4(),
        organization_id=organization.id,
        slug="test",
        title="test",
        body="test!",
        created_by=user.id,
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
        amount_received=amount,
        by_user=by_user,
        by_organization=by_organization,
        on_behalf_of_organization=on_behalf_of_organization,
    )
    await save_fixture(donation)
    return donation
