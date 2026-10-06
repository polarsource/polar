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
    ConfigAction,
    ConfigApplyResult,
    ConfigIssue,
    ConfigMeterResult,
    ConfigValidation,
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


class ConfigMeterLocked(PolarError):
    def __init__(self, errors: list[ConfigIssue]) -> None:
        super().__init__(
            "Some meters can't be updated because they're already aggregating events.",
            409,
        )
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
        result = await validation.check(session, organization, config, for_update=True)
        if result.errors:
            raise ConfigMeterLocked(result.errors)

        meters = await self._apply_meters(session, organization, result.meter_changes)
        return ConfigApplyResult(meters=meters)

    async def validate(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        config: Config,
    ) -> ConfigValidation:
        organization = await self._get_organization(
            session, auth_subject, config, OrganizationPermission.products_read
        )
        result = await validation.check(session, organization, config, for_update=False)
        return ConfigValidation(issues=result.issues)

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
                action = ConfigAction.created
            elif change.update_dict:
                await repository.update(change.meter, update_dict=change.update_dict)
                action = ConfigAction.updated
            else:
                action = ConfigAction.unchanged
            results.append(
                ConfigMeterResult(external_id=change.config.external_id, action=action)
            )
        return results


declarative_config = DeclarativeConfigService()
