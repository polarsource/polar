from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from polar.event.system import SystemEvent
from polar.event_type.repository import EventTypeRepository
from polar.meter.filter import Filter, FilterOperator
from polar.meter.repository import MeterRepository
from polar.meter.schemas import MeterCreateBase
from polar.meter.service import METER_LOCKED_FIELD_MESSAGE, METER_LOCKED_FIELDS
from polar.models import Meter, Organization
from polar.postgres import AsyncSession

from .schemas import (
    Config,
    ConfigAction,
    ConfigFieldChange,
    ConfigIssue,
    ConfigIssueSeverity,
    ConfigIssueType,
    ConfigMeter,
)

Loc = list[str | int]

_METER_FIELDS = tuple(
    field for field in MeterCreateBase.model_fields if field != "metadata"
)


@dataclass
class MeterChange:
    index: int
    config: ConfigMeter
    meter: Meter | None
    update_dict: dict[str, Any]

    @property
    def action(self) -> ConfigAction:
        if self.meter is None:
            return ConfigAction.created
        if self.update_dict:
            return ConfigAction.updated
        return ConfigAction.unchanged

    @property
    def diff(self) -> list[ConfigFieldChange]:
        return [
            ConfigFieldChange(
                field="metadata" if field == "user_metadata" else field,
                before=None if self.meter is None else getattr(self.meter, field),
                after=after,
            )
            for field, after in self.update_dict.items()
        ]


def _meter_loc(index: int, *path: str | int) -> Loc:
    return ["body", "meters", index, *path]


def unique_external_ids(changes: list[MeterChange]) -> list[ConfigIssue]:
    seen: set[str] = set()
    issues: list[ConfigIssue] = []
    for change in changes:
        external_id = change.config.external_id
        if external_id in seen:
            issues.append(
                ConfigIssue(
                    severity=ConfigIssueSeverity.error,
                    type=ConfigIssueType.duplicate_external_id,
                    loc=_meter_loc(change.index, "external_id"),
                    msg="Another meter in this config has the same external_id.",
                    input=external_id,
                )
            )
        seen.add(external_id)
    return issues


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
        if change.meter is not None and change.meter.last_billed_event_id is not None
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


async def check(
    session: AsyncSession,
    organization: Organization,
    config: Config,
    *,
    for_update: bool,
) -> tuple[list[MeterChange], list[ConfigIssue]]:
    changes = await diff_meters(
        session, organization, config.meters, for_update=for_update
    )
    issues = [
        *unique_external_ids(changes),
        *locked_meter_fields(changes),
        *await unknown_events(session, organization, changes),
    ]
    return changes, issues
