import uuid

import structlog

from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.grant.scope import resolve_scope
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.benefit.repository import BenefitRepository
from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.member.repository import MemberRepository
from polar.models.license_key import LicenseKeyStatus
from polar.worker import AsyncSessionMaker, RedisMiddleware, TaskPriority, actor

from .repository import LicenseKeyRepository

log: Logger = structlog.get_logger()


class LicenseKeyTaskError(PolarTaskError): ...


class LicenseKeyDoesNotExist(LicenseKeyTaskError):
    def __init__(self, license_key_id: uuid.UUID) -> None:
        self.license_key_id = license_key_id
        message = f"The license key with id {license_key_id} does not exist."
        super().__init__(message)


@actor(actor_name="license_key.sync_benefit_grant", priority=TaskPriority.MEDIUM)
async def sync_benefit_grant(license_key_id: uuid.UUID) -> None:
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
        )
        if grant is None:
            return

        revoke = license_key.status == LicenseKeyStatus.revoked
        already_applied = grant.is_revoked if revoke else grant.is_granted
        if already_applied:
            return

        benefit_repository = BenefitRepository.from_session(session)
        benefit = await benefit_repository.get_by_id(
            grant.benefit_id,
            options=benefit_repository.get_eager_options(),
            include_deleted=True,
        )
        assert benefit is not None

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_id(
            grant.customer_id, include_deleted=True
        )
        assert customer is not None

        member = None
        if grant.member_id is not None:
            member_repository = MemberRepository.from_session(session)
            member = await member_repository.get_by_id(
                grant.member_id, include_deleted=True
            )
            assert member is not None

        scope = await resolve_scope(session, grant.scope)
        apply = (
            benefit_grant_service.revoke_benefit
            if revoke
            else benefit_grant_service.grant_benefit
        )
        await apply(
            session,
            RedisMiddleware.get(),
            customer,
            benefit,
            member=member,
            **scope,
        )
