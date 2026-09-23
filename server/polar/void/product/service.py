import uuid
from collections.abc import Sequence

from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import PolarError, ResourceNotFound
from polar.kit.currency import get_currency_decimal_factor
from polar.kit.math import polar_round
from polar.models import Product as ProductModel
from polar.models import ProductBenefit, ProductPriceFixed, ProductPriceMeteredUnit
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.meter.schemas import to_schema as meter_schema
from polar.void.meter.service import meter as meter_service
from polar.void.organization.service import organization as organization_service

from .repository import ProductRepository
from .schemas import ProductCreate


class ProductInvalid(PolarError):
    def __init__(self, message: str = "Invalid product") -> None:
        super().__init__(message, 400)


def products_in_version(
    products: Sequence[ProductModel], version_id: str | None
) -> dict[str, ProductModel]:
    """The products of one configuration version by slug; empty without a version."""
    return {
        product.slug: product
        for product in products
        if product.version_id == version_id
    }


class ProductService:
    async def list(
        self, session: AsyncReadSession, organization_id: uuid.UUID
    ) -> Sequence[ProductModel]:
        return await ProductRepository.from_session(session).list(organization_id)

    async def get(
        self, session: AsyncReadSession, organization_id: uuid.UUID, id: uuid.UUID
    ) -> ProductModel:
        product = await ProductRepository.from_session(session).get(organization_id, id)
        if product is None:
            raise ResourceNotFound()
        return product

    async def create(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        create_schema: ProductCreate,
    ) -> ProductModel:
        organization = await organization_service.lock(session, organization_id)
        price = create_schema.price
        if price.type == "one_time" and create_schema.meter_ids:
            raise ProductInvalid(
                f"Product {create_schema.slug!r} is one-time and cannot carry meters"
            )
        meters = [
            await meter_service.get(session, organization_id, meter_id)
            for meter_id in dict.fromkeys(create_schema.meter_ids)
        ]
        for meter in meters:
            if meter_schema(meter).currency != price.currency:
                raise ProductInvalid(
                    f"Meter {meter.slug!r} bills in {meter_schema(meter).currency}, "
                    f"product {create_schema.slug!r} in {price.currency}"
                )
        if set(create_schema.meter_terms) - {m.slug for m in meters}:
            raise ProductInvalid("Meter terms must refer to meters on the product")
        entitlements = [
            await entitlement_service.get(session, organization_id, entitlement_id)
            for entitlement_id in dict.fromkeys(create_schema.entitlement_ids)
        ]
        product = ProductModel(
            slug=create_schema.slug,
            version_id=create_schema.version_id,
            name=create_schema.name,
            description=create_schema.description,
            recurring_interval=SubscriptionRecurringInterval(price.interval)
            if price.type == "recurring"
            else None,
            recurring_interval_count=price.interval_count
            if price.type == "recurring"
            else None,
            all_prices=[
                ProductPriceFixed(
                    price_amount=polar_round(
                        price.amount * get_currency_decimal_factor(price.currency)
                    ),
                    price_currency=price.currency,
                ),
                *[
                    ProductPriceMeteredUnit(
                        meter=meter,
                        unit_amount=meter_schema(meter).unit_amount
                        * get_currency_decimal_factor(price.currency),
                        price_currency=price.currency,
                    )
                    for meter in meters
                ],
            ],
            product_benefits=[
                ProductBenefit(benefit=benefit, order=index)
                for index, benefit in enumerate(entitlements)
            ],
            meter_terms={
                key: value.model_dump(mode="json")
                for key, value in create_schema.meter_terms.items()
            },
            organization=organization,
        )
        await ProductRepository.from_session(session).create(product, flush=True)
        return await self.get(session, organization_id, product.id)


product = ProductService()
