"""
Entity listing tools: orders, subscriptions, customers, products, disputes.

Same contract as `tools.py`: organization from deps, per-tool scope guard,
compact text summary back to the model, and a renderable block emitted for the
client — an entity list for small sets, a data table otherwise. Each tool only
reads attributes the corresponding public list endpoint serializes, so
everything touched is eager-loaded.
"""

from collections.abc import Sequence
from datetime import datetime, time, timedelta
from typing import Any, Literal, cast

from pydantic_ai import RunContext
from sqlalchemy.orm import selectinload

from polar.auth.scope import Scope
from polar.checkout.service import checkout as checkout_service
from polar.customer.service import customer as customer_service
from polar.dispute.service import dispute as dispute_service
from polar.event.service import event as event_service
from polar.kit.pagination import PaginationParams
from polar.kit.time_queries import TimeInterval
from polar.metrics.service import metrics as metrics_service
from polar.models import Product
from polar.models.checkout import CheckoutStatus
from polar.models.customer import _avatar_url_for_email
from polar.models.product_price import ProductPriceFixed
from polar.order.repository import OrderRepository
from polar.order.service import order as order_service
from polar.organization.repository import OrganizationRepository
from polar.payout.service import payout as payout_service
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository
from polar.product.service import product as product_service
from polar.refund.service import refund as refund_service
from polar.subscription.service import subscription as subscription_service

from .blocks import (
    ColumnFormat,
    DataTableBlock,
    DataTableColumn,
    EntityListBlock,
)
from .deps import AssistantDeps
from .tools import _scope_denial

_MAX_LIMIT = 25
# Each ranked product costs one metrics query; keep the fan-out small.
_MAX_RANKED_PRODUCTS = 8
_LIST_PRESENTATION_MAX = 5

Presentation = Literal["list", "table"]
Row = dict[str, str | int | float | None]


def _emit_entities(
    deps: AssistantDeps,
    *,
    entity: str,
    title: str,
    columns: list[DataTableColumn],
    rows: list[Row],
    total_count: int,
    presentation: Presentation,
) -> str:
    if presentation == "list" and len(rows) <= _LIST_PRESENTATION_MAX:
        marker = deps.emit(
            EntityListBlock(
                entity=entity,
                title=title,
                columns=columns,
                rows=rows,
                total_count=total_count,
            )
        )
    else:
        marker = deps.emit(
            DataTableBlock(
                entity=entity,
                title=title,
                columns=columns,
                rows=rows,
                total_count=total_count,
            )
        )
    shown = len(rows)
    return (
        f"Prepared a block with {shown} of {total_count} {entity}; place it "
        f"with [block:{marker}] directly after the claim it supports. Rows: "
        + "; ".join(str(row) for row in rows[:_LIST_PRESENTATION_MAX])
    )


def _clamp(limit: int) -> PaginationParams:
    return PaginationParams(1, max(1, min(_MAX_LIMIT, limit)))


