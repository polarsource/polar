import asyncio
import csv
import json
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from functools import wraps
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

import httpx
import structlog
import typer
from rich.console import Console
from sqlalchemy import select

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import BenefitGrant, Customer, Order, Subscription
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import create_async_engine
from polar.product.repository import ProductRepository
from polar.subscription.repository import SubscriptionRepository
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

cli = typer.Typer()
console = Console()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])


def typer_async(f):  # type: ignore
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


def serialize_value(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, UUID):
        return str(val)
    if isinstance(val, datetime):
        return val.isoformat()
    if hasattr(val, "value"):
        return val.value
    return val


def serialize_benefit_grant(grant: BenefitGrant) -> dict[str, Any]:
    return {
        "id": str(grant.id),
        "benefit_id": serialize_value(grant.benefit_id),
        "subscription_id": serialize_value(grant.subscription_id),
        "order_id": serialize_value(grant.order_id),
        "is_granted": grant.is_granted,
        "is_revoked": grant.is_revoked,
        "granted_at": serialize_value(grant.granted_at),
        "revoked_at": serialize_value(grant.revoked_at),
    }


def serialize_subscription(sub: Subscription) -> dict[str, Any]:
    return {
        "id": str(sub.id),
        "status": sub.status.value if sub.status else None,
        "amount": sub.amount,
        "currency": sub.currency,
        "recurring_interval": sub.recurring_interval.value
        if sub.recurring_interval
        else None,
        "current_period_start": serialize_value(sub.current_period_start),
        "current_period_end": serialize_value(sub.current_period_end),
        "cancel_at_period_end": sub.cancel_at_period_end,
        "canceled_at": serialize_value(sub.canceled_at),
        "started_at": serialize_value(sub.started_at),
        "ends_at": serialize_value(sub.ends_at),
        "ended_at": serialize_value(sub.ended_at),
        "customer_id": serialize_value(sub.customer_id),
        "product_id": serialize_value(sub.product_id),
        "discount_id": serialize_value(sub.discount_id),
    }


@dataclass
class CustomerInfo:
    subscriptions: list[dict[str, Any]] = field(default_factory=list)
    benefit_grants: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class OrganizationInfo:
    customers: dict[UUID, CustomerInfo] = field(default_factory=dict)
    bogus_order_ids: list[UUID] = field(default_factory=list)
    real_order_ids: list[UUID] = field(default_factory=list)


@dataclass
class AnalysisResult:
    total_csv_rows: int
    organizations: dict[UUID, OrganizationInfo]
    subscription_status_diffs: set[UUID]


def get_resource_type(event_type: str) -> str:
    if event_type.startswith("subscription."):
        return "subscription"
    elif event_type.startswith("customer."):
        return "customer"
    elif event_type.startswith("order."):
        return "order"
    elif event_type.startswith("benefit_grant."):
        return "benefit_grant"
    return "unknown"


def extract_customer_id_from_payload(
    resource_data: dict[str, Any], resource_type: str
) -> UUID | None:
    if resource_type == "customer":
        resource_id = resource_data.get("id")
        if resource_id:
            return UUID(resource_id)
        return None
    if resource_type == "benefit_grant":
        customer = resource_data.get("customer")
        if customer and customer.get("id"):
            return UUID(customer["id"])
        return None
    customer_id = resource_data.get("customer_id")
    if customer_id:
        return UUID(customer_id)
    customer = resource_data.get("customer")
    if customer and customer.get("id"):
        return UUID(customer["id"])
    return None


def extract_organization_id_from_payload(resource_data: dict[str, Any]) -> UUID | None:
    org_id = resource_data.get("organization_id")
    if org_id:
        return UUID(org_id)
    customer = resource_data.get("customer")
    if customer and customer.get("organization_id"):
        return UUID(customer["organization_id"])
    product = resource_data.get("product")
    if product and product.get("organization_id"):
        return UUID(product["organization_id"])
    return None


