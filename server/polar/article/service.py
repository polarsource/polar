from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime
from operator import and_, or_
from uuid import UUID

import structlog
from discord_webhook import AsyncDiscordWebhook, DiscordEmbed
from slugify import slugify
from sqlalchemy import Select, desc, false, func, nullsfirst, select, true, update
from sqlalchemy.orm import joinedload

from polar.auth.models import (
    AuthSubject,
    Subject,
    is_anonymous,
    is_organization,
    is_user,
)
from polar.authz.service import AccessType, Authz
from polar.config import settings
from polar.exceptions import BadRequest, NotPermitted, PolarRequestValidationError
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.models import ArticlesSubscription
from polar.models.article import Article
from polar.models.organization import Organization
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession, sql
from polar.user.service.user import user as user_service
from polar.worker import enqueue_job

from .schemas import ArticleCreate, ArticlePreview, ArticleUpdate

log = structlog.get_logger()


def polar_slugify(input: str) -> str:
    return slugify(
        input,
        max_length=64,  # arbitrary
        word_boundary=True,
    )


class ArticleService(ResourceServiceReader[Article]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Subject],
        *,
        organization_id: UUID | None = None,
        slug: str | None = None,
        visibility: Article.Visibility | None = None,
        is_published: bool | None = None,
        is_pinned: bool | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[tuple[Article, bool]], int]:
        statement = self._get_readable_articles_statement(
            auth_subject,
            # Don't leak hidden articles in the list
            include_hidden=False,
        )

        if organization_id is not None:
            statement = statement.where(Article.organization_id == organization_id)

        if slug is not None:
            statement = statement.where(Article.slug == slug)

        if visibility is not None:
            statement = statement.where(Article.visibility == visibility)

        if is_published is not None:
            if is_published:
                statement = statement.where(Article.published_at <= utc_now())
            else:
                statement = statement.where(
                    or_(
                        Article.published_at.is_(None), Article.published_at > utc_now()
                    )
                )

        if is_pinned is not None:
            statement = statement.where(Article.is_pinned == is_pinned)

        results, count = await paginate(
            session,
            statement,
            pagination=pagination,
        )

        return results, count

    async def get_by_id(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Subject],
        id: uuid.UUID,
    ) -> tuple[Article, bool] | None:
        statement = (
            self._get_readable_articles_statement(auth_subject)
            .where(Article.id == id)
            .options(
                joinedload(Article.user),
                joinedload(Article.organization),
            )
        )

        result = await session.execute(statement)
        return result.unique().tuples().one_or_none()

    async def create(
        self,
        session: AsyncSession,
        authz: Authz,
        create_schema: ArticleCreate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Article:
        organization = await get_payload_organization(
            session, auth_subject, create_schema
        )
        if not await authz.can(auth_subject.subject, AccessType.write, organization):
            raise NotPermitted()

        slug = polar_slugify(
            create_schema.slug if create_schema.slug else create_schema.title
        )
        slug = await self._get_available_slug(session, organization, slug)

        published_at: datetime | None = None
        if create_schema.visibility == "public":
            published_at = utc_now()
        if create_schema.published_at is not None:
            published_at = create_schema.published_at

        byline = create_schema.byline
        if is_organization(auth_subject):
            byline = Article.Byline.organization

        article = Article(
            slug=slug,
            body=create_schema.get_body(),
            published_at=published_at,
            byline=byline,
            user=auth_subject.subject if is_user(auth_subject) else None,
            organization=organization,
            **create_schema.model_dump(
                exclude={
                    "slug",
                    "body",
                    "body_base64",
                    "byline",
                    "published_at",
                    "organization_id",
                }
            ),
        )
        session.add(article)
        await session.flush()

        return article

    async def update(
        self,
        session: AsyncSession,
        authz: Authz,
        article: Article,
        update: ArticleUpdate,
        auth_subject: AuthSubject[User | Organization],
    ) -> Article:
        if not await authz.can(auth_subject.subject, AccessType.write, article):
            raise NotPermitted()

        if body := update.get_body():
            article.body = body

        if update.slug is not None:
            slug = polar_slugify(update.slug)
            slug = await self._get_available_slug(session, article.organization, slug)

        if update.byline == Article.Byline.user and article.user is not None:
            article.byline = Article.Byline.user

        should_notify_on_discord = False
        if update.visibility is not None:
            # if article was not already visible, and it's changed to visible:
            # set published at
            if (
                article.visibility != Article.Visibility.public
                and update.visibility == Article.Visibility.public
                and article.published_at is None
            ):
                article.published_at = utc_now()
                should_notify_on_discord = True

            article.visibility = update.visibility

        for attr, value in update.model_dump(
            exclude={"slug", "body", "body_base64", "byline", "visibility"},
            exclude_unset=True,
        ).items():
            setattr(article, attr, value)

        session.add(article)
        await session.flush()

        if should_notify_on_discord:
            await self._article_published_discord_notification(article)

        return article

    async def delete(
        self,
        session: AsyncSession,
        authz: Authz,
        article: Article,
        auth_subject: AuthSubject[User | Organization],
    ) -> Article:
        if not await authz.can(auth_subject.subject, AccessType.write, article):
            raise NotPermitted()

        article.set_deleted_at()
        session.add(article)

        return article

    async def preview(
        self,
        session: AsyncSession,
        authz: Authz,
        article: Article,
        preview: ArticlePreview,
        auth_subject: AuthSubject[User | Organization],
    ) -> None:
        if not await authz.can(auth_subject.subject, AccessType.write, article):
            raise NotPermitted()

        user = await user_service.get_by_email(session, preview.email)
        if user is None:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("body", "email"),
                        "msg": "User does not exist on Polar.",
                        "type": "value_error",
                        "input": preview.email,
                    }
                ]
            )

        enqueue_job(
            "articles.send_to_user",
            article_id=article.id,
            user_id=user.id,
            is_test=True,
        )

    async def send(
        self,
        session: AsyncSession,
        authz: Authz,
        article: Article,
        auth_subject: AuthSubject[User | Organization],
    ) -> Article:
        if not await authz.can(auth_subject.subject, AccessType.write, article):
            raise NotPermitted()

        if article.notifications_sent_at is not None:
            raise BadRequest("this post has already been sent")

        if article.notify_subscribers is False:
            raise BadRequest("notify_subscribers is not enabled")

        if not article.published_at:
            raise BadRequest("article is not published")

        if article.published_at > utc_now():
            raise BadRequest("article is scheduled to be published in the future")

        return await self.enqueue_send(session, article)

    async def enqueue_send(self, session: AsyncSession, article: Article) -> Article:
        article.notifications_sent_at = utc_now()
        session.add(article)

        receivers = await article_service.list_receivers(
            session, article.organization_id, article.paid_subscribers_only
        )

        for receiver_user_id, _, _ in receivers:
            enqueue_job(
                "articles.send_to_user",
                article_id=article.id,
                user_id=receiver_user_id,
                is_test=False,
            )

        # after scheduling is complete
        article.email_sent_to_count = len(receivers)
        session.add(article)

        return article

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

    async def count_receivers(
        self,
        session: AsyncSession,
        authz: Authz,
        article: Article,
        auth_subject: AuthSubject[User | Organization],
    ) -> tuple[int, int, int]:
        if not await authz.can(auth_subject.subject, AccessType.write, article):
            raise NotPermitted()

        receivers = await self.list_receivers(
            session, article.organization_id, article.paid_subscribers_only
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

    async def list_by_organization_id(
        self,
        session: AsyncSession,
        organization_id: UUID,
    ) -> Sequence[Article]:
        statement = (
            sql.select(Article)
            .where(Article.organization_id == organization_id)
            .where(Article.deleted_at.is_(None))
        )
        res = await session.execute(statement)
        return res.scalars().unique().all()

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

    async def release_paid_subscribers_only(self, session: AsyncSession) -> None:
        statement = (
            update(Article)
            .where(
                Article.paid_subscribers_only.is_(True),
                Article.paid_subscribers_only_ends_at <= utc_now(),
            )
            .values(paid_subscribers_only=False)
        )
        await session.execute(statement)

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

    def _get_readable_articles_statement(
        self, auth_subject: AuthSubject[Subject], *, include_hidden: bool = True
    ) -> Select[tuple[Article, bool]]:
        base_statement = (
            select(Article)
            .where(Article.deleted_at.is_(None))
            .options(joinedload(Article.user), joinedload(Article.organization))
            .order_by(nullsfirst(desc(Article.published_at)))
        )

        # Articles are readable if they are public and published
        visibility_clause = and_(
            Article.visibility == Article.Visibility.public,
            Article.published_at <= utc_now(),
        )
        # OR if they are hidden
        if include_hidden:
            visibility_clause = or_(
                visibility_clause,
                Article.visibility == Article.Visibility.hidden,
            )

        statement: Select[tuple[Article, bool]]

        # Anonymous
        if is_anonymous(auth_subject):
            statement = base_statement.add_columns(false()).where(visibility_clause)
        # User
        elif is_user(auth_subject):
            statement = (
                # Join user organization membership
                base_statement.join(
                    UserOrganization,
                    onclause=(UserOrganization.user_id == auth_subject.subject.id)
                    & (UserOrganization.organization_id == Article.organization_id)
                    & (UserOrganization.deleted_at.is_(None)),
                    isouter=True,
                )
                # Join user subscriptions
                .join(
                    ArticlesSubscription,
                    onclause=(ArticlesSubscription.user_id == auth_subject.subject.id)
                    & (ArticlesSubscription.organization_id == Article.organization_id)
                    & ArticlesSubscription.deleted_at.is_(None)
                    & ArticlesSubscription.emails_unsubscribed_at.is_(None),
                    isouter=True,
                )
                # Paid subscriber or organization member
                .add_columns(
                    or_(
                        func.coalesce(ArticlesSubscription.paid_subscriber, False),
                        UserOrganization.user_id.is_not(None),
                    )
                )
                # Visible or user is member of the organization
                .where(
                    or_(
                        visibility_clause,
                        UserOrganization.user_id == auth_subject.subject.id,
                    )
                )
            )
        # Organization
        elif is_organization(auth_subject):
            statement = base_statement.add_columns(true()).where(
                Article.organization_id == auth_subject.subject.id
            )

        return statement

    async def _get_available_slug(
        self,
        session: AsyncSession,
        organization: Organization,
        slug: str,
        attempt: int = 0,
    ) -> str:
        if attempt == 0:
            current_slug = slug
        else:
            current_slug = f"{slug}-{attempt}"

        existing_article = await self.get_by(
            session, slug=current_slug, organization_id=organization.id
        )
        if existing_article is None:
            return current_slug

        return await self._get_available_slug(session, organization, slug, attempt + 1)

    async def _article_published_discord_notification(self, article: Article) -> None:
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


article_service = ArticleService(Article)
