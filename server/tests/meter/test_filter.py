from datetime import timedelta

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

    def test_valid_integer_values(self) -> None:
        """Test that valid integers within int32 range are accepted."""
        # Test boundary values
        max_valid = FilterClause(property="test", operator=FilterOperator.eq, value=2147483647)
        assert max_valid.value == 2147483647
        
        min_valid = FilterClause(property="test", operator=FilterOperator.eq, value=-2147483648)
        assert min_valid.value == -2147483648
        
        # Test normal value
        normal = FilterClause(property="test", operator=FilterOperator.eq, value=123)
        assert normal.value == 123
        
        # Test zero
        zero = FilterClause(property="test", operator=FilterOperator.eq, value=0)
        assert zero.value == 0

    def test_invalid_integer_values(self) -> None:
        """Test that integers outside int32 range are rejected."""
        # Test value too large
        with pytest.raises(ValidationError) as exc_info:
            FilterClause(property="test", operator=FilterOperator.eq, value=2147483648)
        assert "less than or equal to 2147483647" in str(exc_info.value)
        
        # Test value too small
        with pytest.raises(ValidationError) as exc_info:
            FilterClause(property="test", operator=FilterOperator.eq, value=-2147483649)
        assert "greater than or equal to -2147483648" in str(exc_info.value)
        
        # Test extremely large value
        with pytest.raises(ValidationError):
            FilterClause(property="test", operator=FilterOperator.eq, value=9999999999999999)

    def test_non_integer_values_unaffected(self) -> None:
        """Test that string and boolean values are not affected by integer validation."""
        # Test string values (including numeric strings)
        string_clause = FilterClause(property="test", operator=FilterOperator.eq, value="9999999999999999")
        assert string_clause.value == "9999999999999999"
        
        empty_string = FilterClause(property="test", operator=FilterOperator.eq, value="")
        assert empty_string.value == ""
        
        # Test boolean values
        true_clause = FilterClause(property="test", operator=FilterOperator.eq, value=True)
        assert true_clause.value is True
        
        false_clause = FilterClause(property="test", operator=FilterOperator.eq, value=False)
        assert false_clause.value is False


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
