"""Loading a polymorphic support case through the base-class repository must
populate the concrete subclass's own columns inline. Otherwise reading them
emits a second, lazy query — which fails under async as a greenlet IO error.
"""

import pytest

from polar.models import Customer, Organization, OrganizationReview, Product
from polar.models.support_case import (
    DisputeSupportCase,
    ReviewAppealSupportCase,
)
from polar.postgres import AsyncSession
from polar.support_case.repository import SupportCaseRepository
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_dispute,
    create_order,
    create_payment,
)


async def _dispute_case(
    save_fixture: SaveFixture,
    organization: Organization,
    customer: Customer,
    product: Product,
) -> DisputeSupportCase:
    order = await create_order(save_fixture, customer=customer, product=product)
    payment = await create_payment(save_fixture, organization, order=order)
    dispute = await create_dispute(save_fixture, order, payment)
    case = DisputeSupportCase(dispute=dispute, organization=organization)
    await save_fixture(case)
    return case


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
    case = ReviewAppealSupportCase(
        organization_review=review, organization=organization
    )
    await save_fixture(case)
    return case


@pytest.mark.asyncio
class TestGetById:
    async def test_loads_dispute_subclass_column(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        case = await _dispute_case(save_fixture, organization, customer, product)
        dispute_id = case.dispute_id
        session.expunge_all()

        loaded = await SupportCaseRepository.from_session(session).get_by_id(case.id)

        assert isinstance(loaded, DisputeSupportCase)
        assert loaded.dispute_id == dispute_id

    async def test_loads_appeal_subclass_column(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        case = await _appeal_case(save_fixture, organization)
        organization_review_id = case.organization_review_id
        session.expunge_all()

        loaded = await SupportCaseRepository.from_session(session).get_by_id(case.id)

        assert isinstance(loaded, ReviewAppealSupportCase)
        assert loaded.organization_review_id == organization_review_id
