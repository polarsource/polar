from typing import Any

import structlog
from sqlalchemy import Column

from polar.actions.base import Action
from polar.models.repository import Repository
from polar.platforms import Platforms
from polar.schema.repository import CreateRepository, UpdateRepository

log = structlog.get_logger()


class RepositoryActions(Action[Repository, CreateRepository, UpdateRepository]):
    @property
    def default_upsert_index_elements(self) -> list[Column[Any]]:
        return [self.model.external_id]


class GithubRepositoryActions(RepositoryActions):
    def get_by_external_id(self, external_id: int) -> Repository | None:
        return self.get_by(platform=Platforms.github, external_id=external_id)


repository = RepositoryActions(Repository)
github_repository = GithubRepositoryActions(Repository)
