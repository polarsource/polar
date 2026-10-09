from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, create_model
from sqlalchemy.exc import IntegrityError

from polar.auth.models import AuthSubject, is_organization
from polar.auth.permission import OrganizationPermission
from polar.auth.scope import Scope
from polar.authz.service import assert_organization_permission
from polar.benefit.repository import BenefitRepository
from polar.benefit.service import benefit as benefit_service
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import Organization, User
from polar.oauth2.exceptions import InsufficientScopeError
from polar.organization.resolver import OrganizationIDModel, get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository
from polar.product.service import product as product_service
from polar.redis import Redis

from . import benefits, products, validation
from .export import export_config
from .schemas import (
    Config,
    ConfigApplyResult,
    ConfigChange,
    ConfigExport,
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigPlan,
    ConfigResource,
    ConfigResult,
)
from .validation import BenefitChange, MeterChange, ProductChange, ResourceChange

_METER_EXTERNAL_ID_INDEX = "ix_meters_organization_id_external_id"
_BENEFIT_EXTERNAL_ID_INDEX = "ix_benefits_organization_id_external_id"
_PRODUCT_EXTERNAL_ID_INDEX = "ix_products_organization_id_external_id"


_SECTION_SCOPES = {
    "benefits": (Scope.benefits_read, Scope.benefits_write),
    "products": (Scope.products_read, Scope.products_write),
}


def _assert_section_scopes(
    auth_subject: AuthSubject[User | Organization], config: Config, *, write: bool
) -> None:
    for section, (read_scope, write_scope) in _SECTION_SCOPES.items():
        if section not in config.model_fields_set:
            continue
        required = {write_scope} if write else {read_scope, write_scope}
        if not auth_subject.scopes & required:
            raise InsufficientScopeError({str(scope) for scope in required})


def _assert_export_scopes(auth_subject: AuthSubject[User | Organization]) -> None:
    for read_scope, write_scope in _SECTION_SCOPES.values():
        required = {read_scope, write_scope}
        if not auth_subject.scopes & required:
            raise InsufficientScopeError({str(scope) for scope in required})


def _constraint_name(error: IntegrityError) -> str | None:
    database_error = getattr(error.orig, "__cause__", None)
    return getattr(database_error, "constraint_name", None)


@dataclass
class _OrganizationTarget:
    organization_id: UUID | None


class ConfigAsCodeNotEnabled(PolarError):
    def __init__(self) -> None:
        super().__init__("Config as code is not enabled for this organization.", 403)


class ConfigMeterConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "A meter in this config was created by a concurrent request. Retry.", 409
        )


class ConfigBenefitConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "A benefit in this config was created by a concurrent request. Retry.", 409
        )


class ConfigProductConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "A product in this config was created by a concurrent request. Retry.", 409
        )


class ConfigInvalid(PolarError):
    def __init__(self, errors: list[ConfigIssue]) -> None:
        super().__init__("The config can't be applied.", 409)
        self.errors = errors

    @property
    def detail(self) -> list[ConfigIssue]:
        return self.errors

    @classmethod
    def schema(cls) -> type[BaseModel]:
        if cls._schema is None:
            cls._schema = create_model(
                cls.__name__,
                error=(Literal[cls.__name__], Field(examples=[cls.__name__])),
                detail=(list[ConfigIssue], ...),
            )
        return cls._schema


