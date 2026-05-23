"""Tests for the inbound Plain agent-reply webhook.

Covers the security-critical HMAC gate (via the HTTP client) and the
thread-routing query + idempotency-event shape (unit). The full
record_merchant_reply behaviour is covered in test_merchant_reply.py;
the endpoint opens its own sessionmaker so the happy path is exercised
through its constituent, individually-tested pieces.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from unittest.mock import patch

import httpx
import pytest

from polar.models.organization import Organization
from polar.models.organization_review_agent_run import AgentRunStatus
from polar.organization_review_agent.repository import (
    OrganizationReviewAgentRunRepository,
)
from polar.organization_review_agent.service import (
    organization_review_agent_service,
)
from polar.postgres import AsyncSession

_SECRET = "test-plain-signing-secret"


def _sign(body: bytes) -> str:
    return hmac.new(_SECRET.encode(), body, hashlib.sha256).hexdigest()


@pytest.mark.asyncio
class TestAgentReplyWebhookSignature:
    async def test_404_when_secret_unset(
        self, client: httpx.AsyncClient
    ) -> None:
        body = json.dumps(
            {"message_id": "m1", "thread_id": "t1", "text": "hi"}
        ).encode()
        # Default settings: PLAIN_REQUEST_SIGNING_SECRET is None → 404.
        resp = await client.post(
            "/v1/integrations/plain/agent-reply",
            content=body,
            headers={
                "Content-Type": "application/json",
                "plain-request-signature": "whatever",
            },
        )
        assert resp.status_code == 404

    async def test_403_on_bad_signature(
        self, client: httpx.AsyncClient
    ) -> None:
        body = json.dumps(
            {"message_id": "m1", "thread_id": "t1", "text": "hi"}
        ).encode()
        with patch(
            "polar.integrations.plain.endpoints.settings"
        ) as settings_mock:
            settings_mock.PLAIN_REQUEST_SIGNING_SECRET = _SECRET
            resp = await client.post(
                "/v1/integrations/plain/agent-reply",
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "plain-request-signature": "deadbeef",  # wrong
                },
            )
        assert resp.status_code == 403

    async def test_valid_signature_no_run(
        self, client: httpx.AsyncClient
    ) -> None:
        """A correctly-signed payload clears the HMAC gate. With no run
        for the thread the endpoint returns 202 ignored_no_run — which
        proves the signature check passed and routing ran."""

        body = json.dumps(
            {
                "message_id": "m1",
                "thread_id": "no-such-thread",
                "text": "hi",
            }
        ).encode()
        with patch(
            "polar.integrations.plain.endpoints.settings"
        ) as settings_mock:
            settings_mock.PLAIN_REQUEST_SIGNING_SECRET = _SECRET
            resp = await client.post(
                "/v1/integrations/plain/agent-reply",
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "plain-request-signature": _sign(body),
                },
            )
        assert resp.status_code == 202
        assert resp.json()["status"] == "ignored_no_run"

    async def test_happy_path_records_then_dedupes(
        self,
        client: httpx.AsyncClient,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Signed payload for a real parked thread is recorded; a
        duplicate delivery of the same message_id is deduped."""

        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session,
                organization,
                context="submission",
                plain_thread_id="thr_live",
            )
        run.status = AgentRunStatus.AWAITING_HUMAN
        await session.flush()

        body = json.dumps(
            {"message_id": "msg-1", "thread_id": "thr_live", "text": "hello"}
        ).encode()
        headers = {
            "Content-Type": "application/json",
            "plain-request-signature": _sign(body),
        }
        with patch(
            "polar.integrations.plain.endpoints.settings"
        ) as settings_mock:
            settings_mock.PLAIN_REQUEST_SIGNING_SECRET = _SECRET
            first = await client.post(
                "/v1/integrations/plain/agent-reply",
                content=body,
                headers=headers,
            )
            second = await client.post(
                "/v1/integrations/plain/agent-reply",
                content=body,
                headers=headers,
            )

        assert first.status_code == 202
        assert first.json()["status"] == "recorded"
        assert second.json()["status"] == "duplicate"

        repo = OrganizationReviewAgentRunRepository.from_session(session)
        refreshed = await repo.get_by_id(run.id)
        assert refreshed is not None
        replied = [
            e for e in refreshed.events if e["kind"] == "merchant_replied"
        ]
        assert len(replied) == 1
        assert replied[0]["message_id"] == "msg-1"


@pytest.mark.asyncio
class TestThreadRouting:
    async def test_get_latest_by_plain_thread_id(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session,
                organization,
                context="submission",
                plain_thread_id="thr_routing",
            )
        await session.flush()

        repo = OrganizationReviewAgentRunRepository.from_session(session)
        found = await repo.get_latest_by_plain_thread_id("thr_routing")
        assert found is not None
        assert found.id == run.id

        missing = await repo.get_latest_by_plain_thread_id("thr_absent")
        assert missing is None

    async def test_idempotency_event_shape(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        """record_merchant_reply stamps message_id on the event so the
        webhook can dedupe duplicate deliveries."""

        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
        run.status = AgentRunStatus.AWAITING_HUMAN
        await session.flush()

        await organization_review_agent_service.record_merchant_reply(
            session, run, raw_message="hi", message_id="msg-42"
        )
        replied = [e for e in run.events if e["kind"] == "merchant_replied"]
        assert len(replied) == 1
        assert replied[0]["message_id"] == "msg-42"
