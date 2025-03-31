from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.exceptions import PolarError
from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.benefit.strategies import BenefitProperties
    from polar.benefit.strategies.custom.properties import BenefitCustomProperties
    from polar.benefit.strategies.discord.properties import BenefitDiscordProperties
    from polar.benefit.strategies.downloadables.properties import (
        BenefitDownloadablesProperties,
    )
    from polar.benefit.strategies.github_repository.properties import (
        BenefitGitHubRepositoryProperties,
    )
    from polar.benefit.strategies.license_keys.properties import (
        BenefitLicenseKeysProperties,
    )
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

    def is_tax_applicable(self) -> bool:
        try:
            _is_tax_applicable_map: dict[BenefitType, bool] = {
                BenefitType.custom: True,
                BenefitType.discord: True,
                BenefitType.github_repository: True,
                BenefitType.downloadables: True,
                BenefitType.license_keys: True,
            }
            return _is_tax_applicable_map[self]
        except KeyError as e:
            raise TaxApplicationMustBeSpecified(self) from e


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

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

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
