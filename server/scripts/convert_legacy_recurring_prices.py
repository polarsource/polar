"""
Convert legacy recurring products to a product-level recurring interval.

Legacy products carry the interval on their prices (`product_prices.type` and
`product_prices.recurring_interval`) and leave `products.recurring_interval`
NULL, so one product can sell both a monthly and a yearly price.

The conversion keeps one interval per product, in this order:

1. the interval most live subscriptions are on;
2. the interval of the last succeeded checkout;
3. the interval of the product's prices, month first.

Then it archives the prices of the other interval, and clears the legacy
columns on every price of the product, archived or not. Deleted products and
prices are converted too, so the legacy columns can be dropped.

Existing subscriptions are left untouched: they renew on their own
`recurring_interval` and their stored prices.

Skipped unless named with `--product-id`: products with both intervals that
have live subscriptions on both, or sold within the last year. Their merchant
chooses the interval to keep first. Always skipped: products with a confirmed
checkout still being handled, since the subscription is built from the
product's prices when the payment is handled.

No webhook or event is emitted.

Usage:
    cd server

    # Read-only report of what is left:
    uv run python -m scripts.convert_legacy_recurring_prices audit

    # Dry-run (default) — show what would change:
    uv run python -m scripts.convert_legacy_recurring_prices convert
    uv run python -m scripts.convert_legacy_recurring_prices convert --slug acme

    # Execute the conversion (batched):
    uv run python -m scripts.convert_legacy_recurring_prices convert --execute

    # Convert one product once its merchant has answered:
    uv run python -m scripts.convert_legacy_recurring_prices convert \\
        --product-id <uuid> --interval year --execute
"""

from dataclasses import dataclass
from datetime import timedelta
from typing import Any
from uuid import UUID

import structlog
import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import (
    ColumnElement,
    Row,
    Select,
    Update,
    and_,
    exists,
    func,
    literal,
    or_,
    select,
    update,
)
from sqlalchemy.orm import aliased

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import Checkout, Organization, Product, ProductPrice, Subscription
from polar.models.checkout import CheckoutStatus
from polar.models.product_price import ProductPriceType
from polar.models.subscription import SubscriptionStatus
from polar.postgres import create_async_engine
from scripts.helper import (
    configure_script_console_logging,
    limit_bindparam,
    read_engine,
    run_batched_update,
    typer_async,
)

cli = typer.Typer()
console = Console()
log = structlog.get_logger()

configure_script_console_logging()

SOLD_WITHIN = timedelta(days=365)

LIVE_STATUSES = (
    SubscriptionStatus.active,
    SubscriptionStatus.trialing,
    SubscriptionStatus.past_due,
)


@dataclass(frozen=True)
class Scope:
    organization_id: UUID | None = None
    product_id: UUID | None = None
    interval: SubscriptionRecurringInterval | None = None

    def clauses(self) -> list[ColumnElement[bool]]:
        clauses: list[ColumnElement[bool]] = []
        if self.organization_id is not None:
            clauses.append(Product.organization_id == self.organization_id)
        if self.product_id is not None:
            clauses.append(Product.id == self.product_id)
        return clauses


def _live_subscription(*clauses: ColumnElement[bool]) -> list[ColumnElement[bool]]:
    return [
        Subscription.product_id == Product.id,
        Subscription.deleted_at.is_(None),
        Subscription.status.in_(LIVE_STATUSES),
        *clauses,
    ]


def _live_subscription_count(
    interval: SubscriptionRecurringInterval,
) -> ColumnElement[int]:
    return (
        select(func.count())
        .where(*_live_subscription(Subscription.recurring_interval == interval))
        .scalar_subquery()
    )


def _live_interval_count() -> ColumnElement[int]:
    return (
        select(func.count(func.distinct(Subscription.recurring_interval)))
        .where(*_live_subscription())
        .scalar_subquery()
    )


def _legacy_interval_count() -> ColumnElement[int]:
    price = aliased(ProductPrice)
    return (
        select(func.count(func.distinct(price.recurring_interval)))
        .where(
            price.product_id == Product.id,
            price.type == ProductPriceType.recurring,
        )
        .scalar_subquery()
    )


def _last_succeeded_checkout_at() -> ColumnElement[Any]:
    price = aliased(ProductPrice)
    return (
        select(func.max(Checkout.created_at))
        .join(price, price.id == Checkout.product_price_id)
        .where(
            price.product_id == Product.id,
            Checkout.status == CheckoutStatus.succeeded,
        )
        .scalar_subquery()
    )


