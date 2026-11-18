import uuid
from typing import Annotated

import stripe as stripe_lib
import structlog

from polar.integrations.stripe.service import stripe as stripe_service
from polar.logging import Logger
from polar.observability.task_logging import LoggableField
from polar.organization.repository import OrganizationRepository
from polar.organization.tasks import OrganizationDoesNotExist
from polar.worker import AsyncSessionMaker, actor

from .service import organization_domain as organization_domain_service

log: Logger = structlog.get_logger()


@actor(actor_name="organization_domain.register_payment_method_domains")
async def register_payment_method_domains(
    domains: Annotated[list[str], LoggableField],
) -> None:
    for domain in domains:
        payment_method_domain = await stripe_service.get_payment_method_domain(domain)
        if payment_method_domain is not None:
            if not payment_method_domain.enabled:
                await stripe_service.update_payment_method_domain(
                    payment_method_domain.id, enabled=True
                )
            continue
        try:
            await stripe_service.create_payment_method_domain(domain)
        except stripe_lib.InvalidRequestError as e:
            log.warning(
                "organization_domain.register_payment_method_domains.rejected",
                domain=domain,
                error=str(e),
            )


@actor(actor_name="organization_domain.register_organization_payment_method_domains")
async def register_organization_payment_method_domains(
    organization_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)
        await organization_domain_service.register_payment_method_domains(
            session, organization
        )


@actor(actor_name="organization_domain.unregister_payment_method_domains")
async def unregister_payment_method_domains(
    domains: Annotated[list[str], LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        for domain in domains:
            if await organization_domain_service.is_payment_method_domain_vouched_for(
                session, domain
            ):
                continue
            payment_method_domain = await stripe_service.get_payment_method_domain(
                domain
            )
            if payment_method_domain is not None and payment_method_domain.enabled:
                await stripe_service.update_payment_method_domain(
                    payment_method_domain.id, enabled=False
                )


@actor(actor_name="organization_domain.unregister_organization_payment_method_domains")
async def unregister_organization_payment_method_domains(
    organization_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        repository = OrganizationRepository.from_session(session)
        organization = await repository.get_by_id(organization_id, include_blocked=True)
        if organization is None:
            raise OrganizationDoesNotExist(organization_id)
        await organization_domain_service.unregister_payment_method_domains(
            session, organization
        )
