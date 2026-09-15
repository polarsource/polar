import uuid
from collections.abc import Sequence
from decimal import Decimal

from polar.exceptions import PolarError, ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import VoidProduct
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.entitlement.service import entitlement as entitlement_service
from polar.void.meter.service import meter as meter_service
from polar.void.organization.service import organization as organization_service

from .repository import ProductRepository
from .schemas import ProductCreate


class ProductInvalid(PolarError):
    def __init__(self, message: str = "Invalid product") -> None:
        super().__init__(message, 400)


def latest_products(
    products: Sequence[VoidProduct], variant_id: str | None = None
) -> dict[str, VoidProduct]:
    """The newest generation per slug within one configuration variant."""
    latest: dict[str, VoidProduct] = {}
    for product in products:
        if product.variant_id != variant_id:
            continue
        current = latest.get(product.slug)
        if current is None or product.generation_id > current.generation_id:
            latest[product.slug] = product
    return latest


def same_definition(wanted: ProductCreate, current: VoidProduct) -> bool:
    price = wanted.price
    return (
        current.name == wanted.name
        and current.variant_id == wanted.variant_id
        and current.description == wanted.description
        and current.price_type == price.type
        and current.interval == (price.interval if price.type == "recurring" else None)
        and current.interval_count
        == (price.interval_count if price.type == "recurring" else 1)
        and Decimal(current.amount) == price.amount
        and current.currency == price.currency
        and (current.meter_terms or {})
        == {
            key: value.model_dump(mode="json")
            for key, value in wanted.meter_terms.items()
        }
        and sorted(current.meter_ids) == sorted(wanted.meter_ids)
        and sorted(current.entitlement_ids) == sorted(wanted.entitlement_ids)
    )


class ProductService:
    async def list(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        *,
        include_archived: bool = True,
    ) -> Sequence[VoidProduct]:
        return await ProductRepository.from_session(session).list(
            organization_id, include_archived=include_archived
        )

    async def get(
        self, session: AsyncReadSession, organization_id: uuid.UUID, id: uuid.UUID
    ) -> VoidProduct:
        product = await ProductRepository.from_session(session).get(organization_id, id)
        if product is None:
            raise ResourceNotFound()
        return product

    async def create(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        create_schema: ProductCreate,
    ) -> VoidProduct:
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
            if meter.currency != price.currency:
                raise ProductInvalid(
                    f"Meter {meter.slug!r} bills in {meter.currency}, "
                    f"product {create_schema.slug!r} in {price.currency}"
                )
        if set(create_schema.meter_terms) - {m.slug for m in meters}:
            raise ProductInvalid("Meter terms must refer to meters on the product")
        entitlements = [
            await entitlement_service.get(session, organization_id, entitlement_id)
            for entitlement_id in dict.fromkeys(create_schema.entitlement_ids)
        ]
        repository = ProductRepository.from_session(session)
        generation = await repository.next_generation(
            organization_id, create_schema.slug, create_schema.variant_id
        )
        product = VoidProduct(
            slug=create_schema.slug,
            variant_id=create_schema.variant_id,
            generation_id=generation,
            name=create_schema.name,
            description=create_schema.description,
            price_type=price.type,
            interval=price.interval if price.type == "recurring" else None,
            interval_count=price.interval_count if price.type == "recurring" else 1,
            amount=price.amount,
            currency=price.currency,
            meter_ids=[m.id for m in meters],
            meter_terms={
                key: value.model_dump(mode="json")
                for key, value in create_schema.meter_terms.items()
            },
            entitlement_ids=[e.id for e in entitlements],
            organization=organization,
        )
        await repository.create(product, flush=True)
        await repository.archive_previous(product)
        await session.flush()
        return await self.get(session, organization_id, product.id)

    async def archive(self, session: AsyncSession, product: VoidProduct) -> None:
        await organization_service.lock(session, product.organization_id)
        if product.archived_at is None:
            product.archived_at = utc_now()
            await session.flush()


product = ProductService()
