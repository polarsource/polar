from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel, ValidationError
from pydantic_core import ErrorDetails

from polar.event_type.repository import EventTypeRepository
from polar.exceptions import PolarRequestValidationError
from polar.models import Organization
from polar.postgres import AsyncSession

from .schemas import (
    MAXIMUM_METERS,
    ConfigIssue,
    ConfigMeter,
    duplicate_external_ids,
)

Path = list[str | int]

SECTIONS: dict[str, type[BaseModel]] = {"meters": ConfigMeter}


@dataclass
class ValidatedConfig:
    raw: dict[str, Any]
    sections: dict[str, list[BaseModel]]
    issues: list[ConfigIssue] = field(default_factory=list)

    @property
    def meters(self) -> list[ConfigMeter]:
        return [m for m in self.sections["meters"] if isinstance(m, ConfigMeter)]

    @property
    def errors(self) -> list[ConfigIssue]:
        return [issue for issue in self.issues if issue.severity == "error"]

    @property
    def is_valid(self) -> bool:
        return not self.errors

    def raise_for_errors(self) -> None:
        if self.is_valid:
            return
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("body", *issue.path),
                    "msg": issue.message,
                    "type": issue.code,
                    "input": issue.got,
                }
                for issue in self.errors
            ]
        )


@dataclass
class RuleContext:
    session: AsyncSession
    organization: Organization
    config: ValidatedConfig


Rule = Callable[[RuleContext], Awaitable[list[ConfigIssue]]]


def _error(code: str, path: Path, message: str, got: Any = None) -> ConfigIssue:
    return ConfigIssue(severity="error", code=code, path=path, message=message, got=got)


def _issue_from_error(error: ErrorDetails, prefix: Path) -> ConfigIssue:
    return _error(
        error["type"],
        [*prefix, *error["loc"]],
        error["msg"],
        error.get("input") if error["loc"] else None,
    )


def _parse_section(
    name: str, model: type[BaseModel], raw: Any
) -> tuple[list[BaseModel], list[ConfigIssue]]:
    if not isinstance(raw, list):
        return [], [_error("list_type", [name], "Input should be a list", raw)]
    if len(raw) > MAXIMUM_METERS:
        return [], [
            _error(
                "too_long",
                [name],
                f"A config can have at most {MAXIMUM_METERS} {name}",
                len(raw),
            )
        ]
    items: list[BaseModel] = []
    issues: list[ConfigIssue] = []
    for index, item in enumerate(raw):
        try:
            items.append(model.model_validate(item))
        except ValidationError as e:
            issues.extend(
                _issue_from_error(error, [name, index]) for error in e.errors()
            )
    return items, issues


def _parse(config: Any) -> ValidatedConfig:
    if not isinstance(config, dict):
        return ValidatedConfig(
            raw={},
            sections={name: [] for name in SECTIONS},
            issues=[_error("dict_type", [], "Config should be an object", config)],
        )
    validated = ValidatedConfig(raw=config, sections={})
    for key in config:
        if key not in SECTIONS:
            validated.issues.append(
                _error("unknown_section", [key], f'Unknown section "{key}"')
            )
    for name, model in SECTIONS.items():
        if name not in config:
            validated.sections[name] = []
            continue
        items, issues = _parse_section(name, model, config[name])
        validated.sections[name] = items
        validated.issues.extend(issues)
    return validated


async def unique_external_ids(context: RuleContext) -> list[ConfigIssue]:
    return [
        _error(
            "duplicate_external_id",
            [name, duplicate.position, "external_id"],
            f'"{duplicate.external_id}" is already used by {name}.{duplicate.first_index}',
            duplicate.external_id,
        )
        for name, items in context.config.sections.items()
        for duplicate in duplicate_external_ids(items)
    ]


def _event_references(value: Any, path: Path) -> list[tuple[str, Path]]:
    if isinstance(value, list):
        return [
            reference
            for index, item in enumerate(value)
            for reference in _event_references(item, [*path, index])
        ]
    if not isinstance(value, dict):
        return []
    if (
        value.get("property") == "name"
        and value.get("operator") == "eq"
        and isinstance(value.get("value"), str)
    ):
        return [(value["value"], [*path, "value"])]
    return [
        reference
        for key, child in value.items()
        for reference in _event_references(child, [*path, key])
    ]


async def unknown_events(context: RuleContext) -> list[ConfigIssue]:
    references = _event_references(context.config.raw, [])
    if not references:
        return []
    repository = EventTypeRepository.from_session(context.session)
    known = await repository.get_by_names_and_organization(
        sorted({name for name, _ in references}), context.organization.id
    )
    return [
        ConfigIssue(
            severity="warning",
            code="unknown_event",
            path=path,
            message=f'No "{name}" events have been received yet',
            got=name,
        )
        for name, path in references
        if (context.organization.id, name) not in known
    ]


RULES: list[Rule] = [unique_external_ids, unknown_events]


async def validate(
    session: AsyncSession, organization: Organization, config: Any
) -> ValidatedConfig:
    validated = _parse(config)
    context = RuleContext(session, organization, validated)
    for rule in RULES:
        validated.issues.extend(await rule(context))
    return validated
