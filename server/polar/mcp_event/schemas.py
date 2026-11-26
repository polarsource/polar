import base64
import binascii
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from pydantic import AfterValidator, ConfigDict, Field

from polar.kit.schemas import IDSchema, Schema
from polar.models.webhook_endpoint import WebhookEventType
from polar.webhook.constants import WEBHOOK_SECRET_PREFIX
from polar.webhook.schemas import EndpointURL


def _validate_secret(value: str) -> str:
    try:
        key = base64.b64decode(value.removeprefix(WEBHOOK_SECRET_PREFIX), validate=True)
    except binascii.Error:
        key = b""
    if not value.startswith(WEBHOOK_SECRET_PREFIX) or not 24 <= len(key) <= 64:
        raise ValueError(
            f"The secret must be {WEBHOOK_SECRET_PREFIX} followed by "
            "24 to 64 base64-encoded bytes."
        )
    return value


class OrganizationMCPEventArguments(Schema):
    model_config = ConfigDict(extra="forbid")


class UserMCPEventArguments(OrganizationMCPEventArguments):
    organization_id: UUID = Field(
        description="The organization to receive events from."
    )


class MCPEventArguments(OrganizationMCPEventArguments):
    organization_id: UUID | None = None


class MCPEvent(Schema):
    name: WebhookEventType
    description: str
    input_schema: dict[str, Any]
    payload_schema: dict[str, Any]


class MCPEventList(Schema):
    items: list[MCPEvent]


class MCPEventUnsubscribe(Schema):
    name: str
    arguments: MCPEventArguments
    url: EndpointURL


class MCPEventSubscribe(MCPEventUnsubscribe):
    secret: Annotated[str, AfterValidator(_validate_secret)]
    ttl_ms: int | None = Field(None, ge=1)


class MCPEventSubscription(IDSchema):
    expires_at: datetime
