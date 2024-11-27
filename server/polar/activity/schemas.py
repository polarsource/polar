from pydantic import Field

from polar.kit.metadata import MetadataOutputMixin
from polar.kit.schemas import IDSchema, TimestampedSchema


class ActivityBase(MetadataOutputMixin, IDSchema, TimestampedSchema):
    message: str = Field(description="A summary of the activity.")


class ActivitySchema(ActivityBase):
    pass
