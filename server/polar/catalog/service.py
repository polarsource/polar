import builtins
import hashlib
import json
import uuid
from collections import defaultdict
from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import selectinload

from polar.auth.models import Agent, AuthSubject, User
from polar.auth.permission import OrganizationPermission
from polar.auth.scope import Scope
from polar.authz.service import get_accessible_org_ids
from polar.authz.types import AccessibleOrganizationID
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.repository import BenefitRepository
from polar.checkout_link.repository import CheckoutLinkRepository
from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.meter.repository import MeterRepository
from polar.meter.service import meter as meter_service
from polar.models import (
    Benefit,
    Catalog,
    CatalogBenefit,
    CatalogMeter,
    CatalogProduct,
    Meter,
    Organization,
    Product,
    ProductCustomField,
    ProductMedia,
)
from polar.models.catalog import CatalogStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.oauth2.exceptions import InsufficientScopeError
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository
from polar.product.service import product as product_service
from polar.webhook.service import webhook as webhook_service

from .repository import (
    CatalogBenefitRepository,
    CatalogMembership,
    CatalogMeterRepository,
    CatalogProductRepository,
    CatalogRepository,
)
from .schemas import (
    CatalogChanges,
    RemovedCatalogItem,
    RemovedCatalogItemResource,
    RemovedCatalogItemStatus,
    RemovedCatalogItemVersion,
)


@dataclass
class CatalogEntries:
    """A catalog's contents by `external_id`. Products, benefits and meters
    have separate `external_id` namespaces."""

    products: dict[str, str] = field(default_factory=dict)
    benefits: dict[str, str] = field(default_factory=dict)
    meters: dict[str, str] = field(default_factory=dict)

    def __bool__(self) -> bool:
        return bool(self.products or self.benefits or self.meters)

    def updated(
        self, definitions: "CatalogEntries", removed: "CatalogRemovals"
    ) -> "CatalogEntries":
        return CatalogEntries(
            products={
                **{k: v for k, v in self.products.items() if k not in removed.products},
                **definitions.products,
            },
            benefits={
                **{k: v for k, v in self.benefits.items() if k not in removed.benefits},
                **definitions.benefits,
            },
            meters={
                **{k: v for k, v in self.meters.items() if k not in removed.meters},
                **definitions.meters,
            },
        )


@dataclass(frozen=True)
class CatalogRemovals:
    """The `external_id`s leaving the catalog."""

    products: Collection[str] = ()
    benefits: Collection[str] = ()
    meters: Collection[str] = ()

    def __bool__(self) -> bool:
        return bool(self.products or self.benefits or self.meters)


def compute_version_hash(
    parent_hash: str | None,
    entries: Mapping[str, str],
    benefits: Mapping[str, str] | None = None,
    meters: Mapping[str, str] | None = None,
) -> str:
    """Hash a catalog like a git commit: its parent's version hash, plus what it contains."""
    lines = [
        parent_hash or "",
        *(f"{key}={value}" for key, value in sorted(entries.items())),
    ]
    if benefits:
        lines.append(json.dumps({"benefits": benefits}, sort_keys=True))
    if meters:
        lines.append(json.dumps({"meters": meters}, sort_keys=True))
    return hashlib.sha256("\n".join(lines).encode()).hexdigest()


def hash_entries(parent_hash: str | None, entries: CatalogEntries) -> str:
    return compute_version_hash(
        parent_hash, entries.products, entries.benefits, entries.meters
    )


def _ids(rows: Mapping[str, Benefit | Meter]) -> dict[str, uuid.UUID]:
    return {external_id: row.id for external_id, row in rows.items()}


@dataclass
class CatalogMembers:
    products: dict[str, Product] = field(default_factory=dict)
    benefits: dict[str, Benefit] = field(default_factory=dict)
    meters: dict[str, Meter] = field(default_factory=dict)


@dataclass
class _RemovedMembership:
    first: int
    last: int
    membership: CatalogMembership


