"""Tests for the facet pipeline + categorisation lane (Slice 8)."""

from __future__ import annotations

from uuid import uuid4

import pytest

from polar.models.organization import Organization
from polar.models.organization_facet import FacetSource
from polar.models.user import User
from polar.organization_review_agent.facet_repository import (
    OrganizationFacetRepository,
)
from polar.organization_review_agent.lanes.categorisation import (
    CategorisationLane,
    _normalise,
)
from polar.organization_review_agent.lanes.base import LaneRunContext
from polar.organization_review_agent.schemas import SignalKind
from polar.organization_review_agent.service import (
    organization_review_agent_service,
)
from polar.postgres import AsyncSession


class TestNormalise:
    def test_slash_to_hierarchy(self) -> None:
        assert _normalise("Software / SaaS") == "software.saas"

    def test_dotted_passthrough(self) -> None:
        assert (
            _normalise("Software.SaaS.AI Text Generation")
            == "software.saas.ai_text_generation"
        )

    def test_empty(self) -> None:
        assert _normalise("  ") == ""


@pytest.mark.asyncio
class TestCategorisationLane:
    async def test_proposes_facets_from_details(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        organization.details = {
            "selling_categories": ["Software / SaaS", "Education"],
            "pricing_models": ["Subscription", "Usage-based"],
            "product_description": "A SaaS analytics tool.",
        }
        await session.flush()

        lane = CategorisationLane()
        ctx = LaneRunContext(
            organization=organization,
            session=session,
            review_context="submission",
        )
        assert await lane.is_enabled(ctx) is True
        result = await lane.run(ctx)

        proposed = result.facts.payload["proposed_facets"]
        pairs = {(p["namespace"], p["value"]) for p in proposed}
        assert ("product_category", "software.saas") in pairs
        assert ("product_category", "education") in pairs
        assert ("pricing_model", "subscription") in pairs
        assert ("pricing_model", "usage-based") in pairs
        # Has a product description -> no mismatch signal.
        assert result.signals == []

    async def test_mismatch_signal_when_no_product_description(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        organization.details = {
            "selling_categories": ["Consulting"],
            # no product_description
        }
        await session.flush()

        lane = CategorisationLane()
        ctx = LaneRunContext(
            organization=organization,
            session=session,
            review_context="submission",
        )
        result = await lane.run(ctx)
        assert any(
            s.kind == SignalKind.MERCHANT_DECLARATION_MISMATCH
            for s in result.signals
        )

    async def test_skips_when_no_details(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        organization.details = {}
        await session.flush()
        lane = CategorisationLane()
        ctx = LaneRunContext(
            organization=organization,
            session=session,
            review_context="submission",
        )
        assert await lane.is_enabled(ctx) is False


@pytest.mark.asyncio
class TestFacetBackfill:
    async def test_backfill_creates_merchant_declared_rows(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        organization.details = {
            "selling_categories": ["Software / SaaS"],
            "pricing_models": ["Subscription"],
        }
        await session.flush()

        facets = (
            await organization_review_agent_service.backfill_facets_from_details(
                session, organization
            )
        )
        assert len(facets) == 2
        assert all(f.source == FacetSource.MERCHANT_DECLARED for f in facets)
        ns = {(f.namespace, f.value) for f in facets}
        assert ("product_category", "software.saas") in ns
        assert ("pricing_model", "subscription") in ns

    async def test_backfill_is_idempotent(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        organization.details = {"selling_categories": ["Software / SaaS"]}
        await session.flush()

        first = await organization_review_agent_service.backfill_facets_from_details(
            session, organization
        )
        second = await organization_review_agent_service.backfill_facets_from_details(
            session, organization
        )
        assert {f.id for f in first} == {f.id for f in second}

        all_facets = await organization_review_agent_service.list_facets(
            session, organization.id
        )
        assert len(all_facets) == 1

    async def test_confirm_promotes_to_reviewer_confirmed(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        repo = OrganizationFacetRepository.from_session(session)
        facet = await repo.upsert(
            organization_id=organization.id,
            namespace="product_category",
            value="software.saas.ai_text_generation",
            source=FacetSource.AI_PROPOSED,
            confidence=0.82,
        )
        await organization_review_agent_service.confirm_facet(
            session, facet, reviewer_user_id=user.id
        )
        assert facet.source == FacetSource.REVIEWER_CONFIRMED
        assert facet.reviewer_user_id == user.id
        assert facet.confirmed_at is not None
        assert facet.confidence == 1.0

    async def test_upsert_does_not_downgrade_confirmed(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        """A later merchant_declared/ai_proposed upsert must not
        clobber a reviewer-confirmed facet."""

        repo = OrganizationFacetRepository.from_session(session)
        facet = await repo.upsert(
            organization_id=organization.id,
            namespace="product_category",
            value="software.saas",
            source=FacetSource.AI_PROPOSED,
        )
        await organization_review_agent_service.confirm_facet(
            session, facet, reviewer_user_id=user.id
        )
        # Re-upsert the same value (e.g. backfill runs later).
        again = await repo.upsert(
            organization_id=organization.id,
            namespace="product_category",
            value="software.saas",
            source=FacetSource.MERCHANT_DECLARED,
        )
        assert again.id == facet.id
        assert again.source == FacetSource.REVIEWER_CONFIRMED
