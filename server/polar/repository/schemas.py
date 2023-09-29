from __future__ import annotations

from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import Field

from polar.enums import Platforms
from polar.integrations.github import client as github
from polar.kit.schemas import Schema
from polar.models import Repository as RepositoryModel
from polar.organization.schemas import Organization as OrganizationSchema
from polar.visibility import Visibility


class Repository(Schema):
    id: UUID
    platform: Platforms
    visibility: Visibility
    name: str = Field(examples=["MyOrg"])
    description: str | None = None
    stars: int | None = Field(default=None, examples=[1337])
    license: str | None = None
    homepage: str | None = None

    organization: OrganizationSchema

    @classmethod
    def from_db(cls, r: RepositoryModel) -> Self:
        return cls(
            id=r.id,
            platform=r.platform,
            visibility=Visibility.PRIVATE if r.is_private else Visibility.PUBLIC,
            name=r.name,
            description=r.description,
            stars=r.stars,
            license=r.license,
            homepage=r.homepage,
            organization=OrganizationSchema.from_db(r.organization),
        )


#
# Internal models below. Not to be used in "public" APIs!
#


class RepositoryCreate(Schema):
    platform: Platforms
    external_id: int
    organization_id: UUID
    name: str
    description: str | None = None
    open_issues: int | None = None
    forks: int | None = None
    stars: int | None = None
    watchers: int | None = None
    main_branch: str | None = None
    topics: list[str] | None = None
    license: str | None = None
    homepage: str | None = None
    repository_pushed_at: datetime | None = None
    repository_created_at: datetime | None = None
    repository_modified_at: datetime | None = None
    is_private: bool
    is_fork: bool | None = None
    is_issues_enabled: bool | None = None
    is_projects_enabled: bool | None = None
    is_wiki_enabled: bool | None = None
    is_pages_enabled: bool | None = None
    is_downloads_enabled: bool | None = None
    is_archived: bool | None = None
    is_disabled: bool | None = None

    @classmethod
    def from_github(
        cls,
        repository: github.rest.Repository
        | github.rest.FullRepository
        | github.webhooks.Repository,
        organization_id: UUID,
    ) -> Self:
        topics = repository.topics if repository.topics else None
        license = (
            repository.license_.name
            if repository.license_ and repository.license_.name
            else None
        )

        repository_pushed_at = (
            datetime.fromtimestamp(repository.pushed_at)
            if isinstance(repository.pushed_at, int)
            else repository.pushed_at
        )
        repository_created_at = (
            datetime.fromtimestamp(repository.created_at)
            if isinstance(repository.created_at, int)
            else repository.created_at
        )
        # FIXME: this shouldn't be needed
        # Remove it when githubkit has updated the schema
        disabled = bool(repository.disabled)

        return cls(
            platform=Platforms.github,
            external_id=repository.id,
            organization_id=organization_id,
            name=repository.name,
            description=repository.description,
            open_issues=repository.open_issues,
            forks=repository.forks,
            stars=repository.stargazers_count,
            watchers=repository.watchers_count,
            main_branch=repository.default_branch,
            topics=topics,
            license=license,
            homepage=repository.homepage,
            repository_pushed_at=repository_pushed_at,
            repository_created_at=repository_created_at,
            repository_modified_at=repository.updated_at,
            is_private=repository.private,
            is_fork=repository.fork,
            is_issues_enabled=repository.has_issues,
            is_projects_enabled=repository.has_projects,
            is_wiki_enabled=repository.has_wiki,
            is_pages_enabled=repository.has_pages,
            is_downloads_enabled=repository.has_downloads,
            is_archived=repository.archived,
            is_disabled=disabled,
        )


class RepositoryUpdate(RepositoryCreate):
    ...


class RepositoryLegacyRead(Schema):
    id: UUID
    platform: Platforms
    visibility: Visibility
    name: str
    description: str | None = None
    stars: int | None = None
    license: str | None = None
    homepage: str | None = None


class RepositorySeeksFundingShield(Schema):
    count: int
