from enum import StrEnum
from typing import Literal

from pydantic import ConfigDict, Field, field_validator

from polar.enums import TaxBehaviorOption
from polar.kit.currency import PresentmentCurrency
from polar.kit.schemas import Schema
from polar.meter.schemas import MeterCreateBase
from polar.models.organization import (
    OrganizationCustomerEmailSettings,
    OrganizationCustomerPortalSettings,
    OrganizationSubscriptionSettings,
)
from polar.organization.schemas import (
    DEFAULT_PRESENTMENT_CURRENCY_DESCRIPTION,
    DEFAULT_TAX_BEHAVIOR_DESCRIPTION,
    OrganizationID,
)

MAXIMUM_METERS = 100

ConfigVersion = Literal[1]


class ConfigOrganization(Schema):
    model_config = ConfigDict(extra="forbid")

    default_presentment_currency: PresentmentCurrency | None = Field(
        None, description=DEFAULT_PRESENTMENT_CURRENCY_DESCRIPTION
    )
    default_tax_behavior: TaxBehaviorOption | None = Field(
        None, description=DEFAULT_TAX_BEHAVIOR_DESCRIPTION
    )
    subscription_settings: OrganizationSubscriptionSettings | None = None
    customer_email_settings: OrganizationCustomerEmailSettings | None = None
    customer_portal_settings: OrganizationCustomerPortalSettings | None = None


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
    organization: ConfigOrganization | None = Field(
        default=None,
        description=(
            "Organization settings to update. Only the settings present are changed."
        ),
    )
    meters: list[ConfigMeter] | None = Field(
        default=None,
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
        cls, value: list[ConfigMeter] | None
    ) -> list[ConfigMeter] | None:
        if value is None:
            return value
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
    organization = "organization"
    meters = "meters"


class ConfigAction(StrEnum):
    created = "created"
    updated = "updated"
    unchanged = "unchanged"


class ConfigApplyResourceResult(Schema):
    section: ConfigSection = Field(description="Config section of the resource.")
    key: str | None = Field(
        description="The resource's `external_id`, or `null` for singleton sections."
    )
    action: ConfigAction = Field(description="What applying the config did.")


class ConfigApplyResult(Schema):
    version: ConfigVersion = Field(description="Version of the applied config schema.")
    results: list[ConfigApplyResourceResult]
