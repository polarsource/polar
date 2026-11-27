from pytest_mock import MockerFixture

from polar.customer_seat.sender import send_seat_invitation_email
from polar.email.schemas import SeatInvitationEmail
from polar.models import CustomerSeat, Organization


class TestSendSeatInvitationEmail:
    def test_send_invitation_success(
        self,
        mocker: MockerFixture,
        customer_seat_pending: CustomerSeat,
        organization: Organization,
    ) -> None:
        mock_enqueue = mocker.patch("polar.customer_seat.sender.enqueue_email_template")

        send_seat_invitation_email(
            customer_email="test@example.com",
            seat=customer_seat_pending,
            invitation_token="claim-token",
            organization=organization,
            product_name="Test Product",
            billing_manager_email="manager@example.com",
        )

        mock_enqueue.assert_called_once()
        email = mock_enqueue.call_args[0][0]
        assert isinstance(email, SeatInvitationEmail)
        assert email.props.organization.id == organization.id
        assert email.props.claim_url.endswith("?token=claim-token")

        enqueue_kwargs = mock_enqueue.call_args[1]
        assert enqueue_kwargs["to_email_addr"] == "test@example.com"
        assert "Test Product" in enqueue_kwargs["subject"]

    def test_send_invitation_with_email_props(
        self,
        mocker: MockerFixture,
        customer_seat_pending: CustomerSeat,
        organization: Organization,
    ) -> None:
        mock_enqueue = mocker.patch("polar.customer_seat.sender.enqueue_email_template")

        send_seat_invitation_email(
            customer_email="test@example.com",
            seat=customer_seat_pending,
            invitation_token="claim-token",
            organization=organization,
            product_name="Test Product",
            billing_manager_email="manager@example.com",
        )

        email = mock_enqueue.call_args[0][0]
        assert isinstance(email, SeatInvitationEmail)
        assert email.props.organization.id == organization.id
