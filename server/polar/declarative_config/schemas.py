from collections.abc import Iterable
from enum import StrEnum
from typing import Any, Literal, NamedTuple

from pydantic import ConfigDict, Field, field_validator

from polar.kit.schemas import Schema
from polar.meter.schemas import MeterCreateBase
from polar.organization.schemas import OrganizationID

MAXIMUM_METERS = 100


class DuplicateExternalID(NamedTuple):
    position: int
    external_id: str
    first_index: int


def duplicate_external_ids(items: Iterable[Any]) -> list[DuplicateExternalID]:
    seen: dict[str, int] = {}
    duplicates: list[DuplicateExternalID] = []
    for index, item in enumerate(items):
        external_id = getattr(item, "external_id", None)
        if external_id is None:
            continue
        if external_id in seen:
            duplicates.append(
                DuplicateExternalID(index, external_id, seen[external_id])
            )
        else:
            seen[external_id] = index
    return duplicates


class ConfigMeter(MeterCreateBase):
    model_config = ConfigDict(extra="forbid")

    external_id: str = Field(
        ...,
        min_length=1,
        description=(
            "Your identifier for the meter. "
            "Used to match the config entry with an existing meter."
        ),
    )


class Config(Schema):
    model_config = ConfigDict(extra="forbid")

    meters: list[ConfigMeter] = Field(
        max_length=MAXIMUM_METERS,
        description=(
            "Meters to create or update, matched by `external_id`. "
            "Omitted fields are set to their default, except `metadata`, "
            "which is left untouched when omitted. "
            "Existing meters that aren't listed are left untouched, "
            "and archived meters stay archived."
        ),
    )
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization to apply the config to. "
            "**Required unless you use an organization token.**"
        ),
    )

    @field_validator("meters")
    @classmethod
    def validate_unique_external_ids(
        cls, value: list[ConfigMeter]
    ) -> list[ConfigMeter]:
        duplicates = {
            duplicate.external_id for duplicate in duplicate_external_ids(value)
        }
        if duplicates:
            raise ValueError(
                f"Duplicate external_id values: {', '.join(sorted(duplicates))}."
            )
        return value


class ConfigEntryError(Schema):
    loc: list[str | int] = Field(
        description="Location of the blocked value in the request body."
    )
    msg: str = Field(description="Why the value can't be applied.")


class ConfigAction(StrEnum):
    created = "created"
    updated = "updated"
    unchanged = "unchanged"


class ConfigMeterResult(Schema):
    external_id: str = Field(description="The meter's `external_id`.")
    action: ConfigAction = Field(description="What applying the config did.")


class ConfigApplyResult(Schema):
    meters: list[ConfigMeterResult]


class ConfigOrganization(Schema):
    organization_id: OrganizationID | None = None


IssueSeverity = Literal["error", "warning"]


class ConfigIssue(Schema):
    severity: IssueSeverity
    code: str = Field(description="Machine-readable reason, e.g. `literal_error`.")
    path: list[str | int] = Field(
        description="Location of the issue in the config, as a JSON path."
    )
    message: str
    got: Any | None = Field(description="The value found at the path, if any.")


class ConfigValidation(Schema):
    issues: list[ConfigIssue]
