from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field

from polar.customer.schemas.customer import CustomerID
from polar.customer.schemas.customer import CustomerResponse as Customer
from polar.kit.schemas import (
    CUSTOMER_ID_EXAMPLE,
    METER_ID_EXAMPLE,
    IDSchema,
    MultipleQueryFilter,
    Schema,
    TimestampedSchema,
)
from polar.kit.versioning import QuerySchema, Version
from polar.meter.schemas import Meter, MeterID
from polar.organization.schemas import OrganizationID
from polar.version import V2027_01

CustomerMeterID = Annotated[UUID4, Path(description="The customer meter ID.")]


class CustomerMeterBase(TimestampedSchema, IDSchema):
    customer_id: UUID4 = Field(
        description="The ID of the customer.", examples=[CUSTOMER_ID_EXAMPLE]
    )
    meter_id: UUID4 = Field(
        description="The ID of the meter.", examples=[METER_ID_EXAMPLE]
    )
    consumed_units: float = Field(
        description="The number of consumed units.", examples=[25.0]
    )
    credited_units: int = Field(
        description="The number of credited units.", examples=[100]
    )
    balance: float = Field(
        description=(
            "The balance of the meter, "
            "i.e. the difference between credited and consumed units."
        ),
        examples=[75.0],
    )


class CustomerMeter(CustomerMeterBase):
    """An active customer meter, with current consumed and credited units."""

    customer: Customer = Field(description="The customer associated with this meter.")
    meter: Meter = Field(description="The meter associated with this customer.")


class CustomerMeterCreditsCreateBase(Schema):
    units: int = Field(
        gt=0,
        le=1_000_000_000,
        description="The number of units to credit.",
        examples=[100],
    )
    rollover: bool = Field(
        default=False,
        description="Whether unused credits carry over to the next meter period.",
    )
    external_id: str | None = Field(
        default=None,
        min_length=1,
        description=(
            "Your unique identifier for this credit. "
            "Retrying with the same `external_id` doesn't grant the credit twice."
        ),
    )


class CustomerMeterCreditsIDCreate(CustomerMeterCreditsCreateBase):
    """Schema to manually grant credits on a customer meter using Polar IDs."""

    customer_id: UUID4 = Field(
        description="The ID of the customer.", examples=[CUSTOMER_ID_EXAMPLE]
    )
    meter_id: UUID4 = Field(
        description="The ID of the meter.", examples=[METER_ID_EXAMPLE]
    )


class CustomerMeterCreditsExternalIDCreate(CustomerMeterCreditsCreateBase):
    """Schema to manually grant credits on a customer meter using external IDs."""

    external_customer_id: str = Field(
        description="The external ID of the customer.", examples=["usr_1337"]
    )
    external_meter_id: str = Field(
        min_length=1,
        description="The external ID of the meter, as set by config as code.",
        examples=["tool_call"],
    )


CustomerMeterCreditsCreate = (
    CustomerMeterCreditsIDCreate | CustomerMeterCreditsExternalIDCreate
)


class CustomerMeterListParams(QuerySchema):
    organization_id: MultipleQueryFilter[OrganizationID] | None = Field(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    )
    customer_id: MultipleQueryFilter[CustomerID] | None = Field(
        None, title="CustomerID Filter", description="Filter by customer ID."
    )
    external_customer_id: MultipleQueryFilter[str] | None = Field(
        None,
        title="ExternalCustomerID Filter",
        description="Filter by external customer ID.",
    )
    meter_id: MultipleQueryFilter[MeterID] | None = Field(
        None, title="MeterID Filter", description="Filter by meter ID."
    )
    external_meter_id: Annotated[
        MultipleQueryFilter[str] | None, Version(starting_from=V2027_01)
    ] = Field(
        None, title="ExternalMeterID Filter", description="Filter by meter external ID."
    )
