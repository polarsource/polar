from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from operator import and_, or_
from uuid import UUID

import structlog
from slugify import slugify
from sqlalchemy import Select, desc, func, nullsfirst, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.authz.service import Subject
from polar.exceptions import BadRequest
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.utils import utc_now
from polar.models import ArticlesSubscription
from polar.models.article import Article
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession, sql
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
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
        slug = polar_slugify(create_schema.title)

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
        organization_id: UUID | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[tuple[Article, bool]], int]:
        statement = self._get_readable_articles_statement(auth_subject).where(
            Article.visibility == Article.Visibility.public
        )

        if organization_id is not None:
            statement = statement.where(Article.organization_id == organization_id)

        results, count = await paginate(session, statement, pagination=pagination)

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

            article.visibility = self._visibility_to_model_visibility(update.visibility)

        if update.paid_subscribers_only is not None:
            article.paid_subscribers_only = update.paid_subscribers_only

        # explicitly set published_at
        if update.set_published_at:
            article.published_at = update.published_at

        if update.notify_subscribers is not None:
            article.notify_subscribers = update.notify_subscribers

        await article.save(session)

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

    async def receivers(
        self, session: AsyncSession, article: Article
    ) -> Sequence[UUID]:
        # for now: send to members of the org
        # TODO: send to subscribers!
        members = await user_organization_service.list_by_org(
            session, article.organization_id
        )
        return [m.user_id for m in members]

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

        receivers = await article_service.receivers(session, article)

        for receiver_user_id in receivers:
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
        # Free articles
        paid_subscriber_clause = Article.paid_subscribers_only.is_(False)
        # OR there is a user and they are a paid subscriber
        if isinstance(auth_subject, User):
            paid_subscriber_clause |= and_(
                ArticlesSubscription.user_id == auth_subject.id,
                ArticlesSubscription.paid_subscriber.is_(True),
            )

        # Articles are visible if
        visibility_clause = and_(
            or_(
                # They are public and published
                and_(
                    Article.published_at <= utc_now(),
                    Article.visibility == Article.Visibility.public,
                ),
                # OR they are hidden
                Article.visibility == Article.Visibility.hidden,
            ),
            # AND the user can access to it
            paid_subscriber_clause,
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
                onclause=and_(
                    ArticlesSubscription.organization_id == Organization.id,
                    ArticlesSubscription.deleted_at.is_(None),
                ),
                isouter=True,
            )
            .join(
                UserOrganization,
                onclause=and_(
                    UserOrganization.organization_id == Organization.id,
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
            or_(
                ArticlesSubscription.user_id == user.id,
                UserOrganization.user_id == user.id,
            ),
        )

        return statement


article_service = ArticleService()
