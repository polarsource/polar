import pytest
import pytest_asyncio
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture

METER = {
    "external_id": "sdk-tool-calls",
    "name": "SDK - Tool Calls",
    "filter": {
        "conjunction": "and",
        "clauses": [{"property": "name", "operator": "eq", "value": "tool_call"}],
    },
    "aggregation": {"func": "count"},
    "unit": "custom",
    "custom_label": "call",
}


@pytest_asyncio.fixture
async def config_as_code_enabled(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    organization.feature_settings = {
        **organization.feature_settings,
        "config_as_code_enabled": True,
    }
    await save_fixture(organization)


@pytest.mark.asyncio
class TestApply:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/config/apply", json={"version": 1, "meters": [METER]}
        )

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_not_enabled(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={
                "version": 1,
                "meters": [METER],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 403
        assert response.json()["error"] == "ConfigAsCodeNotEnabled"

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={
                "version": 1,
                "organization": {"default_tax_behavior": "exclusive"},
                "meters": [METER],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 200
        assert response.json() == {
            "version": 1,
            "results": [
                {"section": "organization", "key": None, "action": "updated"},
                {"section": "meters", "key": "sdk-tool-calls", "action": "created"},
            ],
        }

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_organization_token(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/config/apply", json={"version": 1, "meters": [METER]}
        )

        assert response.status_code == 200

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.meters_write})
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_missing_section_scope(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={"version": 1, "organization": {"default_tax_behavior": "exclusive"}},
        )

        assert response.status_code == 403
        assert response.json()["error"] == "ConfigSectionScopeMissing"

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.meters_write})
    )
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_single_section_scope(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/config/apply", json={"version": 1, "meters": [METER]}
        )

        assert response.status_code == 200

    @pytest.mark.auth(AuthSubjectFixture(subject="user_second"))
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_missing_section_permission(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization_second: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={
                "version": 1,
                "organization": {"default_tax_behavior": "exclusive"},
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 403
        assert response.json()["error"] == "NotPermitted"

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_empty_config(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={"version": 1, "organization_id": str(organization.id)},
        )

        assert response.status_code == 422

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_unknown_key(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={
                "version": 1,
                "meters": [{**METER, "agregation": {"func": "count"}}],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422
        [error] = response.json()["detail"]
        assert error["loc"] == ["body", "meters", 0, "agregation"]

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_duplicate_external_ids(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={
                "version": 1,
                "meters": [METER, {**METER, "name": "Duplicate"}],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422
        [error] = response.json()["detail"]
        assert error["loc"] == ["body", "meters"]

    @pytest.mark.auth
    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_unsupported_version(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/config/apply",
            json={
                "version": 2,
                "meters": [METER],
                "organization_id": str(organization.id),
            },
        )

        assert response.status_code == 422
        [error] = response.json()["detail"]
        assert error["loc"] == ["body", "version"]
