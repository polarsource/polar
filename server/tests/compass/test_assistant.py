import uuid
from datetime import date
from types import SimpleNamespace
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from pydantic import TypeAdapter

from polar.auth.scope import Scope
from polar.compass.assistant.agent import tools_for_scopes
from polar.compass.assistant.blocks import (
    AssistantBlock,
    InsightCardsBlock,
    MetricChartBlock,
    MetricChartPoint,
    TextBlock,
)
from polar.compass.assistant.customer_tools import get_customer_overview
from polar.compass.assistant.deps import AssistantDeps
from polar.compass.assistant.entity_tools import (
    list_checkouts,
    list_customers,
    list_disputes,
    list_orders,
    list_payouts,
    list_products,
    list_refunds,
    list_subscriptions,
)
from polar.compass.assistant.tools import get_insights, get_metrics


def _deps(scopes: set[Scope]) -> AssistantDeps:
    return AssistantDeps(
        session=None,  # type: ignore[arg-type] — denial paths never touch it
        auth_subject=SimpleNamespace(scopes=scopes),  # type: ignore[arg-type]
        organization_id=uuid.uuid4(),
        timezone=ZoneInfo("UTC"),
        today=date(2026, 7, 6),
    )


def _ctx(deps: AssistantDeps) -> Any:
    return SimpleNamespace(deps=deps)


class TestToolsForScopes:
    def test_metrics_read_grants_the_read_tools(self) -> None:
        tools = tools_for_scopes({Scope.metrics_read})

        assert get_metrics in tools
        assert get_insights in tools

    def test_scopes_grant_exactly_their_tools(self) -> None:
        tools = tools_for_scopes({Scope.orders_read})

        assert tools == [list_orders]

    def test_each_entity_scope_maps_to_its_tool(self) -> None:
        cases: dict[Scope, list[object]] = {
            Scope.subscriptions_read: [list_subscriptions],
            Scope.customers_read: [list_customers, get_customer_overview],
            Scope.products_read: [list_products],
            Scope.disputes_read: [list_disputes],
            Scope.checkouts_read: [list_checkouts],
            Scope.refunds_read: [list_refunds],
            Scope.payouts_read: [list_payouts],
        }
        for scope, tools in cases.items():
            assert tools_for_scopes({scope}) == tools

    def test_no_scopes_grant_nothing(self) -> None:
        assert tools_for_scopes(set()) == []


@pytest.mark.asyncio
class TestToolScopeGuards:
    async def test_get_metrics_denies_without_scope(self) -> None:
        deps = _deps(scopes=set())

        result = await get_metrics(_ctx(deps), ["monthly_recurring_revenue"])

        assert "Permission denied" in result
        assert "metrics:read" in result
        assert deps.blocks == []

    async def test_get_insights_denies_without_scope(self) -> None:
        deps = _deps(scopes=set())

        result = await get_insights(_ctx(deps))

        assert "Permission denied" in result
        assert deps.blocks == []

    async def test_entity_tools_deny_without_their_scope(self) -> None:
        deps = _deps(scopes={Scope.metrics_read})

        for tool in (
            list_orders,
            list_subscriptions,
            list_customers,
            list_products,
            list_disputes,
        ):
            result = await tool(_ctx(deps))
            assert "Permission denied" in result
        assert deps.blocks == []

    async def test_get_metrics_rejects_unknown_slugs_before_fetching(self) -> None:
        deps = _deps(scopes={Scope.metrics_read})

        result = await get_metrics(_ctx(deps), ["not_a_metric"])

        assert "Unknown metric slugs" in result
        assert deps.blocks == []


class TestAssistantBlocks:
    def test_union_round_trips_on_type(self) -> None:
        adapter: TypeAdapter[AssistantBlock] = TypeAdapter(AssistantBlock)
        chart = MetricChartBlock(
            metric="monthly_recurring_revenue",
            label="Monthly Recurring Revenue",
            unit="currency",
            points=[MetricChartPoint(timestamp="2026-07-01T00:00:00Z", value=1.0)],  # type: ignore[arg-type]
        )

        parsed = adapter.validate_python(chart.model_dump(mode="json"))

        assert isinstance(parsed, MetricChartBlock)
        assert parsed.type == "metric_chart"

    def test_text_and_cards_discriminate(self) -> None:
        adapter: TypeAdapter[AssistantBlock] = TypeAdapter(AssistantBlock)

        text = adapter.validate_python({"type": "text", "text": "hi"})
        cards = adapter.validate_python({"type": "insight_cards", "insights": []})

        assert isinstance(text, TextBlock)
        assert isinstance(cards, InsightCardsBlock)
