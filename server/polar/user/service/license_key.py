import structlog

from polar.kit.services import ResourceService
from polar.models import User
from polar.models.benefit import BenefitLicenseKeys
from polar.models.license_key import LicenseKey
from polar.postgres import AsyncSession

from ..schemas.license_key import (
    LicenseKeyCreate,
    LicenseKeyUpdate,
)

log = structlog.get_logger()


class LicenseKeyService(
    ResourceService[LicenseKey, LicenseKeyCreate, LicenseKeyUpdate]
):
    async def user_grant(
        self, session: AsyncSession, *, user: User, benefit: BenefitLicenseKeys
    ) -> LicenseKey:
        props = benefit.properties
        key = LicenseKey.build(
            user_id=user.id,
            benefit_id=benefit.id,
            prefix=props.get("prefix", None),
            activation_limit=props.get("activation_limit", None),
            expires=props.get("expires", False),
            ttl=props.get("ttl", None),
            timeframe=props.get("timeframe", None),
        )

        session.add(key)
        await session.flush()
        return key

    async def revoke_for_user() -> None: ...


license_key = LicenseKeyService(LicenseKey)
