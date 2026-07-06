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

from datetime import timedelta

from pydantic_ai import RunContext

from polar.auth.scope import Scope
from polar.kit.time_queries import TimeInterval
from polar.metrics.metrics import METRICS
from polar.metrics.service import metrics as metrics_service

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


async def get_metrics(
    ctx: RunContext[AssistantDeps],
    metric_slugs: list[str],
    days: int = 30,
) -> str:
    """Fetch daily values for up to five metrics over a trailing window.

    Args:
        metric_slugs: Metric slugs to fetch, e.g. `monthly_recurring_revenue`,
            `active_subscriptions`, `churned_subscriptions`, `revenue`,
            `checkouts_conversion`, `gross_margin_percentage`, `cost_per_user`.
        days: Trailing window length in days (7 to 90, default 30).
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

    today = deps.today
    response = await metrics_service.get_metrics(
        deps.session,
        deps.auth_subject,
        start_date=today - timedelta(days=days),
        end_date=today,
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
        deps.emit(
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
            f"over the last {days} days. A chart was rendered for the user."
        )
    return "\n".join(summaries)


async def get_insights(ctx: RunContext[AssistantDeps]) -> str:
    """Fetch Compass insights: computed, narrated findings about the business
    (revenue moves, churn, margins, conversion), each with a severity."""
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.metrics_read):
        return denial

    insights = await compass_service.list_insights(
        deps.session,
        deps.auth_subject,
        timezone=deps.timezone,
        organization_id=[deps.organization_id],
        redis=deps.redis,
    )
    if not insights:
        return "No insights are currently firing for this organization."

    deps.emit(InsightCardsBlock(insights=insights))
    lines = [
        f"[{insight.severity.value}] {insight.title}: {insight.body}"
        for insight in insights
    ]
    return "Insight cards were rendered for the user. Findings:\n" + "\n".join(lines)


TOOLS_WITH_SCOPES: list[tuple[object, Scope]] = [
    (get_metrics, Scope.metrics_read),
    (get_insights, Scope.metrics_read),
]