def _removed_memberships(
    catalogs: Sequence[Catalog], memberships: Sequence[CatalogMembership]
) -> dict[str, _RemovedMembership]:
    """Keys listed by a published catalog but not by the live one, the last of
    `catalogs`, with the positions of the first and last catalogs that list them."""
    positions = {catalog.id: position for position, catalog in enumerate(catalogs)}
    live = len(catalogs) - 1
    removed: dict[str, _RemovedMembership] = {}
    for membership in memberships:
        position = positions[membership.catalog_id]
        entry = removed.setdefault(
            membership.external_id, _RemovedMembership(position, position, membership)
        )
        entry.first = min(entry.first, position)
        if position >= entry.last:
            entry.last = position
            entry.membership = membership
    return {key: entry for key, entry in removed.items() if entry.last != live}


def _removed_items(
    resource: RemovedCatalogItemResource,
    catalogs: Sequence[Catalog],
    removed: Mapping[str, _RemovedMembership],
    customers: Mapping[str, int],
) -> list[RemovedCatalogItem]:
    items: list[RemovedCatalogItem] = []
    for external_id, entry in removed.items():
        customers_count = customers.get(external_id, 0)
        items.append(
            RemovedCatalogItem(
                resource=resource,
                external_id=external_id,
                name=entry.membership.name,
                status=RemovedCatalogItemStatus.deprecated
                if customers_count
                else RemovedCatalogItemStatus.removed,
                customers_count=customers_count,
                last_item_id=entry.membership.item_id,
                first_catalog=RemovedCatalogItemVersion.model_validate(
                    catalogs[entry.first]
                ),
                last_catalog=RemovedCatalogItemVersion.model_validate(
                    catalogs[entry.last]
                ),
                removed_in_catalog=RemovedCatalogItemVersion.model_validate(
                    catalogs[entry.last + 1]
                ),
            )
        )
    return items


CatalogKeys = Mapping[tuple[RemovedCatalogItemResource, str], uuid.UUID]


