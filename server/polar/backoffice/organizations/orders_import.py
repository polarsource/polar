import dataclasses
import random
import string
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any, overload

import aiocsv
from fastapi import UploadFile
from sqlalchemy import func
from sse_starlette.event import ServerSentEvent
from tagflow import document, tag, text

from polar import tasks  # noqa: F401
from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarError
from polar.kit.address import SUPPORTED_COUNTRIES, Address, CountryAlpha2
from polar.models import Customer, Order, Organization, Product
from polar.models.order import OrderBillingReason, OrderStatus
from polar.models.order_item import OrderItem
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession
from polar.product.repository import ProductRepository
from polar.worker import enqueue_job

from ..components import alert


async def _get_product_by_name(
    repository: ProductRepository, organization: Organization, name: str
) -> Any:
    statement = repository.get_base_statement().where(
        Product.organization_id == organization.id,
        func.lower(func.trim(Product.name)) == name.lower(),
    )
    return await repository.get_one_or_none(statement)


@overload
def _getter(
    obj: dict[str, str], key: str, *fallback_keys: str, default: None = None
) -> str | None: ...


@overload
def _getter(
    obj: dict[str, str], key: str, *fallback_keys: str, default: str
) -> str: ...


def _getter(
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


@dataclasses.dataclass
class RowError:
    index: int
    message: str


class OrdersImportError(PolarError):
    def __init__(self, errors: list[RowError]) -> None:
        self.errors = errors
        super().__init__("Errors encountered during import")


class DecodedUploadFile:
    def __init__(self, file: UploadFile, encoding: str = "utf-8") -> None:
        self.file = file
        self.encoding = encoding

    async def read(self, size: int = -1) -> str:
        byte_data = await self.file.read(size)
        return byte_data.decode(self.encoding)


async def orders_import(
    session: AsyncSession,
    organization: Organization,
    file: UploadFile,
    *,
    invoice_number_prefix: str = "IMPORTED_",
) -> AsyncGenerator[tuple[int, int], None]:
    customer_repository = CustomerRepository.from_session(session)
    product_repository = ProductRepository.from_session(session)
    order_repository = OrderRepository.from_session(session)

    customer_map: dict[str, Customer] = {}
    product_map: dict[str, Any] = {}

    decoded_file = DecodedUploadFile(file)

    # Count total rows
    total_rows = 0
    async for _ in aiocsv.AsyncDictReader(decoded_file):
        total_rows += 1
    await file.seek(0)

    yield 0, total_rows

    reader = aiocsv.AsyncDictReader(decoded_file)
    errors: list[RowError] = []
    i = 0
    async for row in reader:
        i += 1
        # Customer
        email = _getter(row, "email", "user_email")
        if email is None:
            errors.append(RowError(i + 1, "Missing email"))
            yield i, total_rows
            continue

        customer = customer_map.get(
            email,
            await customer_repository.get_by_email_and_organization(
                email=email, organization_id=organization.id
            ),
        )
        if customer is None:
            name = _getter(row, "name", "user_name")
            raw_country = _getter(row, "country")
            country = raw_country.upper() if raw_country else None
            if country is None or country not in SUPPORTED_COUNTRIES:
                billing_address = None
            else:
                billing_address = Address(
                    postal_code=_getter(row, "postal_code"),
                    city=_getter(row, "city"),
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
        product_name = _getter(
            row,
            "product_name",
            "product_name_on_polar",
        )
        if product_name is None:
            errors.append(RowError(i + 1, "Missing product name"))
            yield i, total_rows
            continue
        product = product_map.get(
            product_name,
            await _get_product_by_name(product_repository, organization, product_name),
        )
        if product is None:
            errors.append(RowError(i + 1, f"Product not found: {product_name}"))
            yield i, total_rows
            continue

        product_map[product_name] = product

        # Create Order
        lemon_squeezy_id = _getter(row, "id", "identifier")
        if lemon_squeezy_id is not None:
            existing_order_statement = order_repository.get_base_statement().where(
                Order.user_metadata["lemon_squeezy_id"].astext == lemon_squeezy_id,
            )
            existing_order = await order_repository.get_one_or_none(
                existing_order_statement
            )
            if existing_order is not None:
                yield i, total_rows
                continue

        raw_created_at = _getter(row, "date_utc")
        created_at = (
            datetime.strptime(raw_created_at, "%Y-%m-%d %H:%M:%S").replace(tzinfo=UTC)
            if raw_created_at
            else datetime.now(UTC)
        )

        subtotal_amount = int(_getter(row, "subtotal", default="0"))
        order_number = _getter(
            row,
            "order_number",
            default="".join(random.choices(string.ascii_uppercase, k=6)),
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

        yield i, total_rows

    if errors:
        raise OrdersImportError(errors)
    else:
        await session.commit()


async def orders_import_sse(
    session: AsyncSession,
    organization: Organization,
    file: UploadFile,
    *,
    invoice_number_prefix: str = "IMPORTED_",
) -> AsyncGenerator[ServerSentEvent, None]:
    """Same as orders_import but yields progress for SSE."""
    try:
        async for progress in orders_import(
            session,
            organization,
            file,
            invoice_number_prefix=invoice_number_prefix,
        ):
            with document() as d:
                with tag.progress(
                    classes="progress progress-primary w-full",
                    value=str(progress[0]),
                    max=str(progress[1]),
                ):
                    pass
                yield ServerSentEvent(d.to_html(), event="progress")
    except OrdersImportError as e:
        with document() as d:
            with alert(
                variant="error", soft=True, classes="flex flex-col gap-2 items-start"
            ):
                with tag.div():
                    text("Import errors, no order were created:")
                with tag.ul(classes="list-disc list-inside"):
                    for error in e.errors:
                        with tag.li():
                            text(f"Row {error.index}: {error.message}")
            yield ServerSentEvent(d.to_html(), event="close")
    except Exception:
        with document() as d:
            with alert(variant="error", soft=True):
                text("An unexpected error occurred during import. Check server logs.")
            yield ServerSentEvent(d.to_html(), event="close")
        raise
    else:
        with document() as d:
            with alert(variant="success", soft=True):
                text("Import completed successfully.")
            yield ServerSentEvent(d.to_html(), event="close")
