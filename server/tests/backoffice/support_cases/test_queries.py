"""Tests for the shared backoffice support-case list query — the polymorphic
join that resolves an organization for both appeal and dispute cases."""

import pytest

from polar.backoffice.support_cases.queries import (
    Row,
    cases_statement,
    open_case_organization_ids,
)
from polar.models import Customer, Organization, Product
from polar.models.support_case import (
    SupportCaseAudience,
    SupportCaseMessage,
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
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
        for case, org, is_open, _assignee, _awaiting in rows:
            assert org.id == organization.id
            assert is_open is True
        assert by_id[appeal.id][0].type == SupportCaseType.review_appeal
        assert by_id[dispute.id][0].type == SupportCaseType.dispute

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
