from collections.abc import Sequence
from typing import Any

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.exceptions import PolarError, PolarRequestValidationError, ValidationError
from polar.meter.repository import MeterRepository
from polar.meter.schemas import Meter as MeterSchema
from polar.meter.service import meter as meter_service
from polar.models import Meter, Organization, User
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession

from .schemas import (
    BillingConfig,
    BillingConfigAction,
    BillingConfigApplyResult,
    MeterConfig,
    MeterConfigResult,
)

_METER_SCALAR_FIELDS = ("name", "unit", "custom_label", "custom_multiplier")
_METER_LOCKED_FIELDS = ("filter", "aggregation")


class BillingConfigNotEnabled(PolarError):
    def __init__(self) -> None:
        super().__init__("Billing config is not enabled for this organization.", 403)


class BillingConfigService:
    async def apply(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        config: BillingConfig,
    ) -> BillingConfigApplyResult:
        organization = await get_payload_organization(session, auth_subject, config)
        await assert_organization_permission(
            session,
            auth_subject,
            organization.id,
            OrganizationPermission.products_manage,
        )
        if not organization.is_billing_config_enabled:
            raise BillingConfigNotEnabled()

        meters = await self._apply_meters(session, organization, config.meters)
        return BillingConfigApplyResult(version=config.version, meters=meters)

    async def _apply_meters(
        self,
        session: AsyncSession,
        organization: Organization,
        meter_configs: Sequence[MeterConfig],
    ) -> list[MeterConfigResult]:
        repository = MeterRepository.from_session(session)
        existing_meters = {
            meter.external_id: meter
            for meter in await repository.get_all_by_external_ids(
                organization.id, [config.external_id for config in meter_configs]
            )
        }

        errors: list[ValidationError] = []
        changes: list[tuple[MeterConfig, Meter | None, dict[str, Any]]] = []
        for index, meter_config in enumerate(meter_configs):
            meter = existing_meters.get(meter_config.external_id)
            if meter is None:
                changes.append((meter_config, None, {}))
                continue

            update_dict = self._get_meter_update_dict(meter, meter_config)
            if meter.last_billed_event_id is not None:
                for field in _METER_LOCKED_FIELDS:
                    if field in update_dict:
                        errors.append(
                            {
                                "type": "forbidden",
                                "loc": ("body", "meters", index, field),
                                "msg": (
                                    "This field can't be updated because the meter "
                                    "is already aggregating events."
                                ),
                                "input": getattr(meter_config, field),
                            }
                        )
            changes.append((meter_config, meter, update_dict))

        if errors:
            raise PolarRequestValidationError(errors)

        results: list[MeterConfigResult] = []
        for meter_config, meter, update_dict in changes:
            if meter is None:
                meter = await meter_service.create_for_organization(
                    session, organization, meter_config
                )
                action = BillingConfigAction.created
            elif update_dict:
                meter = await repository.update(meter, update_dict=update_dict)
                action = BillingConfigAction.updated
            else:
                action = BillingConfigAction.unchanged
            results.append(
                MeterConfigResult(
                    external_id=meter_config.external_id,
                    action=action,
                    meter=MeterSchema.model_validate(meter),
                )
            )
        return results

    def _get_meter_update_dict(
        self, meter: Meter, meter_config: MeterConfig
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


billing_config = BillingConfigService()
