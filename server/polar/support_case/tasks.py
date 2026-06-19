from uuid import UUID

from polar.config import settings
from polar.email.schemas import (
    SupportCaseOrganizationNewMessageEmail,
    SupportCaseOrganizationNewMessageProps,
)
from polar.email.sender import enqueue_email_template
from polar.models.support_case import (
    SupportCaseMessageAuthorKind,
    SupportCaseType,
)
from polar.support_case.repository import (
    SupportCaseMessageRepository,
    SupportCaseRepository,
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

        case = await SupportCaseRepository.from_session(session).get_by_id(
            message.case_id
        )
        if case is None:
            return
        # Dispute cases have no merchant-facing thread yet, so an email would
        # point to a page with nothing to act on. Suppress it until that UI
        # exists; the message is still recorded on the case. Remove this guard
        # when the merchant dispute view ships.
        if case.type == SupportCaseType.dispute:
            return
        members = await user_organization_service.list_by_org(
            session, case.organization_id
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
                # Notification-only: send from noreply and drop the default
                # support@ reply-to, so replies don't open a disconnected Plain
                # thread. The footer tells recipients to respond on the case.
                from_email_addr=f"noreply@{settings.EMAIL_FROM_DOMAIN}",
                reply_to_name=None,
                reply_to_email_addr=None,
            )
