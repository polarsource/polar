from pydantic import Field

from polar.benefit.schemas import BenefitID
from polar.kit.versioning import QuerySchema


class CustomerPortalLicenseKeyListParams(QuerySchema):
    benefit_id: BenefitID | None = Field(
        None, description="Filter by a specific benefit"
    )
