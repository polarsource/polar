from datetime import datetime
from typing import Annotated, Self

from fastapi import Path
from pydantic import UUID4, AwareDatetime, Field, model_validator
from pydantic_extra_types.timezone_name import TimeZoneName

from polar.customer.schemas.customer import CustomerID
from polar.kit.external_id import ExternalIDInputMixin, ExternalIDOutputMixin
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
)
from polar.kit.schemas import IDSchema, MultipleQueryFilter, Schema, TimestampedSchema
from polar.kit.time_queries import MIN_DATETIME, TimeInterval
from polar.kit.versioning import QuerySchema, Version
from polar.meter.aggregation import Aggregation, AggregationFunction
from polar.meter.filter import Filter
from polar.meter.unit import MeterUnit
from polar.openapi import destructive_when_equals
from polar.organization.schemas import OrganizationID
from polar.version import V2027_01

NAME_DESCRIPTION = (
    "The name of the meter. Will be shown on customer's invoices and usage."
)
_filter_description = (
    "The filter to apply on events that'll be used to calculate the meter."
)
_aggregation_description = (
    "The aggregation to apply on the filtered events to calculate the meter."
)


class MeterCreateBase(Schema, MetadataInputMixin):
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

    @model_validator(mode="after")
    def validate_custom_unit_fields(self) -> Self:
        if self.unit == MeterUnit.custom:
            if self.custom_label is None:
                raise ValueError("custom_label is required when unit is 'custom'.")
        else:
            if self.custom_label is not None:
                raise ValueError(
                    "custom_label and custom_multiplier are only allowed when unit is 'custom'."
                )
        return self


class MeterCreate(MeterCreateBase, ExternalIDInputMixin):
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the meter. "
            "**Required unless you use an organization token.**"
        ),
    )


class MeterUpdate(Schema, MetadataInputMixin, ExternalIDInputMixin):
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
        json_schema_extra=destructive_when_equals(True),
        description=(
            "Whether the meter is archived. "
            "Archived meters are no longer used for billing."
        ),
    )


class Meter(IDSchema, TimestampedSchema, MetadataOutputMixin, ExternalIDOutputMixin):
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


class MeterListParams(QuerySchema):
    organization_id: MultipleQueryFilter[OrganizationID] | None = Field(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    )
    external_id: Annotated[
        MultipleQueryFilter[str] | None, Version(starting_from=V2027_01)
    ] = Field(
        None, title="ExternalID Filter", description="Filter by meter external ID."
    )
    query: str | None = Field(None, description="Filter by name.")
    is_archived: bool | None = Field(None, description="Filter on archived meters.")


class MeterQuantitiesParams(QuerySchema):
    start_timestamp: AwareDatetime = Field(
        ...,
        description="Start timestamp.",
        ge=MIN_DATETIME,
    )
    end_timestamp: AwareDatetime = Field(..., description="End timestamp.")
    interval: TimeInterval = Field(..., description="Interval between two timestamps.")
    timezone: TimeZoneName = Field(
        default=TimeZoneName("UTC"),
        description="Timezone to use for the timestamps. Default is UTC.",
    )
    customer_id: MultipleQueryFilter[CustomerID] | None = Field(
        None, title="CustomerID Filter", description="Filter by customer ID."
    )
    external_customer_id: MultipleQueryFilter[str] | None = Field(
        None,
        title="ExternalCustomerID Filter",
        description="Filter by external customer ID.",
    )
    customer_aggregation_function: AggregationFunction | None = Field(
        None,
        description=(
            "If set, will first compute the quantities per customer before aggregating "
            "them using the given function. "
            "If not set, the quantities will be aggregated across all events."
        ),
    )
