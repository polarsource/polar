from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from operator import and_, or_
from uuid import UUID

import structlog
from slugify import slugify
from sqlalchemy import desc, nullsfirst
from sqlalchemy.orm import joinedload

from polar.exceptions import BadRequest
from polar.kit.utils import utc_now
from polar.models.article import Article
from polar.models.user import User
from polar.postgres import AsyncSession, sql
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

from .schemas import ArticleCreate, ArticleUpdate, Visibility

log = structlog.get_logger()


class ArticleService:
    async def create(
        self,
        session: AsyncSession,
        subject: User,
        create_schema: ArticleCreate,
        autocommit: bool = True,
    ) -> Article:
        slug = slugify(
            create_schema.title,
            max_length=64,  # arbitrary
            word_boundary=True,
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
        organization_id: UUID | None = None,
        organization_ids: list[UUID] | None = None,
        can_see_unpublished_in_organization_ids: list[UUID] | None = None,
    ) -> Sequence[Article]:
        post_can_see_stmts = [
            and_(
                Article.visibility == "public",
                Article.published_at <= utc_now(),
            ),
        ]

        if (
            can_see_unpublished_in_organization_ids is not None
            and len(can_see_unpublished_in_organization_ids) > 0
        ):
            post_can_see_stmts.append(
                Article.organization_id.in_(can_see_unpublished_in_organization_ids),
            )
        else:
            # dummy statement to make sure that we always pass at two statements to or_
            post_can_see_stmts.append(False)

        statement = (
            sql.select(Article)
            .where(Article.deleted_at.is_(None))
            .where(or_(*post_can_see_stmts))
            .options(
                joinedload(Article.created_by_user),
                joinedload(Article.organization),
            )
            .order_by(nullsfirst(desc(Article.published_at)))
        )

        if organization_id is not None:
            statement = statement.where(Article.organization_id == organization_id)

        if organization_ids is not None:
            statement = statement.where(Article.organization_id.in_(organization_ids))

        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def update(
        self,
        session: AsyncSession,
        article: Article,
        update: ArticleUpdate,
    ) -> Article:
        if update.title is not None:
            # TODO: Update slug if article is not published
            article.title = update.title

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


article_service = ArticleService()
