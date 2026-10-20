import uuid
from datetime import timedelta
from typing import Any

import pytest
from authlib.oauth2.rfc7523.jwt_bearer import JWT_BEARER_GRANT_TYPE
from httpx import AsyncClient
from sqlalchemy import select

from polar.agent.identity_assertion import (
    IDENTITY_ASSERTION_TYPE,
    create_identity_assertion,
)
from polar.auth.scope import UNCLAIMED_AGENT_SCOPES
from polar.config import settings
from polar.kit import jwt
from polar.kit.crypto import get_token_hash
from polar.kit.db.postgres import Session
from polar.kit.utils import utc_now
from polar.models import Agent, OAuth2Token
from polar.models.agent import AgentStatus
from polar.oauth2.constants import ISSUER
from polar.oauth2.sub_type import SubType
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_agent


@pytest.fixture
def agent_sign_up_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AGENT_SIGN_UP_ENABLED", True)


@pytest.mark.anyio
class TestJWTBearerGrant:
    async def test_disabled(self, client: AsyncClient, agent: Agent) -> None:
        response = await client.post(
            "/v1/oauth2/token",
            data={
                "grant_type": JWT_BEARER_GRANT_TYPE,
                "assertion": create_identity_assertion(agent.id).token,
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "unsupported_grant_type"

    @pytest.mark.usefixtures("agent_sign_up_enabled")
    async def test_valid(
        self, client: AsyncClient, sync_session: Session, agent: Agent
    ) -> None:
        response = await client.post(
            "/v1/oauth2/token",
            data={
                "grant_type": JWT_BEARER_GRANT_TYPE,
                "assertion": create_identity_assertion(agent.id).token,
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["access_token"].startswith("polar_at_a_")
        assert "refresh_token" not in json
        assert json["expires_in"] == 3600
        assert set(json["scope"].split()) == UNCLAIMED_AGENT_SCOPES

        token = (
            sync_session.execute(
                select(OAuth2Token).where(
                    OAuth2Token.access_token == get_token_hash(json["access_token"])
                )
            )
            .unique()
            .scalar_one()
        )
        assert token.sub_type == SubType.agent
        assert token.agent_id == agent.id
        assert token.client_id == agent.oauth2_client.client_id
        assert token.refresh_token is None

    @pytest.mark.usefixtures("agent_sign_up_enabled")
    async def test_tampered_signature(
        self, save_fixture: SaveFixture, client: AsyncClient, agent: Agent
    ) -> None:
        other_agent = await create_agent(save_fixture)
        header, _, signature = create_identity_assertion(agent.id).token.split(".")
        _, payload, _ = create_identity_assertion(other_agent.id).token.split(".")

        response = await client.post(
            "/v1/oauth2/token",
            data={
                "grant_type": JWT_BEARER_GRANT_TYPE,
                "assertion": f"{header}.{payload}.{signature}",
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_grant"

    @pytest.mark.usefixtures("agent_sign_up_enabled")
    @pytest.mark.parametrize(
        ("type", "claims", "expires_in"),
        [
            pytest.param("discord_oauth", {}, timedelta(days=1), id="wrong type"),
            pytest.param(
                IDENTITY_ASSERTION_TYPE,
                {"aud": "https://example.com"},
                timedelta(days=1),
                id="wrong audience",
            ),
            pytest.param(
                IDENTITY_ASSERTION_TYPE,
                {"iss": "https://example.com"},
                timedelta(days=1),
                id="wrong issuer",
            ),
            pytest.param(
                IDENTITY_ASSERTION_TYPE, {}, timedelta(seconds=-1), id="expired"
            ),
        ],
    )
    async def test_invalid_assertion(
        self,
        client: AsyncClient,
        agent: Agent,
        type: jwt.TYPE,
        claims: dict[str, Any],
        expires_in: timedelta,
    ) -> None:
        now = utc_now()
        assertion = jwt.encode_sync(
            data={
                "iss": ISSUER,
                "aud": ISSUER,
                "sub": str(agent.id),
                "iat": int(now.timestamp()) - 60,
                **claims,
            },
            expires_at=now + expires_in,
            type=type,
        )

        response = await client.post(
            "/v1/oauth2/token",
            data={"grant_type": JWT_BEARER_GRANT_TYPE, "assertion": assertion},
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_grant"

    @pytest.mark.usefixtures("agent_sign_up_enabled")
    async def test_unknown_agent(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/oauth2/token",
            data={
                "grant_type": JWT_BEARER_GRANT_TYPE,
                "assertion": create_identity_assertion(uuid.uuid4()).token,
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_grant"

    @pytest.mark.usefixtures("agent_sign_up_enabled")
    @pytest.mark.parametrize(
        "agent_fields",
        [
            pytest.param({"status": AgentStatus.revoked}, id="revoked"),
            pytest.param({"status": AgentStatus.claimed}, id="claimed"),
            pytest.param({"deleted_at": utc_now()}, id="deleted"),
        ],
    )
    async def test_agent_cannot_authenticate(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        agent_fields: dict[str, Any],
    ) -> None:
        agent = await create_agent(save_fixture, **agent_fields)

        response = await client.post(
            "/v1/oauth2/token",
            data={
                "grant_type": JWT_BEARER_GRANT_TYPE,
                "assertion": create_identity_assertion(agent.id).token,
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_grant"

    @pytest.mark.usefixtures("agent_sign_up_enabled")
    async def test_other_agent_client(
        self, save_fixture: SaveFixture, client: AsyncClient, agent: Agent
    ) -> None:
        other_agent = await create_agent(save_fixture)

        response = await client.post(
            "/v1/oauth2/token",
            data={
                "grant_type": JWT_BEARER_GRANT_TYPE,
                "assertion": create_identity_assertion(agent.id).token,
                "client_id": other_agent.oauth2_client.client_id,
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_client"
