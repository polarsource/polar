import hashlib
import uuid
from collections.abc import Mapping, Sequence

from polar.auth.models import Agent, AuthSubject, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.benefit.repository import BenefitRepository
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.models import (
    Benefit,
    Catalog,
    CatalogBenefit,
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

from .repository import (
    CatalogBenefitRepository,
    CatalogProductRepository,
    CatalogRepository,
)


def benefit_entry_key(external_id: str) -> str:
    """Benefits and products have separate `external_id` namespaces."""
    return f"benefit:{external_id}"


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

    async def _get_live_benefits(
        self,
        session: AsyncReadSession,
        organization: Organization,
        live: Catalog | None,
    ) -> dict[str, Benefit]:
        """Benefits of the live catalog. Catalogs published before benefits were
        versioned have no benefit members, so they have the current benefits."""
        if live is not None:
            members = await CatalogBenefitRepository.from_session(
                session
            ).get_all_by_catalog(live.id)
            if members:
                return {member.external_id: member.benefit for member in members}
        return {
            benefit.external_id: benefit
            for benefit in await BenefitRepository.from_session(
                session
            ).get_catalog_baseline(organization.id)
            if benefit.external_id is not None
        }

    async def get_live_entries(
        self, session: AsyncReadSession, organization: Organization
    ) -> tuple[str | None, dict[str, str]]:
        """Return the live catalog's version hash and contents.

        Before the first publish, that's the catalog apply creates from the
        existing products and benefits.
        """
        live = await CatalogRepository.from_session(session).get_live(organization.id)
        benefit_entries = {
            benefit_entry_key(external_id): str(benefit.id)
            for external_id, benefit in (
                await self._get_live_benefits(session, organization, live)
            ).items()
        }
        if live is not None:
            members = await CatalogProductRepository.from_session(
                session
            ).get_all_by_catalog(live.id)
            return live.version_hash, {
                **{member.external_id: str(member.product_id) for member in members},
                **benefit_entries,
            }
        entries = {
            **{
                product.external_id: str(product.id)
                for product in await ProductRepository.from_session(
                    session
                ).get_catalog_baseline(organization.id)
                if product.external_id is not None
            },
            **benefit_entries,
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
        new product and benefit definitions would publish."""
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

        version_hash, entries = await self.get_live_entries(session, organization)
        if version_hash is None:
            return None
        products = await ProductRepository.from_session(session).get_catalog_baseline(
            organization.id
        )
        benefits = await self._get_live_benefits(session, organization, None)

        catalog = await repository.create(
            Catalog(
                organization=organization,
                version_hash=version_hash,
                status=CatalogStatus.live,
                published_at=utc_now(),
            ),
            flush=True,
        )
        await self._add_members(
            session,
            catalog,
            {
                product.external_id: product
                for product in products
                if product.external_id is not None
            },
            benefits,
        )
        return catalog

    async def publish(
        self,
        session: AsyncSession,
        organization: Organization,
        live: Catalog | None,
        new_products: Mapping[str, Product],
        new_benefits: Mapping[str, Benefit],
        version_hash: str,
        name: str | None = None,
    ) -> Catalog:
        repository = CatalogRepository.from_session(session)
        products = (
            {}
            if live is None
            else {
                member.external_id: member.product
                for member in await CatalogProductRepository.from_session(
                    session
                ).get_all_by_catalog(live.id)
            }
        )
        benefits = await self._get_live_benefits(session, organization, live)
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
        await self._add_members(
            session,
            catalog,
            {**products, **new_products},
            {**benefits, **new_benefits},
        )
        return catalog

    async def _add_members(
        self,
        session: AsyncSession,
        catalog: Catalog,
        products: Mapping[str, Product],
        benefits: Mapping[str, Benefit],
    ) -> None:
        catalog_product_repository = CatalogProductRepository.from_session(session)
        for external_id, product in products.items():
            if product.catalog_id is None:
                product.catalog = catalog
            await catalog_product_repository.create(
                CatalogProduct(
                    catalog=catalog, product=product, external_id=external_id
                )
            )
        catalog_benefit_repository = CatalogBenefitRepository.from_session(session)
        for external_id, benefit in benefits.items():
            if benefit.catalog_id is None:
                benefit.catalog = catalog
            await catalog_benefit_repository.create(
                CatalogBenefit(
                    catalog=catalog, benefit=benefit, external_id=external_id
                )
            )

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
