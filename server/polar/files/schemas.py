from datetime import datetime

from polar.kit.schemas import Schema


class FileCreateSignedURL(Schema):
    url: str


class FileCreate(Schema):
    name: str
    size: int
    type: str
    last_modified_at: datetime
