from collections.abc import Sequence
from uuid import UUID

import structlog
from sqlalchemy import func, select
from sqlalchemy.orm import contains_eager

from polar.exceptions import BadRequest, NotPermitted, ResourceNotFound
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models import Benefit, LicenseKey, LicenseKeyActivation, User
from polar.models.benefit import BenefitLicenseKeys
from polar.postgres import AsyncSession, sql

from .schemas import (
    LicenseKeyActivate,
    LicenseKeyCreate,
    LicenseKeyDeactivate,
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
        query = self._get_loaded_base().where(LicenseKey.id == id)
        result = await session.execute(query)
        return result.unique().scalar_one_or_none()

    async def get_by_id(
        self,
        session: AsyncSession,
        id: UUID,
    ) -> LicenseKey | None:
        query = self._get_select_base().where(LicenseKey.id == id)
        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def get_activation_or_raise(
        self, session: AsyncSession, *, license_key: LicenseKey, activation_id: UUID
    ) -> LicenseKeyActivation:
        query = select(LicenseKeyActivation).where(
            LicenseKeyActivation.id == activation_id,
            LicenseKeyActivation.license_key_id == license_key.id,
            LicenseKeyActivation.deleted_at.is_(None),
        )
        result = await session.execute(query)
        record = result.scalar_one_or_none()
        if not record:
            raise ResourceNotFound()

        return record

    async def get_list(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        pagination: PaginationParams,
    ) -> tuple[Sequence[LicenseKey], int]:
        query = (
            self._get_select_base()
            .where(Benefit.organization_id == organization_id)
            .order_by(LicenseKey.created_at.asc())
        )
        return await paginate(session, query, pagination=pagination)

    async def update(
        self,
        session: AsyncSession,
        *,
        license_key: LicenseKey,
        updates: LicenseKeyUpdate,
    ) -> LicenseKey:
        update_dict = updates.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(license_key, key, value)

        session.add(license_key)
        await session.flush()
        return license_key

    async def validate(
        self,
        session: AsyncSession,
        *,
        license_key: LicenseKey,
        validate: LicenseKeyValidate,
    ) -> tuple[LicenseKey, LicenseKeyActivation | None]:
        if license_key.expires_at:
            if utc_now() >= license_key.expires_at:
                raise ResourceNotFound("License key has expired.")

        activation = None
        if validate.activation_id:
            activation = await self.get_activation_or_raise(
                session,
                license_key=license_key,
                activation_id=validate.activation_id,
            )

        if validate.benefit_id and validate.benefit_id != license_key.benefit_id:
            raise ResourceNotFound("License key does not match given benefit.")

        if validate.user_id and validate.user_id != license_key.user_id:
            raise ResourceNotFound("License key does not match given user.")

        if validate.increment_usage and license_key.limit_usage:
            remaining = license_key.limit_usage - license_key.usage
            if validate.increment_usage > remaining:
                raise BadRequest(f"License key only has {remaining} more usages.")

        license_key.mark_validated(increment_usage=validate.increment_usage)
        session.add(license_key)
        return (license_key, activation)

    async def get_activation_count(
        self,
        session: AsyncSession,
        license_key: LicenseKey,
    ) -> int:
        query = select(func.count(LicenseKeyActivation.id)).where(
            LicenseKeyActivation.license_key_id == license_key.id,
            LicenseKeyActivation.deleted_at.is_(None),
        )
        res = await session.execute(query)
        count = res.scalar()
        if count:
            return count
        return 0

    async def activate(
        self,
        session: AsyncSession,
        license_key: LicenseKey,
        activate: LicenseKeyActivate,
    ) -> LicenseKeyActivation:
        if not license_key.limit_activations:
            raise NotPermitted("License key does not require activation")

        current_activation_count = await self.get_activation_count(
            session,
            license_key=license_key,
        )
        if current_activation_count >= license_key.limit_activations:
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

    async def deactivate(
        self,
        session: AsyncSession,
        license_key: LicenseKey,
        deactivate: LicenseKeyDeactivate,
    ) -> bool:
        activation = await self.get_activation_or_raise(
            session,
            license_key=license_key,
            activation_id=deactivate.activation_id,
        )
        activation.mark_deleted()
        session.add(activation)
        await session.flush()
        assert activation.deleted_at is not None
        return True

    async def user_grant(
        self, session: AsyncSession, *, user: User, benefit: BenefitLicenseKeys
    ) -> LicenseKey:
        props = benefit.properties
        key = LicenseKey.build(
            user_id=user.id,
            benefit_id=benefit.id,
            prefix=props.get("prefix", None),
            limit_activations=props.get("limit_activations", None),
            limit_usage=props.get("limit_usage", None),
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

    def _get_loaded_base(self) -> sql.Select:
        return (
            self._get_select_base()
            .join(
                LicenseKeyActivation,
                onclause=LicenseKeyActivation.license_key_id == LicenseKey.id,
                isouter=True,
            )
            .options(contains_eager(LicenseKey.activations))
            .where(LicenseKeyActivation.deleted_at.is_(None))
        )

    def _get_select_base(self) -> sql.Select:
        return (
            select(LicenseKey)
            .join(Benefit, onclause=LicenseKey.benefit_id == Benefit.id)
            .options(
                contains_eager(LicenseKey.benefit),
            )
        )


license_key = LicenseKeyService(LicenseKey)