async def list_orders(
    ctx: RunContext[AssistantDeps],
    limit: int = 10,
    presentation: Presentation = "table",
) -> str:
    """List the most recent orders: customer, product, amount and status.

    Args:
        limit: How many to fetch (1 to 25).
        presentation: `list` for a compact list (5 or fewer), else `table`.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.orders_read):
        return denial
    items, count = await order_service.list(
        deps.session,
        deps.auth_subject,
        organization_id=[deps.organization_id],
        pagination=_clamp(limit),
    )
    rows: list[Row] = [
        {
            "customer": order.customer.email if order.customer else None,
            "product": order.product.name if order.product else None,
            "amount": order.net_amount,
            "status": str(order.status),
            "date": order.created_at.isoformat(),
        }
        for order in items
    ]
    columns = [
        DataTableColumn(key="customer", label="Customer"),
        DataTableColumn(key="product", label="Product"),
        DataTableColumn(key="amount", label="Amount", format=ColumnFormat.currency),
        DataTableColumn(key="status", label="Status", format=ColumnFormat.badge),
        DataTableColumn(key="date", label="Date", format=ColumnFormat.datetime),
    ]
    return _emit_entities(
        deps,
        entity="orders",
        title="Recent orders",
        columns=columns,
        rows=rows,
        total_count=count,
        presentation=presentation,
    )


async def list_subscriptions(
    ctx: RunContext[AssistantDeps],
    limit: int = 10,
    active: bool | None = None,
    presentation: Presentation = "table",
) -> str:
    """List subscriptions: customer, product, amount, status and start date.

    Args:
        limit: How many to fetch (1 to 25).
        active: Only active (true) or only ended (false); omit for all.
        presentation: `list` for a compact list (5 or fewer), else `table`.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.subscriptions_read):
        return denial
    items, count = await subscription_service.list(
        deps.session,
        deps.auth_subject,
        organization_id=[deps.organization_id],
        active=active,
        pagination=_clamp(limit),
    )
    rows: list[Row] = [
        {
            "customer": sub.customer.email if sub.customer else None,
            "product": sub.product.name if sub.product else None,
            "amount": sub.amount,
            "status": str(sub.status),
            "started": sub.started_at.isoformat() if sub.started_at else None,
        }
        for sub in items
    ]
    columns = [
        DataTableColumn(key="customer", label="Customer"),
        DataTableColumn(key="product", label="Product"),
        DataTableColumn(key="amount", label="Amount", format=ColumnFormat.currency),
        DataTableColumn(key="status", label="Status", format=ColumnFormat.badge),
        DataTableColumn(key="started", label="Started", format=ColumnFormat.datetime),
    ]
    return _emit_entities(
        deps,
        entity="subscriptions",
        title="Subscriptions",
        columns=columns,
        rows=rows,
        total_count=count,
        presentation=presentation,
    )


async def list_customers(
    ctx: RunContext[AssistantDeps],
    limit: int = 10,
    query: str | None = None,
    presentation: Presentation = "table",
) -> str:
    """List customers: email, name and signup date. Optionally search them.

    Args:
        limit: How many to fetch (1 to 25).
        query: Optional search over email and name.
        presentation: `list` for a compact list (5 or fewer), else `table`.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.customers_read):
        return denial
    items, count = await customer_service.list(
        deps.session,
        deps.auth_subject,
        organization_id=[deps.organization_id],
        query=query,
        pagination=_clamp(limit),
    )
    rows: list[Row] = [
        {
            "avatar": item.avatar_url,
            "email": item.email,
            "name": item.name,
            "created": item.created_at.isoformat(),
        }
        for item in items
    ]
    columns = [
        DataTableColumn(key="avatar", label="", format=ColumnFormat.avatar),
        DataTableColumn(key="email", label="Email"),
        DataTableColumn(key="name", label="Name"),
        DataTableColumn(key="created", label="Created", format=ColumnFormat.datetime),
    ]
    return _emit_entities(
        deps,
        entity="customers",
        title="Customers",
        columns=columns,
        rows=rows,
        total_count=count,
        presentation=presentation,
    )


def _product_price(product: Any) -> int | None:
    for price in product.all_prices:
        if isinstance(price, ProductPriceFixed) and not price.is_archived:
            return price.price_amount
    return None


async def list_products(
    ctx: RunContext[AssistantDeps],
    limit: int = 10,
    presentation: Presentation = "table",
) -> str:
    """List products: name, list price and whether they're recurring.

    Args:
        limit: How many to fetch (1 to 25).
        presentation: `list` for a compact list (5 or fewer), else `table`.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.products_read):
        return denial
    # Loaded via the repository with prices eager-loaded: the price column
    # reads `all_prices`, which is lazy="raise" and not loaded by the
    # service's list query.
    items = await ProductRepository.from_session(deps.session).get_all_by_organization(
        deps.organization_id,
        options=(selectinload(Product.all_prices),),
        limit=max(1, min(_MAX_LIMIT, limit)),
    )
    count = len(items)
    rows: list[Row] = [
        {
            "name": item.name,
            "price": _product_price(item),
            "recurring": "recurring" if item.is_recurring else "one-time",
        }
        for item in items
    ]
    columns = [
        DataTableColumn(key="name", label="Name"),
        DataTableColumn(key="price", label="Price", format=ColumnFormat.currency),
        DataTableColumn(key="recurring", label="Billing", format=ColumnFormat.badge),
    ]
    return _emit_entities(
        deps,
        entity="products",
        title="Products",
        columns=columns,
        rows=rows,
        total_count=count,
        presentation=presentation,
    )


