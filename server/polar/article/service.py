from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from operator import and_, or_
from uuid import UUID

import structlog
from discord_webhook import AsyncDiscordWebhook, DiscordEmbed
from slugify import slugify
from sqlalchemy import (
    Select,
    desc,
    false,
    func,
    nullsfirst,
    select,
)
from sqlalchemy.orm import contains_eager, joinedload

from polar.authz.service import Subject
from polar.config import settings
from polar.exceptions import BadRequest
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.utils import utc_now
from polar.models import ArticlesSubscription
from polar.models.article import Article
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession, sql
from polar.worker import enqueue_job

from .schemas import ArticleCreate, ArticleUpdate, Visibility

log = structlog.get_logger()


def polar_slugify(input: str) -> str:
    return slugify(
        input,
        max_length=64,  # arbitrary
        word_boundary=True,
    )


class ArticleService:
    async def create(
        self,
        session: AsyncSession,
        subject: User,
        create_schema: ArticleCreate,
        autocommit: bool = True,
    ) -> Article:
        slug = polar_slugify(
            create_schema.slug if create_schema.slug else create_schema.title
        )

        orig_slug = slug

        # TODO: detect and handle duplicate slugs
        for n in range(0, 100):
            test_slug = orig_slug if n == 0 else f"{orig_slug}-{n}"

            exists = await self.get_by_slug(
                session, create_schema.organization_id, test_slug
            )

            # slug is unused, continue with creating an article with this slug
            if exists is None:
                slug = test_slug
                break

            # continue until a free slug has been found
        else:
            # if no free slug has been found in 100 attempts, error out
            raise Exception(
                "This slug has been used more than 100 times in this organization."
            )

        published_at: datetime | None = None
        if create_schema.visibility == "public":
            published_at = utc_now()
        if create_schema.published_at is not None:
            published_at = create_schema.published_at

        return await Article(
            slug=slug,
            title=create_schema.title,
            body=create_schema.body,
            created_by=subject.id,
            organization_id=create_schema.organization_id,
            byline=create_schema.byline,
            visibility=self._visibility_to_model_visibility(create_schema.visibility),
            paid_subscribers_only=create_schema.paid_subscribers_only,
            published_at=published_at,
            is_pinned=True if create_schema.is_pinned is True else False,
        ).save(session, autocommit=autocommit)

    async def get_loaded(
        self,
        session: AsyncSession,
        id: UUID,
    ) -> Article | None:
        statement = (
            sql.select(Article)
            .where(Article.id == id)
            .where(Article.deleted_at.is_(None))
            .options(
                joinedload(Article.created_by_user),
                joinedload(Article.organization),
            )
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()

    async def get_by_slug(
        self,
        session: AsyncSession,
        organization_id: UUID,
        slug: str,
    ) -> Article | None:
        statement = (
            sql.select(Article)
            .where(
                Article.organization_id == organization_id,
                Article.slug == slug,
                Article.deleted_at.is_(None),
            )
            .options(
                joinedload(Article.created_by_user),
                joinedload(Article.organization),
            )
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()

    async def list(
        self,
        session: AsyncSession,
        user: User,
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[tuple[Article, bool]], int]:
        statement = self._get_subscribed_articles_statement(user)

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def search(
        self,
        session: AsyncSession,
        auth_subject: Subject,
        *,
        show_unpublished: bool = False,
        organization_id: UUID | None = None,
        is_pinned: bool | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[tuple[Article, bool]], int]:
        statement = self._get_readable_articles_statement(auth_subject)

        # Show only public and published articles
        if not show_unpublished:
            statement = statement.where(
                Article.visibility == Article.Visibility.public,
                Article.published_at <= utc_now(),
            )
        # Show unpublished articles only for organization members
        else:
            statement = statement.where(
                or_(
                    Article.visibility == Article.Visibility.public,
                    UserOrganization.user_id.is_not(None),
                )
            )

        if organization_id is not None:
            statement = statement.where(Article.organization_id == organization_id)

        if is_pinned is not None:
            statement = statement.where(Article.is_pinned == is_pinned)

        results, count = await paginate(
            session,
            statement,
            pagination=pagination,
        )

        return results, count

    async def get_readable_by_organization_and_slug(
        self,
        session: AsyncSession,
        auth_subject: Subject,
        *,
        organization_id: UUID,
        slug: str,
    ) -> tuple[Article, bool] | None:
        statement = self._get_readable_articles_statement(auth_subject).where(
            Article.organization_id == organization_id, Article.slug == slug
        )
        res = await session.execute(statement)
        return res.unique().tuples().one_or_none()

    async def get_readable_by_id(
        self,
        session: AsyncSession,
        auth_subject: Subject,
        *,
        id: UUID,
    ) -> tuple[Article, bool] | None:
        statement = self._get_readable_articles_statement(auth_subject).where(
            Article.id == id
        )
        res = await session.execute(statement)
        return res.unique().tuples().one_or_none()

    async def update(
        self,
        session: AsyncSession,
        article: Article,
        update: ArticleUpdate,
    ) -> Article:
        should_notify_on_discord = False

        if update.title is not None:
            article.title = update.title

        if update.slug is not None:
            article.slug = polar_slugify(update.slug)

        if update.body is not None:
            article.body = update.body

        if update.byline is not None:
            article.byline = (
                Article.Byline.user
                if update.byline == "user"
                else Article.Byline.organization
            )

        if update.visibility is not None:
            # if article was not already visible, and it's changed to visible:
            # set published at
            if (
                article.visibility != Article.Visibility.public
                and update.visibility == "public"
                and article.published_at is None
            ):
                article.published_at = utc_now()
                shouldNotifyOnDiscord = True

            article.visibility = self._visibility_to_model_visibility(update.visibility)

        if update.paid_subscribers_only is not None:
            article.paid_subscribers_only = update.paid_subscribers_only

        if update.is_pinned is not None:
            article.is_pinned = update.is_pinned

        # explicitly set published_at
        if update.set_published_at:
            article.published_at = update.published_at

        if update.notify_subscribers is not None:
            article.notify_subscribers = update.notify_subscribers

        await article.save(session)

        if should_notify_on_discord:
            await self.article_published_discord_notification(article)

        return article

    def _visibility_to_model_visibility(self, v: Visibility) -> Article.Visibility:
        match v:
            case "hidden":
                return Article.Visibility.hidden
            case "private":
                return Article.Visibility.private
            case "public":
                return Article.Visibility.public

    async def track_view(
        self,
        session: AsyncSession,
        id: UUID,
    ) -> None:
        statement = (
            sql.update(Article)
            .where(Article.id == id)
            .values({"web_view_count": Article.web_view_count + 1})
        )
        await session.execute(statement)
        await session.commit()

    async def list_scheduled_unsent_posts(
        self, session: AsyncSession
    ) -> Sequence[Article]:
        statement = sql.select(Article).where(
            Article.notifications_sent_at.is_(None),
            Article.notify_subscribers.is_(True),
            Article.deleted_at.is_(None),
            Article.visibility == Article.Visibility.public,
            Article.published_at < utc_now(),
        )
        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def list_receivers(
        self, session: AsyncSession, organization_id: UUID, paid_subscribers_only: bool
    ) -> Sequence[tuple[UUID, bool, bool]]:
        user_subscription_clause = (
            ArticlesSubscription.organization_id == organization_id
        )
        if paid_subscribers_only:
            user_subscription_clause &= ArticlesSubscription.paid_subscriber.is_(True)

        statement = (
            select(
                User.id,
                func.coalesce(ArticlesSubscription.paid_subscriber, False),
                UserOrganization.user_id.is_not(None),
            )
            .join(
                UserOrganization,
                onclause=(UserOrganization.user_id == User.id)
                & (UserOrganization.organization_id == organization_id),
                isouter=True,
            )
            .join(
                ArticlesSubscription,
                onclause=(ArticlesSubscription.user_id == User.id)
                & (ArticlesSubscription.organization_id == organization_id)
                & (ArticlesSubscription.emails_unsubscribed_at.is_(None)),
                isouter=True,
            )
        ).where(
            or_(
                user_subscription_clause,
                UserOrganization.organization_id == organization_id,
            )
        )

        result = await session.execute(statement)
        return result.tuples().all()

    async def count_receivers(
        self, session: AsyncSession, organization_id: UUID, paid_subscribers_only: bool
    ) -> tuple[int, int, int]:
        receivers = await self.list_receivers(
            session, organization_id, paid_subscribers_only
        )
        free_subscribers = 0
        premium_subscribers = 0
        organization_members = 0
        for _, is_paid_subscriber, is_organization_member in receivers:
            if is_paid_subscriber:
                premium_subscribers += 1
            elif is_organization_member:
                organization_members += 1
            else:
                free_subscribers += 1
        return free_subscribers, premium_subscribers, organization_members

    async def send_to_subscribers(
        self, session: AsyncSession, article: Article
    ) -> None:
        if article.notifications_sent_at is not None:
            # already sent
            raise BadRequest("this post has already been sent")

        if article.notify_subscribers is False:
            # not allowed to send
            raise BadRequest("notify_subscribers is not enabled")

        if not article.published_at:
            raise BadRequest("article is not published")

        if article.published_at > utc_now():
            raise BadRequest("article is scheduled to be published in the future")

        article.notifications_sent_at = utc_now()
        await article.save(session)
        await session.commit()

        receivers = await article_service.list_receivers(
            session, article.organization_id, article.paid_subscribers_only
        )

        for receiver_user_id, _, _ in receivers:
            await enqueue_job(
                "articles.send_to_user",
                article_id=article.id,
                user_id=receiver_user_id,
                is_test=False,
            )

        # after scheduling is complete
        article.email_sent_to_count = len(receivers)
        await article.save(session)
        await session.commit()

    def _get_readable_articles_statement(
        self, auth_subject: Subject
    ) -> Select[tuple[Article, bool]]:
        # Articles are readable if
        visibility_clause = or_(
            # They are public and published
            and_(
                Article.visibility == Article.Visibility.public,
                Article.published_at <= utc_now(),
            ),
            # OR they are hidden
            Article.visibility == Article.Visibility.hidden,
        )

        # OR if the user is member of the organization
        if isinstance(auth_subject, User):
            visibility_clause |= UserOrganization.user_id == auth_subject.id

        statement = (
            select(Article)
            .add_columns(
                or_(
                    func.coalesce(ArticlesSubscription.paid_subscriber, False),
                    UserOrganization.user_id.is_not(None),
                )
            )
            .join(Article.organization)
            .join(
                ArticlesSubscription,
                onclause=(
                    ArticlesSubscription.user_id == auth_subject.id
                    if isinstance(auth_subject, User)
                    else false()
                )
                & (ArticlesSubscription.organization_id == Organization.id)
                & ArticlesSubscription.deleted_at.is_(None)
                & ArticlesSubscription.emails_unsubscribed_at.is_(None),
                isouter=True,
            )
            .join(
                UserOrganization,
                onclause=and_(
                    and_(
                        UserOrganization.user_id == auth_subject.id
                        if isinstance(auth_subject, User)
                        else false(),
                        UserOrganization.organization_id == Organization.id,
                    ),
                    UserOrganization.deleted_at.is_(None),
                ),
                isouter=True,
            )
            .where(Article.deleted_at.is_(None), visibility_clause)
            .options(
                joinedload(Article.created_by_user),
                contains_eager(Article.organization),
            )
            .order_by(nullsfirst(desc(Article.published_at)))
        )

        return statement

    def _get_subscribed_articles_statement(
        self, user: User
    ) -> Select[tuple[Article, bool]]:
        statement = self._get_readable_articles_statement(user).where(
            Article.visibility == Article.Visibility.public,
            Article.published_at <= utc_now(),
            or_(
                ArticlesSubscription.user_id == user.id,
                UserOrganization.user_id == user.id,
            ),
        )

        return statement

    async def get_subscriber(
        self,
        session: AsyncSession,
        user_id: UUID,
        subscribed_to_organization_id: UUID,
    ) -> ArticlesSubscription | None:
        statement = (
            sql.select(ArticlesSubscription)
            .where(ArticlesSubscription.user_id == user_id)
            .where(
                ArticlesSubscription.organization_id == subscribed_to_organization_id
            )
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()

    async def unsubscribe(
        self,
        session: AsyncSession,
        id: UUID,
    ) -> None:
        stmt = (
            sql.update(ArticlesSubscription)
            .values({"emails_unsubscribed_at": utc_now()})
            .where(
                ArticlesSubscription.id == id,
                ArticlesSubscription.emails_unsubscribed_at.is_(None),
            )
        )
        await session.execute(stmt)
        await session.commit()

    async def article_published_discord_notification(self, article: Article) -> None:
        if not settings.DISCORD_WEBHOOK_URL:
            return

        webhook = AsyncDiscordWebhook(
            url=settings.DISCORD_WEBHOOK_URL, content="Published Article"
        )

        embed = DiscordEmbed(
            title="Published Article",
            description=f"[{article.title}](https://polar.sh/{article.organization.name}/posts/{article.slug})",  # noqa: E501
            color="65280",
        )

        embed.add_embed_field(
            name="Org",
            value=f"[Open](https://polar.sh/{article.organization.name})",
        )

        webhook.add_embed(embed)
        await webhook.execute()


article_service = ArticleService()
