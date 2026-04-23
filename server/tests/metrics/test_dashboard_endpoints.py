import uuid

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization, UserOrganization
from polar.models.metric_dashboard import MetricDashboard
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture


async def create_dashboard(
    save_fixture: SaveFixture,
    *,
    organization: Organization,
    name: str = "Test Dashboard",
    metrics: list[str] | None = None,
) -> MetricDashboard:
    dashboard = MetricDashboard(
        name=name,
        metrics=metrics or ["revenue", "orders"],
        organization_id=organization.id,
    )
    await save_fixture(dashboard)
    return dashboard


@pytest.mark.asyncio
class TestListDashboards:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/metrics/dashboards")
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.metrics_read}),
    )
    async def test_user_empty(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/metrics/dashboards")
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.metrics_read}),
    )
    async def test_user_returns_own_dashboards(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(
            save_fixture, organization=organization, name="My Dashboard"
        )

        response = await client.get("/v1/metrics/dashboards")
        assert response.status_code == 200

        json = response.json()
        assert len(json) == 1
        assert json[0]["id"] == str(dashboard.id)
        assert json[0]["name"] == "My Dashboard"

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.metrics_read}),
    )
    async def test_filter_by_organization_id(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        await create_dashboard(save_fixture, organization=organization)

        response = await client.get(
            "/v1/metrics/dashboards",
            params={"organization_id": str(organization.id)},
        )
        assert response.status_code == 200
        assert len(response.json()) == 1

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.metrics_read})
    )
    async def test_organization_returns_own_dashboards(
        self,
        client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(save_fixture, organization=organization)

        response = await client.get("/v1/metrics/dashboards")
        assert response.status_code == 200

        json = response.json()
        assert len(json) == 1
        assert json[0]["id"] == str(dashboard.id)

    @pytest.mark.auth
    async def test_does_not_return_other_org_dashboards(
        self,
        client: AsyncClient,
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        # Dashboard belonging to an org the user is NOT a member of
        await create_dashboard(save_fixture, organization=organization_second)

        response = await client.get("/v1/metrics/dashboards")
        assert response.status_code == 200
        assert response.json() == []


@pytest.mark.asyncio
class TestCreateDashboard:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/metrics/dashboards",
            json={"name": "Test", "metrics": []},
        )
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.metrics_write}),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/metrics/dashboards",
            json={
                "name": "My Dashboard",
                "metrics": ["revenue", "orders"],
                "organization_id": str(organization.id),
            },
        )
        assert response.status_code == 201

        json = response.json()
        assert json["name"] == "My Dashboard"
        assert json["metrics"] == ["revenue", "orders"]
        assert json["organization_id"] == str(organization.id)
        assert "id" in json
        assert "created_at" in json

    @pytest.mark.auth
    async def test_empty_metrics(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/metrics/dashboards",
            json={
                "name": "Empty Dashboard",
                "metrics": [],
                "organization_id": str(organization.id),
            },
        )
        assert response.status_code == 201
        assert response.json()["metrics"] == []

    @pytest.mark.auth
    async def test_empty_name_rejected(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/metrics/dashboards",
            json={
                "name": "",
                "metrics": [],
                "organization_id": str(organization.id),
            },
        )
        assert response.status_code == 422

    @pytest.mark.auth
    async def test_too_many_metrics_rejected(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.post(
            "/v1/metrics/dashboards",
            json={
                "name": "Big Dashboard",
                "metrics": [f"metric_{i}" for i in range(11)],
                "organization_id": str(organization.id),
            },
        )
        assert response.status_code == 422

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.metrics_write})
    )
    async def test_organization_token(
        self,
        client: AsyncClient,
        organization: Organization,
    ) -> None:
        response = await client.post(
            "/v1/metrics/dashboards",
            json={"name": "Org Dashboard", "metrics": ["revenue"]},
        )
        assert response.status_code == 201
        assert response.json()["organization_id"] == str(organization.id)


