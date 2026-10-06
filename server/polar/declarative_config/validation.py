from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from typing import Any

from polar.event_type.repository import EventTypeRepository
from polar.meter.filter import Filter, FilterOperator
from polar.meter.repository import MeterRepository
from polar.meter.schemas import MeterCreateBase
from polar.meter.service import METER_LOCKED_FIELD_MESSAGE, METER_LOCKED_FIELDS
from polar.models import Meter, Organization
from polar.postgres import AsyncSession

from .schemas import Config, ConfigIssue, ConfigIssueSeverity, ConfigMeter

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


@dataclass
class ConfigCheck:
    meter_changes: list[MeterChange]
    issues: list[ConfigIssue]

    @property
    def errors(self) -> list[ConfigIssue]:
        return [
            issue
            for issue in self.issues
            if issue.severity == ConfigIssueSeverity.error
        ]


@dataclass
class RuleContext:
    session: AsyncSession
    organization: Organization
    config: Config
    meter_changes: list[MeterChange]


Rule = Callable[[RuleContext], Awaitable[list[ConfigIssue]]]


def _meter_loc(index: int, *path: str | int) -> Loc:
    return ["body", "meters", index, *path]


async def locked_meter_fields(context: RuleContext) -> list[ConfigIssue]:
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.error,
            type="meter_locked",
            loc=_meter_loc(change.index, field),
            msg=METER_LOCKED_FIELD_MESSAGE,
            input=None,
        )
        for change in context.meter_changes
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
        ):
            references.append((clause.value, [*clause_loc, "value"]))
    return references


async def unknown_events(context: RuleContext) -> list[ConfigIssue]:
    references = [
        reference
        for index, meter in enumerate(context.config.meters)
        for reference in _event_name_references(
            meter.filter, _meter_loc(index, "filter")
        )
    ]
    if not references:
        return []
    repository = EventTypeRepository.from_session(context.session)
    known = await repository.get_by_names_and_organization(
        sorted({name for name, _ in references}), context.organization.id
    )
    return [
        ConfigIssue(
            severity=ConfigIssueSeverity.warning,
            type="unknown_event",
            loc=loc,
            msg=f'No "{name}" events have been received yet',
            input=name,
        )
        for name, loc in references
        if (context.organization.id, name) not in known
    ]


RULES: list[Rule] = [locked_meter_fields, unknown_events]


def _get_meter_update_dict(meter: Meter, meter_config: ConfigMeter) -> dict[str, Any]:
    update_dict: dict[str, Any] = {}
    for field in _METER_FIELDS:
        value = getattr(meter_config, field)
        if getattr(meter, field) != value:
            update_dict[field] = value
    if (
        "metadata" in meter_config.model_fields_set
        and meter.user_metadata != meter_config.metadata
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
        update_dict = (
            {} if meter is None else _get_meter_update_dict(meter, meter_config)
        )
        changes.append(MeterChange(index, meter_config, meter, update_dict))
    return changes


async def check(
    session: AsyncSession,
    organization: Organization,
    config: Config,
    *,
    for_update: bool,
) -> ConfigCheck:
    meter_changes = await diff_meters(
        session, organization, config.meters, for_update=for_update
    )
    context = RuleContext(session, organization, config, meter_changes)
    issues = [issue for rule in RULES for issue in await rule(context)]
    return ConfigCheck(meter_changes, issues)