def _catalog_changes(
    catalog: Catalog,
    members: Mapping[uuid.UUID, CatalogKeys],
) -> CatalogChanges | None:
    """Compare a catalog's keys with its parent's: a key listing another item
    is a new version of it."""
    if catalog.parent_id is None:
        return None
    before = members.get(catalog.parent_id, {})
    after = members.get(catalog.id, {})
    return CatalogChanges(
        added_count=len(after.keys() - before.keys()),
        changed_count=sum(
            before[key] != item_id for key, item_id in after.items() if key in before
        ),
        removed_count=len(before.keys() - after.keys()),
    )


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
                selectinload(Catalog.meter_members),
            )
        )
        return await repository.get_one_or_none(statement)

    async def get_changes(
        self, session: AsyncReadSession, catalogs: Sequence[Catalog]
    ) -> dict[uuid.UUID, CatalogChanges | None]:
        catalog_ids = builtins.list(
            {catalog.id for catalog in catalogs}
            | {catalog.parent_id for catalog in catalogs if catalog.parent_id}
        )
        members: defaultdict[
            uuid.UUID, dict[tuple[RemovedCatalogItemResource, str], uuid.UUID]
        ] = defaultdict(dict)
        for resource, memberships in (
            (
                RemovedCatalogItemResource.product,
                await CatalogProductRepository.from_session(session).get_memberships(
                    catalog_ids
                ),
            ),
            (
                RemovedCatalogItemResource.benefit,
                await CatalogBenefitRepository.from_session(session).get_memberships(
                    catalog_ids
                ),
            ),
            (
                RemovedCatalogItemResource.meter,
                await CatalogMeterRepository.from_session(session).get_memberships(
                    catalog_ids
                ),
            ),
        ):
            for membership in memberships:
                members[membership.catalog_id][(resource, membership.external_id)] = (
                    membership.item_id
                )
        return {catalog.id: _catalog_changes(catalog, members) for catalog in catalogs}

    async def list_removed(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization | Agent],
        organization_id: uuid.UUID,
    ) -> builtins.list[RemovedCatalogItem]:
        if organization_id not in await self._get_readable_org_ids(
            session, auth_subject
        ):
            return []
        catalogs = await CatalogRepository.from_session(session).get_published(
            organization_id
        )
        if not catalogs or catalogs[-1].status != CatalogStatus.live:
            return []
        catalog_ids = [catalog.id for catalog in catalogs]

        products = _removed_memberships(
            catalogs,
            await CatalogProductRepository.from_session(session).get_memberships(
                catalog_ids
            ),
        )
        product_customers = await ProductRepository.from_session(
            session
        ).count_customers_by_external_ids(organization_id, builtins.list(products))
        benefits = _removed_memberships(
            catalogs,
            await CatalogBenefitRepository.from_session(session).get_memberships(
                catalog_ids
            ),
        )
        benefit_customers = await BenefitGrantRepository.from_session(
            session
        ).count_granted_customers_by_benefit_external_ids(
            organization_id, builtins.list(benefits)
        )
        meters = _removed_memberships(
            catalogs,
            await CatalogMeterRepository.from_session(session).get_memberships(
                catalog_ids
            ),
        )
        meter_customers = await MeterRepository.from_session(
            session
        ).count_billed_customers_by_external_ids(organization_id, builtins.list(meters))

        return sorted(
            [
                *_removed_items(
                    RemovedCatalogItemResource.product,
                    catalogs,
                    products,
                    product_customers,
                ),
                *_removed_items(
                    RemovedCatalogItemResource.benefit,
                    catalogs,
                    benefits,
                    benefit_customers,
                ),
                *_removed_items(
                    RemovedCatalogItemResource.meter,
                    catalogs,
                    meters,
                    meter_customers,
                ),
            ],
            key=lambda item: (
                -item.removed_in_catalog.published_at.timestamp(),
                item.external_id,
            ),
        )

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

    async def lists_meters(self, session: AsyncReadSession, catalog: Catalog) -> bool:
        """Whether the catalog records its meters, as `lists_benefits` does for
        benefits. A draft without meters that was saved before the first catalog
        listing meters was published predates meter versioning, and keeps the
        live meters."""
        repository = CatalogMeterRepository.from_session(session)
        first = await repository.get_first_published_at(catalog.organization_id)
        if catalog.status == CatalogStatus.draft:
            saved_at = catalog.modified_at or catalog.created_at
            return (
                first is not None and first <= saved_at
            ) or await repository.has_members(catalog.id)
        return first is not None and (
            catalog.published_at is None or catalog.published_at >= first
        )

    async def get_catalog_meters(
        self,
        session: AsyncReadSession,
        organization: Organization,
        catalog: Catalog | None,
    ) -> dict[str, Meter]:
        """Meters of a catalog, by `external_id`.

        A catalog published before meters were versioned has the current
        meters, as does no catalog before the first publish.
        """
        if catalog is not None and await self.lists_meters(session, catalog):
            return {
                member.external_id: member.meter
                for member in await CatalogMeterRepository.from_session(
                    session
                ).get_all_by_catalog(catalog.id)
            }
        return {
            meter.external_id: meter
            for meter in await MeterRepository.from_session(
                session
            ).get_catalog_baseline(organization.id)
            if meter.external_id is not None
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
            meters={
                external_id: str(meter.id)
                for external_id, meter in (
                    await self.get_catalog_meters(session, organization, live)
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
        removed: CatalogRemovals,
    ) -> tuple[str | None, str | None]:
        """Return the live version hash, and the version hash of the catalog these
        new definitions, without the removed entries, would publish."""
        before, entries = await self.get_live_entries(session, organization, live)
        if not definitions and not removed:
            return before, before
        return before, hash_entries(before, entries.updated(definitions, removed))

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
        meters = await self.get_catalog_meters(session, organization, None)

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
            CatalogMembers(
                products={
                    product.external_id: product
                    for product in products
                    if product.external_id is not None
                },
                benefits=benefits,
                meters=meters,
            ),
        )
        return catalog

    async def _next_members(
        self,
        session: AsyncReadSession,
        organization: Organization,
        live: Catalog | None,
        new: CatalogMembers,
        removed: CatalogRemovals,
    ) -> CatalogMembers:
        members = await self._get_members(session, organization, live)
        for external_id in removed.products:
            members.products.pop(external_id)
        for external_id in removed.benefits:
            members.benefits.pop(external_id)
        for external_id in removed.meters:
            members.meters.pop(external_id)
        return CatalogMembers(
            products={**members.products, **new.products},
            benefits={**members.benefits, **new.benefits},
            meters={**members.meters, **new.meters},
        )

    async def _get_members(
        self,
        session: AsyncReadSession,
        organization: Organization,
        catalog: Catalog | None,
    ) -> CatalogMembers:
        return CatalogMembers(
            products={}
            if catalog is None
            else {
                member.external_id: member.product
                for member in await CatalogProductRepository.from_session(
                    session
                ).get_all_by_catalog(catalog.id)
            },
            benefits=await self.get_catalog_benefits(session, organization, catalog),
            meters=await self.get_catalog_meters(session, organization, catalog),
        )

    async def publish(
        self,
        session: AsyncSession,
        organization: Organization,
        live: Catalog | None,
        new: CatalogMembers,
        version_hash: str,
        removed: CatalogRemovals,
        name: str | None = None,
    ) -> Catalog:
        repository = CatalogRepository.from_session(session)
        await repository.lock(organization.id)
        members = await self._next_members(session, organization, live, new, removed)
        await self._replace_live(session, organization, live, members)
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
        await self._add_members(session, catalog, members)
        return catalog

    async def save_draft(
        self,
        session: AsyncSession,
        organization: Organization,
        live: Catalog | None,
        new: CatalogMembers,
        version_hash: str,
        removed: CatalogRemovals,
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
        members = await self._next_members(session, organization, live, new, removed)
        draft = await repository.get_draft(organization.id)
        if draft is None:
            draft = await repository.create(
                Catalog(organization=organization, status=CatalogStatus.draft),
                flush=True,
            )
        else:
            await self._clear_draft(
                session,
                draft,
                keep={
                    *(product.id for product in members.products.values()),
                    *(benefit.id for benefit in members.benefits.values()),
                    *(meter.id for meter in members.meters.values()),
                },
            )
        await repository.update(
            draft,
            update_dict={
                "name": name,
                "version_hash": version_hash,
                "parent": live,
            },
            flush=True,
        )
        await self._add_members(session, draft, members)
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
        the new product rows. Its new meters start matching events.

        A draft that changes benefits or meters also needs `benefits:write` or
        `meters:write`, as applying them does."""
        repository = CatalogRepository.from_session(session)
        await repository.lock(organization.id)
        await self._assert_still_draft(session, draft)
        live = await repository.get_live(organization.id)

        members = await self._get_members(session, organization, draft)
        live_members = await self._get_members(session, organization, live)
        for scope, rows, live_rows in (
            (Scope.benefits_write, members.benefits, live_members.benefits),
            (Scope.meters_write, members.meters, live_members.meters),
        ):
            if _ids(rows) != _ids(live_rows) and scope not in auth_subject.scopes:
                raise InsufficientScopeError({str(scope)})
        await self._replace_live(session, organization, live, members)
        product_repository = ProductRepository.from_session(session)
        for product in members.products.values():
            if product.catalog_id == draft.id:
                await product_repository.update(
                    product, update_dict={"is_current": True}, flush=True
                )
        benefit_repository = BenefitRepository.from_session(session)
        for benefit in members.benefits.values():
            if benefit.catalog_id == draft.id:
                await benefit_repository.update(
                    benefit, update_dict={"is_current": True}, flush=True
                )
        meter_repository = MeterRepository.from_session(session)
        for meter in members.meters.values():
            if meter.catalog_id == draft.id:
                await meter_repository.update(
                    meter, update_dict={"is_current": True}, flush=True
                )
                await meter_service.activate(session, meter)
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
        members: CatalogMembers,
    ) -> None:
        replaced = await self._retire(session, organization, live, members)
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
        members: CatalogMembers,
    ) -> Sequence[tuple[Product, Product]]:
        """Stop selling the live rows the next catalog replaces or leaves out.
        Return the replaced products with their replacement.

        Send `product.updated` and `benefit.updated` for the rows this retires.
        Apply already retired, and announced, the rows it replaced."""
        if live is None:
            return ()
        replaced: builtins.list[tuple[Product, Product]] = []
        product_repository = ProductRepository.from_session(session)
        for member in await CatalogProductRepository.from_session(
            session
        ).get_all_by_catalog(live.id):
            product = members.products.get(member.external_id)
            if product is not None and product.id == member.product_id:
                continue
            was_current = member.product.is_current
            await product_repository.update(
                member.product, update_dict={"is_current": False}, flush=True
            )
            if was_current:
                await product_service.notify_retired(session, member.product)
            if product is not None:
                replaced.append((member.product, product))
        benefit_repository = BenefitRepository.from_session(session)
        for external_id, benefit in (
            await self.get_catalog_benefits(session, organization, live)
        ).items():
            next_benefit = members.benefits.get(external_id)
            if next_benefit is not None and next_benefit.id == benefit.id:
                continue
            was_current = benefit.is_current
            await benefit_repository.update(
                benefit, update_dict={"is_current": False}, flush=True
            )
            if was_current:
                await webhook_service.send(
                    session, organization, WebhookEventType.benefit_updated, benefit
                )
        meter_repository = MeterRepository.from_session(session)
        for external_id, meter in (
            await self.get_catalog_meters(session, organization, live)
        ).items():
            next_meter = members.meters.get(external_id)
            if next_meter is not None and next_meter.id == meter.id:
                continue
            await meter_repository.update(
                meter, update_dict={"is_current": False}, flush=True
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

    async def _clear_draft(
        self,
        session: AsyncSession,
        draft: Catalog,
        keep: Collection[uuid.UUID] = (),
    ) -> None:
        """Delete the draft's memberships and the rows only it lists, except
        the rows in `keep`, which the next draft lists again."""
        catalog_product_repository = CatalogProductRepository.from_session(session)
        product_repository = ProductRepository.from_session(session)
        for member in await catalog_product_repository.get_all_by_catalog(draft.id):
            if member.product.catalog_id == draft.id and member.product_id not in keep:
                await product_repository.soft_delete(member.product)
        catalog_benefit_repository = CatalogBenefitRepository.from_session(session)
        benefit_repository = BenefitRepository.from_session(session)
        for benefit_member in await catalog_benefit_repository.get_all_by_catalog(
            draft.id
        ):
            if (
                benefit_member.benefit.catalog_id == draft.id
                and benefit_member.benefit_id not in keep
            ):
                await benefit_repository.soft_delete(benefit_member.benefit)
        catalog_meter_repository = CatalogMeterRepository.from_session(session)
        meter_repository = MeterRepository.from_session(session)
        for meter_member in await catalog_meter_repository.get_all_by_catalog(draft.id):
            if (
                meter_member.meter.catalog_id == draft.id
                and meter_member.meter_id not in keep
            ):
                await meter_repository.update(
                    meter_member.meter, update_dict={"deleted_at": utc_now()}
                )
        await catalog_product_repository.delete_by_catalog(draft.id)
        await catalog_benefit_repository.delete_by_catalog(draft.id)
        await catalog_meter_repository.delete_by_catalog(draft.id)

    async def _add_members(
        self, session: AsyncSession, catalog: Catalog, members: CatalogMembers
    ) -> None:
        """Make the catalog list these rows. Rows not in a catalog yet were
        created in it."""
        catalog_product_repository = CatalogProductRepository.from_session(session)
        for external_id, product in members.products.items():
            if product.catalog_id is None:
                product.catalog = catalog
            await catalog_product_repository.create(
                CatalogProduct(
                    catalog=catalog, product=product, external_id=external_id
                )
            )
        catalog_benefit_repository = CatalogBenefitRepository.from_session(session)
        for external_id, benefit in members.benefits.items():
            if benefit.catalog_id is None:
                benefit.catalog = catalog
            await catalog_benefit_repository.create(
                CatalogBenefit(
                    catalog=catalog, benefit=benefit, external_id=external_id
                )
            )
        catalog_meter_repository = CatalogMeterRepository.from_session(session)
        for external_id, meter in members.meters.items():
            # A draft lists the live meters too: only its new versions belong to it.
            if meter.catalog_id is None and (
                catalog.status != CatalogStatus.draft or not meter.is_current
            ):
                meter.catalog = catalog
            await catalog_meter_repository.create(
                CatalogMeter(catalog=catalog, meter=meter, external_id=external_id)
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
