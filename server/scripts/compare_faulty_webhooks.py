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
from rich.table import Table
from sqlalchemy import select

from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import BenefitGrant, Customer, Order, Subscription
from polar.postgres import create_async_engine

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


@dataclass
class FieldDiff:
    field: str
    sent_value: Any
    db_value: Any


@dataclass
class ResourceDiff:
    resource_id: UUID
    resource_type: str
    event_type: str
    webhook_event_id: UUID
    organization_id: UUID | None = None
    diffs: list[FieldDiff] = field(default_factory=list)

    @property
    def recommended_action(self) -> str:
        if self.event_type == "order.created":
            return "NOTIFY_MERCHANT_REMOVE_ORDER"
        if self.event_type == "customer.created":
            return "NOTIFY_MERCHANT_REMOVE_CUSTOMER"
        if self.event_type == "subscription.created":
            return "NOTIFY_MERCHANT_REMOVE_SUBSCRIPTION"
        if self.event_type == "benefit_grant.created":
            return "NOTIFY_MERCHANT_REMOVE_BENEFIT_GRANT"
        return "RESEND_WEBHOOK"


@dataclass
class ComparisonResult:
    total_csv_rows: int
    resources_found: int
    resources_missing: int
    resources_matching: int
    resources_differing: int
    resource_diffs: list[ResourceDiff]
    missing_resource_ids: list[tuple[UUID, str]]
    diffs_by_event_type: dict[str, int] = field(default_factory=dict)
    diffs_by_organization: dict[UUID, int] = field(default_factory=dict)


SUBSCRIPTION_FIELDS = [
    "status",
    "amount",
    "currency",
    # "current_period_start",
    # "current_period_end",
    # "cancel_at_period_end",
    "canceled_at",
    "started_at",
    "ends_at",
    "ended_at",
    "customer_id",
    "product_id",
    "discount_id",
]

CUSTOMER_FIELDS = [
    "email",
    "email_verified",
    "name",
    "external_id",
    "organization_id",
]

ORDER_FIELDS = [
    "status",
    "subtotal_amount",
    "discount_amount",
    "tax_amount",
    "currency",
    "billing_reason",
    "refunded_amount",
    "customer_id",
    "product_id",
    "subscription_id",
]

BENEFIT_GRANT_FIELDS = [
    "customer_id",
    "benefit_id",
    "subscription_id",
    "order_id",
]


def parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    value = value.replace("Z", "+00:00")
    return datetime.fromisoformat(value)


UUID_FIELDS = {
    "customer_id",
    "product_id",
    "discount_id",
    "subscription_id",
    "order_id",
    "benefit_id",
    "organization_id",
    "checkout_id",
}


def normalize_value(value: Any, field_name: str) -> Any:
    if value is None:
        return None
    if (
        field_name.endswith("_at")
        or field_name.endswith("_start")
        or field_name.endswith("_end")
    ):
        if isinstance(value, str):
            return parse_datetime(value)
        return value
    if field_name in UUID_FIELDS:
        if isinstance(value, str):
            return UUID(value)
        return value
    return value


def compare_values(sent: Any, db: Any, field_name: str) -> bool:
    sent_norm = normalize_value(sent, field_name)
    db_norm = normalize_value(db, field_name)

    if isinstance(sent_norm, datetime) and isinstance(db_norm, datetime):
        return sent_norm.replace(microsecond=0) == db_norm.replace(microsecond=0)

    return sent_norm == db_norm


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


def get_fields_for_type(resource_type: str) -> list[str]:
    if resource_type == "subscription":
        return SUBSCRIPTION_FIELDS
    elif resource_type == "customer":
        return CUSTOMER_FIELDS
    elif resource_type == "order":
        return ORDER_FIELDS
    elif resource_type == "benefit_grant":
        return BENEFIT_GRANT_FIELDS
    return []


def extract_organization_id(resource_data: dict[str, Any]) -> UUID | None:
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


