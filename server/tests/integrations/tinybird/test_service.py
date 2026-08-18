import asyncio
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
import respx
from sqlalchemy import select

from polar.integrations.tinybird.client import (
    MAX_RETRIES,
    TinybirdClient,
    TinybirdOperationalError,
    TinybirdRequestError,
)
from polar.integrations.tinybird.service import (
    DATASOURCE_EVENTS,
    TinybirdEventsQuery,
    TinybirdEventTypesQuery,
    _compile,
    _event_to_tinybird,
    clickhouse_dialect,
    count_user_events_by_organization,
    events_table,
)
from polar.meter.filter import (
    Filter,
    FilterClause,
    FilterConjunction,
    FilterOperator,
)
from polar.models import Event
from polar.models.event import EventSource
from tests.fixtures.tinybird import tinybird_available

pytestmark = pytest.mark.xdist_group(name="tinybird")


def create_test_event(
    *,
    organization_id: uuid.UUID | None = None,
    name: str = "test.event",
    source: EventSource = EventSource.system,
    user_metadata: dict[str, object] | None = None,
) -> Event:
    """Create an Event object for testing (not persisted to DB)."""
    now = datetime.now(UTC)
    event = Event(
        id=uuid.uuid4(),
        ingested_at=now,
        timestamp=now,
        name=name,
        source=source,
        organization_id=organization_id or uuid.uuid4(),
        user_metadata=user_metadata or {},
    )
    return event


class TestEventToTinybird:
    def test_basic_conversion(self) -> None:
        event = create_test_event(name="order.paid")
        result = _event_to_tinybird(event)

        assert result["id"] == str(event.id)
        assert result["name"] == "order.paid"
        assert result["source"] == "system"
        assert result["organization_id"] == str(event.organization_id)
        assert result["user_metadata"] == "{}"

    def test_system_event_denormalizes_metadata(self) -> None:
        event = create_test_event(
            name="order.paid",
            source=EventSource.system,
            user_metadata={
                "amount": 1000,
                "currency": "usd",
                "order_id": "order_123",
            },
        )
        result = _event_to_tinybird(event)

        assert result["amount"] == 1000
        assert result["currency"] == "usd"
        assert result["order_id"] == "order_123"
        assert result["user_metadata"] == "{}"

    def test_user_event_does_not_denormalize_metadata(self) -> None:
        event = create_test_event(
            name="custom.event",
            source=EventSource.user,
            user_metadata={
                "meter_id": "meter_credits_usage",
                "amount": 0.24,
                "currency": "usd",
            },
        )
        result = _event_to_tinybird(event)

        assert result["meter_id"] is None
        assert result["amount"] is None
        assert result["currency"] is None
        metadata = json.loads(result["user_metadata"])
        assert metadata["meter_id"] == "meter_credits_usage"
        assert metadata["amount"] == 0.24
        assert metadata["currency"] == "usd"

    def test_user_event_still_extracts_cost_and_llm(self) -> None:
        event = create_test_event(
            name="llm.request",
            source=EventSource.user,
            user_metadata={
                "_cost": {"amount": 0.05, "currency": "usd"},
                "_llm": {
                    "vendor": "openai",
                    "model": "gpt-4",
                    "input_tokens": 100,
                    "output_tokens": 50,
                },
            },
        )
        result = _event_to_tinybird(event)

        assert result["source"] == "user"
        assert result["cost_amount"] == 0.05
        assert result["cost_currency"] == "usd"
        assert result["llm_vendor"] == "openai"
        assert result["llm_model"] == "gpt-4"
        assert result["llm_input_tokens"] == 100
        assert result["llm_output_tokens"] == 50
        assert result["user_metadata"] == "{}"

    def test_nullable_fields_are_none(self) -> None:
        event = create_test_event()
        result = _event_to_tinybird(event)

        assert result["customer_id"] is None
        assert result["external_customer_id"] is None
        assert result["parent_id"] is None
        assert result["meter_id"] is None
        assert result["amount"] is None


