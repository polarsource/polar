import secrets
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams, paginate
from polar.models import Organization, OrganizationDomain
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import OrganizationDomainRepository
from .schemas import OrganizationDomainCreate


class OrganizationDomainAlreadyExists(PolarError):
    def __init__(self, domain: str) -> None:
        self.domain = domain
        super().__init__(
            f"The domain {domain} is already added to this organization.", 409
        )


class OrganizationDomainService:
    async def list(
        self,
        session: AsyncReadSession,
        organization: Organization,
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[OrganizationDomain], int]:
        repository = OrganizationDomainRepository.from_session(session)
        statement = repository.get_statement_by_organization(organization.id).order_by(
            OrganizationDomain.domain
        )
        return await paginate(session, statement, pagination=pagination)

    async def get(
        self,
        session: AsyncReadSession,
        organization: Organization,
        id: UUID,
    ) -> OrganizationDomain | None:
        repository = OrganizationDomainRepository.from_session(session)
        return await repository.get_by_organization_and_id(organization.id, id)

    async def create(
        self,
        session: AsyncSession,
        organization: Organization,
        create: OrganizationDomainCreate,
    ) -> OrganizationDomain:
        repository = OrganizationDomainRepository.from_session(session)
        try:
            async with session.begin_nested():
                return await repository.create(
                    OrganizationDomain(
                        organization=organization,
                        domain=create.domain,
                        verification_record_value=secrets.token_urlsafe(32),
                    ),
                    flush=True,
                )
        except IntegrityError as e:
            raise OrganizationDomainAlreadyExists(create.domain) from e

    async def delete(
        self, session: AsyncSession, organization_domain: OrganizationDomain
    ) -> None:
        repository = OrganizationDomainRepository.from_session(session)
        await repository.soft_delete(organization_domain)


organization_domain = OrganizationDomainService()
