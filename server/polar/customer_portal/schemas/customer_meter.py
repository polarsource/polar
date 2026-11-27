from pydantic import Field

from polar.customer_meter.schemas import CustomerMeterBase
from polar.kit.schemas import IDSchema, MultipleQueryFilter, TimestampedSchema
from polar.kit.versioning import QuerySchema
from polar.meter.schemas import NAME_DESCRIPTION as METER_NAME_DESCRIPTION
from polar.meter.schemas import MeterID


class CustomerCustomerMeterMeter(IDSchema, TimestampedSchema):
    name: str = Field(description=METER_NAME_DESCRIPTION)


class CustomerCustomerMeter(CustomerMeterBase):
    meter: CustomerCustomerMeterMeter


class CustomerPortalMeterListParams(QuerySchema):
    meter_id: MultipleQueryFilter[MeterID] | None = Field(
        None, title="MeterID Filter", description="Filter by meter ID."
    )
    query: str | None = Field(None, description="Filter by meter name.")
