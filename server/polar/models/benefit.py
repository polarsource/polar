from enum import StrEnum
from typing import TYPE_CHECKING, Literal, TypedDict
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.exceptions import PolarError
from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import BenefitGrant, Organization


class TaxApplicationMustBeSpecified(PolarError):
    def __init__(self, type: "BenefitType") -> None:
        self.type = type
        message = "The tax application should be specified for this type."
        super().__init__(message)


class BenefitType(StrEnum):
    custom = "custom"
    articles = "articles"
    ads = "ads"
    discord = "discord"
    github_repository = "github_repository"
    downloadables = "downloadables"
    license_keys = "license_keys"

    def is_tax_applicable(self) -> bool:
        try:
            _is_tax_applicable_map: dict[BenefitType, bool] = {
                BenefitType.ads: True,
                BenefitType.discord: True,
                BenefitType.github_repository: True,
                BenefitType.downloadables: True,
                BenefitType.license_keys: True,
            }
            return _is_tax_applicable_map[self]
        except KeyError as e:
            raise TaxApplicationMustBeSpecified(self) from e


class BenefitProperties(TypedDict):
    """Configurable properties for this benefit."""


class BenefitCustomProperties(BenefitProperties):
    note: str | None


class BenefitDiscordProperties(BenefitProperties):
    guild_id: str
    role_id: str


class BenefitArticlesProperties(BenefitProperties):
    paid_articles: bool


class BenefitAdsProperties(BenefitProperties):
    image_height: int
    image_width: int


class BenefitGitHubRepositoryProperties(BenefitProperties):
    # repository_id was set previously (before 2024-13-15), for benefits using the "main"
    # Polar GitHub App for granting benefits. Benefits created after this date are using
    # the "Polar Repository Benefit" GitHub App, and only uses the repository_owner
    # and repository_name fields.
    repository_id: UUID | None
    repository_owner: str
    repository_name: str
    permission: Literal["pull", "triage", "push", "maintain", "admin"]


class BenefitDownloadablesProperties(BenefitProperties):
    archived: dict[UUID, bool]
    files: list[UUID]


class BenefitLicenseKeyExpiration(TypedDict):
    ttl: int
    timeframe: Literal["year", "month", "day"]


class BenefitLicenseKeysProperties(BenefitProperties):
    prefix: str | None
    expires: BenefitLicenseKeyExpiration | None
    limit_activations: int | None
    limit_usage: int | None


class Benefit(RecordModel):
    __tablename__ = "benefits"

    type: Mapped[BenefitType] = mapped_column(String, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_tax_applicable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    selectable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deletable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    properties: Mapped[BenefitProperties] = mapped_column(
        "properties", JSONB, nullable=False, default=dict
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="cascade"), nullable=False
    )
    organization: Mapped["Organization"] = relationship("Organization", lazy="raise")

    @declared_attr
    def grants(cls) -> Mapped["list[BenefitGrant]"]:
        return relationship(
            "BenefitGrant", lazy="raise", back_populates="benefit", viewonly=True
        )

    __mapper_args__ = {
        "polymorphic_on": "type",
    }


class BenefitCustom(Benefit):
    properties: Mapped[BenefitCustomProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": BenefitType.custom,
        "polymorphic_load": "inline",
    }


class BenefitArticles(Benefit):
    properties: Mapped[BenefitArticlesProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": BenefitType.articles,
        "polymorphic_load": "inline",
    }


class BenefitAds(Benefit):
    properties: Mapped[BenefitAdsProperties] = mapped_column(use_existing_column=True)

    __mapper_args__ = {
        "polymorphic_identity": BenefitType.ads,
        "polymorphic_load": "inline",
    }


class BenefitDiscord(Benefit):
    properties: Mapped[BenefitDiscordProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": BenefitType.discord,
        "polymorphic_load": "inline",
    }


class BenefitGitHubRepository(Benefit):
    properties: Mapped[BenefitGitHubRepositoryProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": BenefitType.github_repository,
        "polymorphic_load": "inline",
    }


class BenefitDownloadables(Benefit):
    properties: Mapped[BenefitDownloadablesProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": BenefitType.downloadables,
        "polymorphic_load": "inline",
    }


class BenefitLicenseKeys(Benefit):
    properties: Mapped[BenefitLicenseKeysProperties] = mapped_column(
        use_existing_column=True
    )

    __mapper_args__ = {
        "polymorphic_identity": BenefitType.license_keys,
        "polymorphic_load": "inline",
    }
