"""Repository for ``organization_facets`` (Slice 8).

Multi-value / hierarchical facets per organization. Two write paths:

* Backfill / lane-proposal: idempotent upsert keyed on
  ``(organization_id, namespace, value)`` so re-running the backfill
  or re-investigating an org never duplicates rows.
* Reviewer confirm: flip an ``ai_proposed`` row to
  ``reviewer_confirmed`` (or insert a ``reviewer_manual`` one).

Routing predicates (Slice 3 part 2) read these via ``facet_eq`` /
``facet_has`` / ``facet_prefix``.
"""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select

from polar.kit.repository.base import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models.organization_facet import FacetSource, OrganizationFacet


class OrganizationFacetRepository(
    RepositorySoftDeletionIDMixin[OrganizationFacet, UUID],
    RepositorySoftDeletionMixin[OrganizationFacet],
    RepositoryBase[OrganizationFacet],
):
    model = OrganizationFacet

    async def list_for_organization(
        self,
        organization_id: UUID,
        *,
        namespace: str | None = None,
    ) -> Sequence[OrganizationFacet]:
        statement = (
            self.get_base_statement()
            .where(OrganizationFacet.organization_id == organization_id)
            .order_by(OrganizationFacet.namespace, OrganizationFacet.value)
        )
        if namespace is not None:
            statement = statement.where(
                OrganizationFacet.namespace == namespace
            )
        return await self.get_all(statement)

    async def get_facet(
        self,
        organization_id: UUID,
        namespace: str,
        value: str,
    ) -> OrganizationFacet | None:
        statement = self.get_base_statement().where(
            OrganizationFacet.organization_id == organization_id,
            OrganizationFacet.namespace == namespace,
            OrganizationFacet.value == value,
        )
        return await self.get_one_or_none(statement)

    async def upsert(
        self,
        *,
        organization_id: UUID,
        namespace: str,
        value: str,
        source: FacetSource,
        confidence: float | None = None,
    ) -> OrganizationFacet:
        """Insert a facet, or return the existing one unchanged.

        Idempotent on ``(organization_id, namespace, value)``. Does
        NOT downgrade an existing source — a value already confirmed
        by a reviewer stays confirmed even if a later AI pass proposes
        it again.
        """

        existing = await self.get_facet(organization_id, namespace, value)
        if existing is not None:
            return existing
        facet = OrganizationFacet(
            organization_id=organization_id,
            namespace=namespace,
            value=value,
            source=source,
            confidence=confidence,
        )
        self.session.add(facet)
        await self.session.flush()
        return facet

    async def confirm(
        self,
        facet: OrganizationFacet,
        *,
        reviewer_user_id: UUID,
    ) -> None:
        """Mark an AI-proposed facet as reviewer-confirmed."""

        facet.source = FacetSource.REVIEWER_CONFIRMED
        facet.reviewer_user_id = reviewer_user_id
        facet.confirmed_at = utc_now()
        facet.confidence = 1.0
        await self.session.flush()


__all__ = ["OrganizationFacetRepository"]
