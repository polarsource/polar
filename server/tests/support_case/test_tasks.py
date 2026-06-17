"""Tests for support_case.tasks — merchant reply email fan-out."""

import contextlib
from collections.abc import AsyncIterator, Sequence

import pytest
from pytest_mock import MockerFixture

from polar.models import (
    Customer,
    Organization,
    OrganizationReview,
    Product,
    UserOrganization,
)
from polar.models.support_case import (
    DisputeSupportCase,
    ReviewAppealSupportCase,
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
    create_dispute,
    create_order,
    create_payment,
)

# Unwrap to bypass the actor decorator (which needs the Dramatiq broker).
_notify = notify_organization_of_new_message.__wrapped__  # type: ignore[attr-defined]


@contextlib.asynccontextmanager
async def _session_maker(session: AsyncSession) -> AsyncIterator[AsyncSession]:
    yield session


async def _appeal_case(
    save_fixture: SaveFixture, organization: Organization
) -> ReviewAppealSupportCase:
    review = OrganizationReview(
        organization_id=organization.id,
        verdict=OrganizationReview.Verdict.FAIL,
        risk_score=90.0,
        violated_sections=[],
        reason="denied",
        model_used="test",
    )
    await save_fixture(review)
    case = ReviewAppealSupportCase(organization_review_id=review.id)
    await save_fixture(case)
    return case


async def _dispute_case(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    product: Product,
) -> DisputeSupportCase:
    order = await create_order(save_fixture, customer=customer, product=product)
    payment = await create_payment(save_fixture, organization, order=order)
    dispute = await create_dispute(save_fixture, order, payment)
    case = DisputeSupportCase(dispute_id=dispute.id)
    await save_fixture(case)
    return case


async def _message(
    save_fixture: SaveFixture,
    case: SupportCase,
    *,
    author_kind: SupportCaseMessageAuthorKind,
    audience: Sequence[SupportCaseAudience],
    body: str = "A staff reply.",
) -> SupportCaseMessage:
    message = SupportCaseMessage(
        case_id=case.id,
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
        case = await _appeal_case(save_fixture, organization)
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

    async def test_suppresses_dispute_case_until_merchant_ui(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user_organization: UserOrganization,
    ) -> None:
        # No merchant-facing dispute thread yet, so its emails are gated off.
        case = await _dispute_case(save_fixture, organization, customer, product)
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

        enqueue.assert_not_called()

    async def test_skips_non_staff_message(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        case = await _appeal_case(save_fixture, organization)
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
