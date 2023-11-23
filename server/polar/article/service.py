from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

import structlog
from slugify import slugify
from sqlalchemy.orm import joinedload

from polar.models.article import Article
from polar.models.user import User
from polar.postgres import AsyncSession, sql

from .schemas import ArticleCreate

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

        return await Article(
            slug=slug,
            title=create_schema.title,
            body=create_schema.body,
            created_by=subject.id,
            organization_id=create_schema.organization_id,
            byline=create_schema.byline,
            visibility=create_schema.visibility,
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
            .where(Article.organization_id == organization_id)
            .where(Article.slug == slug)
            .where(Article.deleted_at.is_(None))
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
        organization_id: UUID,
        allow_hidden: bool,
        allow_private: bool,
    ) -> Sequence[Article]:
        visibility = ["public"]
        if allow_hidden:
            visibility.append("hidden")
        if allow_private:
            visibility.append("private")

        statement = (
            sql.select(Article)
            .where(Article.organization_id == organization_id)
            .where(Article.deleted_at.is_(None))
            .where(Article.visibility.in_(visibility))
            .options(
                joinedload(Article.created_by_user),
                joinedload(Article.organization),
            )
        )
        res = await session.execute(statement)
        return res.scalars().unique().all()


article_service = ArticleService()
