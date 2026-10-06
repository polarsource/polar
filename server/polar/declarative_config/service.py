from collections.abc import Sequence
from typing import Any, Literal

from pydantic import BaseModel, Field, create_model
from sqlalchemy.exc import IntegrityError

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.exceptions import PolarError
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import Meter, Organization, User
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession

from .schemas import (
    Config,
    ConfigAction,
    ConfigApplyResult,
    ConfigEntryError,
    ConfigMeter,
    ConfigMeterResult,
)

_METER_SCALAR_FIELDS = ("name", "unit", "custom_label", "custom_multiplier")
_METER_LOCKED_FIELDS = ("filter", "aggregation")


class ConfigAsCodeNotEnabled(PolarError):
    def __init__(self) -> None:
        super().__init__("Config as code is not enabled for this organization.", 403)


class ConfigMeterConflict(PolarError):
    def __init__(self) -> None:
        super().__init__(
            "A meter in this config was created by a concurrent request. Retry.", 409
        )


class ConfigMeterLocked(PolarError):
    def __init__(self, errors: list[ConfigEntryError]) -> None:
        super().__init__(
            "Some meters can't be updated because they're already aggregating events.",
            409,
        )
        self.errors = errors

    @property
    def detail(self) -> list[ConfigEntryError]:
        return self.errors

    @classmethod
    def schema(cls) -> type[BaseModel]:
        if cls._schema is None:
            cls._schema = create_model(
                cls.__name__,
                error=(Literal[cls.__name__], Field(examples=[cls.__name__])),
                detail=(list[ConfigEntryError], ...),
            )
        return cls._schema


class DeclarativeConfigService:
    async def apply(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        config: Config,
    ) -> ConfigApplyResult:
        organization = await get_payload_organization(session, auth_subject, config)
        await assert_organization_permission(
            session,
            auth_subject,
            organization.id,
            OrganizationPermission.products_manage,
        )
        if not organization.is_config_as_code_enabled:
            raise ConfigAsCodeNotEnabled()

        meters = await self._apply_meters(session, organization, config.meters)
        return ConfigApplyResult(meters=meters)

    async def _apply_meters(
        self,
        session: AsyncSession,
        organization: Organization,
        meter_configs: Sequence[ConfigMeter],
    ) -> list[ConfigMeterResult]:
        repository = MeterRepository.from_session(session)
        existing_meters = {
            meter.external_id: meter
            for meter in await repository.get_all_by_external_ids(
                organization.id, [config.external_id for config in meter_configs]
            )
        }

        errors: list[ConfigEntryError] = []
        changes: list[tuple[ConfigMeter, Meter | None, dict[str, Any]]] = []
        for index, meter_config in enumerate(meter_configs):
            meter = existing_meters.get(meter_config.external_id)
            if meter is None:
                changes.append((meter_config, None, {}))
                continue

            update_dict = self._get_meter_update_dict(meter, meter_config)
            if meter.last_billed_event_id is not None:
                errors.extend(
                    ConfigEntryError(
                        loc=["body", "meters", index, field],
                        msg=(
                            "This field can't be updated because the meter "
                            "is already aggregating events."
                        ),
                    )
                    for field in _METER_LOCKED_FIELDS
                    if field in update_dict
                )
            changes.append((meter_config, meter, update_dict))

        if errors:
            raise ConfigMeterLocked(errors)

        results: list[ConfigMeterResult] = []
        for meter_config, meter, update_dict in changes:
            if meter is None:
                try:
                    await meter_service.create_for_organization(
                        session, organization, meter_config
                    )
                except IntegrityError as e:
                    raise ConfigMeterConflict() from e
                action = ConfigAction.created
            elif update_dict:
                await repository.update(meter, update_dict=update_dict)
                action = ConfigAction.updated
            else:
                action = ConfigAction.unchanged
            results.append(
                ConfigMeterResult(external_id=meter_config.external_id, action=action)
            )
        return results

    def _get_meter_update_dict(
        self, meter: Meter, meter_config: ConfigMeter
    ) -> dict[str, Any]:
        update_dict: dict[str, Any] = {}
        for field in (*_METER_SCALAR_FIELDS, *_METER_LOCKED_FIELDS):
            value = getattr(meter_config, field)
            if getattr(meter, field) != value:
                update_dict[field] = value
        if (
            "metadata" in meter_config.model_fields_set
            and meter.user_metadata != meter_config.metadata
        ):
            update_dict["user_metadata"] = meter_config.metadata
        return update_dict


declarative_config = DeclarativeConfigService()
