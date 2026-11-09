import builtins
import hashlib
import json
import uuid
from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import selectinload

from polar.auth.models import Agent, AuthSubject, User
from polar.auth.permission import OrganizationPermission
from polar.auth.scope import Scope
from polar.authz.service import get_accessible_org_ids
from polar.authz.types import AccessibleOrganizationID
from polar.benefit.repository import BenefitRepository
from polar.checkout_link.repository import CheckoutLinkRepository
from polar.exceptions import PolarError
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
from polar.oauth2.exceptions import InsufficientScopeError
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository

from .repository import (
    CatalogBenefitRepository,
    CatalogProductRepository,
    CatalogRepository,
)


@dataclass
class CatalogEntries:
    """A catalog's contents by `external_id`. Products and benefits have
    separate `external_id` namespaces."""

    products: dict[str, str] = field(default_factory=dict)
    benefits: dict[str, str] = field(default_factory=dict)

    def __bool__(self) -> bool:
        return bool(self.products or self.benefits)

    def updated(
        self,
        definitions: "CatalogEntries",
        removed_products: Collection[str],
        removed_benefits: Collection[str],
    ) -> "CatalogEntries":
        return CatalogEntries(
            products={
                **{k: v for k, v in self.products.items() if k not in removed_products},
                **definitions.products,
            },
            benefits={
                **{k: v for k, v in self.benefits.items() if k not in removed_benefits},
                **definitions.benefits,
            },
        )


def compute_version_hash(
    parent_hash: str | None,
    entries: Mapping[str, str],
    benefits: Mapping[str, str] | None = None,
) -> str:
    """Hash a catalog like a git commit: its parent's version hash, plus what it contains."""
    lines = [
        parent_hash or "",
        *(f"{key}={value}" for key, value in sorted(entries.items())),
    ]
    if benefits:
        lines.append(json.dumps({"benefits": benefits}, sort_keys=True))
    return hashlib.sha256("\n".join(lines).encode()).hexdigest()


def hash_entries(parent_hash: str | None, entries: CatalogEntries) -> str:
    return compute_version_hash(parent_hash, entries.products, entries.benefits)


def _benefit_ids(benefits: Mapping[str, Benefit]) -> dict[str, uuid.UUID]:
    return {external_id: benefit.id for external_id, benefit in benefits.items()}


class CatalogNotFound(PolarError):
    def __init__(self, id: uuid.UUID) -> None:
        super().__init__(f"No catalog with ID {id}.", 404)