async def analyze_webhooks(rows: list[dict[str, Any]]) -> AnalysisResult:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    org_customer_ids: dict[UUID, set[UUID]] = {}
    org_order_ids: dict[UUID, set[UUID]] = {}
    subscription_sent_statuses: dict[UUID, str] = {}

    total_rows = len(rows)
    console.print(
        f"[cyan]Phase 1: Extracting customers and orders from {total_rows} rows...[/cyan]"
    )

    for i, row in enumerate(rows):
        if (i + 1) % 500 == 0:
            console.print(f"  Processed {i + 1}/{total_rows}...")

        event_type = row["type"]
        payload_str = row["payload"]

        try:
            payload = json.loads(payload_str)
        except json.JSONDecodeError:
            continue

        resource_data = payload.get("data", {})
        resource_type = get_resource_type(event_type)

        org_id = extract_organization_id_from_payload(resource_data)
        if not org_id:
            continue

        customer_id = extract_customer_id_from_payload(resource_data, resource_type)
        if customer_id:
            if org_id not in org_customer_ids:
                org_customer_ids[org_id] = set()
            org_customer_ids[org_id].add(customer_id)

        if resource_type == "order":
            order_id = resource_data.get("id")
            if order_id:
                if org_id not in org_order_ids:
                    org_order_ids[org_id] = set()
                org_order_ids[org_id].add(UUID(order_id))

        if resource_type == "subscription":
            sent_status = resource_data.get("status")
            sub_id_str = resource_data.get("id")
            if sent_status and sub_id_str:
                subscription_sent_statuses[UUID(sub_id_str)] = sent_status

    console.print(
        "[cyan]Phase 2: Fetching customer and subscription data from DB...[/cyan]"
    )

    organizations: dict[UUID, OrganizationInfo] = {}

    async with sessionmaker() as session:
        for org_id, customer_ids in org_customer_ids.items():
            org_info = OrganizationInfo()

            for cust_id in customer_ids:
                cust_result = await session.execute(
                    select(Customer).where(Customer.id == cust_id)
                )
                db_customer = cust_result.scalar_one_or_none()

                if db_customer is None:
                    continue

                sub_result = await session.execute(
                    select(Subscription).where(Subscription.customer_id == cust_id)
                )
                db_subscriptions = sub_result.scalars().all()

                grant_result = await session.execute(
                    select(BenefitGrant).where(BenefitGrant.customer_id == cust_id)
                )
                db_grants = grant_result.scalars().all()

                org_info.customers[cust_id] = CustomerInfo(
                    subscriptions=[serialize_subscription(s) for s in db_subscriptions],
                    benefit_grants=[serialize_benefit_grant(g) for g in db_grants],
                )

            organizations[org_id] = org_info

        console.print("[cyan]Phase 3: Checking order validity...[/cyan]")

        for org_id, order_ids in org_order_ids.items():
            if org_id not in organizations:
                organizations[org_id] = OrganizationInfo()

            for order_id in order_ids:
                order_result = await session.execute(
                    select(Order.id).where(Order.id == order_id)
                )
                exists = order_result.scalar_one_or_none()

                if exists:
                    organizations[org_id].real_order_ids.append(order_id)
                else:
                    organizations[org_id].bogus_order_ids.append(order_id)

    verified_status_diffs: set[UUID] = set()
    async with sessionmaker() as session:
        for sub_id, sent_status in subscription_sent_statuses.items():
            status_result = await session.execute(
                select(Subscription.status).where(Subscription.id == sub_id)
            )
            db_status = status_result.scalar_one_or_none()
            if db_status and db_status.value != sent_status:
                verified_status_diffs.add(sub_id)

    await engine.dispose()

    return AnalysisResult(
        total_csv_rows=total_rows,
        organizations=organizations,
        subscription_status_diffs=verified_status_diffs,
    )


def print_results(result: AnalysisResult, output_json: bool = False) -> None:
    output = {
        "summary": {
            "total_csv_rows": result.total_csv_rows,
            "organizations_affected": len(result.organizations),
            "subscriptions_with_status_diff": len(result.subscription_status_diffs),
        },
        "organizations": {
            str(org_id): {
                "customers": {
                    str(cust_id): {
                        "subscriptions": info.subscriptions,
                        "benefit_grants": info.benefit_grants,
                    }
                    for cust_id, info in org_info.customers.items()
                },
                "bogus_order_ids": [str(oid) for oid in org_info.bogus_order_ids],
                "real_order_ids": [str(oid) for oid in org_info.real_order_ids],
            }
            for org_id, org_info in result.organizations.items()
        },
    }

    if output_json:
        print(json.dumps(output, indent=2), flush=True)
        return

    console.print("\n[bold]Summary[/bold]")
    console.print(f"  Total CSV rows:              {result.total_csv_rows}")
    console.print(f"  Organizations affected:      {len(result.organizations)}")
    console.print(
        f"  Subscriptions with status diff: {len(result.subscription_status_diffs)}"
    )

    for org_id, org_info in result.organizations.items():
        console.print(f"\n[bold cyan]Organization: {org_id}[/bold cyan]")
        console.print(f"  Customers: {len(org_info.customers)}")
        console.print(f"  Bogus orders: {len(org_info.bogus_order_ids)}")
        console.print(f"  Real orders: {len(org_info.real_order_ids)}")

        for cust_id, cust_info in list(org_info.customers.items())[:5]:
            console.print(f"\n  [bold]Customer: {cust_id}[/bold]")
            for sub in cust_info.subscriptions:
                console.print(f"    - Subscription {sub['id'][:8]}...: {sub['status']}")

        if len(org_info.customers) > 5:
            console.print(f"\n  ... and {len(org_info.customers) - 5} more customers")


