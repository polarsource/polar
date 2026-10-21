import hashlib
from collections.abc import Mapping

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


def compute_hash(parent_hash: str | None, entries: Mapping[str, str]) -> str:
    """Hash a catalog like a git commit: its parent's hash, plus what it contains."""
    lines = [
        parent_hash or "",
        *(f"{key}={value}" for key, value in sorted(entries.items())),
    ]
    return hashlib.sha256("\n".join(lines).encode()).hexdigest()


class CatalogService:
    async def get_live_entries(
        self, session: AsyncReadSession, organization: Organization
    ) -> tuple[str | None, dict[str, str]]:
        """Return the live catalog's hash and contents.

        Before the first publish, that's the catalog apply creates from the
        existing products.
        """
        live = await CatalogRepository.from_session(session).get_live(organization.id)
        if live is not None:
            members = await CatalogProductRepository.from_session(
                session
            ).get_all_by_catalog(live.id)
            return live.hash, {
                member.external_id: str(member.product_id) for member in members
            }
        entries = {
            product.external_id: str(product.id)
            for product in await ProductRepository.from_session(
                session
            ).get_catalog_baseline(organization.id)
            if product.external_id is not None
        }
        if not entries:
            return None, {}
        return compute_hash(None, entries), entries

    async def get_next_hash(
        self,
        session: AsyncReadSession,
        organization: Organization,
        definitions: Mapping[str, str],
    ) -> tuple[str | None, str | None]:
        """Return the live hash, and the hash of the catalog these new product
        definitions would publish."""
        before, entries = await self.get_live_entries(session, organization)
        if not definitions:
            return before, before
        return before, compute_hash(before, {**entries, **definitions})

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
                hash=compute_hash(
                    None,
                    {
                        product.external_id: str(product.id)
                        for product in products
                        if product.external_id is not None
                    },
                ),
                status=CatalogStatus.live,
                published_at=utc_now(),
            ),
            flush=True,
        )
        catalog_product_repository = CatalogProductRepository.from_session(session)
        for product in products:
            assert product.external_id is not None
            product.catalog = catalog
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
        hash: str,
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
                hash=hash,
                status=CatalogStatus.live,
                published_at=utc_now(),
            ),
            flush=True,
        )
        for external_id, product in new_products.items():
            product.catalog = catalog
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


catalog = CatalogService()
