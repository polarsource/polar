"""Tests for the shared backoffice support-case list query — the polymorphic
join that resolves an organization for both appeal and dispute cases."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from polar.backoffice.support_cases.queries import (
    Row,
    cases_statement,
    open_case_organization_ids,
)
from polar.models import Customer, Organization, Product, User
from polar.models.dispute import DisputeStatus
from polar.models.support_case import (
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseParticipant,
    SupportCaseParticipantKind,
    SupportCaseType,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_appeal_case,
    create_dispute_case,
)


async def _rows(session: AsyncSession, **kwargs: object) -> list[Row]:
    result = await session.execute(cases_statement(**kwargs))  # type: ignore[arg-type]
    return list(result.all())  # type: ignore[arg-type]


@pytest.mark.asyncio
class TestCasesStatement:
    async def test_returns_both_case_types_for_organization(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        appeal = await create_appeal_case(save_fixture, organization)
        dispute = await create_dispute_case(
            save_fixture, organization, customer, product
        )

        rows = await _rows(session, organization_id=organization.id)

        by_id = {row[0].id: row for row in rows}
        assert appeal.id in by_id
        assert dispute.id in by_id
        # Each row resolves to the owning organization, regardless of type.
        for case, org, is_open, *_rest in rows:
            assert org.id == organization.id
            assert is_open is True
        assert by_id[appeal.id][0].type == SupportCaseType.review_appeal
        assert by_id[dispute.id][0].type == SupportCaseType.dispute
        assert by_id[dispute.id][6] == DisputeStatus.needs_response
        assert by_id[appeal.id][6] is None

    async def test_type_filter_narrows_to_disputes(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        await create_appeal_case(save_fixture, organization)
        dispute = await create_dispute_case(
            save_fixture, organization, customer, product
        )

        rows = await _rows(
            session,
            organization_id=organization.id,
            case_type=SupportCaseType.dispute.value,
        )

        assert [row[0].id for row in rows] == [dispute.id]

    async def test_closed_case_excluded_by_open_status(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        dispute = await create_dispute_case(
            save_fixture, organization, customer, product
        )
        await save_fixture(
            SupportCaseMessage(
                case=dispute,
                type=SupportCaseMessageType.closed,
                author_kind=SupportCaseMessageAuthorKind.system,
                audience=[],
            )
        )

        open_rows = await _rows(session, organization_id=organization.id, status="open")
        closed_rows = await _rows(
            session, organization_id=organization.id, status="closed"
        )

        assert dispute.id not in [row[0].id for row in open_rows]
        assert dispute.id in [row[0].id for row in closed_rows]

    async def test_unread_per_viewer(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
        user: User,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)
        base = datetime.now(UTC)
        await save_fixture(
            SupportCaseMessage(
                case=case,
                type=SupportCaseMessageType.chat,
                author_kind=SupportCaseMessageAuthorKind.merchant,
                body="Here is my evidence.",
                audience=[SupportCaseAudience.merchant],
                created_at=base + timedelta(minutes=1),
            )
        )

        rows = await _rows(
            session, organization_id=organization.id, viewer_user_id=user.id
        )
        assert rows[0][5] is True  # unread

        await save_fixture(
            SupportCaseParticipant(
                case=case,
                kind=SupportCaseParticipantKind.platform,
                platform_user=user,
                last_read_at=base + timedelta(minutes=2),
            )
        )
        rows = await _rows(
            session, organization_id=organization.id, viewer_user_id=user.id
        )
        assert rows[0][5] is False

        rows = await _rows(
            session, organization_id=organization.id, viewer_user_id=uuid4()
        )
        assert rows[0][5] is True

        await save_fixture(
            SupportCaseMessage(
                case=case,
                type=SupportCaseMessageType.chat,
                author_kind=SupportCaseMessageAuthorKind.merchant,
                body="Any update?",
                audience=[SupportCaseAudience.merchant],
                created_at=base + timedelta(minutes=3),
            )
        )
        rows = await _rows(
            session, organization_id=organization.id, viewer_user_id=user.id
        )
        assert rows[0][5] is True


@pytest.mark.asyncio
class TestCasesStatementEvidenceDueSort:
    async def test_orders_by_soonest_deadline_dropping_nothing(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        now = datetime.now(UTC)
        appeal = await create_appeal_case(save_fixture, organization)
        later = await create_dispute_case(
            save_fixture,
            organization,
            customer,
            product,
            evidence_due_by=now + timedelta(days=7),
            payment_processor_id="STRIPE_DISPUTE_LATER",
        )
        soon = await create_dispute_case(
            save_fixture,
            organization,
            customer,
            product,
            evidence_due_by=now + timedelta(days=1),
            payment_processor_id="STRIPE_DISPUTE_SOON",
        )
        undated = await create_dispute_case(
            save_fixture,
            organization,
            customer,
            product,
            payment_processor_id="STRIPE_DISPUTE_NO_DEADLINE",
        )

        rows = await _rows(
            session, organization_id=organization.id, sort="evidence_due"
        )

        ids = [row[0].id for row in rows]
        assert ids[:2] == [soon.id, later.id]
        # Rows without a deadline sink to the bottom instead of disappearing.
        assert set(ids[2:]) == {undated.id, appeal.id}

    async def test_resolved_past_due_dispute_sorts_first_and_exposes_fields(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        now = datetime.now(UTC)
        lost = await create_dispute_case(
            save_fixture,
            organization,
            customer,
            product,
            dispute_status=DisputeStatus.lost,
            evidence_due_by=now - timedelta(days=20),
            past_due=True,
            payment_processor_id="STRIPE_DISPUTE_LOST",
        )
        upcoming = await create_dispute_case(
            save_fixture,
            organization,
            customer,
            product,
            evidence_due_by=now + timedelta(days=3),
            payment_processor_id="STRIPE_DISPUTE_UPCOMING",
        )

        rows = await _rows(
            session, organization_id=organization.id, sort="evidence_due"
        )

        assert [row[0].id for row in rows] == [lost.id, upcoming.id]
        _case, _org, *_rest, evidence_due_by, evidence_past_due = rows[0]
        assert evidence_due_by is not None
        assert evidence_past_due is True


@pytest.mark.asyncio
class TestOpenCaseOrganizationIds:
    async def test_includes_org_with_open_dispute_case(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        await create_dispute_case(save_fixture, organization, customer, product)

        result = await session.execute(
            open_case_organization_ids(organization_ids=[organization.id])
        )

        assert organization.id in set(result.scalars().all())

    async def test_awaiting_reply_requires_merchant_last_message(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        case = await create_dispute_case(save_fixture, organization, customer, product)

        # Opened only (lifecycle, no audience): not awaiting a platform reply.
        result = await session.execute(
            open_case_organization_ids(
                organization_ids=[organization.id], awaiting_reply=True
            )
        )
        assert organization.id not in set(result.scalars().all())

        # A merchant-visible message from the merchant flips it to awaiting.
        await save_fixture(
            SupportCaseMessage(
                case=case,
                type=SupportCaseMessageType.chat,
                author_kind=SupportCaseMessageAuthorKind.merchant,
                body="Here is my evidence.",
                audience=[SupportCaseAudience.merchant],
            )
        )
        result = await session.execute(
            open_case_organization_ids(
                organization_ids=[organization.id], awaiting_reply=True
            )
        )
        assert organization.id in set(result.scalars().all())
