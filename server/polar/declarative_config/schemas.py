from enum import StrEnum
from typing import Any

from pydantic import ConfigDict, Field

from polar.kit.schemas import Schema
from polar.meter.schemas import MeterCreateBase
from polar.organization.schemas import OrganizationID

MAXIMUM_METERS = 100


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


class ConfigIssueSeverity(StrEnum):
    error = "error"
    warning = "warning"


class ConfigIssueType(StrEnum):
    duplicate_external_id = "duplicate_external_id"
    meter_locked = "meter_locked"
    unknown_event = "unknown_event"


class ConfigIssue(Schema):
    severity: ConfigIssueSeverity = Field(
        description="`error` blocks applying the config, `warning` doesn't."
    )
    type: ConfigIssueType = Field(description="Machine-readable reason.")
    loc: list[str | int] = Field(
        description="Location of the issue in the request body."
    )
    msg: str = Field(description="Human-readable description of the issue.")
    input: Any | None = Field(description="The value at `loc`, if relevant.")


class ConfigAction(StrEnum):
    created = "created"
    updated = "updated"
    unchanged = "unchanged"


class ConfigMeterResult(Schema):
    external_id: str = Field(description="The meter's `external_id`.")
    action: ConfigAction = Field(description="What applying the config does.")


class ConfigApplyResult(Schema):
    meters: list[ConfigMeterResult]


class ConfigFieldChange(Schema):
    field: str = Field(description="Name of the changed field.")
    before: Any | None = Field(description="Current value, `None` on create.")
    after: Any | None = Field(description="Value after applying the config.")


class ConfigMeterChange(ConfigMeterResult):
    diff: list[ConfigFieldChange] = Field(
        description=(
            "Fields that applying the config changes. "
            "On create, fields left empty are omitted."
        )
    )


class ConfigPlan(Schema):
    changes: list[ConfigMeterChange]
    issues: list[ConfigIssue]
