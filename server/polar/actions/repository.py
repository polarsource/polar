from typing import Any

import structlog
from sqlalchemy import Column

from polar.actions.base import Action
from polar.models.repository import Repository
from polar.platforms import Platforms
from polar.postgres import AsyncSession
from polar.schema.repository import CreateRepository, UpdateRepository

log = structlog.get_logger()


class RepositoryActions(Action[Repository, CreateRepository, UpdateRepository]):
    @property
    def default_upsert_index_elements(self) -> list[Column[Any]]:
        return [self.model.external_id]


class GithubRepositoryActions(RepositoryActions):
    async def get_by_external_id(
        self, session: AsyncSession, external_id: int
    ) -> Repository | None:
        return await self.get_by(
            session, platform=Platforms.github, external_id=external_id
        )


repository = RepositoryActions(Repository)
github_repository = GithubRepositoryActions(Repository)
