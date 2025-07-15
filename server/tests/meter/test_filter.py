from datetime import timedelta

import pytest

from polar.event.repository import EventRepository
from polar.kit.utils import utc_now
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import Event, Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event


def test_strip_metadata_prefix() -> None:
    filter = Filter(
        conjunction=FilterConjunction.and_,
        clauses=[
            FilterClause(
                property="metadata.property", operator=FilterOperator.eq, value="value"
            )
        ],
    )

    clause = filter.clauses[0]
    assert isinstance(clause, FilterClause)
    assert clause.property == "property"


@pytest.mark.asyncio
class TestFilter:
    async def test_timestamp_clause(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        now = utc_now()
        events = [
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                timestamp=now - timedelta(days=1),
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                timestamp=now,
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                timestamp=now + timedelta(days=1),
            ),
        ]

        filter = Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(
                    property="timestamp",
                    operator=FilterOperator.lt,
                    value=int(now.timestamp()),
                )
            ],
        )

        repository = EventRepository.from_session(session)
        statement = repository.get_base_statement().where(filter.get_sql_clause(Event))
        matching_events = await repository.get_all(statement)

        assert len(matching_events) == 1
        assert matching_events[0].id == events[0].id

    @pytest.mark.parametrize("value", [1, True])
    async def test_like_clause_non_string_value(
        self,
        value: int | bool,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        events = [
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"value": value},
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"value": str(value)},
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"value": "other_value"},
            ),
        ]
        filter = Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(
                    property="value", operator=FilterOperator.like, value=value
                )
            ],
        )

        repository = EventRepository.from_session(session)
        statement = repository.get_base_statement().where(filter.get_sql_clause(Event))
        matching_events = await repository.get_all(statement)

        assert len(matching_events) == 2

    async def test_boolean_clause_number_value(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        events = [
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"value": 1},
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"value": 0},
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"value": 1},
            ),
        ]
        filter = Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(property="value", operator=FilterOperator.eq, value=True)
            ],
        )

        repository = EventRepository.from_session(session)
        statement = repository.get_base_statement().where(filter.get_sql_clause(Event))
        matching_events = await repository.get_all(statement)

        assert len(matching_events) == 2
