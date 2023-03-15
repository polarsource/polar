from __future__ import annotations

from uuid import UUID
from typing import Sequence
from sqlalchemy import desc, func, or_

import structlog
from sqlalchemy.orm import InstrumentedAttribute

from polar.kit.services import ResourceService
from polar.models.issue import Issue
from polar.enums import Platforms
from polar.postgres import AsyncSession, sql

from .schemas import IssueCreate, IssueUpdate


log = structlog.get_logger()


class IssueService(ResourceService[Issue, IssueCreate, IssueUpdate]):
    @property
    def upsert_constraints(self) -> list[InstrumentedAttribute[int]]:
        return [self.model.external_id]

    async def get_by_platform(
        self, session: AsyncSession, platform: Platforms, external_id: int
    ) -> Issue | None:
        return await self.get_by(session, platform=platform, external_id=external_id)

    async def get_by_number(
        self,
        session: AsyncSession,
        platform: Platforms,
        organization_id: UUID,
        repository_id: UUID,
        number: int,
    ) -> Issue | None:
        return await self.get_by(
            session,
            platform=platform,
            organization_id=organization_id,
            repository_id=repository_id,
            number=number,
        )

    async def list_by_repository(
        self, session: AsyncSession, repository_id: UUID
    ) -> Sequence[Issue]:
        statement = sql.select(Issue).where(Issue.repository_id == repository_id)
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues

    async def list_by_repository_and_status(
        self,
        session: AsyncSession,
        repository_id: UUID,
        text: str | None = None,
        include_open: bool = True,
        include_closed: bool = False,
    ) -> Sequence[Issue]:
        statement = sql.select(Issue).where(Issue.repository_id == repository_id)

        filters = []
        if include_open:
            filters.append(Issue.issue_closed_at.is_(None))
        if include_closed:
            filters.append(Issue.issue_closed_at.is_not(None))

        statement = statement.where(or_(*filters))

        if text:
            # Search in titles using the vector index
            # https://www.postgresql.org/docs/current/textsearch-controls.html#TEXTSEARCH-PARSING-QUERIES
            #
            # The index supports fast matching of words and prefix-matching of words
            #
            # Here we're converting a user query like "feat cli" to
            # "feat:* | cli:*"
            words = text.split(" ")

            # remove empty words
            words = [w for w in words if len(w.strip()) > 0]

            # convert all words to prefix matches
            words = [f"{w}:*" for w in words]

            # OR all words
            search = " | ".join(words)

            statement = statement.where(
                Issue.title_tsv.bool_op("@@")(func.to_tsquery(search))
            )

            # Sort results based on matching
            statement = statement.order_by(
                desc(func.ts_rank_cd(Issue.title_tsv, func.to_tsquery(search)))
            )

        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues


issue = IssueService(Issue)
