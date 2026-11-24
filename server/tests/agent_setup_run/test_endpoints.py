from datetime import datetime
from typing import Any

import pytest
from httpx2 import AsyncClient

from polar.agent_setup_run.repository import AgentSetupRunRepository
from polar.agent_setup_run.service import CODE_LENGTH, RUN_TTL
from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.utils import utc_now
from polar.models import AgentSetupRun, Organization, UserOrganization
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

CODE = "K7Q2M9XD"
DRAFTS: dict[str, Any] = {
    "products": [
        {
            "name": "Pro",
            "description": "500 images",
            "price_amount": 1900,
            "recurring_interval": "month",
        }
    ],
    "product_description": "Illustrations from text prompts, sold as monthly plans.",
    "website": "https://example.com",
    "support_email": "help@example.com",
    "socials": [{"platform": "github", "url": "https://github.com/example"}],
}


async def create_run(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    code: str = CODE,
    created_at: datetime | None = None,
    approved_at: datetime | None = None,
) -> AgentSetupRun:
    run = AgentSetupRun(
        organization=organization,
        code_hash=get_token_hash(code),
        stages={},
        approved_at=approved_at,
    )
    if created_at is not None:
        run.created_at = created_at
    await save_fixture(run)
    return run


@pytest.mark.anyio
class TestCreate:
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            f"/v1/agent-setup-runs/organization/{organization.id}"
        )
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_member(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post(
            f"/v1/agent-setup-runs/organization/{organization.id}"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/agent-setup-runs/organization/{organization.id}"
        )
        assert response.status_code == 201
        json = response.json()
        assert len(json["code"]) == CODE_LENGTH
        assert json["organization_id"] == str(organization.id)
        assert json["stages"] == {}
        assert json["drafts"] is None
        assert json["approved_at"] is None


@pytest.mark.anyio
class TestGetLatest:
    @pytest.mark.auth
    async def test_no_run(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get(
            f"/v1/agent-setup-runs/organization/{organization.id}"
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_latest(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await create_run(
            save_fixture, organization, code="older", created_at=utc_now() - RUN_TTL
        )
        latest = await create_run(save_fixture, organization)

        response = await client.get(
            f"/v1/agent-setup-runs/organization/{organization.id}"
        )
        assert response.status_code == 200
        json = response.json()
        assert json["id"] == str(latest.id)
        assert "code" not in json

    @pytest.mark.auth
    async def test_reported_run_wins_over_newer_unused(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        reported = await create_run(
            save_fixture, organization, created_at=utc_now() - RUN_TTL / 2
        )
        await create_run(save_fixture, organization, code="unused")
        await client.post(
            "/v1/agent-setup-runs/report", json={"code": CODE, "stage": "connect"}
        )

        response = await client.get(
            f"/v1/agent-setup-runs/organization/{organization.id}"
        )
        assert response.json()["id"] == str(reported.id)


@pytest.mark.anyio
class TestReport:
    async def test_unknown_code(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/agent-setup-runs/report", json={"code": "nope"}
        )
        assert response.status_code == 404

    async def test_expired(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        await create_run(save_fixture, organization, created_at=utc_now() - RUN_TTL)
        response = await client.post("/v1/agent-setup-runs/report", json={"code": CODE})
        assert response.status_code == 404

    async def test_stage_and_drafts(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        run = await create_run(save_fixture, organization)

        response = await client.post(
            "/v1/agent-setup-runs/report",
            json={"code": CODE, "stage": "connect"},
        )
        assert response.status_code == 200

        response = await client.post(
            "/v1/agent-setup-runs/report",
            json={
                "code": CODE,
                "stage": "analyze",
                "note": "Next.js, 1 plan",
                "drafts": DRAFTS,
            },
        )
        assert response.status_code == 200
        json = response.json()
        assert json["approved_at"] is None
        assert json["drafts"] == DRAFTS

        stored = await AgentSetupRunRepository.from_session(session).get_by_id(run.id)
        assert stored is not None
        assert stored.stages == {
            "connect": {"status": "done", "note": None, "url": None},
            "analyze": {"status": "done", "note": "Next.js, 1 plan", "url": None},
        }

    async def test_waiting_and_partial_drafts(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        run = await create_run(save_fixture, organization)

        await client.post(
            "/v1/agent-setup-runs/report",
            json={
                "code": CODE,
                "stage": "analyze",
                "status": "in_progress",
                "drafts": {"products": DRAFTS["products"]},
            },
        )
        response = await client.post(
            "/v1/agent-setup-runs/report",
            json={
                "code": CODE,
                "stage": "checkout",
                "status": "waiting",
                "note": "Approve the access token in your browser",
                "drafts": {"product_description": DRAFTS["product_description"]},
            },
        )
        assert response.status_code == 200
        drafts = response.json()["drafts"]
        assert drafts["products"] == DRAFTS["products"]
        assert drafts["product_description"] == DRAFTS["product_description"]

        stored = await AgentSetupRunRepository.from_session(session).get_by_id(run.id)
        assert stored is not None
        assert stored.stages["checkout"] == {
            "status": "waiting",
            "note": "Approve the access token in your browser",
            "url": None,
        }

    async def test_url(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        run = await create_run(save_fixture, organization)
        url = f"{settings.FRONTEND_BASE_URL}/dashboard/acme/cli/token?state=abc"

        response = await client.post(
            "/v1/agent-setup-runs/report",
            json={"code": CODE, "stage": "checkout", "status": "waiting", "url": url},
        )
        assert response.status_code == 200

        stored = await AgentSetupRunRepository.from_session(session).get_by_id(run.id)
        assert stored is not None
        assert stored.stages["checkout"]["url"] == url

    async def test_url_outside_dashboard(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        await create_run(save_fixture, organization)

        response = await client.post(
            "/v1/agent-setup-runs/report",
            json={
                "code": CODE,
                "stage": "checkout",
                "status": "waiting",
                "url": "https://example.com/approve",
            },
        )
        assert response.status_code == 422

    async def test_fills_empty_organization_profile(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        organization.website = None
        organization.email = "saved@example.com"
        organization.socials = []
        await save_fixture(organization)
        await create_run(save_fixture, organization)

        response = await client.post(
            "/v1/agent-setup-runs/report",
            json={
                "code": CODE,
                "stage": "analyze",
                "drafts": {**DRAFTS, "website": "not a url"},
            },
        )
        assert response.status_code == 200

        stored = await OrganizationRepository.from_session(session).get_by_id(
            organization.id
        )
        assert stored is not None
        assert stored.website is None
        assert stored.email == "saved@example.com"
        assert stored.socials == DRAFTS["socials"]

    async def test_read_only(
        self, client: AsyncClient, save_fixture: SaveFixture, organization: Organization
    ) -> None:
        await create_run(save_fixture, organization)
        response = await client.post("/v1/agent-setup-runs/report", json={"code": CODE})
        assert response.status_code == 200
        assert response.json() == {"drafts": None, "approved_at": None}

    async def test_drafts_ignored_after_approval(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        run = await create_run(save_fixture, organization, approved_at=utc_now())

        response = await client.post(
            "/v1/agent-setup-runs/report",
            json={"code": CODE, "stage": "products", "drafts": DRAFTS},
        )
        assert response.status_code == 200
        assert response.json()["drafts"] is None

        stored = await AgentSetupRunRepository.from_session(session).get_by_id(run.id)
        assert stored is not None
        assert stored.stages == {
            "products": {"status": "done", "note": None, "url": None}
        }


@pytest.mark.anyio
class TestApprove:
    @pytest.mark.auth
    async def test_no_run(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            f"/v1/agent-setup-runs/organization/{organization.id}/approve",
            json=DRAFTS,
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_valid(
        self,
        client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        await create_run(save_fixture, organization)
        edited = {
            **DRAFTS,
            "products": [{**DRAFTS["products"][0], "price_amount": 2900}],
        }

        response = await client.post(
            f"/v1/agent-setup-runs/organization/{organization.id}/approve",
            json=edited,
        )
        assert response.status_code == 200
        json = response.json()
        assert json["approved_at"] is not None
        assert json["drafts"] == edited

        response = await client.post("/v1/agent-setup-runs/report", json={"code": CODE})
        assert response.json()["drafts"] == edited