async def compare_webhooks(csv_path: Path) -> ComparisonResult:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)

    resource_diffs: list[ResourceDiff] = []
    missing_resource_ids: list[tuple[UUID, str]] = []
    diffs_by_event_type: dict[str, int] = {}
    diffs_by_organization: dict[UUID, int] = {}
    found_count = 0
    matching_count = 0

    with open(csv_path) as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    total_rows = len(rows)
    console.print(f"[cyan]Processing {total_rows} webhook events from CSV...[/cyan]")

    async with sessionmaker() as session:
        for i, row in enumerate(rows):
            if (i + 1) % 100 == 0:
                console.print(f"  Processed {i + 1}/{total_rows}...")

            webhook_event_id = UUID(row["id"])
            event_type = row["type"]
            payload_str = row["payload"]

            try:
                payload = json.loads(payload_str)
            except json.JSONDecodeError:
                console.print(
                    f"[yellow]Skipping {webhook_event_id}: invalid JSON payload[/yellow]"
                )
                continue

            resource_data = payload.get("data", {})
            resource_id_str = resource_data.get("id")
            if not resource_id_str:
                console.print(
                    f"[yellow]Skipping {webhook_event_id}: no resource ID in payload[/yellow]"
                )
                continue

            resource_id = UUID(resource_id_str)
            resource_type = get_resource_type(event_type)

            db_resource: Subscription | Customer | Order | BenefitGrant | None = None
            if resource_type == "subscription":
                result = await session.execute(
                    select(Subscription).where(Subscription.id == resource_id)
                )
                db_resource = result.scalar_one_or_none()
            elif resource_type == "customer":
                result = await session.execute(
                    select(Customer).where(Customer.id == resource_id)
                )
                db_resource = result.scalar_one_or_none()
            elif resource_type == "order":
                result = await session.execute(
                    select(Order).where(Order.id == resource_id)
                )
                db_resource = result.scalar_one_or_none()
            elif resource_type == "benefit_grant":
                result = await session.execute(
                    select(BenefitGrant).where(BenefitGrant.id == resource_id)
                )
                db_resource = result.scalar_one_or_none()
            else:
                continue

            if db_resource is None:
                missing_resource_ids.append((resource_id, resource_type))
                continue

            found_count += 1
            fields_to_compare = get_fields_for_type(resource_type)
            field_diffs: list[FieldDiff] = []

            for field_name in fields_to_compare:
                sent_value = resource_data.get(field_name)
                db_value = getattr(db_resource, field_name, None)

                if not compare_values(sent_value, db_value, field_name):
                    field_diffs.append(
                        FieldDiff(
                            field=field_name,
                            sent_value=sent_value,
                            db_value=db_value,
                        )
                    )

            if field_diffs:
                org_id = extract_organization_id(resource_data)
                resource_diffs.append(
                    ResourceDiff(
                        resource_id=resource_id,
                        resource_type=resource_type,
                        event_type=event_type,
                        webhook_event_id=webhook_event_id,
                        organization_id=org_id,
                        diffs=field_diffs,
                    )
                )
                diffs_by_event_type[event_type] = (
                    diffs_by_event_type.get(event_type, 0) + 1
                )
                if org_id:
                    diffs_by_organization[org_id] = (
                        diffs_by_organization.get(org_id, 0) + 1
                    )
            else:
                matching_count += 1

    await engine.dispose()

    return ComparisonResult(
        total_csv_rows=total_rows,
        resources_found=found_count,
        resources_missing=len(missing_resource_ids),
        resources_matching=matching_count,
        resources_differing=len(resource_diffs),
        resource_diffs=resource_diffs,
        missing_resource_ids=missing_resource_ids,
        diffs_by_event_type=diffs_by_event_type,
        diffs_by_organization=diffs_by_organization,
    )


def print_results(result: ComparisonResult, output_json: bool = False) -> None:
    if output_json:
        output = {
            "summary": {
                "total_csv_rows": result.total_csv_rows,
                "resources_found": result.resources_found,
                "resources_missing": result.resources_missing,
                "resources_matching": result.resources_matching,
                "resources_differing": result.resources_differing,
                "organizations_affected": len(result.diffs_by_organization),
            },
            "diffs_by_organization": {
                str(k): v for k, v in result.diffs_by_organization.items()
            },
            "diffs_by_event_type": result.diffs_by_event_type,
            "actions": [
                {
                    "resource_type": rd.resource_type,
                    "resource_id": str(rd.resource_id),
                    "organization_id": str(rd.organization_id) if rd.organization_id else None,
                    "event_type": rd.event_type,
                    "changed_fields": [d.field for d in rd.diffs],
                    "action": rd.recommended_action,
                }
                for rd in result.resource_diffs
            ],
            "missing_resources": [
                {"resource_id": str(rid), "resource_type": rtype}
                for rid, rtype in result.missing_resource_ids
            ],
        }
        print(json.dumps(output, indent=2))
        return

    console.print("\n[bold]Summary[/bold]")
    console.print(f"  Total CSV rows:      {result.total_csv_rows}")
    console.print(f"  Resources found:     {result.resources_found}")
    console.print(f"  Resources missing:   {result.resources_missing}")
    console.print(f"  Resources matching:  {result.resources_matching}")
    console.print(f"  [red]Resources differing: {result.resources_differing}[/red]")
    console.print(f"  [cyan]Organizations affected: {len(result.diffs_by_organization)}[/cyan]")

    if result.diffs_by_organization:
        console.print("\n[bold]Diffs by Organization[/bold]")
        for org_id, count in sorted(
            result.diffs_by_organization.items(), key=lambda x: -x[1]
        ):
            console.print(f"  {org_id}: [red]{count}[/red]")

    if result.diffs_by_event_type:
        console.print("\n[bold]Diffs by Event Type[/bold]")
        for event_type, count in sorted(
            result.diffs_by_event_type.items(), key=lambda x: -x[1]
        ):
            console.print(f"  {event_type}: [red]{count}[/red]")

    if result.resource_diffs:
        console.print("\n[bold]Action Plan[/bold]")
        table = Table(show_header=True, header_style="bold")
        table.add_column("Type")
        table.add_column("Resource ID")
        table.add_column("Organization")
        table.add_column("Event")
        table.add_column("Changed Fields")
        table.add_column("Action")

        for rd in result.resource_diffs[:50]:
            changed_fields = ", ".join(d.field for d in rd.diffs)
            table.add_row(
                rd.resource_type,
                str(rd.resource_id)[:8] + "...",
                str(rd.organization_id)[:8] + "..." if rd.organization_id else "N/A",
                rd.event_type,
                changed_fields[:30] + ("..." if len(changed_fields) > 30 else ""),
                rd.recommended_action,
            )

        console.print(table)

        if len(result.resource_diffs) > 50:
            console.print(
                f"\n[yellow]... and {len(result.resource_diffs) - 50} more. "
                "Use --json for full output.[/yellow]"
            )

    if result.missing_resource_ids:
        console.print(
            f"\n[yellow]Missing {len(result.missing_resource_ids)} resources from DB[/yellow]"
        )


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


@cli.command()
@typer_async
async def compare(
    csv_source: str = typer.Argument(
        ..., help="Path or URL to CSV file with faulty webhook data"
    ),
    output_json: bool = typer.Option(False, "--json", help="Output as JSON to stdout"),
) -> None:
    """Compare faulty webhook payload data against actual resources in the database."""
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

    result = await compare_webhooks(csv_path)
    print_results(result, output_json=output_json)


if __name__ == "__main__":
    cli()
