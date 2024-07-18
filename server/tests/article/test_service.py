import random
import string
import uuid
from collections.abc import Callable, Coroutine, Sequence
from datetime import datetime

import pytest
import pytest_asyncio

from polar.article.service import article_service
from polar.auth.models import Anonymous, AuthSubject, Subject
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models import (
    Article,
    ArticlesSubscription,
    Organization,
    User,
    UserOrganization,
)
from polar.models.article import ArticleVisibility
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_organization, create_user


def random_string(length: int = 32) -> str:
    return "".join(random.choices(string.ascii_letters, k=length))


async def create_article(
    save_fixture: SaveFixture,
    *,
    user: User,
    organization: Organization,
    visibility: ArticleVisibility,
    paid_subscribers_only: bool,
    published_at: datetime | None = None,
) -> Article:
    article = Article(
        slug=random_string(),
        title=random_string(),
        body=random_string(),
        user=user,
        organization=organization,
        published_at=published_at,
        visibility=visibility,
        paid_subscribers_only=paid_subscribers_only,
    )
    await save_fixture(article)
    return article


async def create_articles_subscription(
    save_fixture: SaveFixture,
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
    await save_fixture(articles_subscription)
    return articles_subscription


def get_articles_ids(results: Sequence[tuple[Article, bool]]) -> list[uuid.UUID]:
    return [article.id for (article, _) in results]


@pytest_asyncio.fixture
async def article_public_free_published(
    save_fixture: SaveFixture, user: User, organization: Organization
) -> Article:
    return await create_article(
        save_fixture,
        user=user,
        organization=organization,
        visibility=ArticleVisibility.public,
        paid_subscribers_only=False,
        published_at=utc_now(),
    )


@pytest_asyncio.fixture
async def article_public_paid_published(
    save_fixture: SaveFixture, user: User, organization: Organization
) -> Article:
    return await create_article(
        save_fixture,
        user=user,
        organization=organization,
        visibility=ArticleVisibility.public,
        paid_subscribers_only=True,
        published_at=utc_now(),
    )


@pytest_asyncio.fixture
async def article_hidden_free_published(
    save_fixture: SaveFixture, user: User, organization: Organization
) -> Article:
    return await create_article(
        save_fixture,
        user=user,
        organization=organization,
        visibility=ArticleVisibility.hidden,
        paid_subscribers_only=False,
        published_at=utc_now(),
    )


@pytest_asyncio.fixture
async def article_hidden_paid_published(
    save_fixture: SaveFixture, user: User, organization: Organization
) -> Article:
    return await create_article(
        save_fixture,
        user=user,
        organization=organization,
        visibility=ArticleVisibility.hidden,
        paid_subscribers_only=True,
        published_at=utc_now(),
    )


@pytest_asyncio.fixture
async def article_private_published(
    save_fixture: SaveFixture, user: User, organization: Organization
) -> Article:
    return await create_article(
        save_fixture,
        user=user,
        organization=organization,
        visibility=ArticleVisibility.private,
        paid_subscribers_only=False,
        published_at=utc_now(),
    )


@pytest_asyncio.fixture
async def article_unpublished(
    save_fixture: SaveFixture, user: User, organization: Organization
) -> Article:
    return await create_article(
        save_fixture,
        user=user,
        organization=organization,
        visibility=ArticleVisibility.public,
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
    save_fixture: SaveFixture, organization: Organization
) -> None:
    for _ in range(5):
        user = await create_user(save_fixture)
        await create_articles_subscription(
            save_fixture, user=user, organization=organization, paid_subscriber=False
        )


@pytest.mark.asyncio
@pytest.mark.usefixtures("other_subscriptions")
class TestList:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="anonymous"),
        AuthSubjectFixture(subject="user_second"),
    )
    async def test_anonymous_or_user(
        self,
        session: AsyncSession,
        articles: list[Article],
        auth_subject: AuthSubject[Anonymous | User],
        article_public_free_published: Article,
        article_public_paid_published: Article,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await article_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 2
        assert count == 2

        assert article_public_free_published.id in get_articles_ids(results)
        assert article_public_paid_published.id in get_articles_ids(results)

        for _, is_paid_subscriber in results:
            assert is_paid_subscriber is False

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"), AuthSubjectFixture(subject="organization")
    )
    async def test_organization_member_or_organization(
        self,
        session: AsyncSession,
        articles: list[Article],
        auth_subject: AuthSubject[User | Organization],
        user_organization: UserOrganization,
    ) -> None:
        # then
        session.expunge_all()

        results, count = await article_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 6
        assert count == 6

        for _, is_paid_subscriber in results:
            assert is_paid_subscriber is True

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_free_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        articles: list[Article],
        article_public_free_published: Article,
        article_public_paid_published: Article,
        organization: Organization,
        user_second: User,
        auth_subject: AuthSubject[User],
    ) -> None:
        await create_articles_subscription(
            save_fixture,
            user=user_second,
            organization=organization,
            paid_subscriber=False,
        )

        # then
        session.expunge_all()

        results, count = await article_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 2
        assert count == 2

        assert article_public_free_published.id in get_articles_ids(results)
        assert article_public_paid_published.id in get_articles_ids(results)

        for _, is_paid_subscriber in results:
            assert is_paid_subscriber is False

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_paid_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        articles: list[Article],
        article_public_free_published: Article,
        article_public_paid_published: Article,
        organization: Organization,
        user_second: User,
        auth_subject: AuthSubject[User],
    ) -> None:
        await create_articles_subscription(
            save_fixture,
            user=user_second,
            organization=organization,
            paid_subscriber=True,
        )

        # then
        session.expunge_all()

        results, count = await article_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(results) == 2
        assert count == 2

        assert article_public_free_published.id in get_articles_ids(results)
        assert article_public_paid_published.id in get_articles_ids(results)

        for _, is_paid_subscriber in results:
            assert is_paid_subscriber is True


