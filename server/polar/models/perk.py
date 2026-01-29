from enum import StrEnum

from sqlalchemy import Boolean, String, Text, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class RedemptionType(StrEnum):
    link = "link"
    code = "code"


class PerkCategory(StrEnum):
    cloud = "cloud"
    finance = "finance"
    marketing = "marketing"
    developer_tools = "developer_tools"
    analytics = "analytics"
    ai = "ai"
    other = "other"


class Perk(RecordModel):
    """
    Global startup perks available to all Spaire users.
    These are not organization-specific - they're platform-level perks.
    """

    __tablename__ = "perks"

    # Provider details
    provider_name: Mapped[str] = mapped_column(String(255), nullable=False)
    logo_key: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Filename for /assets/images/perks/[logo_key].png"
    )

    # Perk content
    headline: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="e.g. '$5k in Credits'"
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[PerkCategory] = mapped_column(String(50), nullable=False, index=True)

    # Redemption
    redemption_type: Mapped[RedemptionType] = mapped_column(String(20), nullable=False)
    redemption_url: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="URL to visit for link-type redemption"
    )
    redemption_code: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Code to copy for code-type redemption"
    )

    # Display
    featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    display_order: Mapped[int] = mapped_column(
        default=100, nullable=False, comment="Lower values appear first"
    )

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
