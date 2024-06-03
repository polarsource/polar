from datetime import datetime

from pydantic import UUID4

from polar.file.schemas import FileDownload
from polar.kit.schemas import Schema
from polar.models.downloadable import DownloadableStatus


class DownloadableURL(Schema):
    url: str
    expires_at: datetime


class DownloadableRead(Schema):
    id: UUID4
    benefit_id: UUID4

    file: FileDownload


class DownloadableCreate(Schema):
    file_id: UUID4
    user_id: UUID4
    benefit_id: UUID4
    status: DownloadableStatus


class DownloadableUpdate(Schema):
    file_id: UUID4
    user_id: UUID4
    benefit_id: UUID4
    status: DownloadableStatus
