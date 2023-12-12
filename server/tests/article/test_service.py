import random
import string
import uuid
from collections.abc import Callable, Coroutine, Sequence
from datetime import datetime

import pytest
import pytest_asyncio

from polar.article.service import article_service
from polar.authz.service import Anonymous, Subject
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models import (
    Article,
    ArticlesSubscription,
    Organization,
    User,
    UserOrganization,
)
from polar.postgres import AsyncSession
from tests.fixtures.random_objects import create_user


def random_string(length: int = 32) -> str:
    return "".join(random.choices(string.ascii_letters, k=length))


async def create_article(
    session: AsyncSession,
    *,
    created_by_user: User,
    organization: Organization,
    visibility: Article.Visibility,
    paid_subscribers_only: bool,
    published_at: datetime | None = None,
) -> Article:
    article = Article(
        slug=random_string(),
        title=random_string(),
        body=random_string(),
        created_by_user=created_by_user,
        organization=organization,
        published_at=published_at,
        visibility=visibility,
        paid_subscribers_only=paid_subscribers_only,
    )
    session.add(article)
    await session.commit()
    return article


async def create_articles_subscription(
    session: AsyncSession,
    *,
    user: User,
    organization: Organization,
    paid_subscriber: bool,
) -> ArticlesSubscription:
    articles_subscription = ArticlesSubscription(
        paid_subscriber=paid_subscriber,
        organization=organization,
        user=user,
    )
    session.add(articles_subscription)
    await session.commit()
    return articles_subscription


def get_articles_ids(results: Sequence[tuple[Article, bool]]) -> list[uuid.UUID]:
    return [article.id for (article, _) in results]


@pytest_asyncio.fixture
async def article_public_free_published(
    session: AsyncSession, user: User, organization: Organization
) -> Article:
    return await create_article(
        session,
        created_by_user=user,
        organization=organization,
        visibility=Article.Visibility.public,
        paid_subscribers_only=False,
        published_at=utc_now(),
    )


@pytest_asyncio.fixture
async def article_public_paid_published(
    session: AsyncSession, user: User, organization: Organization
) -> Article:
    return await create_article(
        session,
        created_by_user=user,
        organization=organization,
        visibility=Article.Visibility.public,
        paid_subscribers_only=True,
        published_at=utc_now(),
    )


@pytest_asyncio.fixture
async def article_hidden_free_published(
    session: AsyncSession, user: User, organization: Organization
) -> Article:
    return await create_article(
        session,
        created_by_user=user,
        organization=organization,
        visibility=Article.Visibility.hidden,
        paid_subscribers_only=False,
        published_at=utc_now(),
    )


@pytest_asyncio.fixture
async def article_hidden_paid_published(
    session: AsyncSession, user: User, organization: Organization
) -> Article:
    return await create_article(
        session,
        created_by_user=user,
        organization=organization,
        visibility=Article.Visibility.hidden,
        paid_subscribers_only=True,
        published_at=utc_now(),
    )


@pytest_asyncio.fixture
async def article_private_published(
    session: AsyncSession, user: User, organization: Organization
) -> Article:
    return await create_article(
        session,
        created_by_user=user,
        organization=organization,
        visibility=Article.Visibility.private,
        paid_subscribers_only=False,
        published_at=utc_now(),
    )


@pytest_asyncio.fixture
async def article_unpublished(
    session: AsyncSession, user: User, organization: Organization
) -> Article:
    return await create_article(
        session,
        created_by_user=user,
        organization=organization,
        visibility=Article.Visibility.public,
        paid_subscribers_only=False,
        published_at=None,
    )


@pytest_asyncio.fixture
async def articles(
    article_public_free_published: Article,
    article_public_paid_published: Article,
    article_hidden_free_published: Article,
    article_hidden_paid_published: Article,
    article_private_published: Article,
    article_unpublished: Article,
) -> list[Article]:
    return [
        article_public_free_published,
        article_public_paid_published,
        article_hidden_free_published,
        article_hidden_paid_published,
        article_private_published,
        article_unpublished,
    ]


@pytest_asyncio.fixture
async def other_subscriptions(
    session: AsyncSession, organization: Organization
) -> None:
    for _ in range(5):
        user = await create_user(session)
        await create_articles_subscription(
            session, user=user, organization=organization, paid_subscriber=False
        )