def is_url(path: str) -> bool:
    parsed = urlparse(path)
    return parsed.scheme in ("http", "https")


async def download_file(url: str) -> Path:
    console.print(f"[cyan]Downloading {url}...[/cyan]")
    async with httpx.AsyncClient(follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()

    temp_file = tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False)
    temp_file.write(response.text)
    temp_file.close()
    console.print(f"[green]Downloaded to {temp_file.name}[/green]")
    return Path(temp_file.name)


async def send_webhooks(result: AnalysisResult) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    if result.subscription_status_diffs:
        console.print(
            f"\n[cyan]Sending subscription.updated for {len(result.subscription_status_diffs)} subscriptions...[/cyan]"
        )
        async with sessionmaker() as session:
            sub_repo = SubscriptionRepository.from_session(session)
            prod_repo = ProductRepository.from_session(session)

            for i, sub_id in enumerate(result.subscription_status_diffs):
                subscription = await sub_repo.get_by_id(
                    sub_id, options=sub_repo.get_eager_options()
                )
                if subscription is None:
                    continue

                product = await prod_repo.get_by_id(
                    subscription.product_id, options=prod_repo.get_eager_options()
                )
                if product is None:
                    continue

                await webhook_service.send(
                    session,
                    product.organization,
                    WebhookEventType.subscription_updated,
                    subscription,
                )

                if (i + 1) % 100 == 0:
                    console.print(
                        f"  Sent {i + 1}/{len(result.subscription_status_diffs)}..."
                    )

        console.print(
            f"[green]Sent {len(result.subscription_status_diffs)} subscription.updated webhooks[/green]"
        )

    await engine.dispose()

    all_customer_ids: set[UUID] = set()
    for org_info in result.organizations.values():
        all_customer_ids.update(org_info.customers.keys())

    console.print(
        f"\n[cyan]Enqueueing customer_state_changed for {len(all_customer_ids)} customers...[/cyan]"
    )

    for i, customer_id in enumerate(all_customer_ids):
        enqueue_job(
            "customer.webhook",
            WebhookEventType.customer_state_changed,
            customer_id,
        )
        if (i + 1) % 100 == 0:
            console.print(f"  Enqueued {i + 1}/{len(all_customer_ids)}...")

    console.print(
        f"[green]Enqueued {len(all_customer_ids)} customer_state_changed webhooks[/green]"
    )


@cli.command()
@typer_async
async def compare(
    csv_source: str = typer.Argument(
        ..., help="Path or URL to CSV file with faulty webhook data"
    ),
    output_json: bool = typer.Option(False, "--json", help="Output as JSON to stdout"),
    execute: bool = typer.Option(
        False,
        "--execute",
        help="Send webhooks to correct the state",
    ),
) -> None:
    """Analyze faulty webhook data and optionally send corrective webhooks."""
    if is_url(csv_source):
        try:
            csv_path = await download_file(csv_source)
        except httpx.HTTPError as e:
            console.print(f"[red]Failed to download file: {e}[/red]")
            raise typer.Exit(1)
    else:
        csv_path = Path(csv_source)
        if not csv_path.exists():
            console.print(f"[red]File not found: {csv_path}[/red]")
            raise typer.Exit(1)

    with open(csv_path) as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    result = await analyze_webhooks(rows)
    print_results(result, output_json=output_json)

    if execute:
        await send_webhooks(result)

    await asyncio.sleep(2)


if __name__ == "__main__":
    cli()
