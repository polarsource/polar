import uuid
from collections.abc import Mapping

from polar.checkout_link.repository import CheckoutLinkRepository
from polar.discount.repository import DiscountRepository
from polar.kit.utils import utc_now
from polar.models import (
    Catalog,
    CatalogProduct,
    Organization,
    Product,
    ProductCustomField,
    ProductMedia,
)
from polar.models.catalog import CatalogStatus
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository

from .repository import CatalogProductRepository, CatalogRepository


class CatalogService:
    async def lock(self, session: AsyncSession, organization: Organization) -> None:
        await CatalogRepository.from_session(session).lock(organization.id)

    async def get_base_version(
        self, session: AsyncReadSession, organization: Organization
    ) -> tuple[int | None, int]:
        """Return the live version, and the version the next apply builds on."""
        live = await CatalogRepository.from_session(session).get_live(organization.id)
        if live is not None:
            return live.version, live.version
        has_baseline = await ProductRepository.from_session(
            session
        ).has_catalog_baseline(organization.id)
        # Apply creates catalog 1 from the existing products before publishing.
        return (1, 1) if has_baseline else (None, 0)

    async def get_or_create_live(
        self, session: AsyncSession, organization: Organization
    ) -> Catalog | None:
        repository = CatalogRepository.from_session(session)
        live = await repository.get_live(organization.id)
        if live is not None:
            return live

        products = await ProductRepository.from_session(session).get_catalog_baseline(
            organization.id
        )
        if not products:
            return None

        catalog = await repository.create(
            Catalog(
                organization=organization,
                version=await repository.get_max_version(organization.id) + 1,
                status=CatalogStatus.live,
                published_at=utc_now(),
            ),
            flush=True,
        )
        catalog_product_repository = CatalogProductRepository.from_session(session)
        for product in products:
            assert product.external_id is not None
            if product.version is None:
                product.version = catalog.version
            await catalog_product_repository.create(
                CatalogProduct(
                    catalog=catalog, product=product, external_id=product.external_id
                )
            )
        return catalog

    async def publish(
        self,
        session: AsyncSession,
        organization: Organization,
        live: Catalog | None,
        new_products: Mapping[str, Product],
    ) -> Catalog:
        repository = CatalogRepository.from_session(session)
        catalog_product_repository = CatalogProductRepository.from_session(session)

        members = (
            {}
            if live is None
            else {
                member.external_id: member.product
                for member in await catalog_product_repository.get_all_by_catalog(
                    live.id
                )
            }
        )
        if live is not None:
            await repository.update(
                live, update_dict={"status": CatalogStatus.archived}, flush=True
            )
        catalog = await repository.create(
            Catalog(
                organization=organization,
                version=await repository.get_max_version(organization.id) + 1,
                status=CatalogStatus.live,
                published_at=utc_now(),
            ),
            flush=True,
        )
        for external_id, product in new_products.items():
            product.version = catalog.version
            members.pop(external_id, None)
            await catalog_product_repository.create(
                CatalogProduct(
                    catalog=catalog, product=product, external_id=external_id
                )
            )
        for external_id, product in members.items():
            await catalog_product_repository.create(
                CatalogProduct(
                    catalog=catalog, product=product, external_id=external_id
                )
            )
        return catalog

    def copy_product_settings(self, product: Product, new_product: Product) -> None:
        """Copy what config doesn't describe onto a product's new version."""
        new_product.is_archived = product.is_archived
        new_product.is_tax_applicable = product.is_tax_applicable
        new_product.tax_code = product.tax_code
        new_product.product_medias = [
            ProductMedia(file=media.file, order=media.order)
            for media in product.product_medias
        ]
        new_product.attached_custom_fields = [
            ProductCustomField(
                custom_field=field.custom_field,
                order=field.order,
                required=field.required,
            )
            for field in product.attached_custom_fields
        ]

    async def carry_over_references(
        self, session: AsyncSession, replaced: Mapping[uuid.UUID, uuid.UUID]
    ) -> None:
        """Point checkout links and discount restrictions at the new version."""
        checkout_link_repository = CheckoutLinkRepository.from_session(session)
        discount_repository = DiscountRepository.from_session(session)
        for product_id, new_product_id in replaced.items():
            await checkout_link_repository.replace_product(product_id, new_product_id)
            await discount_repository.replace_product(product_id, new_product_id)


catalog = CatalogService()
