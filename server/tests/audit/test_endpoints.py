from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization, User, UserOrganization
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_account

from .conftest import generate_audit_entry


@pytest.mark.asyncio
class TestAudit:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/audit/")

        assert response.status_code == 401

    @pytest.mark.auth(AuthSubjectFixture(scopes=set()))
    async def test_missing_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/audit/")

        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.web_write}))
    async def test_invalid_scope(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
    ) -> None:
        response = await client.get("/v1/audit/")

        assert response.status_code == 403

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.audit_read}))
    async def test_list_all(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        account = await create_account(
            save_fixture, user_organization.organization, user_organization.user
        )

        audit_entry = generate_audit_entry(account, organization)
        await save_fixture(audit_entry)

        response = await client.get("/v1/audit/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1

    @pytest.mark.auth(AuthSubjectFixture(scopes={Scope.audit_read}))
    async def test_filter_by_time_range(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        account = await create_account(
            save_fixture, user_organization.organization, user_organization.user
        )

        start_ts = datetime(2025, 4, 1, second=54, tzinfo=UTC)
        end_ts = datetime(2025, 4, 1, second=55, tzinfo=UTC)

        audit_entry_1 = generate_audit_entry(
            account, organization, start_ts=start_ts, end_ts=end_ts
        )
        await save_fixture(audit_entry_1)

        start_ts = datetime(2025, 4, 2, second=54, tzinfo=UTC)
        end_ts = datetime(2025, 4, 2, second=55, tzinfo=UTC)

        audit_entry_2 = generate_audit_entry(
            account, organization, start_ts=start_ts, end_ts=end_ts
        )
        await save_fixture(audit_entry_2)

        response = await client.get(
            "/v1/audit/",
            params={
                "start_ts": datetime(2025, 4, 1, tzinfo=UTC).isoformat(),
                "end_ts": datetime(2025, 4, 2, tzinfo=UTC).isoformat(),
            },
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(audit_entry_1.id)
