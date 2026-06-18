import contextlib
import uuid
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from plain_client import (
    ComponentTextInput,
    CustomerByEmailCustomerByEmail,
    UpsertCustomerUpsertCustomer,
)
from pytest_mock import MockerFixture

from polar.integrations.plain.service import (
    CUSTOMER_CARD_TTL_SECONDS,
    PlainCustomerError,
    PlainService,
)
from polar.models import Feedback, Organization, User
from polar.models.feedback import FeedbackType
from polar.models.organization import OrganizationStatus


@contextlib.asynccontextmanager
async def _mock_client(plain_mock: MagicMock) -> Any:
    yield plain_mock


_DATETIME = {
    "__typename": "DateTime",
    "iso8601": "2025-01-01T00:00:00Z",
    "unixTimestamp": "1735689600",
}


def _customer_dict(
    *, plain_customer_id: str = "c_123", external_id: str | None
) -> dict[str, Any]:
    return {
        "__typename": "Customer",
        "id": plain_customer_id,
        "fullName": "user@example.com",
        "shortName": None,
        "externalId": external_id,
        "email": {
            "__typename": "Email",
            "email": "user@example.com",
            "isVerified": False,
            "verifiedAt": None,
        },
        "company": None,
        "updatedAt": _DATETIME,
        "createdAt": _DATETIME,
        "createdBy": {"__typename": "SystemActor", "systemId": "system"},
        "markedAsSpamAt": None,
    }


def _customer_by_email_payload(
    *, plain_customer_id: str = "c_123", external_id: str | None
) -> CustomerByEmailCustomerByEmail:
    return CustomerByEmailCustomerByEmail.model_validate(
        _customer_dict(plain_customer_id=plain_customer_id, external_id=external_id)
    )


def _upsert_customer_payload(
    *, error: dict[str, Any] | None = None, with_customer: bool = True
) -> UpsertCustomerUpsertCustomer:
    customer = _customer_dict(external_id=str(uuid.uuid4())) if with_customer else None
    return UpsertCustomerUpsertCustomer.model_validate(
        {"result": "CREATED", "customer": customer, "error": error}
    )


@pytest.fixture
def plain_service(mocker: MockerFixture) -> PlainService:
    mocker.patch.object(PlainService, "enabled", True)
    return PlainService()


@pytest.fixture
def plain_client(mocker: MockerFixture) -> MagicMock:
    client = MagicMock()
    client.customer_by_email = AsyncMock()
    client.upsert_customer = AsyncMock()
    mocker.patch(
        "polar.integrations.plain.service.PlainService._get_plain_client",
        return_value=_mock_client(client),
    )
    return client


_FEEDBACK_ID = uuid.UUID("9627a2e3-b7e3-4c6a-9f00-13ed415849fd")


def _feedback(*, message: str, type: FeedbackType = FeedbackType.question) -> Feedback:
    user = User(email="user@example.com", email_verified=False)
    return Feedback(id=_FEEDBACK_ID, type=type, message=message, user=user)


def _ok_result() -> MagicMock:
    result = MagicMock()
    result.error = None
    return result


@pytest.fixture
def feedback_thread_client(mocker: MockerFixture, plain_client: MagicMock) -> MagicMock:
    # Don't hit the LLM gateway from thread-creation tests.
    mocker.patch(
        "polar.integrations.plain.service._generate_thread_subject",
        AsyncMock(return_value="Generated subject"),
    )
    plain_client.customer_by_email.return_value = _customer_by_email_payload(
        external_id=str(uuid.uuid4())
    )
    thread_result = _ok_result()
    thread_result.thread.id = "t_123"
    plain_client.create_thread = AsyncMock(return_value=thread_result)
    plain_client.create_note = AsyncMock(return_value=_ok_result())
    plain_client.reply_to_thread = AsyncMock(return_value=_ok_result())
    return plain_client


