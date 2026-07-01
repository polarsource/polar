from collections.abc import Sequence
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
        connection: OrganizationSSOConnection,
        update: OrganizationSSOConnectionUpdate,
    ) -> OrganizationSSOConnection:
        repository = OrganizationSSOConnectionRepository.from_session(session)
        update_dict = update.model_dump(exclude_none=True)
        return await repository.update(connection, update_dict=update_dict)

    async def delete(
        self,
        session: AsyncSession,
        connection: OrganizationSSOConnection,
    ) -> OrganizationSSOConnection:
        repository = OrganizationSSOConnectionRepository.from_session(session)
        return await repository.soft_delete(connection)


organization_sso_connection = OrganizationSSOConnectionService()
