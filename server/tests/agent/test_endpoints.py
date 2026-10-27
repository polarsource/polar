from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

import pytest
from authlib.oauth2.rfc7523.jwt_bearer import JWT_BEARER_GRANT_TYPE
from httpx import AsyncClient
from pytest_mock import MockerFixture
from sqlalchemy.orm import joinedload

from polar.agent.identity_assertion import (
    IDENTITY_ASSERTION_TTL,
    decode_identity_assertion,
)
from polar.agent.repository import AgentRepository
from polar.agent.service import CLAIM_TOKEN_TTL, CLAIM_TTL
from polar.agent.words import WORDS
from polar.auth.models import AuthSubject
from polar.auth.scope import CLAIMED_AGENT_SCOPES, UNCLAIMED_AGENT_SCOPES
from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.email import mask_email
from polar.kit.utils import utc_now
from polar.models import Agent, OAuth2Token, Organization, Product, User
from polar.models.agent import AgentStatus
from polar.models.user_organization import OrganizationRole
from polar.oauth2.constants import CLAIM_GRANT_TYPE
from polar.oauth2.sub_type import SubType
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from tests.fixtures.auth import make_session_stale
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_agent

CLAIM_TOKEN = "polar_act_claim"
LINK_TOKEN = "polar_acl_link"
CODE = "amber-river-lemon"


@pytest.fixture
def agent_sign_up_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AGENT_SIGN_UP_ENABLED", True)


@pytest.fixture
async def claim_agent(
    save_fixture: SaveFixture, organization: Organization, user: User
) -> Agent:
    """An agent whose claim the user was asked to confirm."""
    return await create_agent(
        save_fixture,
        organization=organization,
        claim_token_hash=get_token_hash(CLAIM_TOKEN),
        claim_token_expires_at=utc_now() + CLAIM_TOKEN_TTL,
        claim_email=user.email.upper(),
        claim_link_token_hash=get_token_hash(LINK_TOKEN),
        claim_code_hash=get_token_hash(CODE),
        claim_expires_at=utc_now() + CLAIM_TTL,
    )


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
        assert json["post_claim_scopes"] == sorted(CLAIMED_AGENT_SCOPES)
        assert json["claim_url"] == "http://test/v1/agent/identity/claim"

        repository = AgentRepository.from_session(session)
        agent = await repository.get_by_id(
            UUID(json["registration_id"]), options=(joinedload(Agent.oauth2_client),)
        )
        assert agent is not None
        assert agent.name == "Claude"
        assert agent.status == AgentStatus.unclaimed
        assert agent.organization_id is None

        oauth2_client = agent.oauth2_client
        assert oauth2_client.agent_id == agent.id
        assert oauth2_client.user_id is None
        assert oauth2_client.client_secret_hash is None
        assert oauth2_client.client_id_issued_at > 0
        assert oauth2_client.token_endpoint_auth_method == "none"
        assert oauth2_client.redirect_uris == []
        assert oauth2_client.grant_types == [JWT_BEARER_GRANT_TYPE, CLAIM_GRANT_TYPE]
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


@pytest.mark.anyio
@pytest.mark.usefixtures("agent_sign_up_enabled")
class TestStartClaim:
    @pytest.mark.parametrize(
        "agent_fields",
        [
            pytest.param({"claim_token_hash": get_token_hash("other")}, id="unknown"),
            pytest.param({"status": AgentStatus.revoked}, id="revoked"),
        ],
    )
    async def test_invalid_claim_token(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        agent_fields: dict[str, Any],
    ) -> None:
        await create_agent(
            save_fixture,
            **{
                "claim_token_hash": get_token_hash(CLAIM_TOKEN),
                "claim_token_expires_at": utc_now() + CLAIM_TOKEN_TTL,
                **agent_fields,
            },
        )

        response = await client.post(
            "/v1/agent/identity/claim",
            json={"claim_token": CLAIM_TOKEN, "email": "human@example.com"},
        )

        assert response.status_code == 401
        assert response.json()["error"] == "invalid_claim_token"

    async def test_registration_expired(
        self, save_fixture: SaveFixture, client: AsyncClient
    ) -> None:
        await create_agent(
            save_fixture,
            claim_token_hash=get_token_hash(CLAIM_TOKEN),
            claim_token_expires_at=utc_now() - timedelta(seconds=1),
        )

        response = await client.post(
            "/v1/agent/identity/claim",
            json={"claim_token": CLAIM_TOKEN, "email": "human@example.com"},
        )

        assert response.status_code == 410
        assert response.json()["error"] == "claim_expired"

    async def test_claimed(
        self, save_fixture: SaveFixture, client: AsyncClient, user: User
    ) -> None:
        await create_agent(
            save_fixture,
            status=AgentStatus.claimed,
            claimed_by_user=user,
            claimed_at=utc_now(),
            claim_token_hash=get_token_hash(CLAIM_TOKEN),
            claim_token_expires_at=utc_now() + CLAIM_TOKEN_TTL,
        )

        response = await client.post(
            "/v1/agent/identity/claim",
            json={"claim_token": CLAIM_TOKEN, "email": "human@example.com"},
        )

        assert response.status_code == 409
        assert response.json()["error"] == "claimed_or_in_flight"

    @pytest.mark.auth
    async def test_retry_replaces_link_and_code(
        self,
        session: AsyncSession,
        client: AsyncClient,
        claim_agent: Agent,
        user: User,
    ) -> None:
        claim_token_expires_at = claim_agent.claim_token_expires_at

        response = await client.post(
            "/v1/agent/identity/claim",
            json={"claim_token": CLAIM_TOKEN, "email": user.email},
        )

        assert response.status_code == 200
        json = response.json()
        assert json["registration_id"] == str(claim_agent.id)
        assert UUID(json["claim_attempt_id"])
        assert json["status"] == "initiated"
        claim_attempt = json["claim_attempt"]
        assert claim_attempt["expires_in"] == CLAIM_TTL.total_seconds()
        assert claim_attempt["interval"] == 5
        link_token = claim_attempt["verification_uri"].removeprefix(
            f"{settings.FRONTEND_BASE_URL}/agent/claim?token="
        )
        assert link_token.startswith("polar_acl_")

        agent = await AgentRepository.from_session(session).get_by_id(claim_agent.id)
        assert agent is not None
        assert agent.claim_email == user.email
        assert agent.claim_link_token_hash == get_token_hash(link_token)
        assert agent.claim_code_hash == get_token_hash(claim_attempt["user_code"])
        words = claim_attempt["user_code"].split("-")
        assert len(words) == 3
        assert all(word in WORDS for word in words)
        assert agent.claim_expires_at == datetime.fromisoformat(json["expires_at"])
        assert agent.claim_token_expires_at == claim_token_expires_at

        old_link_response = await client.get(f"/v1/agent/claim/{LINK_TOKEN}")
        assert old_link_response.status_code == 404
        new_link_response = await client.get(f"/v1/agent/claim/{link_token}")
        assert new_link_response.status_code == 200