async def list_disputes(
    ctx: RunContext[AssistantDeps],
    limit: int = 10,
    presentation: Presentation = "table",
) -> str:
    """List disputes: amount, status and when they were opened.

    Args:
        limit: How many to fetch (1 to 25).
        presentation: `list` for a compact list (5 or fewer), else `table`.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.disputes_read):
        return denial
    items, count = await dispute_service.list(
        deps.session,
        deps.auth_subject,
        organization_id=[deps.organization_id],
        pagination=_clamp(limit),
    )
    rows: list[Row] = [
        {
            "amount": item.amount,
            "status": str(item.status),
            "opened": item.created_at.isoformat(),
        }
        for item in items
    ]
    columns = [
        DataTableColumn(key="amount", label="Amount", format=ColumnFormat.currency),
        DataTableColumn(key="status", label="Status", format=ColumnFormat.badge),
        DataTableColumn(key="opened", label="Opened", format=ColumnFormat.datetime),
    ]
    return _emit_entities(
        deps,
        entity="disputes",
        title="Disputes",
        columns=columns,
        rows=rows,
        total_count=count,
        presentation=presentation,
    )


async def list_checkouts(
    ctx: RunContext[AssistantDeps],
    limit: int = 10,
    status: Literal["open", "expired", "confirmed", "succeeded", "failed"]
    | None = None,
    presentation: Presentation = "table",
) -> str:
    """List checkout sessions: who opened them, amount and outcome. Useful to
    drill into conversion questions (e.g. expired = abandoned checkouts).

    Args:
        limit: How many to fetch (1 to 25).
        status: Only checkouts with this status; omit for all.
        presentation: `list` for a compact list (5 or fewer), else `table`.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.checkouts_read):
        return denial
    items, count = await checkout_service.list(
        deps.session,
        deps.auth_subject,
        organization_id=[deps.organization_id],
        status=[CheckoutStatus(status)] if status else None,
        pagination=_clamp(limit),
    )
    rows: list[Row] = [
        {
            "customer": item.customer_email,
            "amount": item.net_amount,
            "status": str(item.status),
            "created": item.created_at.isoformat(),
        }
        for item in items
    ]
    columns = [
        DataTableColumn(key="customer", label="Customer"),
        DataTableColumn(key="amount", label="Amount", format=ColumnFormat.currency),
        DataTableColumn(key="status", label="Status", format=ColumnFormat.badge),
        DataTableColumn(key="created", label="Created", format=ColumnFormat.datetime),
    ]
    return _emit_entities(
        deps,
        entity="checkouts",
        title="Checkouts",
        columns=columns,
        rows=rows,
        total_count=count,
        presentation=presentation,
    )


async def list_refunds(
    ctx: RunContext[AssistantDeps],
    limit: int = 10,
    presentation: Presentation = "table",
) -> str:
    """List refunds: amount, reason, status and when they were issued.

    Args:
        limit: How many to fetch (1 to 25).
        presentation: `list` for a compact list (5 or fewer), else `table`.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.refunds_read):
        return denial
    items, count = await refund_service.list(
        # Read-only listing; the service annotates the broader session type.
        cast(AsyncSession, deps.session),
        deps.auth_subject,
        organization_id=[deps.organization_id],
        pagination=_clamp(limit),
    )
    rows: list[Row] = [
        {
            "amount": item.amount,
            "reason": str(item.reason),
            "status": str(item.status),
            "created": item.created_at.isoformat(),
        }
        for item in items
    ]
    columns = [
        DataTableColumn(key="amount", label="Amount", format=ColumnFormat.currency),
        DataTableColumn(key="reason", label="Reason"),
        DataTableColumn(key="status", label="Status", format=ColumnFormat.badge),
        DataTableColumn(key="created", label="Created", format=ColumnFormat.datetime),
    ]
    return _emit_entities(
        deps,
        entity="refunds",
        title="Refunds",
        columns=columns,
        rows=rows,
        total_count=count,
        presentation=presentation,
    )


async def list_payouts(
    ctx: RunContext[AssistantDeps],
    limit: int = 10,
    presentation: Presentation = "table",
) -> str:
    """List payouts to the merchant's bank account: amount, fees, status and
    date. Answers "when do I get paid and how much".

    Args:
        limit: How many to fetch (1 to 25).
        presentation: `list` for a compact list (5 or fewer), else `table`.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.payouts_read):
        return denial
    organization = await OrganizationRepository.from_session(deps.session).get_by_id(
        deps.organization_id
    )
    account_id = organization.payout_account_id if organization else None
    if account_id is None:
        return "This organization has no payout account set up yet."
    items, count = await payout_service.list(
        cast(AsyncSession, deps.session),
        cast(Any, deps.auth_subject),
        account_id=[account_id],
        pagination=_clamp(limit),
    )
    rows: list[Row] = [
        {
            "amount": item.amount,
            "fees": item.fees_amount,
            "status": str(item.status),
            "date": item.created_at.isoformat(),
        }
        for item in items
    ]
    columns = [
        DataTableColumn(key="amount", label="Amount", format=ColumnFormat.currency),
        DataTableColumn(key="fees", label="Fees", format=ColumnFormat.currency),
        DataTableColumn(key="status", label="Status", format=ColumnFormat.badge),
        DataTableColumn(key="date", label="Date", format=ColumnFormat.datetime),
    ]
    return _emit_entities(
        deps,
        entity="payouts",
        title="Payouts",
        columns=columns,
        rows=rows,
        total_count=count,
        presentation=presentation,
    )


