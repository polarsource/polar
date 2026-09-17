from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import Any

import pytest_asyncio

from polar.kit.utils import utc_now
from polar.models import Organization, VoidBillingIdentity, VoidMeter
from polar.postgres import AsyncSession
from polar.void.event.schemas import EventCreate, EventSource
from polar.void.event.service import event as event_service
from polar.void.identity.schemas import IdentityCreate
from polar.void.identity.service import identity as identity_service
from polar.void.meter.schemas import MeterCreate
from polar.void.meter.service import meter as meter_service
from polar.void.reducer.schemas import ReducerCreate
from polar.void.reducer.service import reducer as reducer_service
from polar.void.typesafe import Judgment as JevJudgment
from tests.fixtures.database import SaveFixture
from tests.void.conftest import VERSION, activate_version

WHEN = "most recent spend is retries or loops, not progress"


class FixedJudge:
    def __init__(self, noul: float = 0.81) -> None:
        self.noul = noul
        self.calls = 0
        self.states: list[dict[str, Any]] = []

    async def judge(self, state: Any, when: str) -> JevJudgment:
        self.calls += 1
        self.states.append(dict(state))
        assert when == WHEN
        return JevJudgment(noul=self.noul, model="jev-test")


@dataclass
class Tree:
    root: VoidBillingIdentity
    child: VoidBillingIdentity
    meter: VoidMeter


@pytest_asyncio.fixture
async def tree(
    session: AsyncSession, organization: Organization, save_fixture: SaveFixture
) -> Tree:
    await activate_version(save_fixture, organization)
    root, _ = await identity_service.ensure(
        session, organization, IdentityCreate(external_id="root")
    )
    child, _ = await identity_service.ensure(
        session,
        organization,
        IdentityCreate(external_id="child", parent_external_id="root"),
    )
    usage = await reducer_service.create(
        session,
        organization.id,
        ReducerCreate.model_validate(
            {
                "slug": "tokens",
                "filter": {
                    "conjunction": "and",
                    "clauses": [
                        {
                            "property": "name",
                            "operator": "eq",
                            "value": "llm.completion",
                        }
                    ],
                },
                "aggregation": {"func": "sum", "property": "output_tokens"},
            }
        ),
    )
    credit = await reducer_service.create(
        session,
        organization.id,
        ReducerCreate.model_validate(
            {
                "slug": "credit",
                "filter": {"conjunction": "and", "clauses": []},
                "aggregation": {"func": "sum", "property": "amount"},
            }
        ),
    )
    meter = await meter_service.create(
        session,
        organization.id,
        MeterCreate(
            version_id=VERSION,
            name="Tokens",
            slug="tokens",
            usage_reducer_id=usage.id,
            credit_reducer_id=credit.id,
            unit_amount=Decimal("0.001"),
        ),
    )
    return Tree(root=root, child=child, meter=meter)


def completion(
    external_id: str,
    *,
    identity: str = "child",
    minutes_ago: int = 5,
    name: str = "llm.completion",
    tools: list[str] | None = None,
    tool_errors: list[str] | None = None,
) -> EventCreate:
    return EventCreate(
        external_id=external_id,
        name=name,
        external_identity_id=identity,
        timestamp=utc_now() - timedelta(minutes=minutes_ago),
        metadata={
            "model": "anthropic/claude-sonnet",
            "input_tokens": 10,
            "output_tokens": 4,
            "cost": 0.02,
            "finish_reason": "stop",
            "tools": tools or [],
            "tool_errors": tool_errors or [],
        },
    )


async def ingest(
    session: AsyncSession, organization: Organization, *events: EventCreate
) -> None:
    await event_service.ingest(session, organization.id, list(events), EventSource.user)
