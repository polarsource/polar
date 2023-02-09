from datetime import datetime

from polar.schema.base import Schema


class CreateDemo(Schema):
    testing: str


class UpdateDemo(CreateDemo):
    ...


class DemoSchema(Schema):
    id: str
    created_at: datetime
    updated_at: datetime | None
    testing: str

    class Config:
        orm_mode = True