@pytest.mark.asyncio
class TestCreateFeedbackThread:
    async def test_impersonates_with_note_and_notes_transcript(
        self,
        plain_service: PlainService,
        feedback_thread_client: MagicMock,
    ) -> None:
        transcript = "**User**\n\nHow do I do X?\n\n**Assistant**\n\nTry Y."
        feedback = _feedback(
            message=f"I still need help\n\n---\n\n## Transcript\n\n{transcript}"
        )

        url = await plain_service.create_feedback_thread(feedback)

        assert url == (
            "https://app.plain.com/workspace/w_01JE9TRRX9KT61D8P2CH77XDQM/thread/t_123"
        )
        thread_input = feedback_thread_client.create_thread.call_args.args[0]
        assert thread_input.title == "Generated subject"
        feedback_thread_client.reply_to_thread.assert_awaited_once()
        reply_input = feedback_thread_client.reply_to_thread.call_args.args[0]
        assert reply_input.thread_id == "t_123"
        assert reply_input.text_content == "I still need help"
        assert (
            reply_input.impersonation.as_customer.customer_identifier.customer_id
            == "c_123"
        )
        note_input = feedback_thread_client.create_note.call_args.args[0]
        assert note_input.text.startswith(transcript)
        # The note links back to the backoffice feedback record.
        assert f"/feedbacks/{_FEEDBACK_ID}" in note_input.markdown
        assert "[View in backoffice]" in note_input.markdown

    async def test_impersonates_with_original_question_when_no_note(
        self,
        plain_service: PlainService,
        feedback_thread_client: MagicMock,
    ) -> None:
        transcript = "**User**\n\nHow do I do X?\n\n**Assistant**\n\nTry Y."
        feedback = _feedback(message=f"## Transcript\n\n{transcript}")

        await plain_service.create_feedback_thread(feedback)

        reply_input = feedback_thread_client.reply_to_thread.call_args.args[0]
        assert reply_input.text_content == "How do I do X?"
        note_input = feedback_thread_client.create_note.call_args.args[0]
        assert note_input.text.startswith(transcript)
        assert f"/feedbacks/{_FEEDBACK_ID}" in note_input.markdown

    async def test_direct_submission_keeps_message_as_note(
        self,
        plain_service: PlainService,
        feedback_thread_client: MagicMock,
    ) -> None:
        feedback = _feedback(message="The dashboard is broken.", type=FeedbackType.bug)

        await plain_service.create_feedback_thread(feedback)

        feedback_thread_client.reply_to_thread.assert_not_awaited()
        note_input = feedback_thread_client.create_note.call_args.args[0]
        assert note_input.text.startswith("The dashboard is broken.")
        assert f"/feedbacks/{_FEEDBACK_ID}" in note_input.markdown


@pytest.mark.asyncio
class TestGenerateThreadSubject:
    async def test_returns_model_output(self, mocker: MockerFixture) -> None:
        from polar.integrations.plain.service import _generate_thread_subject

        get_model = mocker.patch(
            "polar.integrations.plain.service.settings.get_pydantic_gateway_model",
            return_value=(MagicMock(), "openai", "gpt-5.5"),
        )
        agent = MagicMock()
        agent.run = AsyncMock(
            return_value=MagicMock(output='  "Custom domain setup"  ')
        )
        agent_cls = mocker.patch(
            "polar.integrations.plain.service.Agent", return_value=agent
        )

        subject = await _generate_thread_subject(
            "How do I set up a domain?", "Fallback"
        )

        assert subject == "Custom domain setup"
        # Uses the configured default model (no hardcoded provider).
        get_model.assert_called_once_with()
        # gpt-5.5 rejects a non-default temperature.
        assert agent_cls.call_args.kwargs["model_settings"] == {}

    async def test_falls_back_on_error(self, mocker: MockerFixture) -> None:
        from polar.integrations.plain.service import _generate_thread_subject

        mocker.patch(
            "polar.integrations.plain.service.settings.get_pydantic_gateway_model",
            side_effect=RuntimeError("gateway down"),
        )

        subject = await _generate_thread_subject("Anything", "Re: your recent question")

        assert subject == "Re: your recent question"

    async def test_falls_back_on_empty_content(self) -> None:
        from polar.integrations.plain.service import _generate_thread_subject

        subject = await _generate_thread_subject("   ", "Re: your recent question")

        assert subject == "Re: your recent question"


