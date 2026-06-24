import pytest
from sqlalchemy.orm import joinedload

from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationReview
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestReviewRelationship:
    async def test_resolves_to_live_review_when_soft_deleted_exists(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """A soft-deleted prior review (e.g. a reset grandfathered one) must not
        shadow the live one — `organization.review` is the live row only."""
        await save_fixture(
            OrganizationReview(
                organization_id=organization.id,
                verdict=OrganizationReview.Verdict.FAIL,
                risk_score=90.0,
                violated_sections=[],
                reason="superseded",
                model_used="test",
                deleted_at=utc_now(),
            )
        )
        live = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=90.0,
            violated_sections=[],
            reason="live",
            model_used="test",
        )
        await save_fixture(live)

        session.expunge_all()
        repository = OrganizationRepository.from_session(session)
        loaded = await repository.get_by_id(
            organization.id, options=(joinedload(Organization.review),)
        )

        assert loaded is not None
        assert loaded.review is not None
        assert loaded.review.id == live.id
