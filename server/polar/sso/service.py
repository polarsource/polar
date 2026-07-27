from collections.abc import Sequence
from typing import Any
from uuid import UUID

from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams, paginate
from polar.models import Organization, OrganizationSSOConnection
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import OrganizationSSOConnectionRepository
from .schemas import (
    OrganizationSSOConnectionCreate,
    OrganizationSSOConnectionUpdate,
)


class SSONotEnabled(PolarError):
    def __init__(self, organization: Organization) -> None:
        self.organization_id = organization.id
        super().__init__(
            f"Single sign-on is not enabled for this organization ({organization.id}).",
            403,
        )


class LastSSOConnectionRequired(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "This organization enforces SSO. Disable SSO enforcement before "
            "removing its last enabled connection.",
            409,
        )


class OrganizationSSOConnectionService:
    async def list(
        self,
        session: AsyncReadSession,
        organization: Organization,
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[OrganizationSSOConnection], int]:
        if not organization.is_sso_enabled:
            raise SSONotEnabled(organization)
        repository = OrganizationSSOConnectionRepository.from_session(session)
        statement = repository.get_statement_by_organization(organization.id).order_by(
            OrganizationSSOConnection.created_at.desc()
        )
        return await paginate(session, statement, pagination=pagination)

    async def get(
        self,
        session: AsyncReadSession,
        organization: Organization,
        id: UUID,
    ) -> OrganizationSSOConnection | None:
        if not organization.is_sso_enabled:
            raise SSONotEnabled(organization)
        repository = OrganizationSSOConnectionRepository.from_session(session)
        return await repository.get_by_organization_and_id(organization.id, id)

    async def create(
        self,
        session: AsyncSession,
        organization: Organization,
        create: OrganizationSSOConnectionCreate,
    ) -> OrganizationSSOConnection:
        if not organization.is_sso_enabled:
            raise SSONotEnabled(organization)
        repository = OrganizationSSOConnectionRepository.from_session(session)
        connection = OrganizationSSOConnection(
            organization=organization,
            **create.model_dump(),
        )
        return await repository.create(connection, flush=True)

    async def update(
        self,
        session: AsyncSession,
        organization: Organization,
        connection: OrganizationSSOConnection,
        update: OrganizationSSOConnectionUpdate,
    ) -> OrganizationSSOConnection:
        if (
            update.enabled is False
            and organization.sso_enforced
            and not await self._has_other_enabled_connection(
                session, organization, connection
            )
        ):
            raise LastSSOConnectionRequired()
        repository = OrganizationSSOConnectionRepository.from_session(session)
        update_dict: dict[str, Any] = {
            field: value
            for field, value in update.model_dump(
                exclude_unset=True, exclude={"configuration"}
            ).items()
            if value is not None or field == "name"
        }

        if update.configuration is not None:
            update_dict["configuration"] = update.configuration.model_dump()

        return await repository.update(connection, update_dict=update_dict)

    async def delete(
        self,
        session: AsyncSession,
        organization: Organization,
        connection: OrganizationSSOConnection,
    ) -> OrganizationSSOConnection:
        if (
            connection.enabled
            and organization.sso_enforced
            and not await self._has_other_enabled_connection(
                session, organization, connection
            )
        ):
            raise LastSSOConnectionRequired()
        repository = OrganizationSSOConnectionRepository.from_session(session)
        return await repository.soft_delete(connection)

    async def _has_other_enabled_connection(
        self,
        session: AsyncReadSession,
        organization: Organization,
        connection: OrganizationSSOConnection,
    ) -> bool:
        repository = OrganizationSSOConnectionRepository.from_session(session)
        enabled = await repository.get_enabled_by_organization(organization.id)
        return any(other.id != connection.id for other in enabled)


organization_sso_connection = OrganizationSSOConnectionService()
