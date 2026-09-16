from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema

Release = Annotated[str, Field(pattern=r"^[a-f0-9]{40}$")]


class ValidationRequest(Schema):
    run_id: UUID
    release: Release


class Manifest(Schema):
    run_id: UUID
    release: Release
    environment: str
    emitted_at: datetime
    service_name: str
    logfire_enabled: bool
    s3_bucket: str | None
    sentry_event_id: str | None
