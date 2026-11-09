from datetime import datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from polar.agent.identity_assertion import decode_identity_assertion
from polar.agent.service import CLAIM_TOKEN_TTL
from polar.auth.scope import CLAIMED_AGENT_SCOPES
from polar.kit.crypto import get_token_hash
from polar.kit.db.postgres import Session
from polar.kit.utils import utc_now
from polar.models import Agent, OAuth2Token, User
from polar.models.agent import AgentStatus
from polar.oauth2.constants import CLAIM_GRANT_TYPE
from polar.oauth2.sub_type import SubType
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_agent

CLAIM_TOKEN = "polar_act_claim"
POLL = {"grant_type": CLAIM_GRANT_TYPE, "claim_token": CLAIM_TOKEN}


async def create_claim_agent(save_fixture: SaveFixture, **kwargs: Any) -> Agent:
    return await create_agent(
        save_fixture,
        **{
            "claim_token_hash": get_token_hash(CLAIM_TOKEN),
            "claim_token_expires_at": utc_now() + CLAIM_TOKEN_TTL,
            **kwargs,
        },
    )


@pytest.mark.anyio
class TestClaimGrant:
    async def test_pending(
        self, save_fixture: SaveFixture, client: AsyncClient
    ) -> None:
        await create_claim_agent(
            save_fixture, claim_expires_at=utc_now() + timedelta(days=1)
        )

        response = await client.post("/v1/oauth2/token", data=POLL)

        assert response.status_code == 400
        assert response.json()["error"] == "authorization_pending"

    async def test_slow_down(
        self, save_fixture: SaveFixture, sync_session: Session, client: AsyncClient
    ) -> None:
        await create_claim_agent(save_fixture)

        await client.post("/v1/oauth2/token", data=POLL)
        sync_session.expire_all()
        response = await client.post("/v1/oauth2/token", data=POLL)

        assert response.status_code == 400
        assert response.json()["error"] == "slow_down"

    @pytest.mark.parametrize(
        "agent_fields",
        [
            pytest.param(
                {"claim_expires_at": utc_now() - timedelta(seconds=1)},
                id="claim attempt",
            ),
            pytest.param(
                {"claim_token_expires_at": utc_now() - timedelta(seconds=1)},
                id="claim token",
            ),
        ],
    )
    async def test_expired(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        agent_fields: dict[str, Any],
    ) -> None:
        await create_claim_agent(save_fixture, **agent_fields)

        response = await client.post("/v1/oauth2/token", data=POLL)

        assert response.status_code == 400
        assert response.json()["error"] == "expired_token"

    @pytest.mark.parametrize(
        "agent_fields",
        [
            pytest.param({"claim_token_hash": get_token_hash("other")}, id="unknown"),
            pytest.param({"status": AgentStatus.revoked}, id="revoked"),
        ],
    )
    async def test_invalid(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        agent_fields: dict[str, Any],
    ) -> None:
        await create_claim_agent(save_fixture, **agent_fields)

        response = await client.post("/v1/oauth2/token", data=POLL)

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_grant"

    async def test_claimed(
        self,
        save_fixture: SaveFixture,
        sync_session: Session,
        client: AsyncClient,
        user: User,
    ) -> None:
        claimed_at = utc_now()
        agent = await create_claim_agent(
            save_fixture,
            status=AgentStatus.claimed,
            claimed_by_user=user,
            claimed_at=claimed_at,
        )

        response = await client.post("/v1/oauth2/token", data=POLL)

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
        assert token.agent_id is None
        assert token.client_id == agent.oauth2_client.client_id

        claims = decode_identity_assertion(json["identity_assertion"])
        assert claims.agent_id == agent.id
        assert claims.issued_at >= claimed_at.replace(microsecond=0)
        assert datetime.fromisoformat(json["assertion_expires"]) > claims.issued_at

        response = await client.post("/v1/oauth2/token", data=POLL)

        assert response.status_code == 400
        assert response.json()["error"] == "invalid_grant"

    async def test_claimed_after_claim_token_expiry(
        self, save_fixture: SaveFixture, client: AsyncClient, user: User
    ) -> None:
        await create_claim_agent(
            save_fixture,
            status=AgentStatus.claimed,
            claimed_by_user=user,
            claimed_at=utc_now(),
            claim_token_expires_at=utc_now() - timedelta(seconds=1),
        )

        response = await client.post("/v1/oauth2/token", data=POLL)

        assert response.status_code == 200