@pytest.mark.anyio
@pytest.mark.usefixtures("agent_sign_up_enabled")
class TestPreviewClaim:
    async def test_anonymous(
        self, client: AsyncClient, claim_agent: Agent, organization: Organization
    ) -> None:
        response = await client.get(f"/v1/agent/claim/{LINK_TOKEN}/preview")

        assert response.status_code == 200
        json = response.json()
        assert claim_agent.claim_email is not None
        assert json["agent_name"] == claim_agent.name
        assert json["email"] == mask_email(claim_agent.claim_email)
        assert json["email"] != claim_agent.claim_email
        assert json["organization"]["slug"] == organization.slug

    async def test_unknown_link(self, client: AsyncClient) -> None:
        response = await client.get("/v1/agent/claim/polar_acl_unknown/preview")

        assert response.status_code == 404

    async def test_expired(
        self, save_fixture: SaveFixture, client: AsyncClient, claim_agent: Agent
    ) -> None:
        claim_agent.claim_expires_at = utc_now() - timedelta(seconds=1)
        await save_fixture(claim_agent)

        response = await client.get(f"/v1/agent/claim/{LINK_TOKEN}/preview")

        assert response.status_code == 410
        assert response.json()["error"] == "AgentClaimExpired"


@pytest.mark.anyio
@pytest.mark.usefixtures("agent_sign_up_enabled")
class TestGetClaim:
    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        claim_agent: Agent,
        organization: Organization,
        product: Product,
    ) -> None:
        response = await client.get(f"/v1/agent/claim/{LINK_TOKEN}")

        assert response.status_code == 200
        json = response.json()
        assert json["agent_name"] == claim_agent.name
        assert json["email"] == claim_agent.claim_email
        assert json["organization"] == {
            "id": str(organization.id),
            "name": organization.name,
            "slug": organization.slug,
            "avatar_url": organization.avatar_url,
        }
        assert [item["name"] for item in json["products"]] == [product.name]
        assert json["products"][0]["recurring_interval"] == "month"
        assert [price["amount_type"] for price in json["products"][0]["prices"]] == [
            price.amount_type for price in product.prices
        ]


