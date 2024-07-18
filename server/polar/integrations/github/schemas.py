import time
from typing import Any

from pydantic import UUID4, model_validator

from polar.kit.schemas import Schema
from polar.organization.schemas import OrganizationID

from .types import AppPermissionsType


class OAuthAccessToken(Schema):
    access_token: str
    expires_in: int
    expires_at: int
    refresh_token: str
    refresh_token_expires_in: int
    refresh_token_expires_at: int

    @model_validator(mode="before")
    def set_refresh_token_expires_at(cls, data: dict[str, Any]) -> dict[str, Any]:
        epoch_now = int(time.time())
        expires_in = data["refresh_token_expires_in"]
        data["refresh_token_expires_at"] = epoch_now + expires_in
        return data


class GitHubIssue(Schema):
    raw: str
    owner: str | None = None
    repo: str | None = None
    number: int

    @property
    def canonical(self) -> str:
        if self.owner and self.repo:
            return f"{self.owner.lower()}/{self.repo.lower()}#{self.number}"
        else:
            return f"#{self.number}"


class GithubUser(Schema):
    username: str
    avatar_url: str


class OrganizationCheckPermissionsInput(Schema):
    permissions: AppPermissionsType


class OrganizationBillingPlan(Schema):
    organization_id: UUID4
    is_free: bool
    plan_name: str


class InstallationCreate(Schema):
    installation_id: int
    organization_id: OrganizationID