async def getter(
    session: AsyncSession, auth_subject: AuthSubject[Subject], article: Article
) -> tuple[Article, bool] | None:
    return await article_service.get_by_id(session, auth_subject, id=article.id)


GetterType = Callable[
    [AsyncSession, AuthSubject[Subject], Article],
    Coroutine[None, None, tuple[Article, bool] | None],
]


@pytest.mark.parametrize("getter", [getter])
@pytest.mark.asyncio
class TestReadable:
    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_no_subscription(
        self,
        getter: GetterType,
        session: AsyncSession,
        article_public_free_published: Article,
        article_public_paid_published: Article,
        article_hidden_free_published: Article,
        article_hidden_paid_published: Article,
        article_private_published: Article,
        auth_subject: AuthSubject[User],
    ) -> None:
        # then
        session.expunge_all()

        result = await getter(session, auth_subject, article_public_free_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, auth_subject, article_public_paid_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, auth_subject, article_hidden_free_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, auth_subject, article_hidden_paid_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, auth_subject, article_private_published)
        assert result is None

    @pytest.mark.auth(AuthSubjectFixture(subject="user"))
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
        auth_subject: AuthSubject[User],
    ) -> None:
        # then
        session.expunge_all()

        result = await getter(session, auth_subject, article_public_free_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, auth_subject, article_public_paid_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, auth_subject, article_hidden_free_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, auth_subject, article_hidden_paid_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, auth_subject, article_private_published)
        assert result is not None
        assert result[1] is True

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_free_subscription(
        self,
        getter: GetterType,
        session: AsyncSession,
        save_fixture: SaveFixture,
        article_public_free_published: Article,
        article_public_paid_published: Article,
        article_hidden_free_published: Article,
        article_hidden_paid_published: Article,
        article_private_published: Article,
        user_second: User,
        organization: Organization,
        auth_subject: AuthSubject[User],
    ) -> None:
        await create_articles_subscription(
            save_fixture,
            user=user_second,
            organization=organization,
            paid_subscriber=False,
        )

        # then
        session.expunge_all()

        result = await getter(session, auth_subject, article_public_free_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, auth_subject, article_public_paid_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, auth_subject, article_hidden_free_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, auth_subject, article_hidden_paid_published)
        assert result is not None
        assert result[1] is False

        result = await getter(session, auth_subject, article_private_published)
        assert result is None

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    async def test_paid_subscription(
        self,
        getter: GetterType,
        session: AsyncSession,
        save_fixture: SaveFixture,
        article_public_free_published: Article,
        article_public_paid_published: Article,
        article_hidden_free_published: Article,
        article_hidden_paid_published: Article,
        article_private_published: Article,
        user_second: User,
        organization: Organization,
        auth_subject: AuthSubject[User],
    ) -> None:
        await create_articles_subscription(
            save_fixture,
            user=user_second,
            organization=organization,
            paid_subscriber=True,
        )

        # then
        session.expunge_all()

        result = await getter(session, auth_subject, article_public_free_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, auth_subject, article_public_paid_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, auth_subject, article_hidden_free_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, auth_subject, article_hidden_paid_published)
        assert result is not None
        assert result[1] is True

        result = await getter(session, auth_subject, article_private_published)
        assert result is None


@pytest.mark.asyncio
class TestListReceivers:
    async def test_no_subscription(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        # then
        session.expunge_all()

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
        # then
        session.expunge_all()

        receivers = await article_service.list_receivers(
            session, organization.id, False
        )
        assert len(receivers) == 1
        assert receivers[0] == (user.id, False, True)

        receivers = await article_service.list_receivers(session, organization.id, True)
        assert len(receivers) == 1
        assert receivers[0] == (user.id, False, True)

    async def test_free_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user_second: User,
        organization: Organization,
    ) -> None:
        await create_articles_subscription(
            save_fixture,
            user=user_second,
            organization=organization,
            paid_subscriber=False,
        )

        # then
        session.expunge_all()

        receivers = await article_service.list_receivers(
            session, organization.id, False
        )
        assert len(receivers) == 1
        assert receivers[0] == (user_second.id, False, False)

        receivers = await article_service.list_receivers(session, organization.id, True)
        assert len(receivers) == 0

    async def test_paid_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user_second: User,
        organization: Organization,
    ) -> None:
        await create_articles_subscription(
            save_fixture,
            user=user_second,
            organization=organization,
            paid_subscriber=True,
        )

        # then
        session.expunge_all()

        receivers = await article_service.list_receivers(session, organization.id, True)
        assert len(receivers) == 1
        assert receivers[0] == (user_second.id, True, False)

    async def test_paid_subscription_and_member(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await create_articles_subscription(
            save_fixture, user=user, organization=organization, paid_subscriber=True
        )

        # then
        session.expunge_all()

        receivers = await article_service.list_receivers(session, organization.id, True)
        assert len(receivers) == 1
        assert receivers[0] == (user.id, True, True)

    async def test_paid_subscription_and_member_member_other_orgs(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        # make user member of other orgs
        # this test checks that list_receivers doesn't have a bad join
        other_org = await create_organization(save_fixture)
        user_organization = UserOrganization(
            user_id=user.id, organization_id=other_org.id
        )
        await save_fixture(user_organization)

        await create_articles_subscription(
            save_fixture, user=user, organization=organization, paid_subscriber=True
        )

        # then
        session.expunge_all()

        receivers = await article_service.list_receivers(session, organization.id, True)
        assert len(receivers) == 1
        assert receivers[0] == (user.id, True, True)
