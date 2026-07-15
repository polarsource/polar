"""Tests for support_case.tasks — merchant reply email fan-out and the
attachment PDF merge."""

import contextlib
from collections.abc import AsyncIterator, Sequence
from io import BytesIO
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fpdf import FPDF
from pypdf import PdfReader
from pytest_mock import MockerFixture

from polar.models import (
    Customer,
    Organization,
    Product,
    UserOrganization,
)
from polar.models.file import FileServiceTypes
from polar.models.support_case import (
    SupportCase,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
)
from polar.postgres import AsyncSession
from polar.support_case.repository import SupportCaseAttachmentRepository
from polar.support_case.service import support_case as support_case_service
from polar.support_case.tasks import (
    SupportCaseAttachmentsNotFound,
    merge_case_attachments,
    notify_organization_of_new_message,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_appeal_case,
    create_dispute_case,
    create_support_case_attachment_file,
)

# Unwrap to bypass the actor decorator (which needs the Dramatiq broker).
_notify = notify_organization_of_new_message.__wrapped__  # type: ignore[attr-defined]
_merge = merge_case_attachments.__wrapped__  # type: ignore[attr-defined]


@contextlib.asynccontextmanager
async def _session_maker(session: AsyncSession) -> AsyncIterator[AsyncSession]:
    yield session


async def _message(
    save_fixture: SaveFixture,
    case: SupportCase,
    *,
    author_kind: SupportCaseMessageAuthorKind,
    audience: Sequence[SupportCaseAudience],
    body: str = "A staff reply.",
) -> SupportCaseMessage:
    message = SupportCaseMessage(
        case=case,
        type=SupportCaseMessageType.chat,
        author_kind=author_kind,
        body=body,
        audience=list(audience),
    )
    await save_fixture(message)
    return message


@pytest.mark.asyncio
class TestNotifyOrganization:
    async def test_emails_each_org_member(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        message = await _message(
            save_fixture,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            audience=[SupportCaseAudience.merchant],
        )
        enqueue = mocker.patch("polar.support_case.tasks.enqueue_email_template")
        mocker.patch(
            "polar.support_case.tasks.AsyncSessionMaker",
            return_value=_session_maker(session),
        )

        await _notify(message.id)

        enqueue.assert_called_once()
        email, kwargs = enqueue.call_args
        assert kwargs["to_email_addr"] == user_organization.user.email
        # Notification-only: from noreply, no reply-to (replies shouldn't open a
        # disconnected Plain thread).
        assert kwargs["from_email_addr"].startswith("noreply@")
        assert kwargs["reply_to_email_addr"] is None
        assert email[0].props.case_label == "appeal"
        assert email[0].props.url.endswith(f"/{organization.slug}/finance/account")

    async def test_notifies_dispute_case(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        # The merchant-facing dispute thread ships, so support replies notify.
        case = await create_dispute_case(save_fixture, organization, customer, product)
        message = await _message(
            save_fixture,
            case,
            author_kind=SupportCaseMessageAuthorKind.platform,
            audience=[SupportCaseAudience.merchant],
        )
        enqueue = mocker.patch("polar.support_case.tasks.enqueue_email_template")
        mocker.patch(
            "polar.support_case.tasks.AsyncSessionMaker",
            return_value=_session_maker(session),
        )

        await _notify(message.id)

        enqueue.assert_called_once()
        email, kwargs = enqueue.call_args
        assert kwargs["to_email_addr"] == user_organization.user.email
        # Dispute notifications deep-link to the dispute thread, not finance.
        assert email[0].props.case_label == "dispute"
        assert email[0].props.url.endswith(f"/sales/disputes/{case.dispute_id}")

    async def test_skips_non_staff_message(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await create_appeal_case(save_fixture, organization)
        message = await _message(
            save_fixture,
            case,
            author_kind=SupportCaseMessageAuthorKind.merchant,
            audience=[SupportCaseAudience.merchant],
        )
        enqueue = mocker.patch("polar.support_case.tasks.enqueue_email_template")
        mocker.patch(
            "polar.support_case.tasks.AsyncSessionMaker",
            return_value=_session_maker(session),
        )

        await _notify(message.id)

        enqueue.assert_not_called()


def _pdf_bytes() -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=10)
    pdf.cell(0, 6, "evidence")
    return bytes(pdf.output())


@pytest.mark.asyncio
class TestMergeCaseAttachments:
    async def test_stores_merged_pdf_as_case_level_attachment(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        first = await create_support_case_attachment_file(
            save_fixture, organization, name="a.pdf"
        )
        second = await create_support_case_attachment_file(
            save_fixture, organization, name="b.pdf"
        )
        one = await support_case_service.add_attachment(session, case, file=first)
        two = await support_case_service.add_attachment(session, case, file=second)
        await session.flush()

        s3 = MagicMock()
        s3.get_object_or_raise.side_effect = lambda path: {
            "Body": BytesIO(_pdf_bytes())
        }
        mocker.patch(
            "polar.support_case.tasks.S3_SERVICES",
            {FileServiceTypes.support_case_attachment: s3},
        )
        mocker.patch(
            "polar.support_case.tasks.AsyncSessionMaker",
            return_value=_session_maker(session),
        )

        await _merge(case.id, [one.id, two.id])

        attachments = await SupportCaseAttachmentRepository.from_session(
            session
        ).list_by_case(case.id)
        merged = [
            attachment
            for attachment in attachments
            if attachment.file.name.startswith("merged-attachments-")
        ]
        assert len(merged) == 1
        assert merged[0].message_id is None
        assert merged[0].file.mime_type == "application/pdf"
        assert merged[0].file.is_uploaded is True

        s3.upload.assert_called_once()
        content = s3.upload.call_args.args[0]
        assert content.startswith(b"%PDF")

    async def test_raises_when_nothing_selected(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        mocker.patch(
            "polar.support_case.tasks.AsyncSessionMaker",
            return_value=_session_maker(session),
        )

        with pytest.raises(SupportCaseAttachmentsNotFound):
            await _merge(case.id, [])

    async def test_stores_notes_only_pdf_when_all_attachments_gone(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        s3 = MagicMock()
        mocker.patch(
            "polar.support_case.tasks.S3_SERVICES",
            {FileServiceTypes.support_case_attachment: s3},
        )
        mocker.patch(
            "polar.support_case.tasks.AsyncSessionMaker",
            return_value=_session_maker(session),
        )

        await _merge(case.id, [uuid4()])

        s3.upload.assert_called_once()
        content = s3.upload.call_args.args[0]
        pages = PdfReader(BytesIO(content)).pages
        assert len(pages) == 1
        assert "was deleted before the merge" in pages[0].extract_text()

    async def test_notes_attachments_deleted_before_merge(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        file = await create_support_case_attachment_file(
            save_fixture, organization, name="a.pdf"
        )
        attachment = await support_case_service.add_attachment(session, case, file=file)
        await session.flush()

        s3 = MagicMock()
        s3.get_object_or_raise.side_effect = lambda path: {
            "Body": BytesIO(_pdf_bytes())
        }
        mocker.patch(
            "polar.support_case.tasks.S3_SERVICES",
            {FileServiceTypes.support_case_attachment: s3},
        )
        mocker.patch(
            "polar.support_case.tasks.AsyncSessionMaker",
            return_value=_session_maker(session),
        )

        await _merge(case.id, [attachment.id, uuid4()])

        s3.upload.assert_called_once()
        content = s3.upload.call_args.args[0]
        pages = PdfReader(BytesIO(content)).pages
        assert len(pages) == 2
        assert "was deleted before the merge" in pages[1].extract_text()
