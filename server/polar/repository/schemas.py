from __future__ import annotations

from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import Field

from polar.enums import Platforms
from polar.integrations.github import client as github
from polar.kit.schemas import Schema
from polar.models import Organization as OrganizationModel
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
            visibility=r.visibility,
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
        cls, organization: OrganizationModel, repo: github.rest.Repository
    ) -> Self:
        topics = repo.topics or None
        license = repo.license_.name if repo.license_ and repo.license_.name else None
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
            topics=topics,
            license=license,
            homepage=repo.homepage,
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


class RepositoryLegacyRead(Schema):
    id: UUID
    platform: Platforms
    visibility: Visibility
    name: str
    description: str | None = None
    stars: int | None = None
    license: str | None = None
    homepage: str | None = None

    class Config:
        orm_mode = True


class RepositorySeeksFundingShield(Schema):
    count: int
