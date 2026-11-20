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
        if await stripe_service.get_payment_method_domain(domain) is not None:
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
