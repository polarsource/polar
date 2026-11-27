import contextlib
import json
from collections.abc import AsyncIterator
from datetime import timedelta

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select

from polar.config import Environment, settings
from polar.email.react import serialize_email_props
from polar.email.repository import EmailLogRepository
from polar.email.schemas import SeatInvitationEmail, SeatInvitationProps
from polar.email.sender import SendEmailError
from polar.email.tasks import email_log_prune, email_send
from polar.enums import EmailSender
from polar.kit.utils import utc_now
from polar.models import Organization
from polar.models.email_log import EmailLog, EmailLogStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_email_log

BOUNCED = (2, EmailLogStatus.failed, "email.bounced; type=Permanent")
OLD_BOUNCE = (24 * 31, EmailLogStatus.failed, "email.bounced; type=Permanent")
SUPPRESSED = (1, EmailLogStatus.failed, "email.suppressed")
SENT = (1, EmailLogStatus.sent, None)


@contextlib.asynccontextmanager
async def _session_maker(session: AsyncSession) -> AsyncIterator[AsyncSession]:
    yield session


@pytest.mark.anyio
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

    async def test_persists_deduplication_key(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
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
            deduplication_key="some_reminder:abc:2026-4",
        )

        result = await session.execute(select(EmailLog))
        log = result.scalar_one()
        assert log.deduplication_key == "some_reminder:abc:2026-4"

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

    async def test_seat_invitation_log_has_no_raw_token(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        organization: Organization,
    ) -> None:
        mocker.patch("polar.email.tasks.email_sender.send", return_value=None)
        render = mocker.patch(
            "polar.email.tasks.render_from_json", return_value="<p>Rendered</p>"
        )
        token = "polar_cst_raw_invitation_token"
        email = SeatInvitationEmail(
            props=SeatInvitationProps.model_validate(
                {
                    "email": "member@example.com",
                    "organization": organization,
                    "product_name": "Team plan",
                    "billing_manager_email": "billing@example.com",
                    "claim_url": f"https://polar.sh/acme/portal/claim?token={token}",
                }
            )
        )

        await email_send(
            to_email_addr="member@example.com",
            subject="You've been invited",
            html_content=None,
            from_name="Polar",
            from_email_addr="noreply@polar.sh",
            email_headers=None,
            reply_to_name=None,
            reply_to_email_addr=None,
            template=email.template,
            props_json=serialize_email_props(email),
        )

        assert token in render.call_args.args[1]
        log = (await session.execute(select(EmailLog))).scalar_one()
        assert token not in json.dumps(log.email_props)
        assert log.email_props["product_name"] == "Team plan"

    @pytest.mark.parametrize(
        ("template", "field"),
        [
            ("login_code", "code"),
            ("customer_session_code", "code"),
            ("organization_email_verification", "code"),
            ("email_update", "url"),
            ("customer_email_update_verification", "url"),
        ],
    )
    async def test_redacts_secret_props(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        template: str,
        field: str,
    ) -> None:
        mocker.patch("polar.email.tasks.email_sender.send", return_value=None)
        mocker.patch(
            "polar.email.tasks.render_from_json", return_value="<p>Rendered</p>"
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
            template=template,
            props_json=json.dumps({"email": "test@example.com", field: "SECRET"}),
        )

        log = (await session.execute(select(EmailLog))).scalar_one()
        assert "SECRET" not in json.dumps(log.email_props)
        assert log.email_props["email"] == "test@example.com"

    async def test_send_includes_category_and_tenant_tags(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        mock_send = mocker.patch(
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

        assert mock_send.call_args.kwargs["tags"] == {
            "category": "order_confirmation",
            "tenant_id": org_id,
        }

    async def test_send_tags_omit_tenant_without_organization(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
    ) -> None:
        mock_send = mocker.patch(
            "polar.email.tasks.email_sender.send",
            return_value=None,
        )
        mocker.patch(
            "polar.email.tasks.render_from_json",
            return_value="<p>Rendered</p>",
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
            template="login_code",
            props_json='{"email": "test@example.com"}',
        )

        assert mock_send.call_args.kwargs["tags"] == {"category": "login_code"}

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

    @pytest.mark.parametrize(
        ("history", "removes_suppression"),
        [
            pytest.param([BOUNCED, SUPPRESSED], True, id="first bounce"),
            pytest.param([BOUNCED, SENT], False, id="latest sent"),
            pytest.param([BOUNCED, BOUNCED], False, id="bounced again"),
            pytest.param([OLD_BOUNCE, BOUNCED], True, id="old bounce expired"),
        ],
    )
    async def test_unsuppress_after_failed_delivery(
        self,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        history: list[tuple[int, EmailLogStatus, str | None]],
        removes_suppression: bool,
    ) -> None:
        for hours_ago, status, error in history:
            await create_email_log(
                save_fixture,
                created_at=utc_now() - timedelta(hours=hours_ago),
                status=status,
                error=error,
            )
        mocker.patch.object(settings, "ENV", Environment.production)
        mocker.patch("polar.email.tasks.email_sender.send", return_value=None)
        remove_suppression = mocker.patch(
            "polar.email.tasks.email_sender.remove_suppression"
        )

        await email_send(
            to_email_addr="customer@example.com",
            subject="Sign in to Polar",
            html_content="<p>123456</p>",
            from_name="Polar",
            from_email_addr="noreply@polar.sh",
            email_headers=None,
            reply_to_name=None,
            reply_to_email_addr=None,
            unsuppress=True,
        )

        assert remove_suppression.called is removes_suppression

    async def test_unsuppress_failure_still_sends(
        self,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        await create_email_log(
            save_fixture, created_at=utc_now(), status=EmailLogStatus.failed
        )
        mocker.patch.object(settings, "ENV", Environment.production)
        send = mocker.patch("polar.email.tasks.email_sender.send", return_value=None)
        mocker.patch(
            "polar.email.tasks.email_sender.remove_suppression",
            side_effect=RuntimeError("database down"),
        )

        await email_send(
            to_email_addr="customer@example.com",
            subject="Sign in to Polar",
            html_content="<p>123456</p>",
            from_name="Polar",
            from_email_addr="noreply@polar.sh",
            email_headers=None,
            reply_to_name=None,
            reply_to_email_addr=None,
            unsuppress=True,
        )

        send.assert_called_once()

    @pytest.mark.parametrize("environment", [Environment.sandbox, Environment.test])
    async def test_unsuppress_skipped_outside_production(
        self,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        environment: Environment,
    ) -> None:
        await create_email_log(
            save_fixture, created_at=utc_now(), status=EmailLogStatus.failed
        )
        mocker.patch.object(settings, "ENV", environment)
        mocker.patch("polar.email.tasks.email_sender.send", return_value=None)
        remove_suppression = mocker.patch(
            "polar.email.tasks.email_sender.remove_suppression"
        )

        await email_send(
            to_email_addr="customer@example.com",
            subject="Sign in to Polar",
            html_content="<p>123456</p>",
            from_name="Polar",
            from_email_addr="noreply@polar.sh",
            email_headers=None,
            reply_to_name=None,
            reply_to_email_addr=None,
            unsuppress=True,
        )

        remove_suppression.assert_not_called()


@pytest.mark.anyio
class TestEmailLogPrune:
    async def test_deletes_logs_past_retention_period(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch(
            "polar.email.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_maker(session),
        )
        retention = settings.EMAIL_LOG_RETENTION_PERIOD
        expired = await create_email_log(
            save_fixture, created_at=utc_now() - retention - timedelta(days=1)
        )
        retained = await create_email_log(
            save_fixture, created_at=utc_now() - retention + timedelta(days=1)
        )

        await email_log_prune()

        repository = EmailLogRepository.from_session(session)
        assert await repository.get_by_id(expired.id) is None
        assert await repository.get_by_id(retained.id) is not None