async def top_products_by_revenue(
    ctx: RunContext[AssistantDeps],
    days: int = 365,
    limit: int = 5,
    presentation: Presentation = "table",
) -> str:
    """Rank products by revenue over a trailing window, via the revenue metric
    filtered per product. Answers questions like "what is my most successful
    product" or "which product sells best".

    Args:
        days: Trailing window in days (7 to 365, default 365).
        limit: How many products to rank (1 to 8; one metrics query each).
        presentation: `list` for a compact list (5 or fewer), else `table`.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.metrics_read):
        return denial
    days = max(7, min(365, days))
    limit = max(1, min(_MAX_RANKED_PRODUCTS, limit))

    products, _ = await product_service.list(
        deps.session,
        deps.auth_subject,
        organization_id=[deps.organization_id],
        is_archived=False,
        pagination=PaginationParams(1, _MAX_RANKED_PRODUCTS),
    )
    if not products:
        return "This organization has no products."

    ranked: list[tuple[str, float, float]] = []
    for product in products:
        response = await metrics_service.get_metrics(
            deps.session,
            deps.auth_subject,
            start_date=deps.today - timedelta(days=days),
            end_date=deps.today,
            timezone=deps.timezone,
            interval=TimeInterval.month,
            organization_id=[deps.organization_id],
            product_id=[product.id],
            metrics=["revenue", "orders"],
            redis=deps.redis,
        )
        revenue = float(getattr(response.totals, "revenue", 0) or 0)
        orders = float(getattr(response.totals, "orders", 0) or 0)
        ranked.append((product.name, revenue, orders))
    ranked.sort(key=lambda entry: entry[1], reverse=True)
    ranked = ranked[:limit]

    if all(revenue == 0 for _, revenue, _ in ranked):
        return f"No product revenue was recorded in the last {days} days."
    rows: list[Row] = [
        {"product": name, "revenue": revenue, "orders": int(orders)}
        for name, revenue, orders in ranked
    ]
    columns = [
        DataTableColumn(key="product", label="Product"),
        DataTableColumn(key="revenue", label="Revenue", format=ColumnFormat.currency),
        DataTableColumn(key="orders", label="Orders"),
    ]
    top = rows[0]
    summary = _emit_entities(
        deps,
        entity="products by revenue",
        title=f"Top products by revenue, last {days} days",
        columns=columns,
        rows=rows,
        total_count=len(rows),
        presentation=presentation,
    )
    return (
        f"Top product by revenue over the last {days} days: {top['product']} "
        f"({top['orders']} orders). " + summary
    )


async def top_customers_by_revenue(
    ctx: RunContext[AssistantDeps],
    days: int | None = 365,
    limit: int = 5,
    presentation: Presentation = "table",
) -> str:
    """Rank customers by paid net revenue. Answers questions like "who is my
    best customer" or "which customers bring in the most revenue".

    Args:
        days: Trailing window in days (up to 365); omit for all time.
        limit: How many customers to rank (1 to 25).
        presentation: `list` for a compact list (5 or fewer), else `table`.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.orders_read):
        return denial
    start = None
    if days is not None:
        days = max(1, min(365, days))
        start = datetime.combine(
            deps.today - timedelta(days=days), time.min, deps.timezone
        )
    ranked = await OrderRepository.from_session(deps.session).get_revenue_by_customer(
        deps.organization_id,
        start=start,
        limit=max(1, min(_MAX_LIMIT, limit)),
    )
    window = f"the last {days} days" if days is not None else "all time"
    if not ranked:
        return f"No paid orders were found for {window}."
    rows: list[Row] = [
        {
            "avatar": _avatar_url_for_email(email) if email else None,
            "customer": email or name,
            "revenue": net_revenue,
            "orders": order_count,
        }
        for _, email, name, order_count, net_revenue in ranked
    ]
    columns = [
        DataTableColumn(key="avatar", label="", format=ColumnFormat.avatar),
        DataTableColumn(key="customer", label="Customer"),
        DataTableColumn(
            key="revenue", label="Net revenue", format=ColumnFormat.currency
        ),
        DataTableColumn(key="orders", label="Orders"),
    ]
    top = rows[0]
    summary = _emit_entities(
        deps,
        entity="customers by revenue",
        title=f"Top customers by net revenue, {window}",
        columns=columns,
        rows=rows,
        total_count=len(rows),
        presentation=presentation,
    )
    return (
        f"Best customer by paid net revenue over {window}: {top['customer']} "
        f"({top['orders']} orders). " + summary
    )


