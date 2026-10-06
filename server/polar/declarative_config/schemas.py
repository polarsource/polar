from enum import StrEnum
from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from polar.kit.schemas import Schema
from polar.meter.schemas import MeterCreateBase
from polar.organization.schemas import OrganizationID

MAXIMUM_METERS = 100

ConfigVersion = Literal[1]


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

    version: ConfigVersion = Field(description="Version of the config schema.")
    meters: list[ConfigMeter] = Field(
        max_length=MAXIMUM_METERS,
        description=(
            "Meters to create or update, matched by `external_id`. "
            "Existing meters that aren't listed are left untouched."
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


class ConfigSection(StrEnum):
    meters = "meters"


class ConfigAction(StrEnum):
    created = "created"
    updated = "updated"
    unchanged = "unchanged"


class ConfigApplyResourceResult(Schema):
    section: ConfigSection = Field(description="Config section of the resource.")
    key: str = Field(description="The resource's `external_id`.")
    action: ConfigAction = Field(description="What applying the config did.")


class ConfigApplyResult(Schema):
    version: ConfigVersion = Field(description="Version of the applied config schema.")
    results: list[ConfigApplyResourceResult]