@pytest.mark.asyncio
class TestUpsertCustomer:
    async def test_noop_when_existing_customer_has_matching_external_id(
        self,
        plain_service: PlainService,
        plain_client: MagicMock,
    ) -> None:
        external_id = str(uuid.uuid4())
        plain_client.customer_by_email.return_value = _customer_by_email_payload(
            external_id=external_id
        )

        await plain_service.upsert_customer(
            external_id=external_id, email="user@example.com"
        )

        plain_client.upsert_customer.assert_not_called()

    async def test_upserts_by_email_when_existing_customer_has_different_external_id(
        self,
        plain_service: PlainService,
        plain_client: MagicMock,
    ) -> None:
        external_id = str(uuid.uuid4())
        plain_client.customer_by_email.return_value = _customer_by_email_payload(
            external_id="legacy-id"
        )
        plain_client.upsert_customer.return_value = _upsert_customer_payload()

        await plain_service.upsert_customer(
            external_id=external_id, email="user@example.com"
        )

        plain_client.upsert_customer.assert_awaited_once()
        upsert_input = plain_client.upsert_customer.call_args.args[0]
        assert upsert_input.identifier.email_address == "user@example.com"
        assert upsert_input.identifier.external_id is None
        assert upsert_input.on_update.external_id.value == external_id

    async def test_upserts_by_email_when_existing_customer_has_no_external_id(
        self,
        plain_service: PlainService,
        plain_client: MagicMock,
    ) -> None:
        external_id = str(uuid.uuid4())
        plain_client.customer_by_email.return_value = _customer_by_email_payload(
            external_id=None
        )
        plain_client.upsert_customer.return_value = _upsert_customer_payload()

        await plain_service.upsert_customer(
            external_id=external_id, email="user@example.com"
        )

        upsert_input = plain_client.upsert_customer.call_args.args[0]
        assert upsert_input.identifier.email_address == "user@example.com"
        assert upsert_input.on_update.external_id.value == external_id

    async def test_creates_with_external_id_when_no_existing_customer(
        self,
        plain_service: PlainService,
        plain_client: MagicMock,
    ) -> None:
        external_id = str(uuid.uuid4())
        plain_client.customer_by_email.return_value = None
        plain_client.upsert_customer.return_value = _upsert_customer_payload()

        await plain_service.upsert_customer(
            external_id=external_id, email="user@example.com"
        )

        upsert_input = plain_client.upsert_customer.call_args.args[0]
        assert upsert_input.identifier.external_id == external_id
        assert upsert_input.identifier.email_address is None

    async def test_raises_when_plain_returns_error(
        self,
        plain_service: PlainService,
        plain_client: MagicMock,
    ) -> None:
        external_id = str(uuid.uuid4())
        plain_client.customer_by_email.return_value = None
        plain_client.upsert_customer.return_value = _upsert_customer_payload(
            error={
                "__typename": "MutationError",
                "message": "boom",
                "type": "VALIDATION",
                "code": "duplicate_email",
                "fields": [],
            },
            with_customer=False,
        )

        with pytest.raises(PlainCustomerError):
            await plain_service.upsert_customer(
                external_id=external_id, email="user@example.com"
            )


def _organization(status: OrganizationStatus) -> Organization:
    return Organization(
        id=uuid.uuid4(),
        name="Acme",
        slug="acme",
        email=None,
        status=status,
        created_at=datetime(2025, 1, 1, tzinfo=UTC),
    )


def _status_value(organization: Organization) -> ComponentTextInput | None:
    container = PlainService()._get_organization_component_container(organization)
    for content in container.container_content:
        row = content.component_row
        if row is None:
            continue
        main = row.row_main_content
        if (
            main
            and main[0].component_text is not None
            and main[0].component_text.text == "Status"
        ):
            return main[1].component_text
    return None


class TestOrganizationCard:
    def test_ttl_is_one_hour(self) -> None:
        assert CUSTOMER_CARD_TTL_SECONDS == 60 * 60

    @pytest.mark.parametrize("status", list(OrganizationStatus))
    def test_renders_status_display_name(self, status: OrganizationStatus) -> None:
        value = _status_value(_organization(status))

        assert value is not None
        assert value.text == status.get_display_name()