class CatalogNotDraft(PolarError):
    def __init__(self, id: uuid.UUID) -> None:
        super().__init__(f"The catalog {id} isn't a draft.", 409)


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
        org_ids = await self._get_readable_org_ids(session, auth_subject)
        if organization_id is not None:
            org_ids = {oid for oid in org_ids if oid in set(organization_id)}

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

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        id: uuid.UUID,
    ) -> Catalog | None:
        org_ids = await self._get_readable_org_ids(session, auth_subject)
        repository = CatalogRepository.from_session(session)
        statement = (
            repository.get_statement_by_org_ids(org_ids)
            .where(Catalog.id == id)
            .options(
                selectinload(Catalog.product_members),
                selectinload(Catalog.benefit_members),
            )
        )
        return await repository.get_one_or_none(statement)

    async def get_draft_for_write(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        id: uuid.UUID,
    ) -> Catalog:
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.products_manage
        )
        catalog = await CatalogRepository.from_session(
            session
        ).get_by_id_with_organization(set(org_ids), id)
        if catalog is None or not catalog.organization.is_config_as_code_enabled:
            raise CatalogNotFound(id)
        if catalog.status != CatalogStatus.draft:
            raise CatalogNotDraft(id)
        return catalog

    async def _get_readable_org_ids(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization | Agent],
    ) -> set[AccessibleOrganizationID]:
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.products_read
        )
        enabled_org_ids = await OrganizationRepository.from_session(
            session
        ).get_ids_with_feature(set(org_ids), "config_as_code_enabled")
        return {oid for oid in org_ids if oid in enabled_org_ids}

    async def resolve(
        self,
        session: AsyncReadSession,
        organization: Organization,
        id: uuid.UUID | None,
    ) -> Catalog | None:
        """Return the catalog with this ID, or the live catalog when `id` is None.

        The live catalog is None before the first publish.
        """
        repository = CatalogRepository.from_session(session)
        if id is None:
            return await repository.get_live(organization.id)
        catalog = await repository.get_by_organization_and_id(organization.id, id)
        if catalog is None:
            raise CatalogNotFound(id)
        return catalog

    async def lists_benefits(self, session: AsyncReadSession, catalog: Catalog) -> bool:
        """Whether the catalog records its benefits. Catalogs published before
        the organization's first one that does were published before benefits
        were versioned. Drafts always do."""
        if catalog.status == CatalogStatus.draft:
            return True
        first = await CatalogBenefitRepository.from_session(
            session
        ).get_first_published_at(catalog.organization_id)
        return first is not None and (
            catalog.published_at is None or catalog.published_at >= first
        )

    async def get_catalog_benefits(
        self,
        session: AsyncReadSession,
        organization: Organization,
        catalog: Catalog | None,
    ) -> dict[str, Benefit]:
        """Benefits of a catalog, by `external_id`.

        A catalog published before benefits were versioned has the current
        benefits, as does no catalog before the first publish.
        """
        if catalog is not None and await self.lists_benefits(session, catalog):
            return {
                member.external_id: member.benefit
                for member in await CatalogBenefitRepository.from_session(
                    session
                ).get_all_by_catalog(catalog.id)
            }
        return {
            benefit.external_id: benefit
            for benefit in await BenefitRepository.from_session(
                session
            ).get_catalog_baseline(organization.id)
            if benefit.external_id is not None
        }

    async def get_live_entries(
        self,
        session: AsyncReadSession,
        organization: Organization,
        live: Catalog | None,
    ) -> tuple[str | None, CatalogEntries]:
        """Return the live catalog's version hash and contents.

        Before the first publish, that's the catalog apply creates from the
        existing products and benefits.
        """
        if live is not None:
            members = await CatalogProductRepository.from_session(
                session
            ).get_all_by_catalog(live.id)
            products = {
                member.external_id: str(member.product_id) for member in members
            }
        else:
            products = {
                product.external_id: str(product.id)
                for product in await ProductRepository.from_session(
                    session
                ).get_catalog_baseline(organization.id)
                if product.external_id is not None
            }
        entries = CatalogEntries(
            products=products,
            benefits={
                external_id: str(benefit.id)
                for external_id, benefit in (
                    await self.get_catalog_benefits(session, organization, live)
                ).items()
            },
        )
        if live is not None:
            return live.version_hash, entries
        if not entries:
            return None, entries
        return hash_entries(None, entries), entries

    async def get_next_version_hash(
        self,
        session: AsyncReadSession,
        organization: Organization,
        live: Catalog | None,
        definitions: CatalogEntries,
        removed_products: Collection[str],
        removed_benefits: Collection[str],
    ) -> tuple[str | None, str | None]:
        """Return the live version hash, and the version hash of the catalog these
        new product and benefit definitions, without the removed entries, would
        publish."""
        before, entries = await self.get_live_entries(session, organization, live)
        if not definitions and not removed_products and not removed_benefits:
            return before, before
        return before, hash_entries(
            before, entries.updated(definitions, removed_products, removed_benefits)
        )

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

        version_hash, _ = await self.get_live_entries(session, organization, None)
        if version_hash is None:
            return None
        products = await ProductRepository.from_session(session).get_catalog_baseline(
            organization.id
        )
        benefits = await self.get_catalog_benefits(session, organization, None)

        catalog = await repository.create(
            Catalog(
                organization=organization,
                name=await self.get_default_name(session, organization),
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

    async def _next_members(
        self,
        session: AsyncReadSession,
        organization: Organization,
        live: Catalog | None,
        new_products: Mapping[str, Product],
        new_benefits: Mapping[str, Benefit],
        removed: Collection[str],
        removed_benefits: Collection[str],
    ) -> tuple[dict[str, Product], dict[str, Benefit]]:
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
        benefits = await self.get_catalog_benefits(session, organization, live)
        for external_id in removed:
            products.pop(external_id)
        for external_id in removed_benefits:
            benefits.pop(external_id)
        return {**products, **new_products}, {**benefits, **new_benefits}

    async def publish(
        self,
        session: AsyncSession,
        organization: Organization,
        live: Catalog | None,
        new_products: Mapping[str, Product],
        new_benefits: Mapping[str, Benefit],
        version_hash: str,
        removed: Collection[str],
        removed_benefits: Collection[str],
        name: str | None = None,
    ) -> Catalog:
        repository = CatalogRepository.from_session(session)
        await repository.lock(organization.id)
        products, benefits = await self._next_members(
            session,
            organization,
            live,
            new_products,
            new_benefits,
            removed,
            removed_benefits,
        )
        await self._replace_live(session, organization, live, products, benefits)
        catalog = await repository.create(
            Catalog(
                organization=organization,
                name=name
                if name is not None
                else await self.get_default_name(session, organization),
                version_hash=version_hash,
                parent=live,
                status=CatalogStatus.live,
                published_at=utc_now(),
            ),
            flush=True,
        )
        await self._add_members(session, catalog, products, benefits)
        return catalog

    async def save_draft(
        self,
        session: AsyncSession,
        organization: Organization,
        live: Catalog | None,
        new_products: Mapping[str, Product],
        new_benefits: Mapping[str, Benefit],
        version_hash: str,
        removed: Collection[str],
        removed_benefits: Collection[str],
        name: str | None = None,
    ) -> Catalog:
        """Make the organization's draft the next catalog these changes publish.

        The new rows aren't current, so live keeps selling until the draft is
        published. An existing draft is replaced, and keeps its ID: drafts are
        only created here, under the catalog lock, so an organization has at most
        one.
        """
        repository = CatalogRepository.from_session(session)
        await repository.lock(organization.id)
        products, benefits = await self._next_members(
            session,
            organization,
            live,
            new_products,
            new_benefits,
            removed,
            removed_benefits,
        )
        draft = await repository.get_draft(organization.id)
        if draft is None:
            draft = await repository.create(
                Catalog(organization=organization, status=CatalogStatus.draft),
                flush=True,
            )
        else:
            await self._clear_draft(session, draft)
        await repository.update(
            draft,
            update_dict={
                "name": name,
                "version_hash": version_hash,
                "parent": live,
            },
            flush=True,
        )
        await self._add_members(session, draft, products, benefits)
        return draft

    async def discard_draft(self, session: AsyncSession, draft: Catalog) -> None:
        repository = CatalogRepository.from_session(session)
        await repository.lock(draft.organization_id)
        await self._clear_draft(session, draft)
        # A later draft or publish may reach the same contents and hash.
        await repository.update(draft, update_dict={"version_hash": None})
        await repository.soft_delete(draft, flush=True)

    async def publish_draft(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        organization: Organization,
        draft: Catalog,
    ) -> Catalog:
        """Make the draft live: its new rows become current, the live rows it
        replaces or leaves out stop being current, and checkout links follow
        the new product rows.

        A draft that changes benefits also needs `benefits:write`, as applying
        them does."""
        repository = CatalogRepository.from_session(session)
        await repository.lock(organization.id)
        await self._assert_still_draft(session, draft)
        live = await repository.get_live(organization.id)

        products = {
            member.external_id: member.product
            for member in await CatalogProductRepository.from_session(
                session
            ).get_all_by_catalog(draft.id)
        }
        benefits = await self.get_catalog_benefits(session, organization, draft)
        live_benefits = await self.get_catalog_benefits(session, organization, live)
        if (
            _benefit_ids(benefits) != _benefit_ids(live_benefits)
            and Scope.benefits_write not in auth_subject.scopes
        ):
            raise InsufficientScopeError({str(Scope.benefits_write)})
        await self._replace_live(session, organization, live, products, benefits)
        product_repository = ProductRepository.from_session(session)
        for product in products.values():
            if product.catalog_id == draft.id:
                await product_repository.update(
                    product, update_dict={"is_current": True}, flush=True
                )
        benefit_repository = BenefitRepository.from_session(session)
        for benefit in benefits.values():
            if benefit.catalog_id == draft.id:
                await benefit_repository.update(
                    benefit, update_dict={"is_current": True}, flush=True
                )
        return await repository.update(
            draft,
            update_dict={
                "status": CatalogStatus.live,
                "published_at": utc_now(),
                "name": draft.name
                or await self.get_default_name(session, organization),
            },
            flush=True,
        )

    async def _replace_live(
        self,
        session: AsyncSession,
        organization: Organization,
        live: Catalog | None,
        products: Mapping[str, Product],
        benefits: Mapping[str, Benefit],
    ) -> None:
        replaced = await self._retire(session, organization, live, products, benefits)
        await self._repoint_checkout_links(session, replaced)
        if live is not None:
            await CatalogRepository.from_session(session).update(
                live, update_dict={"status": CatalogStatus.archived}, flush=True
            )

    async def _retire(
        self,
        session: AsyncSession,
        organization: Organization,
        live: Catalog | None,
        products: Mapping[str, Product],
        benefits: Mapping[str, Benefit],
    ) -> Sequence[tuple[Product, Product]]:
        """Stop selling the live rows the next catalog replaces or leaves out.
        Return the replaced products with their replacement."""
        if live is None:
            return ()
        replaced: builtins.list[tuple[Product, Product]] = []
        product_repository = ProductRepository.from_session(session)
        for member in await CatalogProductRepository.from_session(
            session
        ).get_all_by_catalog(live.id):
            product = products.get(member.external_id)
            if product is not None and product.id == member.product_id:
                continue
            await product_repository.update(
                member.product, update_dict={"is_current": False}, flush=True
            )
            if product is not None:
                replaced.append((member.product, product))
        benefit_repository = BenefitRepository.from_session(session)
        for external_id, benefit in (
            await self.get_catalog_benefits(session, organization, live)
        ).items():
            next_benefit = benefits.get(external_id)
            if next_benefit is not None and next_benefit.id == benefit.id:
                continue
            await benefit_repository.update(
                benefit, update_dict={"is_current": False}, flush=True
            )
        return replaced

    async def _repoint_checkout_links(
        self, session: AsyncSession, replaced: Sequence[tuple[Product, Product]]
    ) -> None:
        """Point checkout links at the new version. Discounts restricted to a
        product already cover all its versions."""
        checkout_link_repository = CheckoutLinkRepository.from_session(session)
        for previous, product in replaced:
            await checkout_link_repository.replace_product(previous.id, product.id)

    async def _assert_still_draft(self, session: AsyncSession, draft: Catalog) -> None:
        """Re-read the draft under the catalog lock: a concurrent publish or
        discard may have committed since it was loaded."""
        await CatalogRepository.from_session(session).refresh(draft)
        if draft.status != CatalogStatus.draft or draft.deleted_at is not None:
            raise CatalogNotDraft(draft.id)

    async def _clear_draft(self, session: AsyncSession, draft: Catalog) -> None:
        """Delete the draft's memberships and the rows only it lists."""
        catalog_product_repository = CatalogProductRepository.from_session(session)
        product_repository = ProductRepository.from_session(session)
        for member in await catalog_product_repository.get_all_by_catalog(draft.id):
            if member.product.catalog_id == draft.id:
                await product_repository.soft_delete(member.product)
        catalog_benefit_repository = CatalogBenefitRepository.from_session(session)
        benefit_repository = BenefitRepository.from_session(session)
        for benefit_member in await catalog_benefit_repository.get_all_by_catalog(
            draft.id
        ):
            if benefit_member.benefit.catalog_id == draft.id:
                await benefit_repository.soft_delete(benefit_member.benefit)
        await catalog_product_repository.delete_by_catalog(draft.id)
        await catalog_benefit_repository.delete_by_catalog(draft.id)

    async def _add_members(
        self,
        session: AsyncSession,
        catalog: Catalog,
        products: Mapping[str, Product],
        benefits: Mapping[str, Benefit],
    ) -> None:
        """Make the catalog list these rows. Rows not in a catalog yet were
        created in it."""
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
