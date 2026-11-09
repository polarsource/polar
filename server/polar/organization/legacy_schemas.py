from pydantic import Field

from . import schemas
from .schemas import OrganizationDetails


class OrganizationCreate(schemas.OrganizationCreate):
    details: OrganizationDetails | None = Field(
        None,
        description="Additional, private, business details Polar needs about active organizations for compliance (KYC).",
    )


class OrganizationUpdate(schemas.OrganizationUpdate):
    details: OrganizationDetails | None = Field(
        None,
        description="Additional, private, business details Polar needs about active organizations for compliance (KYC).",
    )
