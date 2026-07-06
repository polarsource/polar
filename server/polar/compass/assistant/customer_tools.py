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

from .blocks import CustomerCardBlock, EntityListBlock, EntityListItem
from .deps import AssistantDeps
from .tools import _scope_denial

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

    deps.emit(
        CustomerCardBlock(
            email=customer.email or "(no email)",
            name=customer.name,
            created_at=customer.created_at,
        )
    )
    summary = [
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
        if orders:
            deps.emit(
                EntityListBlock(
                    entity="orders",
                    items=[
                        EntityListItem(
                            title=order.product.name if order.product else "Order",
                            description=order.created_at.strftime("%b %d, %Y"),
                            meta=f"${order.net_amount / 100:,.2f}",
                        )
                        for order in orders
                    ],
                    total_count=orders_count,
                )
            )
        summary.append(f"Orders: {orders_count} total, {len(orders)} rendered.")
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
        if subscriptions:
            deps.emit(
                EntityListBlock(
                    entity="subscriptions",
                    items=[
                        EntityListItem(
                            title=sub.product.name if sub.product else "Subscription",
                            description=str(sub.status),
                            meta=f"${sub.amount / 100:,.2f}",
                        )
                        for sub in subscriptions
                    ],
                    total_count=subs_count,
                )
            )
        summary.append(
            f"Subscriptions: {subs_count} total, {len(subscriptions)} rendered."
        )
    else:
        summary.append(
            "Subscriptions withheld: token lacks the `subscriptions:read` scope."
        )

    return " ".join(summary)


CUSTOMER_TOOLS_WITH_SCOPES: list[tuple[object, Scope]] = [
    (get_customer_overview, Scope.customers_read),
]
