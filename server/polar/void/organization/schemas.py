from pydantic import Field

from polar.kit.schemas import Schema


class OrganizationUpdate(Schema):
    default_variant_id: str | None = Field(
        min_length=1,
        description="Default configuration variant. Null selects the unnamed variant.",
    )
