from datetime import datetime

from pydantic import UUID4

from polar.file.schemas import FileDownload
from polar.kit.schemas import Schema


class DownloadableURL(Schema):
    url: str
    expires_at: datetime


class DownloadableRead(Schema):
    id: UUID4
    benefit_id: UUID4

    file: FileDownload
