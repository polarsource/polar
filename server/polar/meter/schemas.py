from datetime import datetime
from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field, model_validator

from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
)
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.meter.aggregation import Aggregation
from polar.meter.filter import Filter
from polar.meter.unit import MeterUnit
from polar.organization.schemas import OrganizationID

NAME_DESCRIPTION = (
    "The name of the meter. Will be shown on customer's invoices and usage."
)
_filter_description = (
    "The filter to apply on events that'll be used to calculate the meter."
)
_aggregation_description = (
    "The aggregation to apply on the filtered events to calculate the meter."
)


class MeterCreate(Schema, MetadataInputMixin):
    name: str = Field(..., description=NAME_DESCRIPTION, min_length=3)
    unit: MeterUnit = Field(
        default=MeterUnit.scalar,
        description="The unit of the meter.",
    )
    custom_label: str | None = Field(
        None,
        description=(
            "The label for the custom unit, e.g. 'request'. "
            "Required when unit is 'custom'."
        ),
    )
    custom_multiplier: int | None = Field(
        None,
        description=(
            "The multiplier to convert from the base unit to display scale, "
            "e.g. 1000 to display per 1000 units. "
            "Defaults to 1 when not provided."
        ),
        gt=0,
    )
    filter: Filter = Field(..., description=_filter_description)
    aggregation: Aggregation = Field(..., description=_aggregation_description)
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the meter. "
            "**Required unless you use an organization token.**"
        ),
    )

    @model_validator(mode="after")
    def validate_custom_unit_fields(self) -> "MeterCreate":
        if self.unit == MeterUnit.custom:
            if self.custom_label is None:
                raise ValueError("custom_label is required when unit is 'custom'.")
        else:
            if self.custom_label is not None:
                raise ValueError(
                    "custom_label and custom_multiplier are only allowed when unit is 'custom'."
                )
        return self


class MeterUpdate(Schema, MetadataInputMixin):
    name: str | None = Field(None, description=NAME_DESCRIPTION, min_length=3)
    unit: MeterUnit | None = Field(None, description="The unit of the meter.")
    custom_label: str | None = Field(
        None,
        description=("The label for the custom unit. Required when unit is 'custom'."),
    )
    custom_multiplier: int | None = Field(
        None,
        description=(
            "The multiplier to convert from base unit to display scale. "
            "Required when unit is 'custom'."
        ),
        gt=0,
    )
    filter: Filter | None = Field(None, description=_filter_description)
    aggregation: Aggregation | None = Field(None, description=_aggregation_description)
    is_archived: bool | None = Field(
        None,
        description=(
            "Whether the meter is archived. "
            "Archived meters are no longer used for billing."
        ),
    )


class Meter(IDSchema, TimestampedSchema, MetadataOutputMixin):
    name: str = Field(..., description=NAME_DESCRIPTION)
    unit: MeterUnit = Field(..., description="The unit of the meter.")
    custom_label: str | None = Field(
        None,
        description="The label for the custom unit.",
    )
    custom_multiplier: int | None = Field(
        None,
        description="The multiplier to convert from base unit to display scale.",
    )
    filter: Filter = Field(..., description=_filter_description)
    aggregation: Aggregation = Field(..., description=_aggregation_description)
    organization_id: UUID4 = Field(
        ..., description="The ID of the organization owning the meter."
    )
    archived_at: datetime | None = Field(
        None, description="Whether the meter is archived and the time it was archived."
    )


MeterID = Annotated[UUID4, Path(description="The meter ID.")]


class MeterQuantity(Schema):
    timestamp: datetime = Field(description="The timestamp for the current period.")
    quantity: float = Field(
        description="The quantity for the current period.", examples=[10.0]
    )


class MeterQuantities(Schema):
    quantities: list[MeterQuantity]
    total: float = Field(
        description="The total quantity for the period.", examples=[100.0]
    )
