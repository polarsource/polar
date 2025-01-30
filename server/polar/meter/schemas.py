from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field

from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
    OptionalMetadataInputMixin,
)
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.meter.aggregation import Aggregation
from polar.meter.filter import Filter
from polar.organization.schemas import OrganizationID

_name_description = (
    "The name of the meter. Will be shown on customer's invoices and usage."
)
_filter_description = (
    "The filter to apply on events that'll be used to calculate the meter."
)
_aggregation_description = (
    "The aggregation to apply on the filtered events to calculate the meter."
)


class MeterCreate(Schema, MetadataInputMixin):
    name: str = Field(..., description=_name_description, min_length=3)
    filter: Filter = Field(..., description=_filter_description)
    aggregation: Aggregation = Field(..., description=_aggregation_description)
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the meter. "
            "**Required unless you use an organization token.**"
        ),
    )


class MeterUpdate(Schema, OptionalMetadataInputMixin):
    name: str | None = Field(None, description=_name_description, min_length=3)
    filter: Filter | None = Field(None, description=_filter_description)
    aggregation: Aggregation | None = Field(None, description=_aggregation_description)


class Meter(IDSchema, TimestampedSchema, MetadataOutputMixin):
    name: str = Field(..., description=_name_description)
    filter: Filter = Field(..., description=_filter_description)
    aggregation: Aggregation = Field(..., description=_aggregation_description)
    organization_id: UUID4 = Field(
        ..., description="The ID of the organization owning the meter."
    )


MeterID = Annotated[UUID4, Path(description="The meter ID.")]
