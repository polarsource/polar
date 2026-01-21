# pyright: reportCallIssue=false
import asyncio
import contextlib
import json
import logging.config
import pathlib
import tempfile
import uuid
from collections.abc import AsyncIterator
from functools import wraps
from typing import Annotated, Any, TypedDict

import httpx
import plain_client as pl
import structlog
import typer
from rich.progress import Progress

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_sessionmaker
from polar.organization.repository import OrganizationRepository
from polar.postgres import create_async_engine

cli = typer.Typer()


class BenefitGrantData(TypedDict):
    id: str
    benefit_id: str
    subscription_id: str | None
    order_id: str | None
    is_granted: bool
    is_revoked: bool
    granted_at: str | None
    revoked_at: str | None


class SubscriptionData(TypedDict):
    id: str
    status: str
    amount: int
    currency: str
    recurring_interval: str
    current_period_start: str
    current_period_end: str
    cancel_at_period_end: bool
    canceled_at: str | None
    started_at: str
    ends_at: str | None
    ended_at: str | None
    customer_id: str
    product_id: str
    discount_id: str | None


class CustomerData(TypedDict):
    benefit_grants: list[BenefitGrantData]
    subscriptions: list[SubscriptionData]


class OrganizationData(TypedDict):
    bogus_order_ids: list[str]
    real_order_ids: list[str]
    customers: dict[str, CustomerData]


class SummaryData(TypedDict):
    total_csv_rows: int
    organizations_affected: int
    subscriptions_with_status_diff: int


class WebhooksData(TypedDict):
    summary: SummaryData
    organizations: dict[str, OrganizationData]


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


class PlainScriptError(Exception):
    def __init__(self, message: str):
        super().__init__(message)


@contextlib.asynccontextmanager
async def _get_plain_client() -> AsyncIterator[pl.Plain]:
    async with httpx.AsyncClient(
        headers={"Authorization": f"Bearer {settings.PLAIN_TOKEN}"},
    ) as client:
        async with pl.Plain(
            "https://core-api.uk.plain.com/graphql/v1", http_client=client
        ) as plain:
            yield plain


def _write_json(data: dict[Any, Any]) -> pathlib.Path:
    with tempfile.NamedTemporaryFile("w", delete=False) as f:
        json.dump(data, f, indent=2)
    return pathlib.Path(f.name)


async def _upload_attachment(
    plain: pl.Plain, customer_id: str, file_name: str, file_path: pathlib.Path
) -> str:
    if not file_path.exists():
        raise PlainScriptError(f"File not found: {file_path}")

    file_size = file_path.stat().st_size

    attachment_result = await plain.create_attachment_upload_url(
        pl.CreateAttachmentUploadUrlInput(
            customer_id=customer_id,
            file_name=file_name,
            file_size_bytes=file_size,
            attachment_type=pl.AttachmentType.EMAIL,
        )
    )

    if attachment_result.error is not None:
        raise PlainScriptError(
            f"Failed to create attachment upload URL: {attachment_result.error.message}"
        )

    if attachment_result.attachment_upload_url is None:
        raise PlainScriptError("No attachment upload URL returned")

    upload_form_url = attachment_result.attachment_upload_url.upload_form_url
    upload_form_data = attachment_result.attachment_upload_url.upload_form_data

    with open(file_path, "rb") as f:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    upload_form_url,
                    data={item.key: item.value for item in upload_form_data},
                    files={"file": f},
                )
                response.raise_for_status()
            except httpx.HTTPError as e:
                raise PlainScriptError(f"Failed to upload file: {e}")

    file_path.unlink()
    return attachment_result.attachment_upload_url.attachment.id


