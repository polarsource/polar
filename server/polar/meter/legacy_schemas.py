from pydantic import Field

from polar.organization.schemas import OrganizationID

from . import schemas


class MeterCreate(schemas.MeterCreateBase):
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the meter. "
            "**Required unless you use an organization token.**"
        ),
    )


class MeterUpdate(schemas.MeterUpdateBase):
    pass
