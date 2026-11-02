import base64
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
    decode_identity_assertion,
)
from polar.auth.scope import CLAIMED_AGENT_SCOPES, UNCLAIMED_AGENT_SCOPES
from polar.kit import jwt
from polar.kit.crypto import get_token_hash
from polar.kit.db.postgres import Session
from polar.kit.utils import utc_now
from polar.models import Agent, OAuth2Token, User
from polar.models.agent import AgentStatus
from polar.oauth2.constants import ISSUER
from polar.oauth2.sub_type import SubType
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_agent


@pytest.mark.anyio
class TestJWTBearerGrant:
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
            pytest.param(
                IDENTITY_ASSERTION_TYPE,
                {"sub": "not-a-uuid"},
                timedelta(days=1),
                id="malformed subject",
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

    @pytest.mark.parametrize(
        "agent_fields",
        [
            pytest.param({"status": AgentStatus.revoked}, id="revoked"),
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

    async def test_claimed_agent(
        self,
        save_fixture: SaveFixture,
        sync_session: Session,
        client: AsyncClient,
        user: User,
    ) -> None:
        agent_id = uuid.uuid4()
        assertion = create_identity_assertion(agent_id).token
        # Minted in the same second as the claim, whose timestamp has microseconds.
        agent = await create_agent(
            save_fixture,
            id=agent_id,
            status=AgentStatus.claimed,
            claimed_by_user=user,
            claimed_at=decode_identity_assertion(assertion).issued_at
            + timedelta(milliseconds=500),
        )

        response = await client.post(
            "/v1/oauth2/token",
            data={"grant_type": JWT_BEARER_GRANT_TYPE, "assertion": assertion},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["access_token"].startswith("polar_at_u_")
        assert "refresh_token" not in json
        assert set(json["scope"].split()) == CLAIMED_AGENT_SCOPES

        token = (
            sync_session.execute(
                select(OAuth2Token).where(
                    OAuth2Token.access_token == get_token_hash(json["access_token"])
                )
            )
            .unique()
            .scalar_one()
        )
        assert token.sub_type == SubType.user
        assert token.user_id == user.id
        assert token.client_id == agent.oauth2_client.client_id

    async def test_claimed_agent_assertion_before_claim(
        self, save_fixture: SaveFixture, client: AsyncClient, user: User
    ) -> None:
        agent_id = uuid.uuid4()
        assertion = create_identity_assertion(agent_id).token
        await create_agent(
            save_fixture,
            id=agent_id,
            status=AgentStatus.claimed,
            claimed_by_user=user,
            claimed_at=decode_identity_assertion(assertion).issued_at
            + timedelta(seconds=1),
        )

        response = await client.post(
            "/v1/oauth2/token",
            data={"grant_type": JWT_BEARER_GRANT_TYPE, "assertion": assertion},
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_grant"

    @pytest.mark.parametrize("user_field", ["deleted_at", "blocked_at"])
    async def test_claiming_user_cannot_authenticate(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        user_field: str,
    ) -> None:
        setattr(user, user_field, utc_now())
        await save_fixture(user)
        agent = await create_agent(
            save_fixture,
            status=AgentStatus.claimed,
            claimed_by_user=user,
            claimed_at=utc_now() - timedelta(minutes=1),
        )

        response = await client.post(
            "/v1/oauth2/token",
            data={
                "grant_type": JWT_BEARER_GRANT_TYPE,
                "assertion": create_identity_assertion(agent.id).token,
            },
        )

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_grant"

    @pytest.mark.parametrize("credentials", ["form", "basic"])
    async def test_other_agent_client(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        agent: Agent,
        credentials: str,
    ) -> None:
        other_client_id = (await create_agent(save_fixture)).oauth2_client.client_id
        data = {
            "grant_type": JWT_BEARER_GRANT_TYPE,
            "assertion": create_identity_assertion(agent.id).token,
        }
        headers: dict[str, str] = {}
        if credentials == "form":
            data["client_id"] = other_client_id
        else:
            basic = base64.b64encode(f"{other_client_id}:x".encode()).decode()
            headers["Authorization"] = f"Basic {basic}"

        response = await client.post("/v1/oauth2/token", data=data, headers=headers)

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_client"
