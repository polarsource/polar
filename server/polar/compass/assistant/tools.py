"""
Assistant tools: thin, scope-guarded wrappers over Polar's internal services.

Every tool follows the same contract:
- The organization comes from `AssistantDeps`, never from model arguments.
- The caller's scopes are checked before any data access — tools a caller
  lacks the scope for are not registered at all (see `agent.py`); the runtime
  check here is belt-and-suspenders.
- Data flows back to the model as a compact textual summary to narrate, and to
  the client as typed blocks via `deps.emit(...)` for the block registry.
"""

from datetime import date, timedelta
from typing import Literal

from pydantic_ai import RunContext

from polar.auth.scope import Scope
from polar.kit.time_queries import TimeInterval
from polar.metrics.metrics import METRICS
from polar.metrics.service import metrics as metrics_service

from ..schemas import InsightCategory
from ..service import compass as compass_service
from .blocks import InsightCardsBlock, MetricChartBlock, MetricChartPoint
from .deps import AssistantDeps

_METRIC_BY_SLUG = {metric.slug: metric for metric in METRICS}

_MAX_WINDOW_DAYS = 90
_MIN_WINDOW_DAYS = 7
_MAX_SLUGS = 5


def _scope_denial(deps: AssistantDeps, scope: Scope) -> str | None:
    if scope in deps.auth_subject.scopes:
        return None
    return (
        f"Permission denied: this request's token lacks the `{scope.value}` "
        "scope, so this data cannot be accessed. Tell the user which scope "
        "is missing."
    )


def _resolve_window(
    deps: AssistantDeps,
    *,
    days: int,
    start_date: date | None,
    end_date: date | None,
    max_span_days: int,
) -> tuple[date, date] | str:
    """An inclusive [start, end] date window, from explicit dates or a
    trailing `days` count ending today. Explicit dates express questions a
    trailing window cannot ("yesterday", "last month"). Returns an
    instruction string for the model on invalid input."""
    end = min(end_date, deps.today) if end_date is not None else deps.today
    if start_date is None:
        # The range is inclusive of both endpoints, so a window of N days
        # starts N-1 days before its end.
        return end - timedelta(days=days - 1), end
    if start_date > end:
        return (
            f"Invalid date range: start_date {start_date} is after end_date "
            f"{end}. Today is {deps.today}."
        )
    span = (end - start_date).days + 1
    if span > max_span_days:
        return (
            f"Date range too long: {span} days requested, the maximum is "
            f"{max_span_days} days. Narrow the range."
        )
    return start_date, end


async def get_metrics(
    ctx: RunContext[AssistantDeps],
    metric_slugs: list[str],
    days: int = 30,
    start_date: date | None = None,
    end_date: date | None = None,
) -> str:
    """Fetch daily values for up to five metrics over a date window.

    Args:
        metric_slugs: Metric slugs to fetch, e.g. `monthly_recurring_revenue`,
            `active_subscriptions`, `churned_subscriptions`, `revenue`,
            `checkouts_conversion`, `gross_margin_percentage`, `cost_per_user`.
        days: Trailing window ending today, in days (7 to 90, default 30).
            Ignored when `start_date` is set.
        start_date: First day of an explicit window (inclusive). Set it for
            questions about a specific day or calendar period, e.g. yesterday
            or one month. A single day is `start_date` equal to `end_date`.
        end_date: Last day of the explicit window (inclusive, defaults to
            today).
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.metrics_read):
        return denial

    unknown = [slug for slug in metric_slugs if slug not in _METRIC_BY_SLUG]
    if unknown:
        known = ", ".join(sorted(_METRIC_BY_SLUG))
        return f"Unknown metric slugs {unknown}. Available slugs: {known}"
    slugs = metric_slugs[:_MAX_SLUGS]
    days = max(_MIN_WINDOW_DAYS, min(_MAX_WINDOW_DAYS, days))
    window = _resolve_window(
        deps,
        days=days,
        start_date=start_date,
        end_date=end_date,
        max_span_days=_MAX_WINDOW_DAYS,
    )
    if isinstance(window, str):
        return window
    start, end = window

    response = await metrics_service.get_metrics(
        deps.session,
        deps.auth_subject,
        start_date=start,
        end_date=end,
        timezone=deps.timezone,
        interval=TimeInterval.day,
        organization_id=[deps.organization_id],
        metrics=slugs,
        redis=deps.redis,
    )

    summaries: list[str] = []
    for slug in slugs:
        metric = _METRIC_BY_SLUG[slug]
        points = [
            MetricChartPoint(
                timestamp=period.timestamp,
                value=getattr(period, slug, None) or 0,
            )
            for period in response.periods
        ]
        marker = deps.emit(
            MetricChartBlock(
                metric=slug,
                label=metric.display_name,
                unit=metric.type.value,
                points=points,
            )
        )
        first = points[0].value if points else 0
        last = points[-1].value if points else 0
        summaries.append(
            f"{slug} ({metric.type.value}): start={first} latest={last} "
            f"from {start} to {end} (inclusive). Chart prepared; place it "
            f"with [block:{marker}]."
        )
    return "\n".join(summaries)


async def get_insights(
    ctx: RunContext[AssistantDeps],
    category: Literal["revenue", "retention", "growth", "risk", "cost", "product"]
    | None = None,
) -> str:
    """Fetch Compass insights for your own reasoning: computed, narrated
    findings about the business, each with a severity and an id. Renders
    NOTHING to the user — form your assessment from the findings, then call
    `show_insights` with the one or two ids that support it.

    Args:
        category: Only insights in this area — `revenue`, `retention` (churn),
            `growth`, `risk`, `cost` (margins, cost to serve) or `product`
            (conversion). Omit for a whole-business view.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.metrics_read):
        return denial

    insights = await compass_service.list_insights(
        deps.session,
        deps.auth_subject,
        timezone=deps.timezone,
        organization_id=[deps.organization_id],
        category=[InsightCategory(category)] if category else None,
        redis=deps.redis,
    )
    if not insights:
        area = f" in the {category} category" if category else ""
        return f"No insights are currently firing{area} for this organization."

    lines = [
        f"[{insight.severity.value}] id={insight.id} {insight.title}: "
        f"{insight.body}" + (f" (Method: {insight.why})" if insight.why else "")
        for insight in insights
    ]
    return (
        "Findings (nothing rendered yet; use show_insights to display the "
        "relevant ones, usually one or two):\n" + "\n".join(lines)
    )


async def show_insights(
    ctx: RunContext[AssistantDeps],
    insight_ids: list[str],
) -> str:
    """Render insight cards to the user, by id (from `get_insights`).

    Default to the one or two cards that directly support your assessment;
    render more only when the user explicitly asked to see all insights.

    Args:
        insight_ids: Ids of the insights to display, most important first.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.metrics_read):
        return denial

    wanted = insight_ids
    insights = await compass_service.list_insights(
        deps.session,
        deps.auth_subject,
        timezone=deps.timezone,
        organization_id=[deps.organization_id],
        redis=deps.redis,
    )
    selected = [insight for insight in insights if insight.id in wanted]
    if not selected:
        return "None of those insight ids are currently firing."

    marker = deps.emit(InsightCardsBlock(insights=selected))
    return (
        f"Prepared {len(selected)} insight card(s); place them with "
        f"[block:{marker}]. Cards: " + ", ".join(insight.title for insight in selected)
    )


TOOLS_WITH_SCOPES: list[tuple[object, Scope]] = [
    (get_metrics, Scope.metrics_read),
    (get_insights, Scope.metrics_read),
    (show_insights, Scope.metrics_read),
]
