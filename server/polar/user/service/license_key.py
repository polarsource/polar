import structlog

from polar.kit.services import ResourceService
from polar.models import User
from polar.models.benefit import BenefitLicenseKeys
from polar.models.license_key import LicenseKey
from polar.postgres import AsyncSession, sql

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

    async def user_revoke(
        self,
        session: AsyncSession,
        user: User,
        benefit: BenefitLicenseKeys,
    ) -> list[LicenseKey]:
        query = sql.select(LicenseKey).filter_by(user_id=user.id, benefit_id=benefit.id)
        res = await session.execute(query)
        keys = res.scalars().all()
        if not keys:
            return []

        ret = []
        for key in keys:
            key.mark_revoked()
            session.add(key)
            ret.append(key)

        await session.flush()
        return ret


license_key = LicenseKeyService(LicenseKey)
