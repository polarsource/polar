# pyright: reportCallIssue=false
import asyncio
import contextlib
import csv
import datetime
import pathlib
import tempfile
import uuid
from collections.abc import AsyncIterator, Iterable

import httpx
import plain_client as pl

from polar.config import settings
from polar.kit.db.postgres import create_async_sessionmaker
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession, create_async_engine


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


def _write_csv(
    headers: Iterable[str],
    items: Iterable[Iterable[str | int | float | datetime.datetime]],
) -> pathlib.Path:
    with tempfile.NamedTemporaryFile("w", delete=False) as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(items)
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


async def send_email(session: AsyncSession, organization_id: uuid.UUID) -> None:
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
                title="Webhooks incident",  # FIXME
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
        csv1 = _write_csv(  # FIXME
            ["ID", "Subscription ID"],
            [(f"ID_{i}", f"Subscription_{i}") for i in range(100)],
        )
        csv1_attachment = await _upload_attachment(plain, customer_id, "csv1.csv", csv1)

        # Send email

        # FIXME
        content = f"""
Sorry, **{organization.slug}**
"""
        email_result = await plain.send_new_email(
            pl.SendNewEmailInput(
                customer_id=customer_id,
                thread_id=thread_id,
                subject="Webhooks incident",  # FIXME
                text_content=content,
                markdown_content=content,
                attachment_ids=[csv1_attachment],
            )
        )

        if email_result.error is not None:
            raise PlainScriptError(
                f"Failed to create email: {email_result.error.message}"
            )


async def test_run() -> None:
    engine = create_async_engine("script")
    sessionmaker = create_async_sessionmaker(engine)
    async with sessionmaker() as session:
        await send_email(session, uuid.UUID("29201986-843d-48fb-b232-eaa1a52d8fd3"))
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(test_run())
