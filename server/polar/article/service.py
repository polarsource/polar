from __future__ import annotations

from uuid import UUID

import structlog
from slugify import slugify

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

        # TODO: detect and handle duplicate slugs

        return await Article(
            slug=slug,
            title=create_schema.title,
            body=create_schema.body,
            created_by=subject.id,
            organization_id=create_schema.organization_id,
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
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()


article_service = ArticleService()
