from datetime import UTC, datetime

import pytest

from polar.models import Organization, VoidActivitySpan
from polar.postgres import AsyncSession
from polar.void.activity.schemas import ActivityCreate
from polar.void.activity.service import activity as activity_service
from polar.void.activity.taxonomy import TAXONOMY
from polar.void.activity.typesafe import Judgment
from polar.void.identity.schemas import IdentityCreate
from polar.void.identity.service import identity as identity_service
from polar.void.sense.schemas import SenseCreate, SenseOverWindow
from polar.void.sense.service import SenseService
from tests.fixtures.database import SaveFixture
from tests.void.conftest import VERSION, activate_version


class FixedJudge:
    def __init__(self, noul: float = 0.81) -> None:
        self.noul = noul
        self.calls = 0

    async def judge(self, state: object, when: str) -> Judgment:
        self.calls += 1
        assert when == "retries, not progress"
        return Judgment(noul=self.noul, model="jev-test")


@pytest.mark.asyncio
class TestClassifySense:
    async def test_judges_a_window_and_skips_unchanged_state(
        self,
        session: AsyncSession,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        await activate_version(save_fixture, organization)
        await identity_service.ensure(
            session, organization, IdentityCreate(external_id="root")
        )
        definition = await activity_service.create(
            session,
            organization.id,
            ActivityCreate(
                version_id=VERSION,
                slug="agent",
                event_name="llm.completion",
                group_by="call_id",
                taxonomy=TAXONOMY,
            ),
        )
        sense = await SenseService().create(
            session,
            organization.id,
            SenseCreate(
                version_id=VERSION,
                slug="retry-storm",
                activity_id=definition.id,
                activity_slug="agent",
                when="retries, not progress",
                over=SenseOverWindow(type="window", amount=1, unit="hour"),
            ),
        )
        await save_fixture(
            VoidActivitySpan(
                organization_id=organization.id,
                activity_id=definition.id,
                version_id=VERSION,
                taxonomy=TAXONOMY,
                span_key="call_1",
                event_name="llm.completion",
                external_identity_id="root",
                run_key="run_1",
                activity="retry",
                activity_confidence=0.9,
                waste=0.8,
                cost=0.04,
                input_tokens=12,
                output_tokens=3,
                event_count=1,
                first_event_at=datetime(2026, 9, 17, tzinfo=UTC),
                last_event_at=datetime.now(tz=UTC),
                state_hash="span",
            )
        )
        judge = FixedJudge()
        service = SenseService(judge)
        first = await service.classify_sense(
            session, organization.id, sense.id, "root", ""
        )
        assert first is not None
        assert first.noul == 0.81
        assert judge.calls == 1
        second = await service.classify_sense(
            session, organization.id, sense.id, "root", ""
        )
        assert second is not None
        assert second.id == first.id
        assert judge.calls == 1
        states = await service.observations_for(
            session, organization.id, VERSION, ["root"]
        )
        assert len(states) == 1
        assert states[0].slug == "retry-storm"
        assert states[0].noul == 0.81
        assert states[0].identity_id == "root"
        assert states[0].run_key is None
