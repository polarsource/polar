import asyncio
import csv
import logging.config
import pathlib
import random
import string
from datetime import UTC, datetime
from functools import wraps
from typing import Annotated, Any, overload

import dramatiq
import structlog
import typer
from pydantic import UUID4
from rich.progress import Progress
from sqlalchemy import func

from polar import tasks  # noqa: F401
from polar.customer.repository import CustomerRepository
from polar.kit.address import SUPPORTED_COUNTRIES, Address, CountryAlpha2
from polar.kit.db.postgres import create_async_sessionmaker
from polar.models import Customer, Order, Organization, Product
from polar.models.order import OrderBillingReason, OrderStatus
from polar.models.order_item import OrderItem
from polar.order.repository import OrderRepository
from polar.organization.repository import OrganizationRepository
from polar.postgres import create_async_engine
from polar.product.repository import ProductRepository
from polar.redis import create_redis
from polar.worker import JobQueueManager, enqueue_job

cli = typer.Typer()


def drop_all(*args: Any, **kwargs: Any) -> Any:
    raise structlog.DropEvent


structlog.configure(processors=[drop_all])
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": True,
    }
)


def typer_async(f):  # type: ignore
    # From https://github.com/tiangolo/typer/issues/85
    @wraps(f)
    def wrapper(*args, **kwargs):  # type: ignore
        return asyncio.run(f(*args, **kwargs))

    return wrapper


async def get_product_by_name(
    repository: ProductRepository, organization: Organization, name: str
) -> Any:
    statement = repository.get_base_statement().where(
        Product.organization_id == organization.id,
        func.lower(func.trim(Product.name)) == name.lower(),
    )
    return await repository.get_one_or_none(statement)


@overload
def getter(
    obj: dict[str, str], key: str, *fallback_keys: str, default: None = None
) -> str | None: ...


@overload
def getter(obj: dict[str, str], key: str, *fallback_keys: str, default: str) -> str: ...


def getter(
    obj: dict[str, str], key: str, *fallback_keys: str, default: str | None = None
) -> str | None:
    for k in (key, *fallback_keys):
        try:
            value = obj[k]
            if value != "":
                return value
        except KeyError:
            continue
    return default


