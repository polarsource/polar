from uuid import UUID

from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.email.schemas import (
    SupportCaseOrganizationNewMessageEmail,
    SupportCaseOrganizationNewMessageProps,
)
from polar.email.sender import enqueue_email_template
from polar.models.support_case import (
    ReviewAppealSupportCase,
    SupportCaseMessageAuthorKind,
    SupportCaseType,
)
from polar.support_case.repository import (
    ReviewAppealSupportCaseRepository,
    SupportCaseMessageRepository,
)
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import AsyncSessionMaker, actor

# Recipient-facing label per case type, so the email copy stays generic.
_CASE_LABELS: dict[SupportCaseType, str] = {
    SupportCaseType.review_appeal: "appeal",
}


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

        case = await ReviewAppealSupportCaseRepository.from_session(session).get_by_id(
            message.case_id,
            options=(joinedload(ReviewAppealSupportCase.organization_review),),
        )
        if case is None:
            return

        members = await user_organization_service.list_by_org(
            session, case.organization_review.organization_id
        )
        if not members:
            return
        organization = members[0].organization
        recipients = [member.user.email for member in members]

        case_label = _CASE_LABELS.get(case.type, "support case")
        url = settings.generate_frontend_url(
            f"/dashboard/{organization.slug}/finance/account"
        )
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
            )
