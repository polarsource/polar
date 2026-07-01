"""Benefits seed component (custom + license keys, attached to products)."""

from __future__ import annotations

from polar.benefit.service import benefit as benefit_service
from polar.benefit.strategies.custom.schemas import (
    BenefitCustomCreate,
    BenefitCustomCreateProperties,
)
from polar.benefit.strategies.license_keys.schemas import (
    BenefitLicenseKeysCreate,
    BenefitLicenseKeysCreateProperties,
)
from polar.models.benefit import BenefitType
from polar.product.service import product as product_service

from scripts.seeds.base import SeedContext, Variant


class BenefitsComponent:
    key = "benefits"
    label = "Benefits"
    default_on = False
    requires = ["products"]
    variants: list[Variant] = []

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        custom = await benefit_service.user_create(
            session=ctx.session,
            redis=ctx.redis,
            create_schema=BenefitCustomCreate(
                type=BenefitType.custom,
                description="Community access",
                organization_id=ctx.organization.id,
                properties=BenefitCustomCreateProperties(),
            ),
            auth_subject=ctx.auth_subject,
        )
        license_keys = await benefit_service.user_create(
            session=ctx.session,
            redis=ctx.redis,
            create_schema=BenefitLicenseKeysCreate(
                type=BenefitType.license_keys,
                description="License key",
                organization_id=ctx.organization.id,
                properties=BenefitLicenseKeysCreateProperties(prefix="SEED"),
            ),
            auth_subject=ctx.auth_subject,
        )
        benefits = [custom, license_keys]

        products = ctx.created.get("products", [])
        for product in products:
            await product_service.update_benefits(
                session=ctx.session,
                product=product,
                benefits=[benefit.id for benefit in benefits],
                auth_subject=ctx.auth_subject,
            )

        attached = f", attached to {len(products)} products" if products else ""
        return f"{len(benefits)} benefits{attached}"


component = BenefitsComponent()