@pytest.mark.anyio
@pytest.mark.usefixtures("agent_sign_up_enabled")
class TestConfirmClaim:
    @pytest.mark.auth
    async def test_valid(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        claim_agent: Agent,
        organization: Organization,
        auth_subject: AuthSubject[User],
    ) -> None:
        posthog_mock = mocker.patch("polar.agent.service.posthog")
        enqueue_job_mock = mocker.patch("polar.organization.service.enqueue_job")
        create_customer_mock = mocker.patch(
            "polar.organization.service.polar_self_service.enqueue_create_customer"
        )
        pre_claim_token = OAuth2Token(
            client_id=claim_agent.oauth2_client.client_id,
            token_type="bearer",
            access_token=get_token_hash("polar_at_a_pre_claim"),
            scope="products:write",
            sub_type=SubType.agent,
            agent=claim_agent,
        )
        await save_fixture(pre_claim_token)

        response = await client.post(
            "/v1/agent/claim", json={"link_token": LINK_TOKEN, "code": CODE}
        )

        assert response.status_code == 204

        user = auth_subject.subject
        agent = await AgentRepository.from_session(session).get_by_id(
            claim_agent.id, options=(joinedload(Agent.oauth2_client),)
        )
        assert agent is not None
        assert agent.status == AgentStatus.claimed
        assert agent.claimed_by_user_id == user.id
        assert agent.claimed_at is not None
        assert agent.claim_link_token_hash is None
        assert agent.claim_code_hash is None
        assert agent.claim_token_hash == get_token_hash(CLAIM_TOKEN)
        assert agent.organization_id == organization.id
        assert set(agent.oauth2_client.scope.split()) == CLAIMED_AGENT_SCOPES

        token = await session.get(OAuth2Token, pre_claim_token.id)
        assert token is not None
        assert token.is_revoked()

        user_organization = await user_organization_service.get_by_user_and_org(
            session, user.id, organization.id
        )
        assert user_organization is not None
        assert user_organization.role == OrganizationRole.owner
        create_customer_mock.assert_called_once_with(
            organization_id=organization.id,
            name=organization.name,
            slug=organization.slug,
            owner_external_id=str(user.id),
            owner_email=user.email,
            owner_name=user.full_name or user.email.split("@", 1)[0],
        )
        enqueue_job_mock.assert_not_called()

        posthog_mock.agent_event.assert_called_once()
        assert posthog_mock.agent_event.call_args.args[1:3] == ("claim", "done")
        posthog_mock.user_event.assert_called_once()
        assert posthog_mock.user_event.call_args.args[1:4] == (
            "agent",
            "claim",
            "done",
        )

    @pytest.mark.auth
    async def test_code_spelling_is_forgiven(
        self, session: AsyncSession, client: AsyncClient, claim_agent: Agent
    ) -> None:
        response = await client.post(
            "/v1/agent/claim",
            json={"link_token": LINK_TOKEN, "code": "  Amber  River LEMON "},
        )

        assert response.status_code == 204
        agent = await AgentRepository.from_session(session).get_by_id(claim_agent.id)
        assert agent is not None
        assert agent.status == AgentStatus.claimed

    @pytest.mark.auth
    async def test_wrong_code(
        self, session: AsyncSession, client: AsyncClient, claim_agent: Agent
    ) -> None:
        response = await client.post(
            "/v1/agent/claim",
            json={"link_token": LINK_TOKEN, "code": "wrong-wrong-wrong"},
        )

        assert response.status_code == 400
        assert response.json()["error"] == "AgentClaimInvalidCode"
        agent = await AgentRepository.from_session(session).get_by_id(claim_agent.id)
        assert agent is not None
        assert agent.status == AgentStatus.unclaimed

    @pytest.mark.auth
    async def test_other_email(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        claim_agent: Agent,
    ) -> None:
        claim_agent.claim_email = "someone-else@example.com"
        await save_fixture(claim_agent)

        response = await client.post(
            "/v1/agent/claim", json={"link_token": LINK_TOKEN, "code": CODE}
        )

        assert response.status_code == 403
        assert response.json()["error"] == "AgentClaimEmailMismatch"
        assert "s***@example.com" in response.json()["detail"]
        assert "someone-else" not in response.json()["detail"]
        agent = await AgentRepository.from_session(session).get_by_id(claim_agent.id)
        assert agent is not None
        assert agent.status == AgentStatus.unclaimed

    @pytest.mark.auth
    async def test_expired(
        self, save_fixture: SaveFixture, client: AsyncClient, claim_agent: Agent
    ) -> None:
        claim_agent.claim_expires_at = utc_now() - timedelta(seconds=1)
        await save_fixture(claim_agent)

        response = await client.post(
            "/v1/agent/claim", json={"link_token": LINK_TOKEN, "code": CODE}
        )

        assert response.status_code == 410
        assert response.json()["error"] == "AgentClaimExpired"

    @pytest.mark.auth
    async def test_stale_session(
        self,
        session: AsyncSession,
        client: AsyncClient,
        claim_agent: Agent,
        auth_subject: AuthSubject[User],
    ) -> None:
        make_session_stale(auth_subject)

        response = await client.post(
            "/v1/agent/claim", json={"link_token": LINK_TOKEN, "code": CODE}
        )

        assert response.status_code == 403
        assert response.json()["error"] == "SessionNotFreshError"
        agent = await AgentRepository.from_session(session).get_by_id(claim_agent.id)
        assert agent is not None
        assert agent.status == AgentStatus.unclaimed


@pytest.mark.anyio
class TestAuthMd:
    async def test_disabled(self, client: AsyncClient) -> None:
        response = await client.get("/auth.md")

        assert response.status_code == 404

    @pytest.mark.usefixtures("agent_sign_up_enabled")
    async def test_enabled(self, client: AsyncClient) -> None:
        response = await client.get("/auth.md")

        assert response.status_code == 200
        assert response.headers["content-type"] == "text/markdown; charset=utf-8"
        assert "POST http://test/v1/agent/identity\n" in response.text
        assert "POST http://test/v1/agent/identity/claim\n" in response.text
        assert "POST http://test/v1/oauth2/token\n" in response.text