def _has_confirmed_checkout() -> ColumnElement[bool]:
    price = aliased(ProductPrice)
    return exists(
        select(Checkout.id)
        .join(price, price.id == Checkout.product_price_id)
        .where(
            price.product_id == Product.id,
            Checkout.status == CheckoutStatus.confirmed,
        )
    )


def _has_legacy_recurring_price() -> ColumnElement[bool]:
    price = aliased(ProductPrice)
    return exists(
        select(price.id).where(
            price.product_id == Product.id,
            price.type == ProductPriceType.recurring,
        )
    )


def _chosen_interval() -> ColumnElement[str]:
    price = aliased(ProductPrice)
    by_subscriptions = (
        select(Subscription.recurring_interval)
        .where(*_live_subscription())
        .group_by(Subscription.recurring_interval)
        .order_by(func.count().desc(), Subscription.recurring_interval)
        .limit(1)
        .scalar_subquery()
    )
    by_checkout = (
        select(price.recurring_interval)
        .join(Checkout, Checkout.product_price_id == price.id)
        .where(
            price.product_id == Product.id,
            price.type == ProductPriceType.recurring,
            Checkout.status == CheckoutStatus.succeeded,
        )
        .order_by(Checkout.created_at.desc())
        .limit(1)
        .scalar_subquery()
    )
    by_prices = (
        select(price.recurring_interval)
        .where(
            price.product_id == Product.id,
            price.type == ProductPriceType.recurring,
        )
        .order_by(
            price.is_archived,
            price.deleted_at.is_not(None),
            (price.recurring_interval == SubscriptionRecurringInterval.month).desc(),
            price.id,
        )
        .limit(1)
        .scalar_subquery()
    )
    return func.coalesce(by_subscriptions, by_checkout, by_prices)


def _interval(scope: Scope) -> ColumnElement[str]:
    if scope.interval is not None:
        return literal(scope.interval.value)
    return _chosen_interval()


def _convertible(scope: Scope) -> list[ColumnElement[bool]]:
    clauses = [
        Product.recurring_interval.is_(None),
        _has_legacy_recurring_price(),
        ~_has_confirmed_checkout(),
        *scope.clauses(),
    ]
    if scope.product_id is None:
        last_checkout_at = _last_succeeded_checkout_at()
        clauses.append(
            or_(
                _legacy_interval_count() < 2,
                and_(
                    _live_interval_count() < 2,
                    or_(
                        last_checkout_at.is_(None),
                        last_checkout_at <= utc_now() - SOLD_WITHIN,
                    ),
                ),
            )
        )
    return clauses


def _archivable() -> list[ColumnElement[bool]]:
    return [
        ProductPrice.type == ProductPriceType.recurring,
        ~ProductPrice.is_archived,
        Product.recurring_interval.is_not(None),
        ProductPrice.recurring_interval != Product.recurring_interval,
    ]


def _clearable() -> ColumnElement[bool]:
    sibling = aliased(ProductPrice)
    return or_(
        and_(
            ProductPrice.type == ProductPriceType.recurring,
            Product.recurring_interval.is_not(None),
            or_(
                ProductPrice.is_archived,
                ProductPrice.recurring_interval == Product.recurring_interval,
            ),
        ),
        and_(
            ProductPrice.type == ProductPriceType.one_time,
            ~exists(
                select(sibling.id).where(
                    sibling.product_id == ProductPrice.product_id,
                    sibling.type == ProductPriceType.recurring,
                )
            ),
        ),
    )


def _price_ids(*clauses: ColumnElement[bool]) -> ColumnElement[bool]:
    return ProductPrice.id.in_(
        select(ProductPrice.id)
        .join(Product, Product.id == ProductPrice.product_id)
        .where(*clauses)
        .order_by(ProductPrice.id)
        .limit(limit_bindparam())
        .correlate(None)
        .scalar_subquery()
    )


def convert_products_statement(scope: Scope) -> Update:
    return (
        update(Product)
        .where(
            Product.id.in_(
                select(Product.id)
                .where(*_convertible(scope))
                .order_by(Product.id)
                .limit(limit_bindparam())
                .scalar_subquery()
            )
        )
        .values(recurring_interval=_interval(scope), recurring_interval_count=1)
    )


