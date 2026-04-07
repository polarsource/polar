from pydantic import AwareDatetime, Field

from polar.kit.schemas import (
    IDSchema,
    TimestampedSchema,
)
from polar.models.audit import AuditLog
from polar.organization.schemas import OrganizationID


class AuditBase(IDSchema, TimestampedSchema):
    start_timestamp: AwareDatetime | None = Field(None, description="Log start time.")

    end_timestamp: AwareDatetime | None = Field(
        None, description="Log completion time."
    )

    organization_id: OrganizationID | None = Field(
        default=None,
        description=("The ID of the organization owning the log. "),
    )

    log: AuditLog = Field(None, description="Log content")


class Audit(AuditBase):
    """
    Schema representing an audit log.

    An audit log represents an interaction with the application.
    """

    pass
