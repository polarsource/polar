import structlog

from polar.config import settings
from polar.email.react import render_email_template
from polar.email.schemas import SeatInvitationEmail, SeatInvitationProps
from polar.email.sender import enqueue_email
from polar.logging import Logger
from polar.models import CustomerSeat, Organization

log: Logger = structlog.get_logger()


def send_seat_invitation_email(
    customer_email: str,
    seat: CustomerSeat,
    organization: Organization,
    product_name: str,
    billing_manager_email: str,
) -> None:
    """
    Send an invitation email to a customer who has been assigned a seat.
    """
    if not seat.invitation_token:
        log.warning(
            "seat_invitation.no_token",
            seat_id=seat.id,
            customer_email=customer_email,
        )
        return

    claim_url = (
        f"{settings.FRONTEND_BASE_URL}/{organization.slug}/portal/claim"
        f"?token={seat.invitation_token}"
    )

    html_content = render_email_template(
        SeatInvitationEmail(
            props=SeatInvitationProps.model_validate(
                {
                    "email": customer_email,
                    "organization": organization,
                    "product_name": product_name,
                    "billing_manager_email": billing_manager_email,
                    "claim_url": claim_url,
                }
            )
        )
    )

    enqueue_email(
        to_email_addr=customer_email,
        subject=f"You've been invited to access {product_name}",
        html_content=html_content,
    )

    log.info(
        "seat_invitation.sent",
        seat_id=seat.id,
        customer_email=customer_email,
        organization_id=organization.id,
    )
