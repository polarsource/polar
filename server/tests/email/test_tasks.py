import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.email.sender import SendEmailError
from polar.email.tasks import email_send
from polar.enums import EmailSender
from polar.models.email_log import EmailLog, EmailLogStatus
from polar.postgres import AsyncSession


@pytest.mark.asyncio
class TestEmailSend:
    async def test_successful_send(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        mock_send = mocker.patch(
            "polar.email.tasks.email_sender.send",
            return_value="resend_123",
        )

        await email_send(
            to_email_addr="test@example.com",
            subject="Test Subject",
            html_content="<p>Hello</p>",
            from_name="Polar",
            from_email_addr="noreply@polar.sh",
            email_headers=None,
            reply_to_name=None,
            reply_to_email_addr=None,
        )

        mock_send.assert_called_once()

        result = await session.execute(select(EmailLog))
        log = result.scalar_one()
        assert log.status == EmailLogStatus.sent
        assert log.processor_id == "resend_123"
        assert log.to_email_addr == "test@example.com"
        assert log.subject == "Test Subject"
        assert log.error is None

    async def test_failed_send_creates_log_and_reraises(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.email.tasks.email_sender.send",
            side_effect=SendEmailError("connection refused"),
        )

        with pytest.raises(SendEmailError):
            await email_send(
                to_email_addr="test@example.com",
                subject="Test Subject",
                html_content="<p>Hello</p>",
                from_name="Polar",
                from_email_addr="noreply@polar.sh",
                email_headers=None,
                reply_to_name=None,
                reply_to_email_addr=None,
            )

        result = await session.execute(select(EmailLog))
        log = result.scalar_one()
        assert log.status == EmailLogStatus.failed
        assert log.processor_id is None
        assert log.error == "connection refused"

    async def test_template_email_extracts_organization_id(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.email.tasks.email_sender.send",
            return_value=None,
        )
        mocker.patch(
            "polar.email.tasks.render_from_json",
            return_value="<p>Rendered</p>",
        )

        org_id = "01942f38-d81f-7cd7-a40e-a80ae5e3cecd"
        props_json = (
            '{"email": "test@example.com",'
            f' "organization": {{"id": "{org_id}", "name": "Test Org"}}}}'
        )

        await email_send(
            to_email_addr="test@example.com",
            subject="Test Subject",
            html_content=None,
            from_name="Polar",
            from_email_addr="noreply@polar.sh",
            email_headers=None,
            reply_to_name=None,
            reply_to_email_addr=None,
            template="order_confirmation",
            props_json=props_json,
        )

        result = await session.execute(select(EmailLog))
        log = result.scalar_one()
        assert log.email_template == "order_confirmation"
        assert str(log.organization_id) == org_id
        assert log.email_props["organization"]["name"] == "Test Org"

    async def test_processor_reflects_settings(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.email.tasks.email_sender.send",
            return_value=None,
        )
        mocker.patch(
            "polar.email.tasks.settings.EMAIL_SENDER",
            EmailSender.logger,
        )

        await email_send(
            to_email_addr="test@example.com",
            subject="Test",
            html_content="<p>Hi</p>",
            from_name="Polar",
            from_email_addr="noreply@polar.sh",
            email_headers=None,
            reply_to_name=None,
            reply_to_email_addr=None,
        )

        result = await session.execute(select(EmailLog))
        log = result.scalar_one()
        assert log.processor == EmailSender.logger

    async def test_log_failure_does_not_mask_send_error(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.email.tasks.email_sender.send",
            side_effect=SendEmailError("send failed"),
        )
        mocker.patch(
            "polar.email.tasks.AsyncSessionMaker",
            side_effect=RuntimeError("db down"),
        )
        log_exception = mocker.patch("polar.email.tasks.log.exception")

        with pytest.raises(SendEmailError, match="send failed"):
            await email_send(
                to_email_addr="test@example.com",
                subject="Test",
                html_content="<p>Hi</p>",
                from_name="Polar",
                from_email_addr="noreply@polar.sh",
                email_headers=None,
                reply_to_name=None,
                reply_to_email_addr=None,
            )

        log_exception.assert_called_once_with("Failed to write email log")
