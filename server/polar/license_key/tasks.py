import uuid
from typing import Annotated

import structlog

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.models.license_key import LicenseKeyStatus
from polar.observability.task_logging import LoggableField
from polar.worker import AsyncSessionMaker, RedisMiddleware, TaskPriority, actor

from .repository import LicenseKeyRepository

log: Logger = structlog.get_logger()


class LicenseKeyTaskError(PolarTaskError): ...


class LicenseKeyDoesNotExist(LicenseKeyTaskError):
    def __init__(self, license_key_id: uuid.UUID) -> None:
        self.license_key_id = license_key_id
        message = f"The license key with id {license_key_id} does not exist."
        super().__init__(message)


@actor(
    actor_name="license_key.sync_benefit_grant",
    priority=TaskPriority.MEDIUM,
)
async def sync_benefit_grant(
    license_key_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        license_key_repository = LicenseKeyRepository.from_session(session)
        license_key = await license_key_repository.get_by_id(license_key_id)
        if license_key is None:
            raise LicenseKeyDoesNotExist(license_key_id)

        grant_repository = BenefitGrantRepository.from_session(session)
        grant = await grant_repository.get_by_property_and_organization(
            license_key.organization_id,
            "license_key_id",
            str(license_key.id),
            benefit_id=license_key.benefit_id,
            customer_id=license_key.customer_id,
            for_update=True,
            options=grant_repository.get_eager_options(),
        )
        if grant is None:
            return

        # Match fulfillment's grant-then-key lock order and re-read the status.
        await session.refresh(
            license_key, attribute_names=["status"], with_for_update=True
        )
        revoke = license_key.status == LicenseKeyStatus.revoked
        already_applied = grant.is_revoked if revoke else grant.is_granted
        if already_applied:
            return

        if not revoke and (grant.benefit.is_deleted or grant.customer.is_deleted):
            return

        apply = (
            benefit_grant_service.revoke_benefit
            if revoke
            else benefit_grant_service.grant_benefit
        )
        await apply(
            session,
            RedisMiddleware.get(),
            grant.customer,
            grant.benefit,
            member=grant.member,
            grant=grant,
        )
