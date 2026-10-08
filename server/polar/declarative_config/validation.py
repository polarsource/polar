from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from polar.event.system import SystemEvent
from polar.event_type.repository import EventTypeRepository
from polar.meter.filter import Filter, FilterOperator
from polar.meter.repository import MeterRepository
from polar.meter.schemas import MeterCreateBase
from polar.meter.service import METER_LOCKED_FIELD_MESSAGE, METER_LOCKED_FIELDS
from polar.models import Benefit, Meter, Organization, Product
from polar.postgres import AsyncSession

from .schemas import (
    Config,
    ConfigAction,
    ConfigBenefit,
    ConfigBenefitMeterCredit,
    ConfigFieldChange,
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigIssueType,
    ConfigMeter,
    ConfigProduct,
    ConfigProductPriceMeteredUnit,
    ConfigResource,
)

Loc = list[str | int]

_METER_FIELDS = tuple(
    field for field in MeterCreateBase.model_fields if field != "metadata"
)


@dataclass
class ResourceChange[ConfigT, ModelT]:
    index: int
    config: ConfigT
    existing: ModelT | None
    update_dict: dict[str, Any]

    @property
    def action(self) -> ConfigAction:
        if self.existing is None:
            return ConfigAction.created
        if self.update_dict:
            return ConfigAction.updated
        return ConfigAction.unchanged

    @property
    def diff(self) -> list[ConfigFieldChange]:
        return [
            ConfigFieldChange(
                field="metadata" if field == "user_metadata" else field,
                before=None if self.existing is None else getattr(self.existing, field),
                after=after,
            )
            for field, after in self.update_dict.items()
        ]


MeterChange = ResourceChange[ConfigMeter, Meter]
BenefitChange = ResourceChange[ConfigBenefit, Benefit]
ProductChange = ResourceChange[ConfigProduct, Product]


@dataclass
class ConfigChanges:
    meters: list[MeterChange]
    benefits: list[BenefitChange]
    products: list[ProductChange]


def _loc(resource: ConfigResource, index: int, *path: str | int) -> Loc:
    return ["body", f"{resource}s", index, *path]


def _meter_loc(index: int, *path: str | int) -> Loc:
    return _loc(ConfigResource.meter, index, *path)


def unique_external_ids(
    resource: ConfigResource, changes: Sequence[ResourceChange[Any, Any]]
) -> list[ConfigIssue]:
    seen: set[str] = set()
    issues: list[ConfigIssue] = []
    for change in changes:
        external_id = change.config.external_id
        if external_id in seen:
            issues.append(
                ConfigIssue(
                    severity=ConfigIssueSeverity.error,
                    type=ConfigIssueType.duplicate_external_id,
                    loc=_loc(resource, change.index, "external_id"),
                    msg=f"Another {resource} in this config has the same external_id.",
                    input=external_id,
                )
            )
        seen.add(external_id)
    return issues


def _unknown_reference(
    resource: ConfigResource, external_id: str, loc: Loc
) -> ConfigIssue:
    return ConfigIssue(
        severity=ConfigIssueSeverity.error,
        type=ConfigIssueType.unknown_reference,
        loc=loc,
        msg=f"No {resource} in this config has this external_id.",
        input=external_id,
    )


def unknown_references(config: Config) -> list[ConfigIssue]:
    meters = {meter.external_id for meter in config.meters}
    benefits = {benefit.external_id for benefit in config.benefits}
    issues: list[ConfigIssue] = []
    for index, benefit in enumerate(config.benefits):
        if (
            isinstance(benefit, ConfigBenefitMeterCredit)
            and benefit.properties.meter not in meters
        ):
            issues.append(
                _unknown_reference(
                    ConfigResource.meter,
                    benefit.properties.meter,
                    _loc(ConfigResource.benefit, index, "properties", "meter"),
                )
            )
    for index, product in enumerate(config.products):
        for price_index, price in enumerate(product.prices):
            if (
                isinstance(price, ConfigProductPriceMeteredUnit)
                and price.meter not in meters
            ):
                issues.append(
                    _unknown_reference(
                        ConfigResource.meter,
                        price.meter,
                        _loc(
                            ConfigResource.product,
                            index,
                            "prices",
                            price_index,
                            "meter",
                        ),
                    )
                )
        for benefit_index, benefit_external_id in enumerate(product.benefits):
            if benefit_external_id not in benefits:
                issues.append(
                    _unknown_reference(
                        ConfigResource.benefit,
                        benefit_external_id,
                        _loc(ConfigResource.product, index, "benefits", benefit_index),
                    )
                )
    return issues


def not_supported(
    resource: ConfigResource, changes: Sequence[ResourceChange[Any, Any]]
) -> list[ConfigIssue]:
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.error,
            type=ConfigIssueType.not_supported,
            loc=_loc(resource, change.index),
            msg=f"Applying {resource}s isn't supported yet.",
            input=None,
        )
        for change in changes
    ]


