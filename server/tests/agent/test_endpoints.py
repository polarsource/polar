from datetime import datetime, timedelta
from uuid import UUID

import pytest
from authlib.oauth2.rfc7523.jwt_bearer import JWT_BEARER_GRANT_TYPE
from httpx import AsyncClient
from sqlalchemy.orm import joinedload

from polar.agent.identity_assertion import (
    IDENTITY_ASSERTION_TTL,
    decode_identity_assertion,
)
from polar.agent.repository import AgentRepository
from polar.agent.service import CLAIM_TOKEN_TTL
from polar.auth.scope import UNCLAIMED_AGENT_SCOPES
from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import Agent
from polar.models.agent import AgentStatus
from polar.postgres import AsyncSession


@pytest.fixture
def agent_sign_up_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AGENT_SIGN_UP_ENABLED", True)


@pytest.mark.anyio
class TestCreateIdentity:
    async def test_disabled(self, client: AsyncClient) -> None:
        response = await client.post("/v1/agent/identity", json={"type": "anonymous"})

        assert response.status_code == 404

    @pytest.mark.usefixtures("agent_sign_up_enabled")
    async def test_anonymous(self, client: AsyncClient, session: AsyncSession) -> None:
        response = await client.post(
            "/v1/agent/identity", json={"type": "anonymous", "name": "Claude"}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["registration_type"] == "anonymous"
        assert json["pre_claim_scopes"] == sorted(UNCLAIMED_AGENT_SCOPES)

        repository = AgentRepository.from_session(session)
        agent = await repository.get_by_id(
            UUID(json["registration_id"]), options=(joinedload(Agent.oauth2_client),)
        )
        assert agent is not None
        assert agent.name == "Claude"
        assert agent.status == AgentStatus.unclaimed
        assert agent.organization_id is None

        oauth2_client = agent.oauth2_client
        assert oauth2_client.is_agent is True
        assert oauth2_client.user_id is None
        assert oauth2_client.client_secret_hash is None
        assert oauth2_client.client_id_issued_at > 0
        assert oauth2_client.token_endpoint_auth_method == "none"
        assert oauth2_client.redirect_uris == []
        assert oauth2_client.grant_types == [JWT_BEARER_GRANT_TYPE]
        assert set(oauth2_client.scope.split()) == UNCLAIMED_AGENT_SCOPES

        assert agent.claim_token_hash == get_token_hash(json["claim_token"])
        assert agent.claim_token_expires_at == datetime.fromisoformat(
            json["claim_token_expires"]
        )
        assert abs(
            agent.claim_token_expires_at - utc_now() - CLAIM_TOKEN_TTL
        ) < timedelta(minutes=1)

        claims = decode_identity_assertion(json["identity_assertion"])
        assert claims.agent_id == agent.id
        assert claims.issued_at + IDENTITY_ASSERTION_TTL == datetime.fromisoformat(
            json["assertion_expires"]
        )
