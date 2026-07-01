"""Customers seed component."""

from __future__ import annotations

import random

from polar.customer.schemas.customer import CustomerIndividualCreate
from polar.customer.service import customer as customer_service
from polar.models.customer import Customer

from scripts.seeds.base import SeedContext, Variant

CUSTOMER_COUNT_RANGE = (5, 10)


class CustomersComponent:
    key = "customers"
    label = "Customers"
    default_on = True
    requires: list[str] = []
    variants: list[Variant] = []

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        count = random.randint(*CUSTOMER_COUNT_RANGE)
        customers: list[Customer] = []
        for index in range(count):
            customer = await customer_service.create(
                session=ctx.session,
                customer_create=CustomerIndividualCreate(
                    email=f"customer_{ctx.organization.slug}_{index + 1}@polar.sh",
                    name=f"Customer {index + 1}",
                    organization_id=ctx.organization.id,
                ),
                auth_subject=ctx.auth_subject,
            )
            customers.append(customer)

        ctx.created["customers"] = customers
        return f"{count} customers"


component = CustomersComponent()
