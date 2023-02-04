from typing import Any

import structlog
from sqlalchemy import Column

from polar.actions.base import Action
from polar.models.organization import Organization
from polar.platforms import Platforms
from polar.schema.organization import CreateOrganization, UpdateOrganization

log = structlog.get_logger()


class OrganizationActions(Action[Organization, CreateOrganization, UpdateOrganization]):
    @property
    def default_upsert_index_elements(self) -> list[Column[Any]]:
        return [self.model.external_id]

    def get_by_platform(
        self, platform: Platforms, external_id: int
    ) -> Organization | None:
        return self.get_by(platform=platform, external_id=external_id)

    def get_by_name(self, name: str) -> Organization | None:
        return self.get_by(name=name)


class GithubOrganization(OrganizationActions):
    ...


organization = OrganizationActions(Organization)
github_organization = GithubOrganization(Organization)
