"""Tests for support_case.tasks — merchant reply email fan-out."""

import contextlib
from collections.abc import AsyncIterator, Sequence

import pytest
from pytest_mock import MockerFixture

from polar.models import (
    Customer,
    Organization,
    Product,
    UserOrganization,
)
from polar.models.support_case import (
    SupportCase,
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
)
from polar.postgres import AsyncSession
from polar.support_case.tasks import notify_organization_of_new_message
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_appeal_case,
    create_dispute_case,
)

# Unwrap to bypass the actor decorator (which needs the Dramatiq broker).
_notify = notify_organization_of_new_message.__wrapped__  # type: ignore[attr-defined]


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
        kwargs = enqueue.call_args.kwargs
        assert kwargs["to_email_addr"] == user_organization.user.email
        # Notification-only: from noreply, no reply-to (replies shouldn't open a
        # disconnected Plain thread).
        assert kwargs["from_email_addr"].startswith("noreply@")
        assert kwargs["reply_to_email_addr"] is None

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
        _, kwargs = enqueue.call_args
        assert kwargs["to_email_addr"] == user_organization.user.email

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
