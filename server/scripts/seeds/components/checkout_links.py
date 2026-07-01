"""Checkout links seed component."""

from __future__ import annotations

from polar.checkout_link.schemas import CheckoutLinkCreateProducts
from polar.checkout_link.service import checkout_link as checkout_link_service
from polar.enums import PaymentProcessor

from scripts.seeds.base import SeedContext, Variant


class CheckoutLinksComponent:
    key = "checkout_links"
    label = "Checkout links"
    default_on = False
    requires = ["products"]
    variants: list[Variant] = []

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        products = ctx.created.get("products", [])
        if not products:
            return "checkout links: no products"

        await checkout_link_service.create(
            session=ctx.session,
            checkout_link_create=CheckoutLinkCreateProducts(
                payment_processor=PaymentProcessor.stripe,
                products=[product.id for product in products],
                label=f"{ctx.organization.name} store",
                allow_discount_codes=True,
            ),
            auth_subject=ctx.auth_subject,
        )
        return "1 checkout link"


component = CheckoutLinksComponent()
