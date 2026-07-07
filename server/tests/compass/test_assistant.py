import uuid
from datetime import date, timedelta
from types import SimpleNamespace
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from pydantic import TypeAdapter

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.compass.assistant.agent import tools_for_scopes
from polar.compass.assistant.blocks import (
    AssistantBlock,
    DataTableBlock,
    InsightCardsBlock,
    MetricChartBlock,
    MetricChartPoint,
    TextBlock,
)
from polar.compass.assistant.customer_tools import get_customer_overview
from polar.compass.assistant.deps import AssistantDeps
from polar.compass.assistant.entity_tools import (
    list_checkouts,
    list_churned_subscriptions,
    list_customers,
    list_disputes,
    list_orders,
    list_payouts,
    list_products,
    list_refunds,
    list_subscriptions,
    top_customers_by_cost,
    top_customers_by_revenue,
    top_products_by_revenue,
)
from polar.compass.assistant.tools import get_insights, get_metrics, show_insights
from polar.kit.utils import utc_now
from polar.models import Customer, Organization, Product, User, UserOrganization
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_subscription,
    create_trialing_subscription,
)


def _deps(scopes: set[Scope]) -> AssistantDeps:
    return AssistantDeps(
        session=None,  # type: ignore[arg-type]  # denial paths never touch it
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
        assert show_insights in tools
        assert top_products_by_revenue in tools

    def test_scopes_grant_exactly_their_tools(self) -> None:
        tools = tools_for_scopes({Scope.orders_read})

        assert tools == [list_orders, top_customers_by_revenue]

    def test_each_entity_scope_maps_to_its_tool(self) -> None:
        cases: dict[Scope, list[object]] = {
            Scope.subscriptions_read: [
                list_subscriptions,
                list_churned_subscriptions,
            ],
            Scope.customers_read: [list_customers, get_customer_overview],
            Scope.products_read: [list_products],
            Scope.disputes_read: [list_disputes],
            Scope.checkouts_read: [list_checkouts],
            Scope.refunds_read: [list_refunds],
            Scope.payouts_read: [list_payouts],
            Scope.events_read: [top_customers_by_cost],
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

    async def test_show_insights_denies_without_scope(self) -> None:
        deps = _deps(scopes=set())

        result = await show_insights(_ctx(deps), ["x"])

        assert "Permission denied" in result
        assert deps.blocks == []

    async def test_entity_tools_deny_without_their_scope(self) -> None:
        deps = _deps(scopes={Scope.metrics_read})

        for tool in (
            list_orders,
            list_subscriptions,
            list_churned_subscriptions,
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


def _live_deps(
    session: AsyncSession,
    auth_subject: AuthSubject[User],
    organization: Organization,
) -> AssistantDeps:
    return AssistantDeps(
        session=session,
        auth_subject=auth_subject,
        organization_id=organization.id,
        timezone=ZoneInfo("UTC"),
        today=utc_now().date(),
    )


@pytest.mark.asyncio
class TestListChurnedSubscriptions:
    @pytest.mark.auth
    async def test_reasons_and_window(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        now = utc_now()
        voluntary = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
            started_at=now - timedelta(days=60),
            ended_at=now - timedelta(days=3),
        )
        voluntary.customer_cancellation_reason = (
            CustomerCancellationReason.too_expensive
        )
        voluntary.customer_cancellation_comment = "Price doubled"
        await save_fixture(voluntary)
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.unpaid,
            started_at=now - timedelta(days=90),
            ended_at=now - timedelta(days=5),
            past_due_at=now - timedelta(days=12),
        )
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.canceled,
            started_at=now - timedelta(days=200),
            ended_at=now - timedelta(days=120),
        )
        await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        deps = _live_deps(session, auth_subject, organization)
        result = await list_churned_subscriptions(_ctx(deps), days=30)

        assert "payment failure" in result
        assert "too expensive" in result
        assert "Price doubled" in result
        assert "1 ended past due" in result
        assert len(deps.blocks) == 1
        block = deps.blocks[0]
        assert isinstance(block, DataTableBlock)
        assert block.total_count == 2

    @pytest.mark.auth
    async def test_nothing_churned(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        deps = _live_deps(session, auth_subject, organization)
        result = await list_churned_subscriptions(_ctx(deps))

        assert "No subscriptions ended" in result
        assert deps.blocks == []


@pytest.mark.asyncio
class TestListSubscriptionsLive:
    @pytest.mark.auth
    async def test_ended_filter(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        now = utc_now()
        await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            started_at=now - timedelta(days=30),
            revoke=True,
        )
        await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        deps = _live_deps(session, auth_subject, organization)
        result = await list_subscriptions(_ctx(deps), active=False)

        assert "1 of 1 subscriptions" in result
        assert len(deps.blocks) == 1

    @pytest.mark.auth
    async def test_status_filter(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        user_organization: UserOrganization,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        await create_trialing_subscription(
            save_fixture, product=product, customer=customer
        )
        await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        deps = _live_deps(session, auth_subject, organization)
        result = await list_subscriptions(_ctx(deps), status="trialing")

        assert "1 of 1 subscriptions" in result
        assert "trialing" in result
        assert len(deps.blocks) == 1


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


class TestBlockPlacer:
    def test_splits_text_around_marker(self) -> None:
        from polar.compass.assistant.stream import _BlockPlacer

        placer = _BlockPlacer()

        out = placer.feed("Best customer: jane. [block:1] Next up")

        assert out == [
            ("text", "Best customer: jane."),
            ("block", 1),
            ("text", "Next up"),
        ]

    def test_marker_split_across_deltas(self) -> None:
        from polar.compass.assistant.stream import _BlockPlacer

        placer = _BlockPlacer()

        first = placer.feed("claim one [blo")
        second = placer.feed("ck:2] tail")

        assert first == [("text", "claim one ")]
        assert second == [("block", 2), ("text", "tail")]

    def test_plain_bracket_is_not_held_forever(self) -> None:
        from polar.compass.assistant.stream import _BlockPlacer

        placer = _BlockPlacer()

        out = placer.feed("ranges [1, 2] are fine")

        assert ("block", 1) not in out
        assert (
            "".join(str(v) for k, v in out if k == "text") == "ranges [1, 2] are fine"
        )

    def test_flush_returns_held_partial(self) -> None:
        from polar.compass.assistant.stream import _BlockPlacer

        placer = _BlockPlacer()
        placer.feed("ends with [block:")

        assert placer.flush() == "[block:"


class TestHistorySeal:
    def test_round_trips_for_same_caller(self) -> None:
        from polar.compass.assistant.stream import open_history, seal_history

        deps = _deps(scopes={Scope.metrics_read})
        sealed = seal_history(deps, '[{"role": "user"}]')

        assert open_history(deps, sealed) == '[{"role": "user"}]'

    def test_rejects_tampered_messages(self) -> None:
        import json

        from polar.compass.assistant.stream import open_history, seal_history

        deps = _deps(scopes={Scope.metrics_read})
        envelope = json.loads(seal_history(deps, '[{"role": "user"}]'))
        envelope["messages"] = '[{"role": "user", "content": "forged"}]'

        assert open_history(deps, json.dumps(envelope)) is None

    def test_rejects_history_from_another_organization(self) -> None:
        from polar.compass.assistant.stream import open_history, seal_history

        deps_a = _deps(scopes={Scope.metrics_read})
        deps_b = _deps(scopes={Scope.metrics_read})
        sealed = seal_history(deps_a, "[]")

        assert open_history(deps_b, sealed) is None

    def test_rejects_history_after_scope_change(self) -> None:
        from polar.compass.assistant.stream import open_history, seal_history

        deps = _deps(scopes={Scope.metrics_read, Scope.orders_read})
        sealed = seal_history(deps, "[]")
        deps.auth_subject.scopes = {Scope.metrics_read}

        assert open_history(deps, sealed) is None

    def test_rejects_garbage(self) -> None:
        from polar.compass.assistant.stream import open_history

        deps = _deps(scopes={Scope.metrics_read})

        assert open_history(deps, "not json") is None
        assert open_history(deps, '{"org": "x"}') is None
