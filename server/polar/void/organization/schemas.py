from pydantic import Field

from polar.kit.schemas import Schema


class OrganizationUpdate(Schema):
    default_version_id: str | None = Field(
        min_length=1,
        description="Default configuration version. Null selects the unnamed version.",
    )
