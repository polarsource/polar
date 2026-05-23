"""Multi-value / hierarchical facets per organization.

Slice 8: replaces the free-form ``OrganizationDetails.selling_categories``
and ``pricing_models`` JSONB arrays with a normalised table that
supports multi-value, hierarchical, and AI-proposed values.

Routing predicates (Slice 3 part 2) can pivot on these facets via
``facet_eq``, ``facet_has``, ``facet_prefix``.
"""

from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

if TYPE_CHECKING:
    from polar.models.organization import Organization
    from polar.models.user import User


class FacetSource(StrEnum):
    """Where the facet value came from."""

    MERCHANT_DECLARED = "merchant_declared"
    AI_PROPOSED = "ai_proposed"
    REVIEWER_CONFIRMED = "reviewer_confirmed"
    REVIEWER_MANUAL = "reviewer_manual"
    STRIPE_SUPPLIED = "stripe_supplied"
    DERIVED = "derived"


class OrganizationFacet(RecordModel):
    """One row per (organization, namespace, value) triple."""

    __tablename__ = "organization_facets"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "namespace",
            "value",
            name="organization_facets_org_namespace_value_key",
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    namespace: Mapped[str] = mapped_column(
        String(48),
        nullable=False,
        index=True,
        doc=(
            "business_model / pricing_model / customer_type / "
            "product_category / risk_class. Hierarchical namespaces "
            "store values as dotted paths "
            "(``software.saas.ai_text_generation``)."
        ),
    )

    value: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc=(
            "The facet value. For hierarchical namespaces, the leaf "
            "or any parent path. For multi-value namespaces, one row "
            "per selected value."
        ),
    )

    source: Mapped[FacetSource] = mapped_column(
        StringEnum(FacetSource, length=32),
        nullable=False,
        default=FacetSource.MERCHANT_DECLARED,
        index=True,
    )

    confidence: Mapped[float | None] = mapped_column(
        nullable=True,
        default=None,
        doc=(
            "0-1 confidence score for AI-proposed values. None for "
            "merchant-declared / reviewer-confirmed (those are 1.0 by "
            "construction)."
        ),
    )

    reviewer_user_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="set null"),
        nullable=True,
        default=None,
        doc=(
            "User who confirmed the facet (for REVIEWER_CONFIRMED) "
            "or set it manually (for REVIEWER_MANUAL). NULL for "
            "merchant/AI/stripe/derived sources."
        ),
    )

    confirmed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship(
            "Organization",
            lazy="raise",
            foreign_keys=[cls.organization_id],
        )

    @declared_attr
    def reviewed_by(cls) -> Mapped["User | None"]:
        return relationship(
            "User",
            lazy="raise",
            foreign_keys=[cls.reviewer_user_id],
        )

    def __repr__(self) -> str:
        return (
            f"OrganizationFacet(id={self.id}, "
            f"organization_id={self.organization_id}, "
            f"{self.namespace}={self.value} [{self.source}])"
        )