def compile_clause(clause: Any) -> tuple[str, dict[str, Any]]:
    compiled = clause.compile(
        dialect=clickhouse_dialect, compile_kwargs={"render_postcompile": True}
    )
    return str(compiled), dict(compiled.params)


class TestQueryWildcardsAreLiteral:
    def test_filter_name_query(self) -> None:
        query = TinybirdEventsQuery([uuid.uuid4()]).filter_name_query("ai_gen%")
        sql, params = compile_clause(query._filters[-1])
        assert "positionCaseInsensitiveUTF8(`events_by_timestamp`.`name`," in sql
        assert "like" not in sql.lower()
        assert "ai_gen%" in params.values()

    def test_filter_by_query(self) -> None:
        query = TinybirdEventsQuery([uuid.uuid4()]).filter_by_query("100%_x")
        sql, params = compile_clause(query._filters[-1])
        for column in ("name", "source", "user_metadata"):
            assert (
                f"positionCaseInsensitiveUTF8(`events_by_timestamp`.`{column}`," in sql
            )
        assert list(params.values()).count("100%_x") == 3

    def test_like_operator(self) -> None:
        clause = FilterClause(
            property="name", operator=FilterOperator.like, value="api_test"
        )
        sql, params = compile_clause(
            TinybirdEventsQuery._ch_comparison(events_table.c.name, clause)
        )
        assert "position(toString(`events_by_timestamp`.`name`)," in sql
        assert "api_test" in params.values()

    def test_not_like_operator(self) -> None:
        clause = FilterClause(
            property="name", operator=FilterOperator.not_like, value="api_test"
        )
        sql, params = compile_clause(
            TinybirdEventsQuery._ch_comparison(events_table.c.name, clause)
        )
        assert "position(toString(`events_by_timestamp`.`name`)," in sql
        assert "<= " in sql
        assert "api_test" in params.values()

    def test_like_operator_numeric_column(self) -> None:
        clause = FilterClause(
            property="_cost.amount", operator=FilterOperator.like, value=10
        )
        sql, params = compile_clause(
            TinybirdEventsQuery._ch_comparison(events_table.c.cost_amount, clause)
        )
        assert "position(toString(`events_by_timestamp`.`cost_amount`)," in sql
        assert "10" in params.values()