def locked_meter_fields(changes: list[MeterChange]) -> list[ConfigIssue]:
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.error,
            type=ConfigIssueType.meter_locked,
            loc=_meter_loc(change.index, field),
            msg=METER_LOCKED_FIELD_MESSAGE,
            input=None,
        )
        for change in changes
        if change.existing is not None
        and change.existing.last_billed_event_id is not None
        for field in METER_LOCKED_FIELDS
        if field in change.update_dict
    ]


def _event_name_references(filter: Filter, loc: Loc) -> list[tuple[str, Loc]]:
    references: list[tuple[str, Loc]] = []
    for index, clause in enumerate(filter.clauses):
        clause_loc = [*loc, "clauses", index]
        if isinstance(clause, Filter):
            references.extend(_event_name_references(clause, clause_loc))
        elif (
            clause.property == "name"
            and clause.operator == FilterOperator.eq
            and isinstance(clause.value, str)
            and clause.value not in SystemEvent
        ):
            references.append((clause.value, [*clause_loc, "value"]))
    return references


async def unknown_events(
    session: AsyncSession, organization: Organization, changes: list[MeterChange]
) -> list[ConfigIssue]:
    references = [
        reference
        for change in changes
        for reference in _event_name_references(
            change.config.filter, _meter_loc(change.index, "filter")
        )
    ]
    repository = EventTypeRepository.from_session(session)
    known = await repository.get_by_names_and_organization(
        sorted({name for name, _ in references}), organization.id
    )
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.warning,
            type=ConfigIssueType.unknown_event,
            loc=loc,
            msg="No events with this name have been received yet.",
            input=name,
        )
        for name, loc in references
        if (organization.id, name) not in known
    ]


def _get_meter_update_dict(
    meter: Meter | None, meter_config: ConfigMeter
) -> dict[str, Any]:
    update_dict: dict[str, Any] = {}
    for field in _METER_FIELDS:
        value = getattr(meter_config, field)
        if getattr(meter, field, None) != value:
            update_dict[field] = value
    if "metadata" in meter_config.model_fields_set and (
        getattr(meter, "user_metadata", None) != meter_config.metadata
    ):
        update_dict["user_metadata"] = meter_config.metadata
    return update_dict


async def diff_meters(
    session: AsyncSession,
    organization: Organization,
    meter_configs: Sequence[ConfigMeter],
    *,
    for_update: bool,
) -> list[MeterChange]:
    repository = MeterRepository.from_session(session)
    existing_meters = {
        meter.external_id: meter
        for meter in await repository.get_all_by_external_ids(
            organization.id,
            [config.external_id for config in meter_configs],
            for_update=for_update,
        )
    }
    changes: list[MeterChange] = []
    for index, meter_config in enumerate(meter_configs):
        meter = existing_meters.get(meter_config.external_id)
        update_dict = _get_meter_update_dict(meter, meter_config)
        changes.append(MeterChange(index, meter_config, meter, update_dict))
    return changes


def _create_update_dict(config: ConfigBenefit | ConfigProduct) -> dict[str, Any]:
    update_dict: dict[str, Any] = {}
    for field in type(config).model_fields:
        value = getattr(config, field)
        if field == "external_id" or value in (None, [], {}):
            continue
        update_dict["user_metadata" if field == "metadata" else field] = value
    return update_dict


def diff_benefits(benefit_configs: Sequence[ConfigBenefit]) -> list[BenefitChange]:
    return [
        BenefitChange(index, benefit_config, None, _create_update_dict(benefit_config))
        for index, benefit_config in enumerate(benefit_configs)
    ]


def diff_products(product_configs: Sequence[ConfigProduct]) -> list[ProductChange]:
    return [
        ProductChange(index, product_config, None, _create_update_dict(product_config))
        for index, product_config in enumerate(product_configs)
    ]


async def check(
    session: AsyncSession,
    organization: Organization,
    config: Config,
    *,
    for_update: bool,
) -> tuple[ConfigChanges, list[ConfigIssue]]:
    meters = await diff_meters(
        session, organization, config.meters, for_update=for_update
    )
    benefits = diff_benefits(config.benefits)
    products = diff_products(config.products)
    issues = [
        *unique_external_ids(ConfigResource.meter, meters),
        *unique_external_ids(ConfigResource.benefit, benefits),
        *unique_external_ids(ConfigResource.product, products),
        *unknown_references(config),
        *locked_meter_fields(meters),
        *await unknown_events(session, organization, meters),
        *not_supported(ConfigResource.benefit, benefits),
        *not_supported(ConfigResource.product, products),
    ]
    return ConfigChanges(meters, benefits, products), issues
