from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger
from alembic_utils.replaceable_entity import register_entities
from sqlalchemy import Boolean, ForeignKey, Index, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.exceptions import PolarError
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from polar.benefit.strategies import BenefitProperties
    from polar.models import BenefitGrant, Organization


class TaxApplicationMustBeSpecified(PolarError):
    def __init__(self, type: "BenefitType") -> None:
        self.type = type
        message = "The tax application should be specified for this type."
        super().__init__(message)


class BenefitType(StrEnum):
    custom = "custom"
    discord = "discord"
    github_repository = "github_repository"
    downloadables = "downloadables"
    license_keys = "license_keys"
    meter_credit = "meter_credit"

    def get_display_name(self) -> str:
        return {
            BenefitType.custom: "Custom",
            BenefitType.discord: "Discord",
            BenefitType.github_repository: "GitHub Repository",
            BenefitType.downloadables: "Downloadables",
            BenefitType.license_keys: "License Keys",
            BenefitType.meter_credit: "Meter Credit",
        }[self]

    def is_tax_applicable(self) -> bool:
        try:
            _is_tax_applicable_map: dict[BenefitType, bool] = {
                BenefitType.custom: True,
                BenefitType.discord: True,
                BenefitType.github_repository: True,
                BenefitType.downloadables: True,
                BenefitType.license_keys: True,
                BenefitType.meter_credit: True,
            }
            return _is_tax_applicable_map[self]
        except KeyError as e:
            raise TaxApplicationMustBeSpecified(self) from e


class Benefit(MetadataMixin, RecordModel):
    __tablename__ = "benefits"
    __table_args__ = (
        Index(
            "ix_benefits_search_vector",
            "search_vector",
            postgresql_using="gin",
        ),
    )

    search_vector: Mapped[str] = mapped_column(TSVECTOR, nullable=True, deferred=True)

    type: Mapped[BenefitType] = mapped_column(
        StringEnum(BenefitType), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_tax_applicable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    selectable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deletable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def properties(cls) -> Mapped["BenefitProperties"]:
        return mapped_column("properties", JSONB, nullable=False, default=dict)

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def grants(cls) -> Mapped["list[BenefitGrant]"]:
        return relationship(
            "BenefitGrant", lazy="raise", back_populates="benefit", viewonly=True
        )


benefits_search_vector_update_function = PGFunction(
    schema="public",
    signature="benefits_search_vector_update()",
    definition="""
    RETURNS trigger AS $$
    BEGIN
        NEW.search_vector := to_tsvector('english', coalesce(NEW.type, '') || ' ' || coalesce(NEW.description, ''));
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """,
)

benefits_search_vector_trigger = PGTrigger(
    schema="public",
    signature="benefits_search_vector_trigger",
    on_entity="benefits",
    definition="""
    BEFORE INSERT OR UPDATE ON benefits
    FOR EACH ROW EXECUTE FUNCTION benefits_search_vector_update();
    """,
)

register_entities(
    (
        benefits_search_vector_update_function,
        benefits_search_vector_trigger,
    )
)