async def top_customers_by_cost(
    ctx: RunContext[AssistantDeps],
    days: int = 30,
    limit: int = 5,
    presentation: Presentation = "table",
) -> str:
    """Rank customers by the cost they generate (from `_cost` event metadata).
    Answers questions like "which customer drives the most cost".

    Args:
        days: Trailing window length in days (7 to 90, default 30).
        limit: How many customers to rank (1 to 25).
        presentation: `list` for a compact list (5 or fewer), else `table`.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.events_read):
        return denial
    days = max(7, min(90, days))
    stats = await event_service.list_customer_stats(
        cast(AsyncSession, deps.session),
        deps.auth_subject,
        start_date=deps.today - timedelta(days=days),
        end_date=deps.today,
        timezone=deps.timezone,
        organization_id=[deps.organization_id],
        limit=max(1, min(_MAX_LIMIT, limit)),
    )
    ranked = [
        stat for stat in stats.items if float(stat.totals.get("_cost_amount", 0)) > 0
    ]
    if not ranked:
        return (
            f"No customer costs were tracked in the last {days} days. Costs "
            "come from `_cost` metadata on ingested events."
        )
    rows: list[Row] = [
        {
            "avatar": _avatar_url_for_email(stat.email) if stat.email else None,
            "customer": stat.email or stat.name or stat.external_customer_id,
            "cost": float(stat.totals.get("_cost_amount", 0)),
            "share": f"{float(stat.share) * 100:.0f}%",
            "events": stat.occurrences,
        }
        for stat in ranked
    ]
    columns = [
        DataTableColumn(key="avatar", label="", format=ColumnFormat.avatar),
        DataTableColumn(key="customer", label="Customer"),
        DataTableColumn(key="cost", label="Cost", format=ColumnFormat.currency),
        DataTableColumn(key="share", label="Share of costs"),
        DataTableColumn(key="events", label="Events"),
    ]
    top = rows[0]
    summary = _emit_entities(
        deps,
        entity="customers by cost",
        title=f"Top customers by tracked cost, last {days} days",
        columns=columns,
        rows=rows,
        total_count=len(rows),
        presentation=presentation,
    )
    return (
        f"Top cost driver over the last {days} days: {top['customer']} with "
        f"{top['share']} of all tracked costs. " + summary
    )


ENTITY_TOOLS_WITH_SCOPES: Sequence[tuple[object, Scope]] = [
    (list_orders, Scope.orders_read),
    (list_subscriptions, Scope.subscriptions_read),
    (list_customers, Scope.customers_read),
    (list_products, Scope.products_read),
    (list_disputes, Scope.disputes_read),
    (list_checkouts, Scope.checkouts_read),
    (list_refunds, Scope.refunds_read),
    (list_payouts, Scope.payouts_read),
    (top_customers_by_cost, Scope.events_read),
    (top_products_by_revenue, Scope.metrics_read),
    (top_customers_by_revenue, Scope.orders_read),
]
