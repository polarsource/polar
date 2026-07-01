"""Discounts seed component."""

from __future__ import annotations

from polar.discount.schemas import DiscountPercentageCreate
from polar.discount.service import discount as discount_service
from polar.models.discount import DiscountDuration, DiscountType

from scripts.seeds.base import SeedContext, Variant


class DiscountsComponent:
    key = "discounts"
    label = "Discounts"
    default_on = False
    requires: list[str] = []
    variants: list[Variant] = []

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        await discount_service.create(
            session=ctx.session,
            discount_create=DiscountPercentageCreate(
                name="Free",
                code="free",
                type=DiscountType.percentage,
                basis_points=10000,
                duration=DiscountDuration.once,
                organization_id=ctx.organization.id,
            ),
            auth_subject=ctx.auth_subject,
        )
        return "1 discount (free, 100%)"


component = DiscountsComponent()
