import hmac
import json
import secrets
import ssl
from datetime import datetime, timedelta
from typing import Literal
from uuid import UUID

import httpx

from polar.auth.models import AuthSubject
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.config import Environment, settings
from polar.exceptions import PolarError, ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.kit.http import SSRFBlockedError, SSRFSafeTransport
from polar.kit.utils import generate_uuid, utc_now
from polar.models import Organization, User, WebhookEndpoint
from polar.models.webhook_endpoint import WebhookEventType, WebhookFormat
from polar.organization.resolver import get_payload_organization
from polar.webhook.repository import WebhookEndpointRepository
from polar.webhook.tasks import sign_webhook

from .catalog import MCP_EVENTS
from .schemas import MCPEventArguments, MCPEventSubscribe, MCPEventUnsubscribe

MAX_TTL_MS = 24 * 60 * 60 * 1000

CallbackEndpointErrorReason = Literal[
    "connection_refused",
    "timeout",
    "tls_error",
    "http_4xx",
    "http_5xx",
    "challenge_failed",
]


class CallbackEndpointError(PolarError):
    def __init__(self, reason: CallbackEndpointErrorReason) -> None:
        super().__init__(reason, 400)


class MCPEventService:
    async def subscribe(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        subscribe: MCPEventSubscribe,
    ) -> WebhookEndpoint:
        event = _get_event_type(subscribe.name)
        organization = await _get_organization(
            session, auth_subject, subscribe.arguments
        )
        url = str(subscribe.url)
        repository = WebhookEndpointRepository.from_session(session)
        endpoint = await repository.get_mcp_subscription(organization.id, url, event)

        now = utc_now()
        ttl_ms = min(subscribe.ttl_ms or MAX_TTL_MS, MAX_TTL_MS)
        update_dict = {
            "secret": subscribe.secret,
            "secret_generated_at": now,
            "expires_at": now + timedelta(milliseconds=ttl_ms),
        }

        is_live = (
            endpoint is not None
            and endpoint.expires_at is not None
            and endpoint.expires_at > now
        )
        endpoint_id = endpoint.id if endpoint is not None else generate_uuid()
        if not is_live:
            await _verify_callback(url, subscribe.secret, endpoint_id, now)

        if endpoint is not None:
            return await repository.update(endpoint, update_dict=update_dict)
        return await repository.create(
            WebhookEndpoint(
                id=endpoint_id,
                format=WebhookFormat.mcp,
                events=[event],
                url=url,
                organization=organization,
                **update_dict,
            )
        )

    async def unsubscribe(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        unsubscribe: MCPEventUnsubscribe,
    ) -> None:
        event = _get_event_type(unsubscribe.name)
        organization = await _get_organization(
            session, auth_subject, unsubscribe.arguments
        )
        repository = WebhookEndpointRepository.from_session(session)
        endpoint = await repository.get_mcp_subscription(
            organization.id, str(unsubscribe.url), event
        )
        if endpoint is not None:
            await repository.soft_delete(endpoint)


def _get_event_type(name: str) -> WebhookEventType:
    if name not in MCP_EVENTS:
        raise ResourceNotFound(f"Unknown event: {name}")
    return WebhookEventType(name)


async def _get_organization(
    session: AsyncSession,
    auth_subject: AuthSubject[User | Organization],
    arguments: MCPEventArguments,
) -> Organization:
    organization = await get_payload_organization(session, auth_subject, arguments)
    await assert_organization_permission(
        session,
        auth_subject,
        organization.id,
        OrganizationPermission.organization_manage,
    )
    return organization


async def _verify_callback(
    url: str, secret: str, subscription_id: UUID, now: datetime
) -> None:
    if settings.ENV == Environment.development:
        return

    challenge = secrets.token_urlsafe(32)
    payload = json.dumps({"type": "verification", "challenge": challenge})
    message_id = str(generate_uuid())
    headers = {
        "content-type": "application/json",
        "webhook-id": message_id,
        "webhook-timestamp": str(int(now.timestamp())),
        "webhook-signature": sign_webhook(
            secret, message_id, now, payload, secret_generated_at=now
        ),
        "X-MCP-Subscription-Id": str(subscription_id),
    }

    try:
        async with httpx.AsyncClient(
            transport=SSRFSafeTransport(), follow_redirects=False, timeout=10.0
        ) as client:
            response = await client.post(url, content=payload, headers=headers)
    except httpx.TimeoutException as e:
        raise CallbackEndpointError("timeout") from e
    except (httpx.HTTPError, ssl.SSLError, SSRFBlockedError) as e:
        reason: CallbackEndpointErrorReason = "connection_refused"
        cause: BaseException | None = e
        while cause is not None:
            if isinstance(cause, ssl.SSLError):
                reason = "tls_error"
            cause = cause.__cause__
        raise CallbackEndpointError(reason) from e

    if not response.is_success:
        raise CallbackEndpointError(
            "http_5xx" if response.status_code >= 500 else "http_4xx"
        )

    try:
        echoed = response.json()["challenge"]
    except ValueError, KeyError, TypeError:
        echoed = None
    if not isinstance(echoed, str) or not hmac.compare_digest(
        echoed.encode(), challenge.encode()
    ):
        raise CallbackEndpointError("challenge_failed")


mcp_event = MCPEventService()