class DeclarativeConfigService:
    async def apply(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[User | Organization],
        config: Config,
    ) -> ConfigApplyResult:
        _assert_section_scopes(auth_subject, config, write=True)
        organization = await self._get_organization(
            session, auth_subject, config, OrganizationPermission.products_manage
        )
        changes, issues = await validation.check(
            session, organization, config, for_update=True
        )
        errors = [
            issue for issue in issues if issue.severity == ConfigIssueSeverity.error
        ]
        if errors:
            raise ConfigInvalid(errors)

        meter_results, meter_ids = await self._apply_meters(
            session, organization, changes.meters
        )
        benefit_results, benefit_ids = await self._apply_benefits(
            session, redis, auth_subject, organization, changes.benefits, meter_ids
        )
        product_results = await self._apply_products(
            session,
            auth_subject,
            organization,
            changes.products,
            meter_ids,
            benefit_ids,
        )
        return ConfigApplyResult(
            changes=[*meter_results, *benefit_results, *product_results]
        )

    async def plan(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        config: Config,
    ) -> ConfigPlan:
        _assert_section_scopes(auth_subject, config, write=False)
        organization = await self._get_organization(
            session, auth_subject, config, OrganizationPermission.products_read
        )
        changes, issues = await validation.check(
            session, organization, config, for_update=False
        )
        return ConfigPlan(
            changes=[
                *self._plan_changes(ConfigResource.meter, changes.meters),
                *self._plan_changes(ConfigResource.benefit, changes.benefits),
                *self._plan_changes(ConfigResource.product, changes.products),
            ],
            issues=issues,
        )

    async def export(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        organization_id: UUID | None,
    ) -> ConfigExport:
        _assert_export_scopes(auth_subject)
        organization = await self._get_organization(
            session,
            auth_subject,
            _OrganizationTarget(organization_id),
            OrganizationPermission.products_read,
        )
        return await export_config(session, organization)

    def _plan_changes(
        self, resource: ConfigResource, changes: Sequence[ResourceChange[Any, Any]]
    ) -> list[ConfigChange]:
        return [
            ConfigChange(
                resource=resource,
                external_id=change.config.external_id,
                action=change.action,
                diff=change.diff,
            )
            for change in changes
        ]

    async def _get_organization(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        target: OrganizationIDModel,
        permission: OrganizationPermission,
    ) -> Organization:
        organization = await get_payload_organization(session, auth_subject, target)
        await assert_organization_permission(
            session, auth_subject, organization.id, permission
        )
        if not organization.is_config_as_code_enabled:
            raise ConfigAsCodeNotEnabled()
        return organization

    async def _apply_meters(
        self,
        session: AsyncSession,
        organization: Organization,
        changes: Sequence[MeterChange],
    ) -> tuple[list[ConfigResult], dict[str, UUID]]:
        repository = MeterRepository.from_session(session)
        results: list[ConfigResult] = []
        meter_ids: dict[str, UUID] = {}
        for change in changes:
            meter = change.existing
            if meter is None:
                try:
                    async with session.begin_nested():
                        meter = await meter_service.create_for_organization(
                            session, organization, change.config
                        )
                except IntegrityError as e:
                    if _constraint_name(e) != _METER_EXTERNAL_ID_INDEX:
                        raise
                    raise ConfigMeterConflict() from e
            elif change.update_dict:
                await repository.update(meter, update_dict=change.update_dict)
            meter_ids[change.config.external_id] = meter.id
            results.append(
                ConfigResult(
                    resource=ConfigResource.meter,
                    external_id=change.config.external_id,
                    action=change.action,
                )
            )
        return results, meter_ids

    async def _apply_benefits(
        self,
        session: AsyncSession,
        redis: Redis,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        changes: Sequence[BenefitChange],
        meter_ids: dict[str, UUID],
    ) -> tuple[list[ConfigResult], dict[str, UUID]]:
        repository = BenefitRepository.from_session(session)
        results: list[ConfigResult] = []
        benefit_ids: dict[str, UUID] = {}
        for change in changes:
            benefit = change.existing
            if benefit is None:
                try:
                    async with session.begin_nested():
                        benefit = await benefit_service.user_create(
                            session,
                            redis,
                            benefits.benefit_create(
                                change.config,
                                None
                                if is_organization(auth_subject)
                                else organization.id,
                                meter_ids,
                            ),
                            auth_subject,
                        )
                        await repository.update(
                            benefit,
                            update_dict={"external_id": change.config.external_id},
                        )
                except IntegrityError as e:
                    if _constraint_name(e) != _BENEFIT_EXTERNAL_ID_INDEX:
                        raise
                    raise ConfigBenefitConflict() from e
            elif change.update_dict:
                await benefit_service.update(
                    session,
                    redis,
                    benefit,
                    benefits.benefit_update(change, meter_ids),
                    auth_subject,
                )
            benefit_ids[change.config.external_id] = benefit.id
            results.append(
                ConfigResult(
                    resource=ConfigResource.benefit,
                    external_id=change.config.external_id,
                    action=change.action,
                )
            )
        return results, benefit_ids

    async def _apply_products(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        changes: Sequence[ProductChange],
        meter_ids: dict[str, UUID],
        benefit_ids: dict[str, UUID],
    ) -> list[ConfigResult]:
        repository = ProductRepository.from_session(session)
        external_ids = {
            str(id): external_id
            for ids in (meter_ids, benefit_ids)
            for external_id, id in ids.items()
        }
        results: list[ConfigResult] = []
        for change in changes:
            config = change.config
            product = change.existing
            try:
                if product is None:
                    try:
                        async with session.begin_nested():
                            product = await product_service.create(
                                session,
                                products.product_create(
                                    config,
                                    None
                                    if is_organization(auth_subject)
                                    else organization.id,
                                    meter_ids,
                                ),
                                auth_subject,
                            )
                            await repository.update(
                                product, update_dict={"external_id": config.external_id}
                            )
                    except IntegrityError as e:
                        if _constraint_name(e) != _PRODUCT_EXTERNAL_ID_INDEX:
                            raise
                        raise ConfigProductConflict() from e
                elif change.update_dict.keys() - {"benefits"}:
                    product = await product_service.update(
                        session,
                        product,
                        products.product_update(
                            change, product, meter_ids, external_ids
                        ),
                        auth_subject,
                    )
                if (change.existing is None and config.benefits) or (
                    "benefits" in change.update_dict
                ):
                    await product_service.update_benefits(
                        session,
                        product,
                        [benefit_ids[benefit] for benefit in config.benefits],
                        auth_subject,
                    )
            except PolarRequestValidationError as e:
                raise products.product_error(e, change.index, external_ids) from e
            results.append(
                ConfigResult(
                    resource=ConfigResource.product,
                    external_id=config.external_id,
                    action=change.action,
                )
            )
        return results


declarative_config = DeclarativeConfigService()
