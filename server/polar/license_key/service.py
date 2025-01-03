from collections.abc import Sequence
from uuid import UUID

import structlog
from sqlalchemy import Select, func, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.auth.models import AuthSubject, is_customer, is_organization, is_user
from polar.exceptions import BadRequest, NotPermitted, ResourceNotFound
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.kit.utils import utc_now
from polar.models import (
    Benefit,
    Customer,
    LicenseKey,
    LicenseKeyActivation,
    Organization,
    User,
    UserOrganization,
)
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
    async def get_by_key(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        key: str,
    ) -> LicenseKey | None:
        query = self._get_select_base().where(
            LicenseKey.key == key,
            LicenseKey.organization_id == organization_id,
        )
        result = await session.execute(query)
        return result.unique().scalar_one_or_none()

    async def get_or_raise_by_key(
        self,
        session: AsyncSession,
        *,
        organization_id: UUID,
        key: str,
    ) -> LicenseKey:
        lk = await self.get_by_key(session, organization_id=organization_id, key=key)
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
            .join(Benefit, onclause=LicenseKey.benefit_id == Benefit.id)
            .options(
                joinedload(LicenseKey.activations),
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
        return result.unique().scalar_one_or_none()

    async def get_by_grant_or_raise(
        self,
        session: AsyncSession,
        *,
        id: UUID,
        organization_id: UUID,
        customer_id: UUID,
        benefit_id: UUID,
    ) -> LicenseKey:
        query = self._get_select_base().where(
            LicenseKey.id == id,
            LicenseKey.organization_id == organization_id,
            LicenseKey.customer_id == customer_id,
            LicenseKey.benefit_id == benefit_id,
        )
        result = await session.execute(query)
        key = result.unique().scalar_one_or_none()
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
        auth_subject: AuthSubject[User | Organization],
        *,
        pagination: PaginationParams,
        benefit_ids: Sequence[UUID] | None = None,
        organization_ids: Sequence[UUID] | None = None,
    ) -> tuple[Sequence[LicenseKey], int]:
        query = self._get_select_base().order_by(LicenseKey.created_at.asc())

        if is_user(auth_subject):
            user = auth_subject.subject
            query = query.join(
                UserOrganization,
                onclause=UserOrganization.organization_id == LicenseKey.organization_id,
            ).where(UserOrganization.user_id == user.id)
        elif is_organization(auth_subject):
            query = query.where(LicenseKey.organization_id == auth_subject.subject.id)
        else:
            raise ValueError("Invalid auth_subject given to license keys")

        if organization_ids:
            query = query.where(LicenseKey.organization_id.in_(organization_ids))

        if benefit_ids:
            query = query.where(LicenseKey.benefit_id.in_(benefit_ids))

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

        activation = None
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

        if validate.benefit_id and validate.benefit_id != license_key.benefit_id:
            bound_logger.info("license_key.validate.invalid_benefit")
            raise ResourceNotFound("License key does not match given benefit.")

        if validate.customer_id and validate.customer_id != license_key.customer_id:
            bound_logger.warn(
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
        benefit: BenefitLicenseKeys,
        license_key_id: UUID | None = None,
    ) -> LicenseKey:
        props = benefit.properties
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
        benefit: BenefitLicenseKeys,
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
        auth_subject: AuthSubject[User | Customer],
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
        auth_subject: AuthSubject[User | Customer],
        license_key_id: UUID,
    ) -> LicenseKey | None:
        query = (
            self._get_select_customer_base(auth_subject)
            .where(LicenseKey.id == license_key_id)
            .options(joinedload(LicenseKey.activations), joinedload(LicenseKey.benefit))
        )
        result = await session.execute(query)
        return result.unique().scalar_one_or_none()

    def _get_select_base(self) -> Select[tuple[LicenseKey]]:
        return (
            select(LicenseKey)
            .options(joinedload(LicenseKey.customer))
            .where(LicenseKey.deleted_at.is_(None))
        )

    def _get_select_customer_base(
        self, auth_subject: AuthSubject[User | Customer]
    ) -> Select[tuple[LicenseKey]]:
        statement = self._get_select_base()
        if is_user(auth_subject):
            statement = statement.where(
                LicenseKey.customer_id.in_(
                    select(Customer.id).where(
                        Customer.user_id == auth_subject.subject.id
                    )
                )
            )
        elif is_customer(auth_subject):
            statement = statement.where(
                LicenseKey.customer_id == auth_subject.subject.id
            )
        return statement


license_key = LicenseKeyService(LicenseKey)