@cli.command()
@typer_async
async def orders_import(
    organization_id: UUID4,
    file: Annotated[
        pathlib.Path,
        typer.Argument(
            exists=True,
            file_okay=True,
            dir_okay=False,
            writable=False,
            readable=True,
            resolve_path=True,
        ),
    ],
    invoice_number_prefix: str = typer.Option("LEMONSQUEEZY-"),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    redis = create_redis("script")
    async with JobQueueManager.open(dramatiq.get_broker(), redis) as manager:
        async with sessionmaker() as session:
            organization_repository = OrganizationRepository.from_session(session)
            organization = await organization_repository.get_by_id(organization_id)
            if organization is None:
                print("Organization not found")
                raise typer.Exit(code=1)

            customer_repository = CustomerRepository.from_session(session)
            product_repository = ProductRepository.from_session(session)
            order_repository = OrderRepository.from_session(session)

            customer_map: dict[str, Customer] = {}
            product_map: dict[str, Any] = {}

            # Count total rows
            with file.open("r") as f:
                total_rows = sum(1 for _ in csv.DictReader(f))

            with file.open("r") as f:
                reader = csv.DictReader(f)

                with Progress() as progress:
                    task = progress.add_task(
                        "[green]Importing orders...", total=total_rows
                    )

                    errors: list[tuple[int, str]] = []
                    for i, row in enumerate(reader):
                        # Customer
                        email = getter(row, "email", "user_email")
                        if email is None:
                            errors.append((i + 1, "Missing email"))
                            progress.advance(task)
                            continue

                        customer = customer_map.get(
                            email,
                            await customer_repository.get_by_email_and_organization(
                                email=email, organization_id=organization.id
                            ),
                        )
                        if customer is None:
                            name = getter(row, "name", "user_name")
                            raw_country = getter(row, "country")
                            country = raw_country.upper() if raw_country else None
                            if country is None or country not in SUPPORTED_COUNTRIES:
                                billing_address = None
                            else:
                                billing_address = Address(
                                    postal_code=getter(row, "postal_code"),
                                    city=getter(row, "city"),
                                    country=CountryAlpha2(country),
                                )
                            customer = await customer_repository.create(
                                Customer(
                                    email=email,
                                    name=name,
                                    billing_address=billing_address,
                                    organization=organization,
                                ),
                                flush=True,
                            )
                        customer_map[email] = customer

                        # Product
                        product_name = getter(
                            row,
                            "product_name",
                            "product_name_on_polar",
                        )
                        if product_name is None:
                            errors.append((i + 1, "Missing product name"))
                            progress.advance(task)
                            continue
                        product = product_map.get(
                            product_name,
                            await get_product_by_name(
                                product_repository, organization, product_name
                            ),
                        )
                        if product is None:
                            errors.append((i + 1, f"Product not found: {product_name}"))
                            progress.advance(task)
                            continue

                        product_map[product_name] = product

                        # Create Order
                        lemon_squeezy_id = getter(row, "id", "identifier")
                        if lemon_squeezy_id is not None:
                            existing_order_statement = (
                                order_repository.get_base_statement().where(
                                    Order.user_metadata["lemon_squeezy_id"].astext
                                    == lemon_squeezy_id,
                                )
                            )
                            existing_order = await order_repository.get_one_or_none(
                                existing_order_statement
                            )
                            if existing_order is not None:
                                progress.advance(task)
                                continue

                        raw_created_at = getter(row, "date_utc")
                        created_at = (
                            datetime.strptime(
                                raw_created_at, "%Y-%m-%d %H:%M:%S"
                            ).replace(tzinfo=UTC)
                            if raw_created_at
                            else datetime.now(UTC)
                        )

                        subtotal_amount = int(getter(row, "subtotal", default="0"))
                        order_number = getter(
                            row,
                            "order_number",
                            default="".join(
                                random.choices(string.ascii_uppercase, k=6)
                            ),
                        )
                        order = await order_repository.create(
                            Order(
                                created_at=created_at,
                                status=OrderStatus.paid,
                                subtotal_amount=0,
                                discount_amount=0,
                                tax_amount=0,  # Don't import tax to avoid perturbing our own tax reports
                                applied_balance_amount=0,
                                currency="usd",
                                billing_reason=OrderBillingReason.purchase,
                                billing_name=customer.billing_name,
                                billing_address=customer.billing_address,
                                taxability_reason=None,
                                tax_id=None,
                                tax_rate=None,
                                tax_calculation_processor_id=None,
                                invoice_number=f"{invoice_number_prefix}{organization.slug.upper()}-{order_number}",
                                customer=customer,
                                product=product,
                                discount=None,
                                subscription=None,
                                checkout=None,
                                items=[
                                    OrderItem(
                                        label="Imported",
                                        amount=subtotal_amount,
                                        tax_amount=0,  # Don't import tax to avoid perturbing our own tax reports
                                        proration=False,
                                    )
                                ],
                                user_metadata={
                                    "lemon_squeezy_id": lemon_squeezy_id,
                                }
                                if lemon_squeezy_id
                                else {},
                                custom_field_data={},
                            ),
                            flush=True,
                        )

                        enqueue_job(
                            "benefit.enqueue_benefits_grants",
                            task="grant",
                            customer_id=customer.id,
                            product_id=product.id,
                            order_id=order.id,
                        )

                        progress.advance(task)

            if errors:
                print("Errors encountered during import:")
                for row_number, message in errors:
                    print(f"  Row {row_number}: {message}")
                raise typer.Exit(code=1)
            else:
                await session.commit()


if __name__ == "__main__":
    cli()
