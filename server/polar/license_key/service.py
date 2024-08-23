from collections.abc import Sequence
from uuid import UUID

import structlog
from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import contains_eager

from polar.exceptions import BadRequest, NotPermitted, ResourceNotFound
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models import Benefit, LicenseKey, LicenseKeyActivation, User
from polar.models.benefit import BenefitLicenseKeys
from polar.postgres import AsyncSession

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
        query = (
            self._get_select_base()
            .join(
                LicenseKeyActivation,
                onclause=(
                    and_(
                        LicenseKeyActivation.license_key_id == LicenseKey.id,
                        LicenseKeyActivation.deleted_at.is_(None),
                    )
                ),
                isouter=True,
            )
            .join(Benefit, onclause=LicenseKey.benefit_id == Benefit.id)
            .options(
                contains_eager(LicenseKey.activations),
                contains_eager(LicenseKey.benefit),
            )
            .where(LicenseKey.id == id)
        )
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

    async def get_by_grant_or_raise(
        self,
        session: AsyncSession,
        *,
        id: UUID,
        organization_id: UUID,
        user_id: UUID,
        benefit_id: UUID,
    ) -> LicenseKey:
        query = self._get_select_base().where(
            LicenseKey.id == id,
            LicenseKey.organization_id == organization_id,
            LicenseKey.user_id == user_id,
            LicenseKey.benefit_id == benefit_id,
        )
        result = await session.execute(query)
        key = result.scalar_one_or_none()
        if not key:
            raise ResourceNotFound()
        return key

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

        record.license_key = license_key
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
            .where(LicenseKey.organization_id == organization_id)
            .order_by(LicenseKey.created_at.asc())
        )
        return await paginate(session, query, pagination=pagination)

    async def get_user_list(
        self,
        session: AsyncSession,
        *,
        user: User,
        organization_id: UUID,
        pagination: PaginationParams,
        benefit_id: UUID | None = None,
    ) -> tuple[Sequence[LicenseKey], int]:
        query = (
            self._get_select_base()
            .where(
                LicenseKey.user_id == user.id,
                LicenseKey.organization_id == organization_id,
            )
            .order_by(LicenseKey.created_at.asc())
        )
        if benefit_id:
            query = query.where(LicenseKey.benefit_id == benefit_id)

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
            if activation.conditions and validate.conditions != activation.conditions:
                raise ResourceNotFound("License key does not match required conditions")

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
            conditions=activate.conditions,
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
        self,
        session: AsyncSession,
        *,
        user: User,
        benefit: BenefitLicenseKeys,
        license_key_id: UUID | None = None,
    ) -> LicenseKey:
        props = benefit.properties
        create_schema = LicenseKeyCreate.build(
            organization_id=benefit.organization_id,
            user_id=user.id,
            benefit_id=benefit.id,
            prefix=props.get("prefix", None),
            limit_usage=props.get("limit_usage", None),
            activations=props.get("activations", None),
            expires=props.get("expires", None),
        )
        if license_key_id:
            return await self.user_update_grant(
                session,
                create_schema=create_schema,
                license_key_id=license_key_id,
            )

        return await self.user_create_grant(
            session,
            create_schema=create_schema,
        )

    async def user_update_grant(
        self,
        session: AsyncSession,
        *,
        license_key_id: UUID,
        create_schema: LicenseKeyCreate,
    ) -> LicenseKey:
        key = await self.get_by_grant_or_raise(
            session,
            id=license_key_id,
            organization_id=create_schema.organization_id,
            user_id=create_schema.user_id,
            benefit_id=create_schema.benefit_id,
        )

        update_attrs = [
            "status",
            "expires_at",
            "limit_activations",
            "limit_usage",
        ]
        for attr in update_attrs:
            current = getattr(key, attr)
            updated = getattr(create_schema, attr)
            if current != updated:
                setattr(key, attr, updated)

        session.add(key)
        await session.flush()
        assert key.id is not None
        return key

    async def user_create_grant(
        self,
        session: AsyncSession,
        *,
        create_schema: LicenseKeyCreate,
    ) -> LicenseKey:
        key = LicenseKey(**create_schema.model_dump())
        session.add(key)
        await session.flush()
        assert key.id is not None
        return key

    async def user_revoke(
        self,
        session: AsyncSession,
        user: User,
        benefit: BenefitLicenseKeys,
        license_key_id: UUID,
    ) -> LicenseKey:
        key = await self.get_by_grant_or_raise(
            session,
            id=license_key_id,
            organization_id=benefit.organization_id,
            user_id=user.id,
            benefit_id=benefit.id,
        )
        key.mark_revoked()
        session.add(key)
        await session.flush()
        return key

    def _get_select_base(self) -> Select[tuple[LicenseKey]]:
        return select(LicenseKey).where(LicenseKey.deleted_at.is_(None))


license_key = LicenseKeyService(LicenseKey)
