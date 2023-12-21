import datetime
from typing import Literal
from uuid import UUID

from polar.kit.schemas import Schema

Integration = Literal["slack", "discord"]


class WebhookIntegration(Schema):
    id: UUID
    integration: Integration
    url: str
    organization_id: UUID
    created_at: datetime.datetime


class WebhookIntegrationCreate(Schema):
    integration: Integration
    url: str
    organization_id: UUID


class WebhookIntegrationUpdate(Schema):
    url: str
