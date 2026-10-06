from enum import StrEnum
from typing import Literal

from pydantic import Field, field_validator

from polar.kit.schemas import Schema
from polar.meter.schemas import Meter, MeterCreateBase
from polar.organization.schemas import OrganizationID

MAXIMUM_METERS = 100

BillingConfigVersion = Literal[1]


class MeterConfig(MeterCreateBase):
    external_id: str = Field(
        ...,
        min_length=1,
        description=(
            "Your identifier for the meter. "
            "Used to match the config entry with an existing meter."
        ),
    )


class BillingConfig(Schema):
    version: BillingConfigVersion = Field(
        description="Version of the billing config schema."
    )
    meters: list[MeterConfig] = Field(
        default_factory=list,
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
        cls, value: list[MeterConfig]
    ) -> list[MeterConfig]:
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


class BillingConfigAction(StrEnum):
    created = "created"
    updated = "updated"
    unchanged = "unchanged"


class MeterConfigResult(Schema):
    external_id: str = Field(description="The external ID from the config entry.")
    action: BillingConfigAction = Field(
        description="What applying the config did to the meter."
    )
    meter: Meter


class BillingConfigApplyResult(Schema):
    version: BillingConfigVersion = Field(
        description="Version of the billing config schema that was applied."
    )
    meters: list[MeterConfigResult]
