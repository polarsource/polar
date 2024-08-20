from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.orm import contains_eager

from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.services import ResourceService
from polar.models import Benefit, LicenseKey, LicenseKeyActivation, User
from polar.models.benefit import BenefitLicenseKeys
from polar.postgres import AsyncSession, sql

from ..schemas.license_key import (
    LicenseKeyActivate,
    LicenseKeyCreate,
    LicenseKeyUpdate,
    LicenseKeyValidate,
)

log = structlog.get_logger()


class LicenseKeyService(
    ResourceService[LicenseKey, LicenseKeyCreate, LicenseKeyUpdate]
):
    async def get_by_key(self, session: AsyncSession, *, key: str) -> LicenseKey | None:
        query = self._get_select_base().where(LicenseKey.key == key)
        result = await session.execute(query)
        return result.unique().scalar_one_or_none()

    async def get_or_raise_by_key(
        self, session: AsyncSession, *, key: str
    ) -> LicenseKey:
        lk = await self.get_by_key(session, key=key)
        if not lk:
            raise ResourceNotFound()

        return lk

    async def get_loaded(
        self,
        session: AsyncSession,
        id: UUID,
    ) -> LicenseKey | None:
        query = self._get_select_base().where(LicenseKey.id == id)
        result = await session.execute(query)
        return result.unique().scalar_one_or_none()

    async def validate(
        self,
        session: AsyncSession,
        *,
        license_key: LicenseKey,
        validate: LicenseKeyValidate
    ) -> LicenseKey:
        if not validate.scope:
            return license_key

        if (
            validate.scope.benefit_id
            and validate.scope.benefit_id != license_key.benefit_id
        ):
            raise ResourceNotFound()

        if validate.scope.user_id and validate.scope.user_id != license_key.user_id:
            raise ResourceNotFound()

        return license_key

    async def activate(
        self,
        session: AsyncSession,
        license_key: LicenseKey,
        activate: LicenseKeyActivate,
    ) -> LicenseKeyActivation:
        if not license_key.requires_activation():
            raise NotPermitted("License key does not require activation")

        activations = license_key.activations
        if len(activations) >= license_key.limit_activations:
            raise NotPermitted("License key activation limit already reached")

        instance = LicenseKeyActivation(
            license_key=license_key,
            label=activate.label,
            meta=activate.meta,
        )
        session.add(instance)
        await session.flush()
        assert instance.id
        return instance

    async def user_grant(
        self, session: AsyncSession, *, user: User, benefit: BenefitLicenseKeys
    ) -> LicenseKey:
        props = benefit.properties
        key = LicenseKey.build(
            user_id=user.id,
            benefit_id=benefit.id,
            prefix=props.get("prefix", None),
            activations=props.get("activations", None),
            expires=props.get("expires", None),
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

    def _get_select_base(self) -> sql.Select:
        return (
            select(LicenseKey)
            .join(Benefit, onclause=LicenseKey.benefit_id == Benefit.id)
            .options(
                contains_eager(LicenseKey.benefit),
            )
        )


license_key = LicenseKeyService(LicenseKey)
