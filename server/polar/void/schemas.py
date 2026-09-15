from datetime import datetime

from pydantic import Field

from polar.kit.schemas import IDSchema


class VoidOrganization(IDSchema):
    name: str = Field(description="The organization name.")
    slug: str = Field(description="The organization slug.")
    created_at: datetime = Field(description="The organization creation timestamp.")
    default_variant_id: str | None = Field(
        description="The default Void configuration variant."
    )
