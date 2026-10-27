import hashlib
import uuid
from collections.abc import Mapping, Sequence

from polar.auth.models import Agent, AuthSubject, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.declarative_config.export import export_products
from polar.declarative_config.schemas import ConfigFieldChange, ConfigProductRead
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
from .schemas import CatalogProductChange, CatalogProductDiff

_CHANGE_ORDER = {
    CatalogProductChange.added: 0,
    CatalogProductChange.changed: 1,
    CatalogProductChange.removed: 2,
    CatalogProductChange.unchanged: 3,
}


def _field_changes(
    before: ConfigProductRead | None, after: ConfigProductRead | None
) -> list[ConfigFieldChange]:
    if before is None or after is None:
        return []
    before_fields = before.model_dump(mode="json")
    after_fields = after.model_dump(mode="json")
    return [
        ConfigFieldChange(field=field, before=value, after=after_fields[field])
        for field, value in before_fields.items()
        if value != after_fields[field]
    ]


def _product_diff(
    external_id: str,
    after: CatalogProduct | None,
    before: CatalogProduct | None,
    definitions: Mapping[uuid.UUID, ConfigProductRead | None],
) -> CatalogProductDiff:
    if before is None:
        change = CatalogProductChange.added
    elif after is None:
        change = CatalogProductChange.removed
    elif after.product_id == before.product_id:
        change = CatalogProductChange.unchanged
    else:
        change = CatalogProductChange.changed
    row = after or before
    assert row is not None
    return CatalogProductDiff(
        external_id=external_id,
        name=row.product.name,
        product_id=after.product_id if after else None,
        previous_product_id=before.product_id if before else None,
        change=change,
        diff=_field_changes(
            definitions.get(before.product_id), definitions.get(after.product_id)
        )
        if change == CatalogProductChange.changed and before and after
        else [],
    )


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
        return await repository.paginate(
            statement,
            limit=pagination.limit,
            page=pagination.page,
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        id: uuid.UUID,
    ) -> Catalog | None:
        catalog = await CatalogRepository.from_session(session).get_by_id(id)
        if catalog is None:
            return None
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.products_read
        )
        if catalog.organization_id not in org_ids:
            return None
        enabled_org_ids = await OrganizationRepository.from_session(
            session
        ).get_ids_with_feature({catalog.organization_id}, "config_as_code_enabled")
        return catalog if catalog.organization_id in enabled_org_ids else None

    async def diff(
        self, session: AsyncReadSession, catalog: Catalog
    ) -> tuple[Catalog | None, Sequence[CatalogProductDiff]]:
        """Compare a catalog's products with the version published before it."""
        previous = await CatalogRepository.from_session(session).get_previous(catalog)
        repository = CatalogProductRepository.from_session(session)
        after = {
            member.external_id: member
            for member in await repository.get_all_by_catalog(catalog.id)
        }
        before = (
            {
                member.external_id: member
                for member in await repository.get_all_by_catalog(previous.id)
            }
            if previous is not None
            else {}
        )
        new_rows = [
            member
            for external_id in after.keys() & before.keys()
            for member in (after[external_id], before[external_id])
            if after[external_id].product_id != before[external_id].product_id
        ]
        definitions = await export_products(
            session, catalog.organization_id, [member.product for member in new_rows]
        )
        products = [
            _product_diff(
                external_id,
                after.get(external_id),
                before.get(external_id),
                definitions,
            )
            for external_id in after.keys() | before.keys()
        ]
        products.sort(
            key=lambda product: (_CHANGE_ORDER[product.change], product.external_id)
        )
        return previous, products

    async def get_live_entries(
        self, session: AsyncReadSession, organization: Organization
    ) -> tuple[str | None, dict[str, str]]:
        """Return the live catalog's version hash and contents.

        Before the first publish, that's the catalog apply creates from the
        existing products.
        """
        live = await CatalogRepository.from_session(session).get_live(organization.id)
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
        definitions: Mapping[str, str],
    ) -> tuple[str | None, str | None]:
        """Return the live version hash, and the version hash of the catalog these
        new product definitions would publish."""
        before, entries = await self.get_live_entries(session, organization)
        if not definitions:
            return before, before
        return before, compute_version_hash(before, {**entries, **definitions})

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
                name=name,
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
