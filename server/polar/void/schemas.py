from datetime import datetime
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import IDSchema


class VoidOrganization(IDSchema):
    name: str = Field(description="The organization name.")
    slug: str = Field(description="The organization slug.")
    created_at: datetime = Field(description="The organization creation timestamp.")
    active_deployment_id: UUID | None = Field(
        description="The active deployment, if one has been activated."
    )
    active_version_id: str | None = Field(
        description="The configuration version of the active deployment."
    )
    can_activate: bool = Field(
        description="Whether the organization has passed review and may activate "
        "a deployment."
    )
