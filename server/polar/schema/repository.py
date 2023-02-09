from __future__ import annotations

from datetime import datetime

from polar.models.repository import Repository
from polar.platforms import Platforms
from polar.schema.base import Schema


class CreateRepository(Schema):
    platform: Platforms
    external_id: int
    organization_id: str | None
    organization_name: str
    name: str
    description: str | None
    open_issues: int | None
    forks: int | None
    stars: int | None
    watchers: int | None
    main_branch: str | None
    topics: list[str] | None
    license: str | None
    repository_pushed_at: datetime | None
    repository_created_at: datetime | None
    repository_modified_at: datetime | None
    is_private: bool
    is_fork: bool | None
    is_issues_enabled: bool | None
    is_projects_enabled: bool | None
    is_wiki_enabled: bool | None
    is_pages_enabled: bool | None
    is_downloads_enabled: bool | None
    is_archived: bool | None
    is_disabled: bool | None


class UpdateRepository(CreateRepository):
    ...


class RepositorySchema(CreateRepository):
    id: str
    visibility: Repository.Visibility

    class Config:
        orm_mode = True
