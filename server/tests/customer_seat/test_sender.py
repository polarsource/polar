from pytest_mock import MockerFixture

from polar.customer_seat.sender import send_seat_invitation_email
from polar.models import CustomerSeat, Organization


class TestSendSeatInvitationEmail:
    def test_send_invitation_success(
        self,
        mocker: MockerFixture,
        customer_seat_pending: CustomerSeat,
        seat_enabled_organization: Organization,
    ) -> None:
        mock_enqueue = mocker.patch("polar.customer_seat.sender.enqueue_email")
        mock_render = mocker.patch(
            "polar.customer_seat.sender.render_email_template",
            return_value="<html>Test Email</html>",
        )

        send_seat_invitation_email(
            customer_email="test@example.com",
            seat=customer_seat_pending,
            organization=seat_enabled_organization,
            product_name="Test Product",
            billing_manager_email="manager@example.com",
        )

        mock_render.assert_called_once()
        call_args = mock_render.call_args

        assert call_args[0][0] == "seat_invitation"
        template_data = call_args[0][1]
        assert "organization" in template_data
        assert template_data["product_name"] == "Test Product"
        assert template_data["billing_manager_email"] == "manager@example.com"
        assert "claim_url" in template_data
        assert customer_seat_pending.invitation_token in template_data["claim_url"]

        mock_enqueue.assert_called_once()
        enqueue_kwargs = mock_enqueue.call_args[1]
        assert enqueue_kwargs["to_email_addr"] == "test@example.com"
        assert "Test Product" in enqueue_kwargs["subject"]
        assert enqueue_kwargs["html_content"] == "<html>Test Email</html>"

    def test_send_invitation_no_token(
        self,
        mocker: MockerFixture,
        customer_seat_claimed: CustomerSeat,
        seat_enabled_organization: Organization,
    ) -> None:
        customer_seat_claimed.invitation_token = None

        mock_enqueue = mocker.patch("polar.customer_seat.sender.enqueue_email")
        mock_log = mocker.patch("polar.customer_seat.sender.log")

        send_seat_invitation_email(
            customer_email="test@example.com",
            seat=customer_seat_claimed,
            organization=seat_enabled_organization,
            product_name="Test Product",
            billing_manager_email="manager@example.com",
        )

        mock_log.warning.assert_called_once()
        mock_enqueue.assert_not_called()

    def test_send_invitation_with_email_props(
        self,
        mocker: MockerFixture,
        customer_seat_pending: CustomerSeat,
        seat_enabled_organization: Organization,
    ) -> None:
        mock_render = mocker.patch(
            "polar.customer_seat.sender.render_email_template",
            return_value="<html>Test Email</html>",
        )
        mocker.patch("polar.customer_seat.sender.enqueue_email")

        send_seat_invitation_email(
            customer_email="test@example.com",
            seat=customer_seat_pending,
            organization=seat_enabled_organization,
            product_name="Test Product",
            billing_manager_email="manager@example.com",
        )

        call_args = mock_render.call_args
        template_data = call_args[0][1]
        assert "organization" in template_data
        assert template_data["organization"] == seat_enabled_organization.email_props