async def _send_email(
    session: AsyncSession,
    organization_id: uuid.UUID,
    organization_data: OrganizationData,
) -> None:
    organization_repository = OrganizationRepository.from_session(session)
    organization = await organization_repository.get_by_id(organization_id)
    if organization is None:
        raise PlainScriptError("Organization not found")
    admin = await organization_repository.get_admin_user(session, organization)
    if admin is None:
        raise PlainScriptError("Admin user not found")

    async with _get_plain_client() as plain:
        # Fetch customer in Plain
        customer_result = await plain.upsert_customer(
            pl.UpsertCustomerInput(
                identifier=pl.UpsertCustomerIdentifierInput(email_address=admin.email),
                on_create=pl.UpsertCustomerOnCreateInput(
                    external_id=str(admin.id),
                    full_name=admin.email,
                    email=pl.EmailAddressInput(
                        email=admin.email, is_verified=admin.email_verified
                    ),
                ),
                on_update=pl.UpsertCustomerOnUpdateInput(
                    email=pl.EmailAddressInput(
                        email=admin.email, is_verified=admin.email_verified
                    ),
                ),
            )
        )
        if customer_result.error is not None:
            raise PlainScriptError(
                f"Failed to upsert customer: {customer_result.error.message}"
            )

        if customer_result.customer is None:
            raise PlainScriptError("Failed to upsert customer: no customer returned")

        customer_id = customer_result.customer.id

        # Create thread
        thread_result = await plain.create_thread(
            pl.CreateThreadInput(
                customer_identifier=pl.CustomerIdentifierInput(customer_id=customer_id),
                title="Polar Incident: Incorrect webhook events (Jan 19–21)",
                label_type_ids=["lt_01KFGJRK3DEV0TYT7D084G1MVQ"],
            )
        )
        if thread_result.error is not None:
            raise PlainScriptError(
                f"Failed to create thread: {thread_result.error.message}"
            )

        if thread_result.thread is None:
            raise PlainScriptError("Failed to create thread: no thread returned")

        thread_id = thread_result.thread.id

        # Prepare attachments
        attachments: list[str] = []
        customers_json = _write_json({"customers": organization_data["customers"]})
        attachments.append(
            await _upload_attachment(
                plain, customer_id, "affected_customers.json", customers_json
            )
        )

        if organization_data["bogus_order_ids"]:
            bogus_orders_json = _write_json(
                {"test_orders": organization_data["bogus_order_ids"]}
            )
            attachments.append(
                await _upload_attachment(
                    plain, customer_id, "test_orders.json", bogus_orders_json
                )
            )

        # Send email

        content = """
Hi there,

I’m Birk, Founder & CEO of Polar.

I’m writing to inform you about an incident that caused some incorrect webhooks to be sent between **January 19–21**, and was identified on **January 21**. We believe strongly in transparency and accountability, so I want to clearly explain what happened, the impact, how we’ve resolved it, and how you can confirm the resolution.

---

## Summary

* **Issue**: You received additional and incorrect webhook events.
* **Impact window:** January 19–21.
* **Current status:** Resolved. Corrected webhooks have already been re-sent.
* **Action needed:** We’ve attached an exhaustive list of all resources for which webhooks were sent during the period, along with their current up-to-date state, to make reconciliation and validation easy. Most resources were not affected, but this list is provided for completeness and peace of mind.

---

## What happened?

Due to an internal testing issue, our webhook worker sent **additional and incorrect webhook events** to some customers for their own order & subscription resources. As a result, inaccurate state may have been delivered for certain resources during the period January 19–21.

Important note: The inaccurate state was due to resources running in a separated, isolated, environment for some merchants (more below), and was not the result of any data loss or leakage.

---

## Resolution

Once detected on January 21, we immediately prioritized identifying all impacted resources. We have now:

* Re-sent **correct webhook events** for all affected resources as a safety measure to ensure the latest state is fully synchronized.
* The attached list is intentionally exhaustive and includes all resources for customers that received any webhook event during the period, even if their state was never incorrect, so you can validate with confidence.

At this point, your data **should already be back in sync**. If you want help validating this, simply reply to this email and our team will prioritize working with you.

---

"""

        if organization_data["bogus_order_ids"]:
            content += """
## Removing non-existing (test) orders

You also received `order.created`, `order.paid`, or `order.updated` events for **test orders**.

These were **not real customer orders**:

* They were not customer-visible
* They were not billed
* They were not accessible in production

However, they may have been stored in your database. We’ve attached a separate CSV containing these test orders so you can review and remove them if desired.

---

"""

        content += """
## Customer impact

You may have received incorrect subscription webhooks that mark existing subscriptions as canceled or past due. Depending on your implementation, this may have side-effects on your application if these end users actively used your product between Jan 19-21.

Importantly: **No customer-facing emails** about these state changes were sent by Polar.

Outside of normal transaction emails, we never communicate directly with your customers (our policy). However, given the incident, if you would like us to assist in communicating with affected customers, we’re happy to do so upon request.

---

## Why did this happen?

As part of infrastructure work on our webhook worker, we ran tests in a separate, isolated,  environment that unintentionally emitted production webhooks with incorrect state as a result.

This should not have been possible, and we are making immediate changes to ensure strict isolation and additional safeguards going forward.

---

I sincerely apologize for the impact this incident may have had on you. We understand that Polar is a critical part of your infrastructure, and incidents like this can damage trust. We take that responsibility seriously and are implementing multiple improvements to prevent this from happening again.

I’m personally available to answer any questions or concerns. Your trust in us and our reliability are my top priorities.

Sincerely,
Birk

Founder & CEO, Polar
"""

        email_result = await plain.send_new_email(
            pl.SendNewEmailInput(
                customer_id=customer_id,
                thread_id=thread_id,
                subject="Polar Incident: Incorrect webhook events (Jan 19–21)",
                text_content=content,
                markdown_content=content,
                attachment_ids=attachments,
            )
        )

        if email_result.error is not None:
            raise PlainScriptError(
                f"Failed to create email: {email_result.error.message}"
            )


@cli.command()
@typer_async
async def webhooks_comm(
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
    organization_id: str | None = typer.Option(None),
) -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        with file.open() as f:
            data: WebhooksData = json.loads(f.read())
            if organization_id is not None:
                organizations = {
                    organization_id: data["organizations"][organization_id]
                }
            else:
                organizations = data["organizations"]
            with Progress() as progress:
                task = progress.add_task(
                    "[cyan]Sending communication...", total=len(organizations)
                )
                for id, organization_data in organizations.items():
                    progress.update(task, description=f"[cyan]Handling {id}")
                    await _send_email(session, uuid.UUID(id), organization_data)
                    progress.update(task, advance=1)
    await engine.dispose()


if __name__ == "__main__":
    cli()