@pytest.mark.asyncio
@pytest.mark.usefixtures("other_subscriptions")
class TestList:
    async def test_no_subscription(
        self, session: AsyncSession, articles: list[Article], user_second: User
    ) -> None:
        results, count = await article_service.list(
            session, user_second, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 0
        assert count == 0

    async def test_no_subscription_org_member(
        self,
        session: AsyncSession,
        articles: list[Article],
        user: User,
        user_organization: UserOrganization,
        article_public_free_published: Article,
        article_public_paid_published: Article,
    ) -> None:
        results, count = await article_service.list(
            session, user, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 2
        assert count == 2

        assert article_public_free_published.id in get_articles_ids(results)
        assert article_public_paid_published.id in get_articles_ids(results)

        for _, is_paid_subscriber in results:
            assert is_paid_subscriber is True

    async def test_free_subscription(
        self,
        session: AsyncSession,
        articles: list[Article],
        article_public_free_published: Article,
        organization: Organization,
        user_second: User,
    ) -> None:
        await create_articles_subscription(
            session, user=user_second, organization=organization, paid_subscriber=False
        )
        results, count = await article_service.list(
            session, user_second, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 1
        assert count == 1

        article, is_paid_subscriber = results[0]
        assert article.id == article_public_free_published.id
        assert is_paid_subscriber is False

    async def test_paid_subscription(
        self,
        session: AsyncSession,
        articles: list[Article],
        article_public_free_published: Article,
        article_public_paid_published: Article,
        organization: Organization,
        user_second: User,
    ) -> None:
        await create_articles_subscription(
            session, user=user_second, organization=organization, paid_subscriber=True
        )
        results, count = await article_service.list(
            session, user_second, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 2
        assert count == 2

        assert article_public_free_published.id in get_articles_ids(results)
        assert article_public_paid_published.id in get_articles_ids(results)

        for _, is_paid_subscriber in results:
            assert is_paid_subscriber is True


@pytest.mark.asyncio
@pytest.mark.usefixtures("other_subscriptions")
class TestSearch:
    async def test_anonymous(
        self,
        session: AsyncSession,
        articles: list[Article],
        article_public_free_published: Article,
        organization: Organization,
        user_second: User,
    ) -> None:
        results, count = await article_service.search(
            session,
            Anonymous(),
            organization_id=organization.id,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 1
        assert count == 1

        article, is_paid_subscriber = results[0]
        assert article.id == article_public_free_published.id
        assert is_paid_subscriber is False

    async def test_no_subscription(
        self,
        session: AsyncSession,
        articles: list[Article],
        article_public_free_published: Article,
        organization: Organization,
        user_second: User,
    ) -> None:
        results, count = await article_service.search(
            session,
            user_second,
            organization_id=organization.id,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 1
        assert count == 1

        article, is_paid_subscriber = results[0]
        assert article.id == article_public_free_published.id
        assert is_paid_subscriber is False

    async def test_no_subscription_show_unpublished(
        self,
        session: AsyncSession,
        articles: list[Article],
        article_public_free_published: Article,
        organization: Organization,
        user_second: User,
    ) -> None:
        results, count = await article_service.search(
            session,
            user_second,
            show_unpublished=True,
            organization_id=organization.id,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 1
        assert count == 1

        article, is_paid_subscriber = results[0]
        assert article.id == article_public_free_published.id
        assert is_paid_subscriber is False

    async def test_no_subscription_org_member(
        self,
        session: AsyncSession,
        articles: list[Article],
        article_public_free_published: Article,
        article_public_paid_published: Article,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        results, count = await article_service.search(
            session,
            user,
            organization_id=organization.id,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 2
        assert count == 2

        assert article_public_free_published.id in get_articles_ids(results)
        assert article_public_paid_published.id in get_articles_ids(results)

        for _, is_paid_subscriber in results:
            assert is_paid_subscriber is True

    async def test_no_subscription_org_member_show_unpublished(
        self,
        session: AsyncSession,
        articles: list[Article],
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        results, count = await article_service.search(
            session,
            user,
            show_unpublished=True,
            organization_id=organization.id,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 6
        assert count == 6

        for _, is_paid_subscriber in results:
            assert is_paid_subscriber is True

    async def test_paid_subscription(
        self,
        session: AsyncSession,
        articles: list[Article],
        article_public_free_published: Article,
        article_public_paid_published: Article,
        organization: Organization,
        user_second: User,
    ) -> None:
        await create_articles_subscription(
            session, user=user_second, organization=organization, paid_subscriber=True
        )
        results, count = await article_service.search(
            session,
            user_second,
            organization_id=organization.id,
            pagination=PaginationParams(1, 10),
        )

        assert len(results) == 2
        assert count == 2

        assert article_public_free_published.id in get_articles_ids(results)
        assert article_public_paid_published.id in get_articles_ids(results)

        for _, is_paid_subscriber in results:
            assert is_paid_subscriber is True


# Define wrappers for get_readable_by_organization_and_slug and get_readable_by_id
# to mutualise the tests


async def get_readable_by_organization_and_slug(
    session: AsyncSession, auth_subject: Subject, article: Article
) -> tuple[Article, bool] | None:
    return await article_service.get_readable_by_organization_and_slug(
        session,
        auth_subject,
        organization_id=article.organization_id,
        slug=article.slug,
    )


async def get_readable_by_id(
    session: AsyncSession, auth_subject: Subject, article: Article
) -> tuple[Article, bool] | None:
    return await article_service.get_readable_by_id(
        session, auth_subject, id=article.id
    )


GetterType = Callable[
    [AsyncSession, Subject, Article], Coroutine[None, None, tuple[Article, bool] | None]
]


@pytest.mark.parametrize(
    "getter",
    [
        get_readable_by_organization_and_slug,
        get_readable_by_id,
    ],
)
@pytest.mark.asyncio
class TestGetReadableBy:
    async def test_no_subscription(
        self,
        getter: GetterType,
        session: AsyncSession,
        article_public_free_published: Article,
        article_public_paid_published: Article,
        article_hidden_free_published: Article,
        article_hidden_paid_published: Article,
        article_private_published: Article,
        user_second: User,
    ) -> None:
        result = await getter(session, user_second, article_public_free_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, user_second, article_public_paid_published)
        assert result is None

        result = await getter(session, user_second, article_hidden_free_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, user_second, article_hidden_paid_published)
        assert result is None

        result = await getter(session, user_second, article_private_published)
        assert result is None

    async def test_no_subscription_org_member(
        self,
        getter: GetterType,
        session: AsyncSession,
        article_public_free_published: Article,
        article_public_paid_published: Article,
        article_hidden_free_published: Article,
        article_hidden_paid_published: Article,
        article_private_published: Article,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        result = await getter(session, user, article_public_free_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, user, article_public_paid_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, user, article_hidden_free_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, user, article_hidden_paid_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, user, article_private_published)
        assert result is not None
        assert result[1] is True

    async def test_free_subscription(
        self,
        getter: GetterType,
        session: AsyncSession,
        article_public_free_published: Article,
        article_public_paid_published: Article,
        article_hidden_free_published: Article,
        article_hidden_paid_published: Article,
        article_private_published: Article,
        user_second: User,
        organization: Organization,
    ) -> None:
        await create_articles_subscription(
            session, user=user_second, organization=organization, paid_subscriber=False
        )

        result = await getter(session, user_second, article_public_free_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, user_second, article_public_paid_published)
        assert result is None

        result = await getter(session, user_second, article_hidden_free_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, user_second, article_hidden_paid_published)
        assert result is None

        result = await getter(session, user_second, article_private_published)
        assert result is None

    async def test_paid_subscription(
        self,
        getter: GetterType,
        session: AsyncSession,
        article_public_free_published: Article,
        article_public_paid_published: Article,
        article_hidden_free_published: Article,
        article_hidden_paid_published: Article,
        article_private_published: Article,
        user_second: User,
        organization: Organization,
    ) -> None:
        await create_articles_subscription(
            session, user=user_second, organization=organization, paid_subscriber=True
        )

        result = await getter(session, user_second, article_public_free_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, user_second, article_public_paid_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, user_second, article_hidden_free_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, user_second, article_hidden_paid_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, user_second, article_private_published)
        assert result is None


@pytest.mark.asyncio
class TestListReceivers:
    async def test_no_subscription(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        receivers = await article_service.list_receivers(
            session, organization.id, False
        )
        assert len(receivers) == 0

    async def test_no_subscription_org_member(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        receivers = await article_service.list_receivers(
            session, organization.id, False
        )
        assert len(receivers) == 1
        assert receivers[0] == (user.id, False, True)

        receivers = await article_service.list_receivers(session, organization.id, True)
        assert len(receivers) == 1
        assert receivers[0] == (user.id, False, True)

    async def test_free_subscription(
        self, session: AsyncSession, user_second: User, organization: Organization
    ) -> None:
        await create_articles_subscription(
            session, user=user_second, organization=organization, paid_subscriber=False
        )

        receivers = await article_service.list_receivers(
            session, organization.id, False
        )
        assert len(receivers) == 1
        assert receivers[0] == (user_second.id, False, False)

        receivers = await article_service.list_receivers(session, organization.id, True)
        assert len(receivers) == 0

    async def test_paid_subscription(
        self, session: AsyncSession, user_second: User, organization: Organization
    ) -> None:
        await create_articles_subscription(
            session, user=user_second, organization=organization, paid_subscriber=True
        )

        receivers = await article_service.list_receivers(session, organization.id, True)
        assert len(receivers) == 1
        assert receivers[0] == (user_second.id, True, False)
