from pydantic import UUID4

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.perk import PerkCategory, RedemptionType


class PerkBase(Schema):
    """Base schema for perks."""

    provider_name: str
    logo_key: str
    headline: str
    description: str
    category: PerkCategory
    redemption_type: RedemptionType
    featured: bool


class Perk(TimestampedSchema, PerkBase):
    """Public perk schema - excludes sensitive redemption data."""

    id: UUID4
    redemption_url: str | None = None


class PerkWithCode(Perk):
    """Perk schema with redemption code - returned after claim."""

    redemption_code: str | None = None


class PerkClaim(TimestampedSchema):
    """Record of a perk claim."""

    id: UUID4
    perk_id: UUID4
    user_id: UUID4


class PerkClaimResponse(Schema):
    """Response after claiming a perk."""

    claimed: bool
    perk: PerkWithCode
    total_claims: int
