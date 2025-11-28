from datetime import UTC, timedelta

import pytest
from pydantic import ValidationError

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


class TestFilterClauseValueValidation:
    """Test validation of FilterClause.value field to prevent database overflow."""

    @pytest.mark.parametrize(
        "value",
        [
            2147483647,  # max valid int32
            -2147483648,  # min valid int32
            123,  # normal value
            0,  # zero
        ],
    )
    def test_valid_integer_values(self, value: int) -> None:
        """Test that valid integers within int32 range are accepted."""
        clause = FilterClause(property="test", operator=FilterOperator.eq, value=value)
        assert clause.value == value

    @pytest.mark.parametrize(
        "value",
        [
            2147483648,  # too large
            -2147483649,  # too small
            9999999999999999,  # extremely large
        ],
    )
    def test_invalid_integer_values(self, value: int) -> None:
        """Test that integers outside int32 range are rejected."""
        with pytest.raises(ValidationError):
            FilterClause(property="test", operator=FilterOperator.eq, value=value)

    @pytest.mark.parametrize(
        "value",
        [
            "short",  # normal string
            "a" * 1000,  # max length string
            "",  # empty string
            "test@example.com",  # email format
            "https://example.com/path",  # URL format
        ],
    )
    def test_valid_string_values(self, value: str) -> None:
        """Test that valid strings within length limit are accepted."""
        clause = FilterClause(property="test", operator=FilterOperator.eq, value=value)
        assert clause.value == value

    @pytest.mark.parametrize(
        "value",
        [
            "a" * 1001,  # exceeds max length by 1
            "a" * 2000,  # significantly exceeds max length
            "a" * 10000,  # extremely long string
        ],
    )
    def test_invalid_string_values(self, value: str) -> None:
        """Test that strings exceeding length limit are rejected."""
        with pytest.raises(ValidationError):
            FilterClause(property="test", operator=FilterOperator.eq, value=value)


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

    async def test_timestamp_not_like_integer_value(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        from datetime import datetime

        timestamp_with_345 = datetime.fromtimestamp(1234567890, tz=UTC)
        timestamp_without_345 = datetime.fromtimestamp(1600000000, tz=UTC)
        events = [
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                timestamp=timestamp_with_345,
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                timestamp=timestamp_without_345,
            ),
        ]

        filter = Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(
                    property="timestamp",
                    operator=FilterOperator.not_like,
                    value=345,
                )
            ],
        )

        repository = EventRepository.from_session(session)
        statement = repository.get_base_statement().where(filter.get_sql_clause(Event))
        matching_events = await repository.get_all(statement)

        assert len(matching_events) == 1
        assert matching_events[0].id == events[1].id

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

    async def test_number_comparisons_clause(
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
                metadata={"value": 0.01},
            ),
            await create_event(
                save_fixture,
                organization=organization,
                external_customer_id="customer_1",
                metadata={"value": 10},
            ),
        ]
        filter = Filter(
            conjunction=FilterConjunction.and_,
            clauses=[
                FilterClause(property="value", operator=FilterOperator.gt, value=1)
            ],
        )

        repository = EventRepository.from_session(session)
        statement = repository.get_base_statement().where(filter.get_sql_clause(Event))
        matching_events = await repository.get_all(statement)

        assert len(matching_events) == 1
        assert matching_events[0].id == events[1].id
