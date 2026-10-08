from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError, create_model
from sqlalchemy.exc import IntegrityError

from polar.auth.models import AuthSubject, is_organization
from polar.auth.permission import OrganizationPermission
from polar.auth.scope import Scope
from polar.authz.service import assert_organization_permission
from polar.benefit.repository import BenefitRepository
from polar.benefit.service import benefit as benefit_service
from polar.exceptions import PolarError
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import Organization, User
from polar.oauth2.exceptions import InsufficientScopeError
from polar.organization.resolver import OrganizationIDModel, get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession
from polar.redis import Redis

from . import benefits, validation
from .schemas import (
    MAXIMUM_METERS,
    Config,
    ConfigApplyResult,
    ConfigChange,
    ConfigExport,
    ConfigExportDocument,
    ConfigExportMeter,
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigMeter,
    ConfigPlan,
    ConfigResource,
    ConfigResult,
    ConfigSkippedMeter,
    ConfigSkippedReason,
)
from .validation import BenefitChange, MeterChange, ResourceChange

_METER_EXTERNAL_ID_INDEX = "ix_meters_organization_id_external_id"
_BENEFIT_EXTERNAL_ID_INDEX = "ix_benefits_organization_id_external_id"


def _assert_section_scopes(
    auth_subject: AuthSubject[User | Organization], config: Config, *, write: bool
) -> None:
    if "benefits" not in config.model_fields_set:
        return
    required = (
        {Scope.benefits_write} if write else {Scope.benefits_read, Scope.benefits_write}
    )
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

        meters, meter_ids = await self._apply_meters(
            session, organization, changes.meters
        )
        benefits = await self._apply_benefits(
            session, redis, auth_subject, organization, changes.benefits, meter_ids
        )
        return ConfigApplyResult(changes=[*meters, *benefits])

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
        organization = await self._get_organization(
            session,
            auth_subject,
            _OrganizationTarget(organization_id),
            OrganizationPermission.products_read,
        )
        repository = MeterRepository.from_session(session)
        meters: list[ConfigExportMeter] = []
        skipped: list[ConfigSkippedMeter] = []
        statement = repository.get_organization_statement(organization.id)
        async for meter in repository.stream(statement):
            reason: ConfigSkippedReason | None = None
            if meter.external_id is None:
                reason = ConfigSkippedReason.missing_external_id
            elif meter.archived_at is not None:
                reason = ConfigSkippedReason.archived
            elif len(meters) >= MAXIMUM_METERS:
                reason = ConfigSkippedReason.over_limit
            else:
                try:
                    meter_config = ConfigMeter(
                        external_id=meter.external_id,
                        name=meter.name,
                        unit=meter.unit,
                        custom_label=meter.custom_label,
                        custom_multiplier=meter.custom_multiplier,
                        filter=meter.filter,
                        aggregation=meter.aggregation,
                        metadata=meter.user_metadata,
                    )
                except ValidationError:
                    reason = ConfigSkippedReason.invalid
                else:
                    meters.append(
                        ConfigExportMeter.model_validate(
                            meter_config, from_attributes=True
                        )
                    )
            if reason is not None:
                skipped.append(
                    ConfigSkippedMeter(
                        resource=ConfigResource.meter,
                        id=meter.id,
                        name=meter.name,
                        reason=reason,
                    )
                )
        return ConfigExport(config=ConfigExportDocument(meters=meters), skipped=skipped)

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
    ) -> list[ConfigResult]:
        repository = BenefitRepository.from_session(session)
        results: list[ConfigResult] = []
        for change in changes:
            if change.existing is None:
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
                    change.existing,
                    benefits.benefit_update(change, meter_ids),
                    auth_subject,
                )
            results.append(
                ConfigResult(
                    resource=ConfigResource.benefit,
                    external_id=change.config.external_id,
                    action=change.action,
                )
            )
        return results


declarative_config = DeclarativeConfigService()