class TestQueryBindsValuesInsteadOfInlining:
    def _compile_filters(
        self, query: TinybirdEventsQuery
    ) -> tuple[str, dict[str, Any]]:
        statement = select(events_table.c.name).where(query._get_organization_filter())
        for f in query._filters:
            statement = statement.where(f)
        return _compile(statement)

    def test_injection_payloads_never_reach_the_sql_string(self) -> None:
        query = TinybirdEventsQuery([uuid.uuid4()])
        query.filter_name_query("aaa\\")
        query.filter_customer(external_customer_ids=["e\\", "e2"])
        query.filter_by_query("uniontest")
        query.filter_by_filter(
            Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="name",
                        operator=FilterOperator.eq,
                        value="') UNION SELECT customer_email FROM events --",
                    )
                ],
            )
        )
        sql, params = self._compile_filters(query)

        for injected in (
            "UNION SELECT",
            "customer_email",
            "--",
            "e\\",
            "aaa\\",
        ):
            assert injected not in sql
        assert "') UNION SELECT customer_email FROM events --" in params.values()

    def test_value_is_a_typed_placeholder(self) -> None:
        query = TinybirdEventsQuery([uuid.uuid4()]).filter_by_filter(
            Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="name", operator=FilterOperator.eq, value="O'Brien"
                    )
                ],
            )
        )
        sql, params = self._compile_filters(query)
        assert "{name_1:String}" in sql
        assert "O'Brien" in params.values()

    def test_in_list_placeholders_are_typed_by_column(self) -> None:
        statement = select(events_table.c.name).where(
            events_table.c.organization_id.in_(["a", "b"]),
            events_table.c.cost_amount.in_([1.5, 2.5]),
        )
        sql, _ = _compile(statement)
        assert "{organization_id_1_1:String}" in sql
        assert "{cost_amount_1_1:Float64}" in sql


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
class TestTinybirdEventsQuery:
    async def test_get_event_type_stats(self, tinybird_client: TinybirdClient) -> None:
        org_id = uuid.uuid4()
        events = [
            create_test_event(
                organization_id=org_id,
                name="order.created",
                source=EventSource.system,
            ),
            create_test_event(
                organization_id=org_id,
                name="order.created",
                source=EventSource.system,
            ),
            create_test_event(
                organization_id=org_id,
                name="order.created",
                source=EventSource.system,
            ),
            create_test_event(
                organization_id=org_id,
                name="subscription.created",
                source=EventSource.system,
            ),
            create_test_event(
                organization_id=org_id,
                name="custom.event",
                source=EventSource.user,
            ),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventsQuery([org_id])
        stats = await query.get_event_type_stats()

        stats_by_name = {(s.name, s.source): s for s in stats}

        assert len(stats) == 3
        assert stats_by_name[("order.created", EventSource.system)].occurrences == 3
        assert (
            stats_by_name[("subscription.created", EventSource.system)].occurrences == 1
        )
        assert stats_by_name[("custom.event", EventSource.user)].occurrences == 1

    async def test_filter_by_source(self, tinybird_client: TinybirdClient) -> None:
        org_id = uuid.uuid4()
        events = [
            create_test_event(
                organization_id=org_id, name="system.event", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="system.event", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="user.event", source=EventSource.user
            ),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventsQuery([org_id]).filter_source(EventSource.user)
        stats = await query.get_event_type_stats()

        assert len(stats) == 1
        assert stats[0].name == "user.event"
        assert stats[0].occurrences == 1

    async def test_filter_by_customer_id(self, tinybird_client: TinybirdClient) -> None:
        org_id = uuid.uuid4()
        customer_1 = uuid.uuid4()
        customer_2 = uuid.uuid4()

        events = [
            create_test_event(
                organization_id=org_id, name="event.a", source=EventSource.user
            ),
            create_test_event(
                organization_id=org_id, name="event.a", source=EventSource.user
            ),
            create_test_event(
                organization_id=org_id, name="event.b", source=EventSource.user
            ),
        ]
        events[0].customer_id = customer_1
        events[1].customer_id = customer_1
        events[2].customer_id = customer_2

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventsQuery([org_id]).filter_customer(customer_ids=[customer_1])
        stats = await query.get_event_type_stats()

        assert len(stats) == 1
        assert stats[0].name == "event.a"
        assert stats[0].occurrences == 2

    async def test_get_event_type_stats_from_mv(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_id = uuid.uuid4()
        customer_id = uuid.uuid4()
        events = [
            create_test_event(organization_id=org_id, name="page.viewed"),
            create_test_event(organization_id=org_id, name="page.viewed"),
            create_test_event(organization_id=org_id, name="page.viewed"),
            create_test_event(organization_id=org_id, name="page.viewed"),
            create_test_event(organization_id=org_id, name="button.clicked"),
            create_test_event(organization_id=org_id, name="button.clicked"),
            create_test_event(organization_id=org_id, name="form.submitted"),
        ]
        for e in events:
            e.customer_id = customer_id

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventTypesQuery(org_id)
        stats = await query.get_event_type_stats()

        stats_by_name = {s.name: s for s in stats}
        assert len(stats) == 3
        assert stats_by_name["page.viewed"].occurrences == 4
        assert stats_by_name["button.clicked"].occurrences == 2
        assert stats_by_name["form.submitted"].occurrences == 1

    async def test_organization_isolation(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_1 = uuid.uuid4()
        org_2 = uuid.uuid4()

        events = [
            create_test_event(
                organization_id=org_1, name="org1.event", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_1, name="org1.event", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_2, name="org2.event", source=EventSource.system
            ),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventsQuery([org_1])
        stats = await query.get_event_type_stats()

        assert len(stats) == 1
        assert stats[0].name == "org1.event"
        assert stats[0].occurrences == 2

    async def test_multiple_organizations(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_1 = uuid.uuid4()
        org_2 = uuid.uuid4()

        events = [
            create_test_event(
                organization_id=org_1, name="shared.event", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_1, name="shared.event", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_2, name="shared.event", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_2, name="org2.only", source=EventSource.user
            ),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        query = TinybirdEventsQuery([org_1, org_2])
        stats = await query.get_event_type_stats()

        stats_by_key = {(s.organization_id, s.name, s.source): s for s in stats}
        assert len(stats) == 3
        assert (
            stats_by_key[(org_1, "shared.event", EventSource.system)].occurrences == 2
        )
        assert (
            stats_by_key[(org_2, "shared.event", EventSource.system)].occurrences == 1
        )
        assert stats_by_key[(org_2, "org2.only", EventSource.user)].occurrences == 1

    async def test_statistics_methods_execute_with_bound_params(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_id = uuid.uuid4()
        customer_id = uuid.uuid4()
        events = []
        for i in range(4):
            event = create_test_event(
                organization_id=org_id,
                name="llm.request",
                source=EventSource.user,
                user_metadata={
                    "_cost": {"amount": float(i + 1), "currency": "usd"},
                    "_llm": {"model": "gpt-4", "vendor": "openai"},
                },
            )
            event.customer_id = customer_id
            events.append(event)

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        property_stats = await TinybirdEventsQuery([org_id]).get_property_group_stats(
            "_llm.model", ["_cost.amount"]
        )
        timeseries = await TinybirdEventsQuery([org_id]).get_timeseries_stats(
            "day", "UTC", ["_cost.amount"]
        )
        customer_stats = await TinybirdEventsQuery([org_id]).get_customer_stats(
            ["_cost.amount"]
        )
        variance = await TinybirdEventsQuery([org_id]).get_variance_events(
            ["_cost.amount"]
        )

        assert property_stats[0].value == "gpt-4"
        assert property_stats[0].occurrences == 4
        assert property_stats[0].totals["_cost_amount"] == 10.0
        assert timeseries[0].occurrences == 4
        assert timeseries[0].customers == 1
        assert customer_stats[0].occurrences == 4
        assert len(variance) >= 1

    async def test_property_group_stats_on_custom_metadata_key(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_id = uuid.uuid4()
        events = [
            create_test_event(
                organization_id=org_id,
                name="checkout",
                source=EventSource.user,
                user_metadata={"tier": tier},
            )
            for tier in ("pro", "pro", "free")
        ]
        await tinybird_client.ingest(
            DATASOURCE_EVENTS, [_event_to_tinybird(e) for e in events], wait=True
        )

        stats = await TinybirdEventsQuery([org_id]).get_property_group_stats(
            "tier", ["_cost.amount"]
        )

        by_value = {s.value: s.occurrences for s in stats}
        assert by_value == {"pro": 2, "free": 1}


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
class TestSearchBehaviorAndInjectionSafety:
    async def _ingest(self, tinybird_client: TinybirdClient, org_id: uuid.UUID) -> None:
        events = [
            create_test_event(
                organization_id=org_id,
                name="checkout.completed",
                source=EventSource.user,
            ),
            create_test_event(
                organization_id=org_id, name="checkout.failed", source=EventSource.user
            ),
            create_test_event(
                organization_id=org_id, name="login.success", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="weird'na\\me", source=EventSource.system
            ),
        ]
        await tinybird_client.ingest(
            DATASOURCE_EVENTS, [_event_to_tinybird(e) for e in events], wait=True
        )

    async def test_searches_return_correct_results(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_id = uuid.uuid4()
        await self._ingest(tinybird_client, org_id)

        async def count(query: TinybirdEventsQuery) -> int:
            _, total = await query.get_event_ids_and_count(100, 0)
            return total

        assert await count(TinybirdEventsQuery([org_id])) == 4
        assert (
            await count(TinybirdEventsQuery([org_id]).filter_name_query("checkout"))
            == 2
        )
        assert (
            await count(TinybirdEventsQuery([org_id]).filter_name_query("CHECKOUT"))
            == 2
        )
        assert (
            await count(TinybirdEventsQuery([org_id]).filter_source(EventSource.system))
            == 2
        )
        assert (
            await count(TinybirdEventsQuery([org_id]).filter_name_query("d'na\\m")) == 1
        )

    async def test_wildcards_are_literal_not_operators(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_id = uuid.uuid4()
        await self._ingest(tinybird_client, org_id)
        _, total = await (
            TinybirdEventsQuery([org_id])
            .filter_name_query("check%")
            .get_event_ids_and_count(100, 0)
        )
        assert total == 0

    async def test_injection_payloads_are_inert(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_id = uuid.uuid4()
        await self._ingest(tinybird_client, org_id)

        _, breakout_total = await (
            TinybirdEventsQuery([org_id])
            .filter_name_query("' OR 1=1 -- ")
            .get_event_ids_and_count(100, 0)
        )
        assert breakout_total == 0

        _, throwif_total = await (
            TinybirdEventsQuery([org_id])
            .filter_name_query("z' OR throwIf(1=1) -- ")
            .get_event_ids_and_count(100, 0)
        )
        assert throwif_total == 0


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
class TestCountUserEventsByOrganization:
    async def test_groups_counts_and_filters(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_a = uuid.uuid4()
        org_b = uuid.uuid4()
        org_excluded = uuid.uuid4()
        now = datetime.now(UTC)
        events = [
            create_test_event(organization_id=org_a, source=EventSource.user),
            create_test_event(organization_id=org_a, source=EventSource.user),
            create_test_event(organization_id=org_a, source=EventSource.system),
            create_test_event(organization_id=org_b, source=EventSource.user),
            create_test_event(organization_id=org_excluded, source=EventSource.user),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        counts = await count_user_events_by_organization(
            after=now - timedelta(minutes=1),
            until=now + timedelta(minutes=1),
            exclude_organization_id=org_excluded,
        )

        assert counts[org_a] == 2
        assert counts[org_b] == 1
        assert org_excluded not in counts

    async def test_after_is_exclusive_until_is_inclusive(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_id = uuid.uuid4()
        boundary = datetime.now(UTC).replace(microsecond=123000)
        event_at_boundary = create_test_event(
            organization_id=org_id, source=EventSource.user
        )
        event_at_boundary.ingested_at = boundary
        event_after_boundary = create_test_event(
            organization_id=org_id, source=EventSource.user
        )
        event_after_boundary.ingested_at = boundary + timedelta(milliseconds=1)

        tinybird_events = [
            _event_to_tinybird(e) for e in (event_at_boundary, event_after_boundary)
        ]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        counts = await count_user_events_by_organization(
            after=boundary,
            until=boundary + timedelta(milliseconds=1),
            exclude_organization_id=uuid.uuid4(),
        )

        assert counts[org_id] == 1

    async def test_deduplicates_by_event_id(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_id = uuid.uuid4()
        now = datetime.now(UTC)
        event = create_test_event(organization_id=org_id, source=EventSource.user)

        tinybird_event = _event_to_tinybird(event)
        await tinybird_client.ingest(DATASOURCE_EVENTS, [tinybird_event], wait=True)
        await tinybird_client.ingest(DATASOURCE_EVENTS, [tinybird_event], wait=True)

        counts = await count_user_events_by_organization(
            after=now - timedelta(minutes=1),
            until=now + timedelta(minutes=1),
            exclude_organization_id=uuid.uuid4(),
        )

        assert counts[org_id] == 1

    async def test_no_lower_bound_when_after_is_none(
        self, tinybird_client: TinybirdClient
    ) -> None:
        org_id = uuid.uuid4()
        now = datetime.now(UTC)
        old_event = create_test_event(organization_id=org_id, source=EventSource.user)
        old_event.ingested_at = now - timedelta(days=365)
        recent_event = create_test_event(
            organization_id=org_id, source=EventSource.user
        )

        tinybird_events = [_event_to_tinybird(e) for e in (old_event, recent_event)]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        counts = await count_user_events_by_organization(
            after=None,
            until=now + timedelta(minutes=1),
            exclude_organization_id=uuid.uuid4(),
        )

        assert counts[org_id] == 2


async def _get_source_stats(
    client: TinybirdClient, org_id: uuid.UUID
) -> dict[str, int]:
    rows = await client.query(
        f"SELECT name, count() as cnt FROM {DATASOURCE_EVENTS} "
        f"WHERE organization_id = '{org_id}' GROUP BY name",
        db_statement="delete_test_stats",
    )
    return {row["name"]: row["cnt"] for row in rows}


@pytest.mark.skipif(not tinybird_available(), reason="Tinybird not running")
@pytest.mark.asyncio
class TestTinybirdDelete:
    async def test_delete_by_id(self, tinybird_client: TinybirdClient) -> None:
        org_id = uuid.uuid4()
        events = [
            create_test_event(
                organization_id=org_id, name="delete.test", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="delete.test", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="keep.test", source=EventSource.system
            ),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        stats_before = await _get_source_stats(tinybird_client, org_id)
        assert stats_before["delete.test"] == 2
        assert stats_before["keep.test"] == 1

        event_to_delete = events[0]
        delete_condition = f"id = '{event_to_delete.id}'"
        result = await tinybird_client.delete(DATASOURCE_EVENTS, delete_condition)

        assert "job_id" in result
        job_id = result["job_id"]

        job = await tinybird_client.get_job(job_id)
        while job.get("status") not in ("done", "error"):
            await asyncio.sleep(0.5)
            job = await tinybird_client.get_job(job_id)

        assert job["status"] == "done"

        stats_after = await _get_source_stats(tinybird_client, org_id)
        assert stats_after["delete.test"] == 1
        assert stats_after["keep.test"] == 1

    async def test_delete_multiple_by_id(self, tinybird_client: TinybirdClient) -> None:
        org_id = uuid.uuid4()
        events = [
            create_test_event(
                organization_id=org_id, name="batch.delete", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="batch.delete", source=EventSource.system
            ),
            create_test_event(
                organization_id=org_id, name="batch.keep", source=EventSource.system
            ),
        ]

        tinybird_events = [_event_to_tinybird(e) for e in events]
        await tinybird_client.ingest(DATASOURCE_EVENTS, tinybird_events, wait=True)

        stats_before = await _get_source_stats(tinybird_client, org_id)
        assert stats_before["batch.delete"] == 2
        assert stats_before["batch.keep"] == 1

        ids_to_delete = [str(events[0].id), str(events[1].id)]
        delete_condition = f"id IN ('{ids_to_delete[0]}', '{ids_to_delete[1]}')"
        result = await tinybird_client.delete(DATASOURCE_EVENTS, delete_condition)

        job_id = result["job_id"]
        job = await tinybird_client.get_job(job_id)
        while job.get("status") not in ("done", "error"):
            await asyncio.sleep(0.5)
            job = await tinybird_client.get_job(job_id)

        assert job["status"] == "done"

        stats_after = await _get_source_stats(tinybird_client, org_id)
        assert "batch.delete" not in stats_after
        assert stats_after["batch.keep"] == 1


@pytest.mark.asyncio
class TestRequestWithRetry:
    async def test_retries_on_timeout(self) -> None:
        client = TinybirdClient(
            api_url="https://api.tinybird.co",
            clickhouse_url="https://clickhouse.tinybird.co",
            api_token="test_token",
            read_token="test_token",
            clickhouse_username="test",
            clickhouse_token="test_token",
        )

        call_count = 0

        def side_effect(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise httpx.ReadTimeout("timed out", request=request)
            return httpx.Response(200, json={"data": []})

        with respx.mock:
            respx.get("https://api.tinybird.co/v0/pipes/metrics.json").mock(
                side_effect=side_effect
            )
            result = await client.endpoint("metrics")

        assert result == []
        assert call_count == 3

    async def test_raises_after_all_retries_exhausted_on_timeout(self) -> None:
        client = TinybirdClient(
            api_url="https://api.tinybird.co",
            clickhouse_url="https://clickhouse.tinybird.co",
            api_token="test_token",
            read_token="test_token",
            clickhouse_username="test",
            clickhouse_token="test_token",
        )

        def side_effect(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectTimeout("connect timed out", request=request)

        with respx.mock:
            respx.get("https://api.tinybird.co/v0/pipes/metrics.json").mock(
                side_effect=side_effect
            )
            with pytest.raises(TinybirdOperationalError):
                await client.endpoint("metrics")

    async def test_retries_on_connection_error(self) -> None:
        client = TinybirdClient(
            api_url="https://api.tinybird.co",
            clickhouse_url="https://clickhouse.tinybird.co",
            api_token="test_token",
            read_token="test_token",
            clickhouse_username="test",
            clickhouse_token="test_token",
        )

        call_count = 0

        def side_effect(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise httpx.ConnectError("connection refused", request=request)
            return httpx.Response(200, json={"data": []})

        with respx.mock:
            respx.get("https://api.tinybird.co/v0/pipes/metrics.json").mock(
                side_effect=side_effect
            )
            result = await client.endpoint("metrics")

        assert result == []
        assert call_count == 2

    async def test_total_attempts_is_max_retries_plus_one(self) -> None:
        client = TinybirdClient(
            api_url="https://api.tinybird.co",
            clickhouse_url="https://clickhouse.tinybird.co",
            api_token="test_token",
            read_token="test_token",
            clickhouse_username="test",
            clickhouse_token="test_token",
        )

        call_count = 0

        def side_effect(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            raise httpx.ReadTimeout("timed out", request=request)

        with respx.mock:
            respx.get("https://api.tinybird.co/v0/pipes/metrics.json").mock(
                side_effect=side_effect
            )
            with pytest.raises(TinybirdOperationalError):
                await client.endpoint("metrics")

        assert call_count == MAX_RETRIES + 1


@pytest.mark.asyncio
class TestTinybirdRequestError:
    async def test_endpoint_400_raises_request_error_with_body(self) -> None:
        error_response = {
            "error": "[Error] Illegal type UUID of argument for aggregate function"
        }
        client = TinybirdClient(
            api_url="https://api.tinybird.co",
            clickhouse_url="https://clickhouse.tinybird.co",
            api_token="test_token",
            read_token="test_token",
            clickhouse_username="test",
            clickhouse_token="test_token",
        )

        with respx.mock:
            respx.get("https://api.tinybird.co/v0/pipes/metrics.json").mock(
                return_value=httpx.Response(400, json=error_response)
            )

            with pytest.raises(TinybirdRequestError) as exc_info:
                await client.endpoint("metrics", {"org_ids": "123"})

            error = exc_info.value
            assert error.status_code == 400
            assert error.endpoint == "metrics"
            assert error.error_body == error_response
            assert "Illegal type UUID" in str(error)

    async def test_endpoint_500_raises_operational_error(self) -> None:
        client = TinybirdClient(
            api_url="https://api.tinybird.co",
            clickhouse_url="https://clickhouse.tinybird.co",
            api_token="test_token",
            read_token="test_token",
            clickhouse_username="test",
            clickhouse_token="test_token",
        )

        with respx.mock:
            respx.get("https://api.tinybird.co/v0/pipes/metrics.json").mock(
                return_value=httpx.Response(500, text="Internal Server Error")
            )

            with pytest.raises(TinybirdOperationalError, match="500"):
                await client.endpoint("metrics")
