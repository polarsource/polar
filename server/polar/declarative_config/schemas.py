from enum import StrEnum
from typing import Any

from pydantic import ConfigDict, Field, field_validator

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

    @field_validator("meters")
    @classmethod
    def validate_unique_external_ids(
        cls, value: list[ConfigMeter]
    ) -> list[ConfigMeter]:
        seen: set[str] = set()
        duplicates: set[str] = set()
        for meter in value:
            if meter.external_id in seen:
                duplicates.add(meter.external_id)
            seen.add(meter.external_id)
        if duplicates:
            raise ValueError(
                f"Duplicate external_id values: {', '.join(sorted(duplicates))}."
            )
        return value


class ConfigIssueSeverity(StrEnum):
    error = "error"
    warning = "warning"


class ConfigIssue(Schema):
    severity: ConfigIssueSeverity = Field(
        description="`error` blocks applying the config, `warning` doesn't."
    )
    type: str = Field(description="Machine-readable reason, e.g. `meter_locked`.")
    loc: list[str | int] = Field(
        description="Location of the issue in the request body."
    )
    msg: str = Field(description="Human-readable description of the issue.")
    input: Any | None = Field(
        default=None, description="The value at `loc`, if relevant."
    )


class ConfigValidation(Schema):
    issues: list[ConfigIssue]


class ConfigAction(StrEnum):
    created = "created"
    updated = "updated"
    unchanged = "unchanged"


class ConfigMeterResult(Schema):
    external_id: str = Field(description="The meter's `external_id`.")
    action: ConfigAction = Field(description="What applying the config did.")


class ConfigApplyResult(Schema):
    meters: list[ConfigMeterResult]
