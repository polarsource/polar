from pydantic import Field

from polar.customer.schemas.customer import ExternalCustomerID
from polar.kit.versioning import QuerySchema
from polar.models.member import MemberRole


class MemberListParams(QuerySchema):
    customer_id: str | None = Field(None, description="Filter by customer ID.")
    external_customer_id: ExternalCustomerID | None = Field(
        None, description="Filter by customer external ID."
    )
    role: MemberRole | None = Field(None, description="Filter by member role.")


class MemberCustomerListParams(QuerySchema):
    role: MemberRole | None = Field(None, description="Filter by member role.")
