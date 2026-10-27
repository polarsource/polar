import contextlib
import secrets
from collections.abc import Sequence
from uuid import UUID

import dns.asyncresolver
import dns.exception
import dns.resolver
import structlog
from sqlalchemy.exc import IntegrityError

from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Organization, OrganizationDomain
from polar.organization.embed_hosts import WILDCARD_PREFIX, is_shared_host
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import OrganizationDomainRepository
from .schemas import OrganizationDomainCreate

log: Logger = structlog.get_logger()


class OrganizationDomainAlreadyExists(PolarError):
    def __init__(self, domain: str) -> None:
        self.domain = domain
        super().__init__(
            f"The domain {domain} is already added to this organization.", 409
        )


class OrganizationDomainVerificationFailed(PolarError):
    def __init__(self, organization_domain: OrganizationDomain) -> None:
        self.domain = organization_domain.domain
        super().__init__(
            f"No TXT record matching the verification token was found at "
            f"{organization_domain.verification_record_name}. "
            "DNS changes can take a few minutes to propagate.",
            400,
        )


class OrganizationDomainVerifiedElsewhere(PolarError):
    def __init__(self, domain: str) -> None:
        self.domain = domain
        super().__init__(
            f"The domain {domain} is already verified by another organization.", 409
        )


async def _lookup_txt(name: str) -> set[str]:
    try:
        answer = await dns.asyncresolver.resolve(name, "TXT", lifetime=5)
    except dns.resolver.NXDOMAIN, dns.resolver.NoAnswer:
        return set()
    return {b"".join(record.strings).decode() for record in answer}


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

    async def has_verified(
        self, session: AsyncReadSession, organization: Organization
    ) -> bool:
        repository = OrganizationDomainRepository.from_session(session)
        statement = repository.get_verified_statement_by_organization(organization.id)
        return await repository.count(statement) > 0

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

    async def verify(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_domain: OrganizationDomain,
    ) -> OrganizationDomain:
        if organization_domain.verified_at is not None:
            return organization_domain

        try:
            records = await _lookup_txt(organization_domain.verification_record_name)
        except dns.exception.DNSException as e:
            raise OrganizationDomainVerificationFailed(organization_domain) from e
        if organization_domain.verification_record_value not in records:
            raise OrganizationDomainVerificationFailed(organization_domain)

        repository = OrganizationDomainRepository.from_session(session)
        try:
            async with session.begin_nested():
                organization_domain = await repository.update(
                    organization_domain,
                    update_dict={
                        "verified_at": utc_now(),
                        "verification_lost_at": None,
                    },
                    flush=True,
                )
        except IntegrityError as e:
            await session.refresh(organization_domain)
            raise OrganizationDomainVerifiedElsewhere(organization_domain.domain) from e

        domain = organization_domain.domain
        hosts = [domain]
        if not is_shared_host(f"{WILDCARD_PREFIX}{domain}"):
            hosts.append(f"{WILDCARD_PREFIX}{domain}")
        await session.refresh(organization, with_for_update=True)
        organization.embed_hosts = [
            *organization.embed_hosts,
            *(host for host in hosts if host not in organization.embed_hosts),
        ]
        return organization_domain

    async def reverify(
        self, session: AsyncSession, organization: Organization
    ) -> Sequence[OrganizationDomain]:
        repository = OrganizationDomainRepository.from_session(session)
        organization_domains = await repository.get_all(
            repository.get_statement_by_organization(organization.id)
        )
        for organization_domain in organization_domains:
            if organization_domain.verification_record_value is None:
                continue
            if organization_domain.verified_at is None:
                with contextlib.suppress(
                    OrganizationDomainVerificationFailed,
                    OrganizationDomainVerifiedElsewhere,
                ):
                    await self.verify(session, organization, organization_domain)
                continue

            try:
                records = await _lookup_txt(
                    organization_domain.verification_record_name
                )
            except dns.exception.DNSException as e:
                log.warning(
                    "organization_domain.reverify.lookup_failed",
                    organization_id=str(organization.id),
                    domain=organization_domain.domain,
                    error=str(e),
                )
                continue

            if organization_domain.verification_record_value not in records:
                log.info(
                    "organization_domain.reverify.lost",
                    organization_id=str(organization.id),
                    domain=organization_domain.domain,
                )
                await repository.update(
                    organization_domain,
                    update_dict={
                        "verified_at": None,
                        "verification_lost_at": utc_now(),
                    },
                )
        return organization_domains


organization_domain = OrganizationDomainService()
