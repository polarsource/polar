from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.models import Organization, VoidActivity, VoidActivitySpan
from polar.void.activity.taxonomy import TAXONOMY
from tests.fixtures.database import SaveFixture
from tests.void.conftest import VERSION, activate_version
from tests.void.test_endpoints import TOKEN, create_token

PATH = "/v1/void/activities"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


@pytest.mark.asyncio
class TestActivities:
    async def test_report_and_span(
        self,
        void_client: AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_token(save_fixture, organization, scopes={Scope.void_read})
        empty = await void_client.get(PATH, headers=HEADERS)
        assert empty.status_code == 200
        assert empty.json()["by_activity"] == []
        await activate_version(save_fixture, organization)
        definition = VoidActivity(
            organization_id=organization.id,
            slug="agent",
            version_id=VERSION,
            event_name="llm.completion",
            group_by="call_id",
            run_by="run_id",
            taxonomy=TAXONOMY,
        )
        await save_fixture(definition)
        await save_fixture(
            VoidActivitySpan(
                organization_id=organization.id,
                activity_id=definition.id,
                version_id=VERSION,
                taxonomy=TAXONOMY,
                span_key="call_1",
                event_name="llm.completion",
                external_identity_id="actor",
                run_key="run_1",
                activity="implement",
                activity_confidence=0.9,
                waste=0.1,
                cost=0.04,
                input_tokens=12,
                output_tokens=3,
                event_count=1,
                first_event_at=datetime(2026, 1, 1, tzinfo=UTC),
                last_event_at=datetime(2026, 1, 1, tzinfo=UTC),
                state_hash="abc",
            )
        )
        listed = await void_client.get(
            PATH, headers=HEADERS, params={"identity": "actor"}
        )
        assert listed.status_code == 200
        body = listed.json()
        assert body["taxonomy"] == TAXONOMY
        assert body["by_activity"][0]["slug"] == "implement"
        assert body["runs"][0]["run_key"] == "run_1"
        span = await void_client.get(f"{PATH}/spans/call_1", headers=HEADERS)
        assert span.status_code == 200
        assert span.json()["activity"] == "implement"
        missing = await void_client.get(f"{PATH}/spans/missing", headers=HEADERS)
        assert missing.status_code == 404