@pytest.mark.asyncio
class TestGetDashboard:
    async def test_anonymous(
        self,
        client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(save_fixture, organization=organization)
        response = await client.get(f"/v1/metrics/dashboards/{dashboard.id}")
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.metrics_read}),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(
            save_fixture, organization=organization, name="My Dashboard"
        )

        response = await client.get(f"/v1/metrics/dashboards/{dashboard.id}")
        assert response.status_code == 200

        json = response.json()
        assert json["id"] == str(dashboard.id)
        assert json["name"] == "My Dashboard"
        assert json["organization_id"] == str(organization.id)

    @pytest.mark.auth
    async def test_not_found(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/metrics/dashboards/{uuid.uuid4()}")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_cannot_access_other_org_dashboard(
        self,
        client: AsyncClient,
        organization_second: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(
            save_fixture, organization=organization_second
        )
        response = await client.get(f"/v1/metrics/dashboards/{dashboard.id}")
        assert response.status_code == 404


@pytest.mark.asyncio
class TestUpdateDashboard:
    async def test_anonymous(
        self,
        client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(save_fixture, organization=organization)
        response = await client.patch(
            f"/v1/metrics/dashboards/{dashboard.id}", json={"name": "New Name"}
        )
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.metrics_write}),
    )
    async def test_update_name(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(save_fixture, organization=organization)

        response = await client.patch(
            f"/v1/metrics/dashboards/{dashboard.id}", json={"name": "Renamed"}
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Renamed"

    @pytest.mark.auth
    async def test_update_metrics(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(
            save_fixture, organization=organization, metrics=["revenue"]
        )

        response = await client.patch(
            f"/v1/metrics/dashboards/{dashboard.id}",
            json={"metrics": ["orders", "checkouts"]},
        )
        assert response.status_code == 200
        assert response.json()["metrics"] == ["orders", "checkouts"]

    @pytest.mark.auth
    async def test_partial_update_preserves_other_fields(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(
            save_fixture,
            organization=organization,
            name="Original",
            metrics=["revenue"],
        )

        response = await client.patch(
            f"/v1/metrics/dashboards/{dashboard.id}", json={"name": "Updated"}
        )
        assert response.status_code == 200
        json = response.json()
        assert json["name"] == "Updated"
        assert json["metrics"] == ["revenue"]

    @pytest.mark.auth
    async def test_not_found(self, client: AsyncClient) -> None:
        response = await client.patch(
            f"/v1/metrics/dashboards/{uuid.uuid4()}", json={"name": "X"}
        )
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_cannot_update_other_org_dashboard(
        self,
        client: AsyncClient,
        organization_second: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(
            save_fixture, organization=organization_second
        )
        response = await client.patch(
            f"/v1/metrics/dashboards/{dashboard.id}", json={"name": "Hacked"}
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestDeleteDashboard:
    async def test_anonymous(
        self,
        client: AsyncClient,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(save_fixture, organization=organization)
        response = await client.delete(f"/v1/metrics/dashboards/{dashboard.id}")
        assert response.status_code == 401

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.metrics_write}),
    )
    async def test_valid(
        self,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(save_fixture, organization=organization)

        response = await client.delete(f"/v1/metrics/dashboards/{dashboard.id}")
        assert response.status_code == 204

    @pytest.mark.auth
    async def test_not_found(self, client: AsyncClient) -> None:
        response = await client.delete(f"/v1/metrics/dashboards/{uuid.uuid4()}")
        assert response.status_code == 404

    @pytest.mark.auth
    async def test_cannot_delete_other_org_dashboard(
        self,
        client: AsyncClient,
        organization_second: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        dashboard = await create_dashboard(
            save_fixture, organization=organization_second
        )
        response = await client.delete(f"/v1/metrics/dashboards/{dashboard.id}")
        assert response.status_code == 404
