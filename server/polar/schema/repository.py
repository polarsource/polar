from __future__ import annotations

from datetime import datetime

from polar.clients import github
from polar.models import Organization, Repository
from polar.platforms import Platforms
from polar.schema.base import Schema


class RepositoryCreate(Schema):
    platform: Platforms
    external_id: int
    organization_id: str | None
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

    @classmethod
    def from_github(cls, organization: Organization, repo: github.Repository):
        return cls(
            platform=Platforms.github,
            external_id=repo.id,
            organization_id=organization.id,
            name=repo.name,
            description=repo.description,
            open_issues=repo.open_issues,
            forks=repo.forks,
            stars=repo.stargazers_count,
            watchers=repo.watchers_count,
            main_branch=repo.default_branch,
            topics=repo.topics,
            license=None,  # TODO: Store repo.license?
            repository_pushed_at=repo.pushed_at,
            repository_created_at=repo.created_at,
            repository_modified_at=repo.updated_at,
            is_private=repo.private,
            is_fork=repo.fork,
            is_issues_enabled=repo.has_issues,
            is_projects_enabled=repo.has_projects,
            is_wiki_enabled=repo.has_wiki,
            is_pages_enabled=repo.has_pages,
            is_downloads_enabled=repo.has_downloads,
            is_archived=repo.archived,
            is_disabled=repo.disabled,
        )


class RepositoryUpdate(RepositoryCreate):
    ...


class RepositoryRead(RepositoryCreate):
    id: str
    visibility: Repository.Visibility

    class Config:
        orm_mode = True
