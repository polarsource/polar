import hashlib
import uuid
from collections.abc import Collection, Mapping, Sequence
from datetime import datetime

from polar.auth.models import Agent, AuthSubject, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.kit.pagination import PaginationParams
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
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository

from .repository import CatalogProductRepository, CatalogRepository


def compute_version_hash(parent_hash: str | None, entries: Mapping[str, str]) -> str:
    """Hash a catalog like a git commit: its parent's version hash, plus what it contains."""
    lines = [
        parent_hash or "",
        *(f"{key}={value}" for key, value in sorted(entries.items())),
    ]
    return hashlib.sha256("\n".join(lines).encode()).hexdigest()


class CatalogService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        status: Sequence[CatalogStatus] | None = None,
        published_after: datetime | None = None,
        published_before: datetime | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[Catalog], int]:
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.products_read
        )
        if organization_id is not None:
            org_ids = {oid for oid in org_ids if oid in set(organization_id)}
        enabled_org_ids = await OrganizationRepository.from_session(
            session
        ).get_ids_with_feature(set(org_ids), "config_as_code_enabled")
        org_ids = {oid for oid in org_ids if oid in enabled_org_ids}

        repository = CatalogRepository.from_session(session)
        statement = repository.get_statement_by_org_ids(org_ids)
        if status is not None:
            statement = statement.where(Catalog.status.in_(status))
        if published_after is not None:
            statement = statement.where(Catalog.published_at > published_after)
        if published_before is not None:
            statement = statement.where(Catalog.published_at < published_before)
        return await repository.paginate(
            statement,
            limit=pagination.limit,
            page=pagination.page,
        )

    async def get_live_entries(
        self,
        session: AsyncReadSession,
        organization: Organization,
        live: Catalog | None,
    ) -> tuple[str | None, dict[str, str]]:
        """Return the live catalog's version hash and contents.

        Before the first publish, that's the catalog apply creates from the
        existing products.
        """
        if live is not None:
            members = await CatalogProductRepository.from_session(
                session
            ).get_all_by_catalog(live.id)
            return live.version_hash, {
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
        return compute_version_hash(None, entries), entries

    async def get_next_version_hash(
        self,
        session: AsyncReadSession,
        organization: Organization,
        live: Catalog | None,
        definitions: Mapping[str, str],
        removed: Collection[str] = (),
    ) -> tuple[str | None, str | None]:
        """Return the live version hash, and the version hash of the catalog these
        new product definitions, without the removed products, would publish."""
        before, entries = await self.get_live_entries(session, organization, live)
        if not definitions and not removed:
            return before, before
        kept = {
            external_id: value
            for external_id, value in entries.items()
            if external_id not in removed
        }
        return before, compute_version_hash(before, {**kept, **definitions})

    async def get_default_name(
        self,
        session: AsyncReadSession,
        organization: Organization,
        *,
        after_baseline: bool = False,
    ) -> str:
        """Name the next catalog `v{n}`, n being its position in the organization's
        history. Soft-deleted catalogs still count, so n never goes backwards.

        `get_or_create_live` and `publish` take `CatalogRepository.lock` before
        naming a catalog, so concurrent publishes can't get the same n.
        """
        count = await CatalogRepository.from_session(session).count_by_organization(
            organization.id
        )
        return f"v{count + (2 if after_baseline else 1)}"

    async def get_or_create_live(
        self, session: AsyncSession, organization: Organization
    ) -> Catalog | None:
        repository = CatalogRepository.from_session(session)
        await repository.lock(organization.id)
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
                name=await self.get_default_name(session, organization),
                version_hash=compute_version_hash(
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
        version_hash: str,
        name: str | None = None,
        removed: Collection[str] = (),
    ) -> Catalog:
        repository = CatalogRepository.from_session(session)
        await repository.lock(organization.id)
        catalog_product_repository = CatalogProductRepository.from_session(session)
        product_repository = ProductRepository.from_session(session)

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
        for external_id in removed:
            removed_product = members.pop(external_id, None)
            if removed_product is not None:
                await product_repository.update(
                    removed_product, update_dict={"is_current": False}
                )
        if live is not None:
            await repository.update(
                live, update_dict={"status": CatalogStatus.archived}, flush=True
            )
        catalog = await repository.create(
            Catalog(
                organization=organization,
                name=name
                if name is not None
                else await self.get_default_name(session, organization),
                version_hash=version_hash,
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
