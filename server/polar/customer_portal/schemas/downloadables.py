from datetime import datetime

from pydantic import UUID4, Field

from polar.benefit.schemas import BenefitID
from polar.file.schemas import FileDownload
from polar.kit.schemas import MultipleQueryFilter, Schema
from polar.kit.versioning import QuerySchema


class DownloadableURL(Schema):
    url: str
    expires_at: datetime


class DownloadableRead(Schema):
    id: UUID4
    benefit_id: UUID4

    file: FileDownload


class CustomerPortalDownloadablesListParams(QuerySchema):
    benefit_id: MultipleQueryFilter[BenefitID] | None = Field(
        None, title="BenefitID Filter", description="Filter by benefit ID."
    )
