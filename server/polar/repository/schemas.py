from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import UUID4, Field, HttpUrl

from polar.enums import Platforms
from polar.integrations.github import types
from polar.kit.schemas import Schema
from polar.models import Repository as RepositoryModel
from polar.organization.schemas import Organization as OrganizationSchema
from polar.visibility import Visibility

REPOSITORY_PROFILE_DESCRIPTION_MAX_LENGTH = 240


class RepositoryProfileSettings(Schema):
    description: str | None = Field(
        None,
        description="A description of the repository",
        max_length=REPOSITORY_PROFILE_DESCRIPTION_MAX_LENGTH,
    )
    cover_image_url: str | None = Field(None, description="A URL to a cover image")
    featured_organizations: list[UUID4] | None = Field(
        None, description="A list of featured organizations"
    )
    highlighted_subscription_tiers: list[UUID4] | None = Field(
        None, description="A list of highlighted subscription tiers", max_length=3
    )
    links: list[HttpUrl] | None = Field(
        None, description="A list of links related to the repository"
    )


class Repository(Schema):
    id: UUID
    platform: Platforms
    visibility: Visibility
    name: str = Field(examples=["MyOrg"])
    description: str | None = None
    stars: int | None = Field(default=None, examples=[1337])
    license: str | None = None
    homepage: str | None = None

    profile_settings: RepositoryProfileSettings | None = Field(
        description="Settings for the repository profile"
    )

    organization: OrganizationSchema

    @classmethod
    def from_db(cls, r: RepositoryModel) -> Self:
        profile_settings = RepositoryProfileSettings(
            description=r.profile_settings.get("description", None),
            cover_image_url=r.profile_settings.get("cover_image_url", None),
            featured_organizations=r.profile_settings.get(
                "featured_organizations", None
            ),
            highlighted_subscription_tiers=r.profile_settings.get(
                "highlighted_subscription_tiers", None
            ),
            links=r.profile_settings.get("links", None),
        )

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
            profile_settings=profile_settings,
        )


class RepositoryProfileSettingsUpdate(Schema):
    set_description: bool | None = None
    description: str | None = None

    set_cover_image_url: bool | None = None
    cover_image_url: str | None = None

    featured_organizations: list[UUID4] | None = None
    highlighted_subscription_tiers: list[UUID4] | None = None
    links: list[HttpUrl] | None = None


class RepositoryUpdate(Schema):
    profile_settings: RepositoryProfileSettingsUpdate | None = None


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
        repository: types.Repository
        | types.FullRepository
        | types.RepositoryWebhooks
        | types.WebhookIssuesTransferredPropChangesPropNewRepository,
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
            is_downloads_enabled=bool(repository.has_downloads),
            is_archived=repository.archived,
            is_disabled=bool(repository.disabled),
        )


class RepositoryGitHubUpdate(RepositoryCreate):
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
