from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError, create_model
from sqlalchemy.exc import IntegrityError

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.exceptions import PolarError
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import Organization, User
from polar.organization.resolver import OrganizationIDModel, get_payload_organization
from polar.postgres import AsyncReadSession, AsyncSession

from . import validation
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
from .validation import MeterChange, ResourceChange

_METER_EXTERNAL_ID_INDEX = "ix_meters_organization_id_external_id"


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
        auth_subject: AuthSubject[User | Organization],
        config: Config,
    ) -> ConfigApplyResult:
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

        meters = await self._apply_meters(session, organization, changes.meters)
        return ConfigApplyResult(changes=meters)

    async def plan(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        config: Config,
    ) -> ConfigPlan:
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
                    ConfigSkippedMeter(id=meter.id, name=meter.name, reason=reason)
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
    ) -> list[ConfigResult]:
        repository = MeterRepository.from_session(session)
        results: list[ConfigResult] = []
        for change in changes:
            if change.existing is None:
                try:
                    async with session.begin_nested():
                        await meter_service.create_for_organization(
                            session, organization, change.config
                        )
                except IntegrityError as e:
                    database_error = getattr(e.orig, "__cause__", None)
                    constraint_name = getattr(database_error, "constraint_name", None)
                    if constraint_name != _METER_EXTERNAL_ID_INDEX:
                        raise
                    raise ConfigMeterConflict() from e
            elif change.update_dict:
                await repository.update(change.existing, update_dict=change.update_dict)
            results.append(
                ConfigResult(
                    resource=ConfigResource.meter,
                    external_id=change.config.external_id,
                    action=change.action,
                )
            )
        return results


declarative_config = DeclarativeConfigService()
