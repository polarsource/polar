from uuid import UUID, uuid4

from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.email.schemas import (
    SupportCaseOrganizationNewMessageEmail,
    SupportCaseOrganizationNewMessageProps,
)
from polar.email.sender import enqueue_email_template
from polar.exceptions import PolarTaskError
from polar.file.s3 import S3_SERVICES
from polar.kit.utils import utc_now
from polar.models import File, Organization
from polar.models.file import FileServiceTypes
from polar.models.support_case import (
    DisputeSupportCase,
    SupportCase,
    SupportCaseMessageAuthorKind,
    SupportCaseType,
)
from polar.support_case.pdf import is_mergeable, merge_attachments
from polar.support_case.repository import (
    SupportCaseAttachmentRepository,
    SupportCaseMessageRepository,
    SupportCaseRepository,
)
from polar.support_case.service import support_case as support_case_service
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import AsyncSessionMaker, TaskPriority, actor


class SupportCaseTaskError(PolarTaskError): ...


class SupportCaseDoesNotExist(SupportCaseTaskError):
    def __init__(self, case_id: UUID) -> None:
        self.case_id = case_id
        message = f"The support case with id {case_id} does not exist."
        super().__init__(message)


class SupportCaseAttachmentsNotFound(SupportCaseTaskError):
    def __init__(self, case_id: UUID) -> None:
        self.case_id = case_id
        message = f"No attachments were provided to merge on case {case_id}."
        super().__init__(message)


# Recipient-facing label per case type, so the email copy stays generic.
_CASE_LABELS: dict[SupportCaseType, str] = {
    SupportCaseType.review_appeal: "appeal",
    SupportCaseType.dispute: "dispute",
}


def _case_dashboard_path(case: SupportCase, organization: Organization) -> str:
    """Deep-link the notification to where the merchant reads this case's thread."""
    if isinstance(case, DisputeSupportCase):
        return f"/dashboard/{organization.slug}/sales/disputes/{case.dispute_id}"
    return f"/dashboard/{organization.slug}/finance/account"


@actor(actor_name="support_case.notify_organization_of_new_message")
async def notify_organization_of_new_message(message_id: UUID) -> None:
    """Email an organization's members when a new staff message is posted on
    their case — a reply or a decision (a decision is just another message).
    Polar staff work the case in the backoffice and are never emailed.

    Merchant participation is org-level, so all members are notified. Direct
    email (bypassing the legacy notification system); discoverable via
    ``enqueue_email``. Runs after the request commits, so a rolled-back message
    never emails.
    """
    async with AsyncSessionMaker() as session:
        message = await SupportCaseMessageRepository.from_session(session).get_by_id(
            message_id
        )
        if message is None:
            return
        # Only staff messages notify; merchants/customers see their own.
        if message.author_kind != SupportCaseMessageAuthorKind.platform:
            return

        case = await SupportCaseRepository.from_session(session).get_by_id(
            message.case_id
        )
        if case is None:
            return
        members = await user_organization_service.list_by_org(
            session, case.organization_id
        )
        if not members:
            return
        organization = members[0].organization
        recipients = [member.user.email for member in members]

        case_label = _CASE_LABELS.get(case.type, "support case")
        url = settings.generate_frontend_url(_case_dashboard_path(case, organization))
        subject = f"Update on your {case_label} · {organization.name}"

        for email in recipients:
            enqueue_email_template(
                SupportCaseOrganizationNewMessageEmail(
                    props=SupportCaseOrganizationNewMessageProps(
                        email=email,
                        organization_name=organization.name,
                        case_label=case_label,
                        url=url,
                    )
                ),
                to_email_addr=email,
                subject=subject,
                # Notification-only: send from noreply and drop the default
                # support@ reply-to, so replies don't open a disconnected Plain
                # thread. The footer tells recipients to respond on the case.
                from_email_addr=f"noreply@{settings.EMAIL_FROM_DOMAIN}",
                reply_to_name=None,
                reply_to_email_addr=None,
            )


@actor(actor_name="support_case.merge_attachments", priority=TaskPriority.LOW)
async def merge_case_attachments(case_id: UUID, attachment_ids: list[UUID]) -> None:
    """Merge the selected case attachments into one PDF stored back on the
    case as an internal, case-level attachment (no message)."""
    async with AsyncSessionMaker() as session:
        case = await SupportCaseRepository.from_session(session).get_by_id(
            case_id, options=(joinedload(SupportCase.organization),)
        )
        if case is None:
            raise SupportCaseDoesNotExist(case_id)

        wanted = {UUID(str(raw)) for raw in attachment_ids}
        attachments = await SupportCaseAttachmentRepository.from_session(
            session
        ).list_by_case(case.id)
        selected = [a for a in attachments if a.id in wanted]
        mergeable = [a for a in selected if is_mergeable(a.file.mime_type)]

        # Files the selection can't contribute — an unmergeable type, or one
        # deleted between enqueue and now — are documented as note pages rather
        # than dropped, so the merge still runs as long as anything was selected.
        payloads = []
        for attachment in mergeable:
            s3_service = S3_SERVICES[attachment.file.service]
            content = s3_service.get_object_or_raise(attachment.file.path)[
                "Body"
            ].read()
            payloads.append((attachment.file.name, attachment.file.mime_type, content))
        skipped = [a for a in selected if not is_mergeable(a.file.mime_type)]
        if skipped:
            note = "\n".join(
                f"Skipped {a.file.name}: file type {a.file.mime_type} "
                "cannot be merged into a PDF."
                for a in skipped
            )
            payloads.append(("Skipped files", "text/plain", note.encode()))
        missing = wanted - {a.id for a in selected}
        if missing:
            note = "\n".join(
                f"Attachment {attachment_id} was deleted before the merge "
                "ran and could not be included."
                for attachment_id in sorted(missing)
            )
            payloads.append(("Missing attachments", "text/plain", note.encode()))
        if not payloads:
            raise SupportCaseAttachmentsNotFound(case_id)
        merged = merge_attachments(payloads)

        filename = f"merged-attachments-{utc_now().strftime('%Y%m%d-%H%M%S')}.pdf"
        path = (
            f"{FileServiceTypes.support_case_attachment.value}/"
            f"{case.organization_id}/{uuid4()}/{filename}"
        )
        s3_service = S3_SERVICES[FileServiceTypes.support_case_attachment]
        s3_service.upload(merged, path, "application/pdf")

        file = File(
            organization=case.organization,
            name=filename,
            path=path,
            mime_type="application/pdf",
            size=len(merged),
            service=FileServiceTypes.support_case_attachment,
            is_uploaded=True,
            is_enabled=True,
        )
        session.add(file)
        await support_case_service.add_attachment(session, case, file=file)
