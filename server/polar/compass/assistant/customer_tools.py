"""
Customer drill-down: resolve one customer and stitch their activity together.

The overview needs `customers:read`; the orders and subscriptions sections are
each gated on their own scope and degrade gracefully — a token without
`orders:read` still gets the customer card and subscriptions, with a note about
what was withheld.
"""

from pydantic_ai import RunContext

from polar.auth.scope import Scope
from polar.customer.service import customer as customer_service
from polar.kit.pagination import PaginationParams
from polar.order.service import order as order_service
from polar.subscription.service import subscription as subscription_service

from .blocks import ColumnFormat, CustomerCardBlock, DataTableColumn, EntityListBlock
from .deps import AssistantDeps
from .tools import _scope_denial

_SECTION_COLUMNS = [
    DataTableColumn(key="title", label="Item"),
    DataTableColumn(key="detail", label="Detail"),
    DataTableColumn(key="amount", label="Amount", format=ColumnFormat.currency),
]

_SECTION_LIMIT = 5


async def get_customer_overview(
    ctx: RunContext[AssistantDeps],
    email_or_name: str,
) -> str:
    """Look up one customer by email or name and show who they are, what they
    bought and what they're subscribed to.

    Args:
        email_or_name: Search over customer email and name; the best match wins.
    """
    deps = ctx.deps
    if denial := _scope_denial(deps, Scope.customers_read):
        return denial

    customers, count = await customer_service.list(
        deps.session,
        deps.auth_subject,
        organization_id=[deps.organization_id],
        query=email_or_name,
        pagination=PaginationParams(1, 3),
    )
    if not customers:
        return f"No customer matching {email_or_name!r} was found."
    customer = customers[0]

    card_marker = deps.emit(
        CustomerCardBlock(
            email=customer.email or "(no email)",
            name=customer.name,
            avatar_url=customer.avatar_url,
            created_at=customer.created_at,
        )
    )
    summary = [
        f"Customer card prepared; place it with [block:{card_marker}]. "
        f"Customer: {customer.email}"
        f" (name={customer.name!r}, since {customer.created_at.date()})."
        + (f" {count - 1} other match(es) exist." if count > 1 else "")
    ]

    if Scope.orders_read in deps.auth_subject.scopes:
        orders, orders_count = await order_service.list(
            deps.session,
            deps.auth_subject,
            organization_id=[deps.organization_id],
            customer_id=[customer.id],
            pagination=PaginationParams(1, _SECTION_LIMIT),
        )
        orders_marker = None
        if orders:
            orders_marker = deps.emit(
                EntityListBlock(
                    entity="orders",
                    title="Orders",
                    columns=_SECTION_COLUMNS,
                    rows=[
                        {
                            "title": order.product.name if order.product else "Order",
                            "detail": order.created_at.isoformat(),
                            "amount": order.net_amount,
                        }
                        for order in orders
                    ],
                    total_count=orders_count,
                )
            )
        summary.append(
            f"Orders: {orders_count} total."
            + (f" Block prepared: [block:{orders_marker}]." if orders_marker else "")
        )
    else:
        summary.append("Orders withheld: token lacks the `orders:read` scope.")

    if Scope.subscriptions_read in deps.auth_subject.scopes:
        subscriptions, subs_count = await subscription_service.list(
            deps.session,
            deps.auth_subject,
            organization_id=[deps.organization_id],
            customer_id=[customer.id],
            pagination=PaginationParams(1, _SECTION_LIMIT),
        )
        subs_marker = None
        if subscriptions:
            subs_marker = deps.emit(
                EntityListBlock(
                    entity="subscriptions",
                    title="Subscriptions",
                    columns=_SECTION_COLUMNS,
                    rows=[
                        {
                            "title": sub.product.name
                            if sub.product
                            else "Subscription",
                            "detail": str(sub.status),
                            "amount": sub.amount,
                        }
                        for sub in subscriptions
                    ],
                    total_count=subs_count,
                )
            )
        summary.append(
            f"Subscriptions: {subs_count} total."
            + (f" Block prepared: [block:{subs_marker}]." if subs_marker else "")
        )
    else:
        summary.append(
            "Subscriptions withheld: token lacks the `subscriptions:read` scope."
        )

    return " ".join(summary)


CUSTOMER_TOOLS_WITH_SCOPES: list[tuple[object, Scope]] = [
    (get_customer_overview, Scope.customers_read),
]
