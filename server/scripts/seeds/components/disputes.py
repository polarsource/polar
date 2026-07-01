"""Disputes seed component (an order + payment + dispute).

Reuses the test fixtures, like `seeds_load.py` does — the seed otherwise creates
no orders.
"""

from __future__ import annotations

from polar.models.product_price import ProductPriceFixed

from scripts.seeds.base import SeedContext, Variant
from tests.fixtures.database import save_fixture_factory
from tests.fixtures.random_objects import create_dispute, create_order, create_payment


class DisputesComponent:
    key = "disputes"
    label = "Disputes"
    default_on = False
    requires = ["products", "customers"]
    variants: list[Variant] = []

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        customers = ctx.created.get("customers", [])
        products = ctx.created.get("products", [])
        if not customers or not products:
            return "disputes: needs products and customers"

        product = next(
            (
                p
                for p in products
                if any(isinstance(price, ProductPriceFixed) for price in p.all_prices)
            ),
            products[0],
        )
        customer = customers[0]

        save = save_fixture_factory(ctx.session)
        order = await create_order(save, customer=customer, product=product)
        payment = await create_payment(save, ctx.organization, order=order)
        dispute = await create_dispute(
            save,
            order,
            payment,
            payment_processor_id=f"dp_seed_{ctx.organization.slug}",
        )

        ctx.created.setdefault("disputes", []).append(dispute)
        return "1 order, 1 payment, 1 dispute"


component = DisputesComponent()