def archive_prices_statement(scope: Scope) -> Update:
    return (
        update(ProductPrice)
        .where(_price_ids(*_archivable(), *scope.clauses()))
        .values(is_archived=True)
    )


def clear_prices_statement(scope: Scope) -> Update:
    return (
        update(ProductPrice)
        .where(_price_ids(_clearable(), *scope.clauses()))
        .values(type=None, recurring_interval=None)
    )


def plan_statement(scope: Scope) -> Select[Any]:
    return (
        select(
            Organization.slug,
            Product.id,
            Product.name,
            _interval(scope).label("interval"),
            _live_interval_count().label("live_intervals"),
        )
        .join(Organization, Organization.id == Product.organization_id)
        .where(*_convertible(scope))
        .order_by(Organization.slug, Product.id)
    )


def planned_archive_count_statement(scope: Scope) -> Select[tuple[int]]:
    return (
        select(func.count())
        .select_from(ProductPrice)
        .join(Product, Product.id == ProductPrice.product_id)
        .where(
            *_convertible(scope),
            ProductPrice.type == ProductPriceType.recurring,
            ~ProductPrice.is_archived,
            ProductPrice.recurring_interval != _interval(scope),
        )
    )


def planned_clear_count_statement(scope: Scope) -> Select[tuple[int]]:
    return (
        select(func.count())
        .select_from(ProductPrice)
        .join(Product, Product.id == ProductPrice.product_id)
        .where(*_convertible(scope), ProductPrice.type.is_not(None))
    )


def price_count_statement(*clauses: ColumnElement[bool]) -> Select[tuple[int]]:
    return (
        select(func.count())
        .select_from(ProductPrice)
        .join(Product, Product.id == ProductPrice.product_id)
        .where(*clauses)
    )


def legacy_products_statement() -> Select[Any]:
    return (
        select(
            Organization.slug,
            Product.id,
            Product.name,
            Product.is_archived,
            Product.deleted_at.is_not(None).label("is_deleted"),
            _legacy_interval_count().label("intervals"),
            _live_interval_count().label("live_intervals"),
            _live_subscription_count(SubscriptionRecurringInterval.month).label(
                "live_month"
            ),
            _live_subscription_count(SubscriptionRecurringInterval.year).label(
                "live_year"
            ),
            _last_succeeded_checkout_at().label("last_checkout_at"),
            _has_confirmed_checkout().label("has_confirmed_checkout"),
            _chosen_interval().label("interval"),
        )
        .join(Organization, Organization.id == Product.organization_id)
        .where(Product.recurring_interval.is_(None), _has_legacy_recurring_price())
        .order_by(Organization.slug, Product.id)
    )


@cli.command()
@typer_async
async def audit(
    command_timeout: float = typer.Option(
        300.0, help="Statement timeout for the read queries, in seconds"
    ),
) -> None:
    engine = read_engine(command_timeout)
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            products = (await session.execute(legacy_products_statement())).all()
            dirty_prices = (
                await session.execute(
                    price_count_statement(
                        or_(and_(*_archivable()), _clearable()),
                    )
                )
            ).scalar_one()
    finally:
        await engine.dispose()

    sold_since = utc_now() - SOLD_WITHIN
    live = [p for p in products if not p.is_deleted]

    buckets: dict[tuple[int, bool], list[Row[Any]]] = {}
    for product in live:
        if product.intervals < 2:
            continue
        sold = (
            product.last_checkout_at is not None
            and product.last_checkout_at > sold_since
        )
        buckets.setdefault((product.live_intervals, sold), []).append(product)

    table = Table(title="Legacy products with both intervals (not deleted)")
    for column in (
        "Live intervals",
        "Sold < 1 year",
        "Products",
        "Orgs",
        "Unarchived",
    ):
        table.add_column(column)
    for (live_intervals, sold), rows in sorted(buckets.items()):
        table.add_row(
            str(live_intervals),
            "yes" if sold else "no",
            str(len(rows)),
            str(len({r.slug for r in rows})),
            str(sum(1 for r in rows if not r.is_archived)),
        )
    console.print(table)

    console.print(
        f"Legacy products: [bold]{len(products)}[/bold] "
        f"({len(products) - len(live)} deleted, "
        f"{sum(1 for p in live if p.intervals < 2)} with one interval)."
    )
    console.print(
        f"Skipped for a confirmed checkout: "
        f"[bold]{sum(1 for p in products if p.has_confirmed_checkout)}[/bold]."
    )
    console.print(
        f"Prices left to archive or clear on converted products: "
        f"[bold]{dirty_prices}[/bold]."
    )

    to_contact = [
        p
        for p in live
        if p.intervals >= 2
        and (
            p.live_intervals >= 2
            or (p.last_checkout_at is not None and p.last_checkout_at > sold_since)
        )
    ]
    if not to_contact:
        return

    detail = Table(title="Live subscriptions on both intervals, or sold < 1 year")
    for column in (
        "Slug",
        "Product",
        "Name",
        "Live month",
        "Live year",
        "Last checkout",
        "Interval kept",
    ):
        detail.add_column(column)
    for p in to_contact:
        detail.add_row(
            p.slug,
            str(p.id),
            p.name,
            str(p.live_month),
            str(p.live_year),
            p.last_checkout_at.date().isoformat() if p.last_checkout_at else "-",
            p.interval if p.live_intervals < 2 else "(merchant)",
        )
    console.print(detail)


