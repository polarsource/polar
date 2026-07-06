"""
Entity listing tools: orders, subscriptions, customers, products, disputes.

Same contract as `tools.py`: organization from deps, per-tool scope guard,
compact text summary back to the model, and a renderable block emitted for the
client — an entity list for small sets, a data table otherwise. Each tool only
reads attributes the corresponding public list endpoint serializes, so
everything touched is eager-loaded.
"""

from collections.abc import Sequence
from typing import Any, Literal, cast

from pydantic_ai import RunContext

from polar.auth.scope import Scope
from polar.checkout.service import checkout as checkout_service
from polar.customer.service import customer as customer_service
from polar.dispute.service import dispute as dispute_service
from polar.kit.pagination import PaginationParams
from polar.models.checkout import CheckoutStatus
from polar.models.product_price import ProductPriceFixed
from polar.order.service import order as order_service
from polar.organization.repository import OrganizationRepository
from polar.payout.service import payout as payout_service
from polar.postgres import AsyncSession
from polar.product.service import product as product_service
from polar.refund.service import refund as refund_service
from polar.subscription.service import subscription as subscription_service

from .blocks import (
    ColumnFormat,
    DataTableBlock,
    DataTableColumn,
    EntityListBlock,
    EntityListItem,
)
from .deps import AssistantDeps
from .tools import _scope_denial

_MAX_LIMIT = 25
_LIST_PRESENTATION_MAX = 5

Presentation = Literal["list", "table"]
Row = dict[str, str | int | float | None]


def _emit_entities(
    deps: AssistantDeps,
    *,
    entity: str,
    columns: list[DataTableColumn],
    rows: list[Row],
    total_count: int,
    presentation: Presentation,
) -> str:
    if presentation == "list" and len(rows) <= _LIST_PRESENTATION_MAX:
        first_key = columns[0].key
        meta_key = columns[-1].key
        deps.emit(
            EntityListBlock(
                entity=entity,
                items=[
                    EntityListItem(
                        title=str(row.get(first_key) or ""),
                        description=", ".join(
                            str(row[column.key])
                            for column in columns[1:-1]
                            if row.get(column.key) is not None
                        )
                        or None,
                        meta=(
                            str(row[meta_key])
                            if row.get(meta_key) is not None
                            else None
                        ),
                    )
                    for row in rows
                ],
                total_count=total_count,
            )
        )
    else:
        deps.emit(
            DataTableBlock(
                entity=entity,
                columns=columns,
                rows=rows,
                total_count=total_count,
            )
        )
    shown = len(rows)
    return (
        f"Rendered {shown} of {total_count} {entity} for the user. Rows: "
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
            "email": item.email,
            "name": item.name,
            "created": item.created_at.isoformat(),
        }
        for item in items
    ]
    columns = [
        DataTableColumn(key="email", label="Email"),
        DataTableColumn(key="name", label="Name"),
        DataTableColumn(key="created", label="Created", format=ColumnFormat.datetime),
    ]
    return _emit_entities(
        deps,
        entity="customers",
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
    items, count = await product_service.list(
        deps.session,
        deps.auth_subject,
        organization_id=[deps.organization_id],
        is_archived=False,
        pagination=_clamp(limit),
    )
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
        columns=columns,
        rows=rows,
        total_count=count,
        presentation=presentation,
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
]
