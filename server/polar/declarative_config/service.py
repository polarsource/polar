from collections.abc import Sequence
from typing import Literal

from pydantic import BaseModel, Field, create_model
from sqlalchemy.exc import IntegrityError

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.exceptions import PolarError
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import Organization, User
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession

from . import validation
from .schemas import (
    Config,
    ConfigApplyResult,
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigMeterChange,
    ConfigMeterResult,
    ConfigPlan,
)
from .validation import MeterChange

_METER_EXTERNAL_ID_INDEX = "ix_meters_organization_id_external_id"


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

        meters = await self._apply_meters(session, organization, changes)
        return ConfigApplyResult(meters=meters)

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
                ConfigMeterChange(
                    external_id=change.config.external_id,
                    action=change.action,
                    diff=change.diff,
                )
                for change in changes
            ],
            issues=issues,
        )

    async def _get_organization(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        config: Config,
        permission: OrganizationPermission,
    ) -> Organization:
        organization = await get_payload_organization(session, auth_subject, config)
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
    ) -> list[ConfigMeterResult]:
        repository = MeterRepository.from_session(session)
        results: list[ConfigMeterResult] = []
        for change in changes:
            if change.meter is None:
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
                await repository.update(change.meter, update_dict=change.update_dict)
            results.append(
                ConfigMeterResult(
                    external_id=change.config.external_id, action=change.action
                )
            )
        return results


declarative_config = DeclarativeConfigService()