@cli.command()
@typer_async
async def convert(
    execute: bool = typer.Option(
        False, help="Actually run the conversion (default: dry-run)"
    ),
    slug: str | None = typer.Option(None, help="Only this organization"),
    product_id: UUID | None = typer.Option(
        None,
        help="Only this product, including one whose merchant chose the interval",
    ),
    interval: SubscriptionRecurringInterval | None = typer.Option(
        None,
        help=("Interval to keep, overriding the default rule. Requires --product-id."),
    ),
    batch_size: int = typer.Option(
        5000, min=1, help="Number of rows to process per batch"
    ),
    sleep_seconds: float = typer.Option(0.1, help="Seconds to sleep between batches"),
) -> None:
    if interval is not None and product_id is None:
        raise typer.BadParameter("--interval requires --product-id")

    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    try:
        async with sessionmaker() as session:
            organization_id = None
            if slug is not None:
                organization_id = (
                    await session.execute(
                        select(Organization.id).where(Organization.slug == slug)
                    )
                ).scalar_one_or_none()
                if organization_id is None:
                    raise typer.BadParameter(f"No organization with slug {slug}")
            scope = Scope(
                organization_id=organization_id,
                product_id=product_id,
                interval=interval,
            )

            plan = (await session.execute(plan_statement(scope))).all()
            to_archive = (
                await session.execute(planned_archive_count_statement(scope))
            ).scalar_one() + (
                await session.execute(
                    price_count_statement(*_archivable(), *scope.clauses())
                )
            ).scalar_one()
            to_clear = (
                await session.execute(planned_clear_count_statement(scope))
            ).scalar_one() + (
                await session.execute(
                    price_count_statement(_clearable(), *scope.clauses())
                )
            ).scalar_one()

        intervals: dict[str, int] = {}
        for row in plan:
            intervals[row.interval] = intervals.get(row.interval, 0) + 1
        console.print(
            f"[bold]{len(plan)}[/bold] product(s) to convert "
            f"({', '.join(f'{k}: {v}' for k, v in sorted(intervals.items())) or '-'}), "
            f"[bold]{to_archive}[/bold] price(s) to archive, "
            f"[bold]{to_clear}[/bold] price(s) to clear."
        )

        if scope.organization_id is not None or scope.product_id is not None:
            table = Table()
            for column in ("Slug", "Product", "Name", "Interval kept"):
                table.add_column(column)
            for row in plan:
                table.add_row(row.slug, str(row.id), row.name, row.interval)
            console.print(table)

        if not plan and to_archive == 0 and to_clear == 0:
            console.print("[green]Nothing to convert.")
            return

        if not execute:
            console.print("[yellow]DRY RUN - No changes will be made.")
            return

        console.rule("[bold]Executing conversion")
        for name, statement in (
            ("products", convert_products_statement(scope)),
            ("archived_prices", archive_prices_statement(scope)),
            ("cleared_prices", clear_prices_statement(scope)),
        ):
            rows_updated = await run_batched_update(
                statement, batch_size=batch_size, sleep_seconds=sleep_seconds
            )
            log.info("convert.step_complete", step=name, rowcount=rows_updated)
            console.print(f"[green]{name}: {rows_updated} row(s) updated.")

    finally:
        await engine.dispose()


if __name__ == "__main__":
    cli()
