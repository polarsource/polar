from collections.abc import Sequence
from typing import cast
from uuid import UUID

import structlog
from sqlalchemy import Select, func, select
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.benefit.strategies.license_keys.properties import (
    BenefitLicenseKeysProperties,
)
from polar.exceptions import BadRequest, NotPermitted, ResourceNotFound
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.utils import utc_now
from polar.models import (
    Benefit,
    Customer,
    LicenseKey,
    LicenseKeyActivation,
    Organization,
    User,
)
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import LicenseKeyRepository
from .schemas import (
    LicenseKeyActivate,
    LicenseKeyCreate,
    LicenseKeyDeactivate,
    LicenseKeyUpdate,
    LicenseKeyValidate,
)

log = structlog.get_logger()


class LicenseKeyService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        pagination: PaginationParams,
        organization_id: Sequence[UUID] | None = None,
        benefit_id: Sequence[UUID] | None = None,
    ) -> tuple[Sequence[LicenseKey], int]:
        repository = LicenseKeyRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .order_by(LicenseKey.created_at.asc())
            .options(*repository.get_eager_options())
        )

        if organization_id is not None:
            statement = statement.where(LicenseKey.organization_id.in_(organization_id))

        if benefit_id is not None:
            statement = statement.where(LicenseKey.benefit_id.in_(benefit_id))

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
    ) -> LicenseKey | None:
        repository = LicenseKeyRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(LicenseKey.id == id)
            .options(*repository.get_eager_options())
        )
        return await repository.get_one_or_none(statement)

    async def get_or_raise_by_key(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        key: str,
    ) -> LicenseKey:
        repository = LicenseKeyRepository.from_session(session)
        lk = await repository.get_by_organization_and_key(
            organization_id, key, options=repository.get_eager_options()
        )
        if lk is None:
            raise ResourceNotFound()
        return lk

    async def get_by_grant_or_raise(
        self,
        session: AsyncSession,
        *,
        id: UUID,
        organization_id: UUID,
        customer_id: UUID,
        benefit_id: UUID,
    ) -> LicenseKey:
        repository = LicenseKeyRepository.from_session(session)
        lk = await repository.get_by_id_organization_customer_and_benefit(
            id,
            organization_id,
            customer_id,
            benefit_id,
            options=repository.get_eager_options(),
        )
        if lk is None:
            raise ResourceNotFound()
        return lk

    async def get_activation_or_raise(
        self, session: AsyncReadSession, *, license_key: LicenseKey, activation_id: UUID
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
    ) -> LicenseKey:
        bound_logger = log.bind(
            license_key_id=license_key.id,
            organization_id=license_key.organization_id,
            customer_id=license_key.customer_id,
            benefit_id=license_key.benefit_id,
        )
        if not license_key.is_active():
            bound_logger.info("license_key.validate.invalid_status")
            raise ResourceNotFound("License key is no longer active.")

        if license_key.expires_at:
            if utc_now() >= license_key.expires_at:
                bound_logger.info("license_key.validate.invalid_ttl")
                raise ResourceNotFound("License key has expired.")

        if validate.activation_id:
            activation = await self.get_activation_or_raise(
                session,
                license_key=license_key,
                activation_id=validate.activation_id,
            )
            if activation.conditions and validate.conditions != activation.conditions:
                # Skip logging UGC conditions
                bound_logger.info("license_key.validate.invalid_conditions")
                raise ResourceNotFound("License key does not match required conditions")
            license_key.activation = activation

        if validate.benefit_id and validate.benefit_id != license_key.benefit_id:
            bound_logger.info("license_key.validate.invalid_benefit")
            raise ResourceNotFound("License key does not match given benefit.")

        if validate.customer_id and validate.customer_id != license_key.customer_id:
            bound_logger.warning(
                "license_key.validate.invalid_owner",
                validate_customer_id=validate.customer_id,
            )
            raise ResourceNotFound("License key does not match given user.")

        if validate.increment_usage and license_key.limit_usage:
            remaining = license_key.limit_usage - license_key.usage
            if validate.increment_usage > remaining:
                bound_logger.info(
                    "license_key.validate.insufficient_usage",
                    usage_remaining=remaining,
                    usage_requested=validate.increment_usage,
                )
                raise BadRequest(f"License key only has {remaining} more usages.")

        license_key.mark_validated(increment_usage=validate.increment_usage)
        session.add(license_key)
        bound_logger.info("license_key.validate")
        return license_key

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
        if not license_key.is_active():
            raise NotPermitted(
                "License key is no longer active. "
                "This license key can not be activated."
            )

        if not license_key.limit_activations:
            raise NotPermitted(
                "This license key does not support activations. "
                "Use the /validate endpoint instead to check license validity."
            )

        current_activation_count = await self.get_activation_count(
            session,
            license_key=license_key,
        )
        if current_activation_count >= license_key.limit_activations:
            log.info(
                "license_key.activate.limit_reached",
                license_key_id=license_key.id,
                organization_id=license_key.organization_id,
                customer_id=license_key.customer_id,
                benefit_id=license_key.benefit_id,
            )
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
        log.info(
            "license_key.activate",
            license_key_id=license_key.id,
            organization_id=license_key.organization_id,
            customer_id=license_key.customer_id,
            benefit_id=license_key.benefit_id,
            activation_id=instance.id,
        )
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
        log.info(
            "license_key.deactivate",
            license_key_id=license_key.id,
            organization_id=license_key.organization_id,
            customer_id=license_key.customer_id,
            benefit_id=license_key.benefit_id,
            activation_id=activation.id,
        )
        return True

    async def customer_grant(
        self,
        session: AsyncSession,
        *,
        customer: Customer,
        benefit: Benefit,
        license_key_id: UUID | None = None,
    ) -> LicenseKey:
        props = cast(BenefitLicenseKeysProperties, benefit.properties)
        create_schema = LicenseKeyCreate.build(
            organization_id=benefit.organization_id,
            customer_id=customer.id,
            benefit_id=benefit.id,
            prefix=props.get("prefix", None),
            limit_usage=props.get("limit_usage", None),
            activations=props.get("activations", None),
            expires=props.get("expires", None),
        )
        log.info(
            "license_key.grant.request",
            organization_id=benefit.organization_id,
            customer_id=customer.id,
            benefit_id=benefit.id,
        )
        if license_key_id:
            return await self.customer_update_grant(
                session,
                create_schema=create_schema,
                license_key_id=license_key_id,
            )

        return await self.customer_create_grant(
            session,
            create_schema=create_schema,
        )

    async def customer_update_grant(
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
            customer_id=create_schema.customer_id,
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
        log.info(
            "license_key.grant.update",
            license_key_id=key.id,
            organization_id=key.organization_id,
            customer_id=key.customer_id,
            benefit_id=key.benefit_id,
        )
        return key

    async def customer_create_grant(
        self,
        session: AsyncSession,
        *,
        create_schema: LicenseKeyCreate,
    ) -> LicenseKey:
        key = LicenseKey(**create_schema.model_dump())
        session.add(key)
        await session.flush()
        assert key.id is not None
        log.info(
            "license_key.grant.create",
            license_key_id=key.id,
            organization_id=key.organization_id,
            customer_id=key.customer_id,
            benefit_id=key.benefit_id,
        )
        return key

    async def customer_revoke(
        self,
        session: AsyncSession,
        customer: Customer,
        benefit: Benefit,
        license_key_id: UUID,
    ) -> LicenseKey:
        key = await self.get_by_grant_or_raise(
            session,
            id=license_key_id,
            organization_id=benefit.organization_id,
            customer_id=customer.id,
            benefit_id=benefit.id,
        )
        key.mark_revoked()
        session.add(key)
        await session.flush()
        log.info(
            "license_key.revoke",
            license_key_id=key.id,
            organization_id=key.organization_id,
            customer_id=key.customer_id,
            benefit_id=key.benefit_id,
        )
        return key

    async def get_customer_list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        *,
        pagination: PaginationParams,
        benefit_id: UUID | None = None,
        organization_ids: Sequence[UUID] | None = None,
    ) -> tuple[Sequence[LicenseKey], int]:
        query = (
            self._get_select_customer_base(auth_subject)
            .order_by(LicenseKey.created_at.asc())
            .options(
                joinedload(LicenseKey.benefit),
            )
        )

        if organization_ids:
            query = query.where(LicenseKey.organization_id.in_(organization_ids))

        if benefit_id:
            query = query.where(LicenseKey.benefit_id == benefit_id)

        return await paginate(session, query, pagination=pagination)

    async def get_customer_license_key(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer],
        license_key_id: UUID,
    ) -> LicenseKey | None:
        query = (
            self._get_select_customer_base(auth_subject)
            .where(LicenseKey.id == license_key_id)
            .options(joinedload(LicenseKey.activations), joinedload(LicenseKey.benefit))
        )
        result = await session.execute(query)
        return result.unique().scalar_one_or_none()

    def _get_select_customer_base(
        self, auth_subject: AuthSubject[Customer]
    ) -> Select[tuple[LicenseKey]]:
        return (
            select(LicenseKey)
            .options(joinedload(LicenseKey.customer))
            .where(
                LicenseKey.deleted_at.is_(None),
                LicenseKey.customer_id == auth_subject.subject.id,
            )
        )


license_key = LicenseKeyService()
