from collections.abc import Sequence
from typing import Any
from uuid import UUID

from polar.kit.pagination import PaginationParams, paginate
from polar.models import Organization, OrganizationSSOConnection
from polar.models.organization_sso_connection import OIDCConfiguration
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import OrganizationSSOConnectionRepository
from .schemas import OIDCConfiguration as OIDCConfigurationSchema
from .schemas import (
    OrganizationSSOConnectionCreate,
    OrganizationSSOConnectionUpdate,
)


def _to_stored_configuration(
    configuration: OIDCConfigurationSchema,
) -> OIDCConfiguration:
    stored: OIDCConfiguration = {
        "issuer": str(configuration.issuer),
        "client_id": configuration.client_id,
        "auth_method": configuration.auth_method,
    }
    client_secret = getattr(configuration, "client_secret", None)
    if client_secret is not None:
        stored["client_secret"] = client_secret
    return stored


class OrganizationSSOConnectionService:
    async def list(
        self,
        session: AsyncReadSession,
        organization: Organization,
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[OrganizationSSOConnection], int]:
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
        repository = OrganizationSSOConnectionRepository.from_session(session)
        return await repository.get_by_organization_and_id(organization.id, id)

    async def create(
        self,
        session: AsyncSession,
        organization: Organization,
        create: OrganizationSSOConnectionCreate,
    ) -> OrganizationSSOConnection:
        repository = OrganizationSSOConnectionRepository.from_session(session)
        connection = OrganizationSSOConnection(
            organization=organization,
            type=create.configuration.type,
            configuration=_to_stored_configuration(create.configuration),
            enabled=create.enabled,
        )
        return await repository.create(connection, flush=True)

    async def update(
        self,
        session: AsyncSession,
        connection: OrganizationSSOConnection,
        update: OrganizationSSOConnectionUpdate,
    ) -> OrganizationSSOConnection:
        repository = OrganizationSSOConnectionRepository.from_session(session)
        update_dict: dict[str, Any] = {}
        if update.configuration is not None:
            update_dict["configuration"] = _to_stored_configuration(
                update.configuration
            )
            update_dict["type"] = update.configuration.type
        if update.enabled is not None:
            update_dict["enabled"] = update.enabled
        return await repository.update(connection, update_dict=update_dict)

    async def delete(
        self,
        session: AsyncSession,
        connection: OrganizationSSOConnection,
    ) -> OrganizationSSOConnection:
        repository = OrganizationSSOConnectionRepository.from_session(session)
        return await repository.soft_delete(connection)


organization_sso_connection = OrganizationSSOConnectionService()
