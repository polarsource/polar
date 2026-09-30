"""Imports the staged catalog into Polar (the `create_catalog` step).
Idempotent; subscriptions are created later, during cutover.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, TypeVar
from uuid import UUID

from polar.auth.models import AuthSubject
from polar.customer.repository import CustomerRepository
from polar.customer.service import customer as customer_service
from polar.discount.repository import DiscountRepository
from polar.discount.schemas import DiscountFixedCreate, DiscountPercentageCreate
from polar.discount.service import discount as discount_service
from polar.enums import SubscriptionRecurringInterval
from polar.kit.address import Address, CountryAlpha2
from polar.kit.currency import PresentmentCurrency
from polar.kit.db.postgres import AsyncSession
from polar.models import (
    Customer,
    Discount,
    DiscountProduct,
    MerchantMigration,
    MerchantMigrationRecord,
    Organization,
    Product,
    Subscription,
    User,
)
from polar.models.discount import DiscountDuration
from polar.models.merchant_migration import MerchantMigrationSourcePlatform
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceFixed,
    ProductPriceSource,
)
from polar.product.repository import ProductPriceRepository, ProductRepository
from polar.product.schemas import (
    ProductCreateRecurring,
    ProductPriceCreate,
    ProductPriceFixedCreate,
)
from polar.product.service import product as product_service
from polar.subscription.service import subscription as subscription_service

from .canonical import (
    CanonicalCustomer,
    CanonicalDiscount,
    CanonicalDiscountType,
    CanonicalProduct,
    CanonicalSubscription,
    PriceKey,
    canonical_price_key,
    customer_country_fallbacks,
    deserialize,
    polar_discount_amounts,
    subscription_price_key,
)
from .precheck import (
    ProductImportPlan,
    Reason,
    archived_price_keys,
    imports_archived,
    plan_customer_imports,
    plan_discount_imports,
    plan_product_imports,
    plan_subscription_imports,
    stripe_id_conflict_reason,
)
from .repository import MerchantMigrationRecordRepository
from .schemas import (
    MerchantMigrationImportReport,
    MerchantMigrationImportResult,
    PrecheckEntity,
)

_CanonicalT = TypeVar("_CanonicalT")

IMPORT_BATCH_SIZE = 100

_DEPENDENCY_CODE = "subscription_dependency_not_imported"
_PRICES_ALREADY_IMPORTED = Reason(
    "product_prices_already_imported",
    "Its prices are already on a product imported earlier, so it isn't imported again.",
)
_CUSTOMER_ALREADY_SUBSCRIBED = Reason(
    _DEPENDENCY_CODE,
    "This customer already has a live subscription to the product on Polar, so a "
    "duplicate isn't created. It stays on the source.",
)


def _price_keys(record: MerchantMigrationRecord) -> list[PriceKey]:
    product = deserialize(record.type, record.canonical)
    assert isinstance(product, CanonicalProduct)
    return [canonical_price_key(price) for price in product.prices]


def _price_owners(
    product_records: Sequence[MerchantMigrationRecord],
) -> dict[PriceKey, MerchantMigrationRecord]:
    """The row each price resolves to. A row staged before inactive prices
    joined their product's row can hold one on an `:archived` sibling row too.
    Imported rows win, the oldest first, in the cutover lookup's order; a
    skipped or failed row never takes a price from a pending one."""
    owners = {
        key: record
        for record in product_records
        if record.status == MerchantMigrationRecordStatus.pending
        for key in _price_keys(record)
    }
    imported: dict[PriceKey, MerchantMigrationRecord] = {}
    for record in sorted(
        (
            record
            for record in product_records
            if record.status == MerchantMigrationRecordStatus.imported
        ),
        key=lambda record: (record.created_at, record.id),
    ):
        for key in _price_keys(record):
            imported.setdefault(key, record)
    return owners | imported


def _covered_source_ids(
    product_records: Sequence[MerchantMigrationRecord],
    owners: dict[PriceKey, MerchantMigrationRecord],
) -> set[str]:
    """Pending rows whose every price resolves to an imported row. Left
    pending, they would hold back coupons restricted to their product."""
    covered: set[str] = set()
    for record in product_records:
        if record.status != MerchantMigrationRecordStatus.pending:
            continue
        keys = _price_keys(record)
        if keys and all(
            owners[key].status == MerchantMigrationRecordStatus.imported for key in keys
        ):
            covered.add(record.source_id)
    return covered


def _polar_product_ids_by_source(
    product_records: Sequence[MerchantMigrationRecord],
    products: Sequence[CanonicalProduct],
) -> dict[str, list[UUID]]:
    ids_by_source: dict[str, list[UUID]] = {}
    for record, product in zip(product_records, products, strict=True):
        if (
            record.status == MerchantMigrationRecordStatus.imported
            and record.target_id is not None
        ):
            ids_by_source.setdefault(product.product_source_id, []).append(
                record.target_id
            )
    return ids_by_source


def _polar_product_ids(
    discount: CanonicalDiscount, ids_by_source: dict[str, list[UUID]]
) -> list[UUID]:
    return [
        product_id
        for product_source_id in discount.product_source_ids or []
        for product_id in ids_by_source.get(product_source_id, [])
    ]


def find_imported_price(
    product: Product,
    canonical_product: CanonicalProduct,
    subscription: CanonicalSubscription,
) -> ProductPriceFixed | None:
    key = subscription_price_key(subscription)
    if key is None:
        return None
    canonical_price = next(
        (
            price
            for price in canonical_product.prices
            if canonical_price_key(price) == key
        ),
        None,
    )
    if canonical_price is None:
        return None
    currency = canonical_price.currency.lower()
    # Only the subscriber's own amount, so moving never changes what they pay.
    return next(
        (
            price
            for price in sorted(product.all_prices, key=lambda p: p.is_archived)
            if isinstance(price, ProductPriceFixed)
            and price.source == ProductPriceSource.catalog
            and price.price_currency == currency
            and price.price_amount == canonical_price.amount
        ),
        None,
    )


async def create_imported_subscription(
    session: AsyncSession,
    subscription: CanonicalSubscription,
    product: Product,
    price: ProductPriceFixed,
    customer: Customer,
    *,
    provider: str,
    discount: Discount | None = None,
) -> Subscription:
    applied_at = subscription.discount_started_at
    return await subscription_service.create_imported(
        session,
        product=product,
        price=price,
        customer=customer,
        current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end,
        anchor_day=subscription.anchor_day,
        user_metadata={
            "provider": provider,
            "provider_subscription_id": subscription.source_id,
        },
        tax_behavior=subscription.import_tax_behavior(),
        tax_exempted=False,
        discount=discount,
        discount_applied_at=applied_at if discount is not None else None,
    )


@dataclass
class ImportCounts:
    imported: int = 0
    skipped: int = 0

    def settle(self, status: MerchantMigrationRecordStatus) -> None:
        """Carry over a row a previous run already decided."""
        if status == MerchantMigrationRecordStatus.imported:
            self.imported += 1
        else:
            self.skipped += 1


@dataclass(frozen=True)
class _ImportContext:
    catalog: list[MerchantMigrationRecord]
    product_records: list[MerchantMigrationRecord]
    customer_records: list[MerchantMigrationRecord]
    discount_records: list[MerchantMigrationRecord]
    product_source_ids: set[str]
    covered_product_source_ids: set[str]
    customer_source_ids: set[str]
    country_fallbacks: dict[str, str]


@dataclass(frozen=True)
class ImportedCustomer:
    """The Polar customer to use, or why the record is skipped."""

    customer: Customer | None = None
    skip: Reason | None = None


class CatalogImporter:
    def __init__(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        organization: Organization,
        auth_subject: AuthSubject[User | Organization],
        *,
        record_ids: set[UUID] | None = None,
        exclude_record_ids: set[UUID] | None = None,
    ) -> None:
        self.session = session
        self.migration = migration
        self.organization = organization
        self.auth_subject = auth_subject
        # Neither set imports everything; excluding is the opt-out default for
        # large catalogs.
        self.record_ids = record_ids
        self.exclude_record_ids = exclude_record_ids
        self.record_repository = MerchantMigrationRecordRepository.from_session(session)
        self.customer_repository = CustomerRepository.from_session(session)

    async def import_next_batch(self) -> MerchantMigrationImportReport | None:
        """Import one batch, products then discounts then customers. None while
        records remain; the report once the pass is done.

        A phase that still has more than the remaining budget stops the task
        there. A restricted discount with none of its products on Polar yet,
        while one of them is still pending, stays pending and does not keep the
        pass open.
        """
        ctx = await self._load_context()
        # An empty selection only moves the migration on. Discounts and products
        # are imported regardless of which subscriptions are picked, so they'd
        # otherwise still land.
        if self.record_ids is not None and not self.record_ids:
            return self._report(ctx)
        budget = IMPORT_BATCH_SIZE
        catalog_products = self._records_of(
            ctx.catalog, MerchantMigrationRecordType.product
        )

        pending_products = self._pending_selected(
            ctx.product_records,
            ctx.product_source_ids | ctx.covered_product_source_ids,
        )
        if pending_products:
            batch = pending_products[:budget]
            await self._import_products(
                batch, covered_source_ids=ctx.covered_product_source_ids
            )
            await self._restrict_imported_discounts(
                self._records_of(ctx.catalog, MerchantMigrationRecordType.discount),
                product_records=catalog_products,
                new_product_ids={
                    record.target_id
                    for record in batch
                    if record.status == MerchantMigrationRecordStatus.imported
                    and record.target_id is not None
                },
            )
            budget -= len(batch)
            if budget == 0:
                return None

        actionable_discounts = self._actionable_discounts(
            ctx.discount_records, catalog_products
        )
        if actionable_discounts:
            batch = actionable_discounts[:budget]
            await self._import_discounts(batch, product_records=catalog_products)
            budget -= len(batch)
            if budget == 0:
                return None

        pending_customers = self._pending_selected(
            ctx.customer_records, ctx.customer_source_ids
        )
        if pending_customers:
            batch = pending_customers[:budget]
            await self._import_customers(batch, country_fallbacks=ctx.country_fallbacks)
            budget -= len(batch)
            if budget == 0:
                return None

        return self._report(ctx)

    def _report(self, ctx: _ImportContext) -> MerchantMigrationImportReport:
        return MerchantMigrationImportReport(
            step=self.migration.step,
            results=[
                self._tally(
                    ctx.product_records,
                    ctx.product_source_ids,
                    PrecheckEntity.products,
                ),
                self._tally(ctx.discount_records, None, PrecheckEntity.discounts),
                self._tally(
                    ctx.customer_records,
                    ctx.customer_source_ids,
                    PrecheckEntity.customers,
                ),
                MerchantMigrationImportResult(
                    entity=PrecheckEntity.subscriptions,
                    imported=0,
                    skipped=0,
                ),
            ],
        )

    def _tally(
        self,
        records: Sequence[MerchantMigrationRecord],
        source_ids: set[str] | None,
        entity: PrecheckEntity,
    ) -> MerchantMigrationImportResult:
        counts = ImportCounts()
        for record in records:
            if source_ids is not None and record.source_id not in source_ids:
                continue
            if record.status == MerchantMigrationRecordStatus.pending:
                continue
            counts.settle(record.status)
        return MerchantMigrationImportResult(
            entity=entity,
            imported=counts.imported,
            skipped=counts.skipped,
        )

    async def _load_context(self) -> _ImportContext:
        records = await self.record_repository.list_by_migration(self.migration.id)
        imported_dependencies = (
            await self.record_repository.list_imported_catalog_dependencies(
                self.organization.id
            )
        )
        catalog = self._catalog_with_imported_dependencies(
            records, imported_dependencies
        )
        product_records = self._records_of(records, MerchantMigrationRecordType.product)
        customer_records = self._records_of(
            records, MerchantMigrationRecordType.customer
        )
        discount_records = self._records_of(
            records, MerchantMigrationRecordType.discount
        )
        subscription_records = self._records_of(
            records, MerchantMigrationRecordType.subscription
        )

        catalog_products = self._records_of(
            catalog, MerchantMigrationRecordType.product
        )
        price_owners = _price_owners(catalog_products)
        product_source_ids, customer_source_ids = (
            self._selected_subscription_dependencies(
                subscription_records,
                catalog_products,
                self._records_of(catalog, MerchantMigrationRecordType.customer),
                self._records_of(catalog, MerchantMigrationRecordType.discount),
                price_owners,
            )
        )
        country_fallbacks = customer_country_fallbacks(
            [
                self._as(deserialize(record.type, record.canonical), CanonicalCustomer)
                for record in self._records_of(
                    catalog, MerchantMigrationRecordType.customer
                )
            ],
            [
                self._as(
                    deserialize(record.type, record.canonical), CanonicalSubscription
                )
                for record in subscription_records
            ],
        )
        return _ImportContext(
            catalog=catalog,
            product_records=product_records,
            customer_records=customer_records,
            discount_records=discount_records,
            product_source_ids=product_source_ids,
            covered_product_source_ids=_covered_source_ids(
                catalog_products, price_owners
            ),
            customer_source_ids=customer_source_ids,
            country_fallbacks=country_fallbacks,
        )

    @staticmethod
    def _catalog_with_imported_dependencies(
        records: Sequence[MerchantMigrationRecord],
        imported_dependencies: Sequence[MerchantMigrationRecord],
    ) -> list[MerchantMigrationRecord]:
        catalog = {
            (record.type, record.source_id): record for record in imported_dependencies
        }
        for record in records:
            catalog[(record.type, record.source_id)] = record
        return list(catalog.values())

    def _records_of(
        self,
        records: Sequence[MerchantMigrationRecord],
        type: MerchantMigrationRecordType,
    ) -> list[MerchantMigrationRecord]:
        return [record for record in records if record.type == type]

    def _is_subscription_selected(self, record: MerchantMigrationRecord) -> bool:
        if self.record_ids is not None:
            return record.id in self.record_ids
        if self.exclude_record_ids is not None:
            return record.id not in self.exclude_record_ids
        return True

    def _selected_subscription_dependencies(
        self,
        subscription_records: Sequence[MerchantMigrationRecord],
        product_records: Sequence[MerchantMigrationRecord],
        customer_records: Sequence[MerchantMigrationRecord],
        discount_records: Sequence[MerchantMigrationRecord],
        price_owners: dict[PriceKey, MerchantMigrationRecord],
    ) -> tuple[set[str], set[str]]:
        subscriptions = [
            self._as(deserialize(record.type, record.canonical), CanonicalSubscription)
            for record in subscription_records
        ]
        products = [
            self._as(deserialize(record.type, record.canonical), CanonicalProduct)
            for record in product_records
        ]
        customers = [
            self._as(deserialize(record.type, record.canonical), CanonicalCustomer)
            for record in customer_records
        ]
        discounts = [
            self._as(deserialize(record.type, record.canonical), CanonicalDiscount)
            for record in discount_records
        ]
        plans = plan_subscription_imports(
            subscriptions,
            products,
            customers,
            self.organization.default_presentment_currency,
            None,
            discounts,
        )
        product_source_ids: set[str] = set()
        customer_source_ids: set[str] = set()
        for record, subscription in zip(
            subscription_records, subscriptions, strict=True
        ):
            if (
                record.status != MerchantMigrationRecordStatus.pending
                or not self._is_subscription_selected(record)
                or plans[subscription.source_id] is not None
            ):
                continue
            customer_source_ids.add(subscription.customer_source_id)
            key = subscription_price_key(subscription)
            owner = price_owners.get(key) if key is not None else None
            if owner is not None:
                product_source_ids.add(owner.source_id)
        return product_source_ids, customer_source_ids

    @staticmethod
    def _pending_selected(
        records: Sequence[MerchantMigrationRecord], source_ids: set[str]
    ) -> list[MerchantMigrationRecord]:
        return [
            record
            for record in records
            if record.source_id in source_ids
            and record.status == MerchantMigrationRecordStatus.pending
        ]

    def _actionable_discounts(
        self,
        records: Sequence[MerchantMigrationRecord],
        product_records: Sequence[MerchantMigrationRecord],
    ) -> list[MerchantMigrationRecord]:
        """Pending discounts this pass can settle. A restricted one with none of
        its products on Polar yet stays out while any of them is still pending:
        importing it now would skip it for good."""
        discounts = [
            self._as(deserialize(record.type, record.canonical), CanonicalDiscount)
            for record in records
        ]
        products = [
            self._as(deserialize(record.type, record.canonical), CanonicalProduct)
            for record in product_records
        ]
        plans = plan_discount_imports(
            discounts, products, self.organization.default_presentment_currency
        )
        pending_product_source_ids = {
            product.product_source_id
            for record, product in zip(product_records, products, strict=True)
            if record.status == MerchantMigrationRecordStatus.pending
        }
        polar_product_ids_by_source = _polar_product_ids_by_source(
            product_records, products
        )
        actionable: list[MerchantMigrationRecord] = []
        for record, discount in zip(records, discounts, strict=True):
            if record.status != MerchantMigrationRecordStatus.pending:
                continue
            if plans[discount.source_id] is not None:
                actionable.append(record)
                continue
            if (
                discount.product_source_ids
                and not _polar_product_ids(discount, polar_product_ids_by_source)
                and any(
                    product_source_id in pending_product_source_ids
                    for product_source_id in discount.product_source_ids
                )
            ):
                continue
            actionable.append(record)
        return actionable

    async def _import_products(
        self,
        records: Sequence[MerchantMigrationRecord],
        *,
        covered_source_ids: set[str],
    ) -> None:
        products = [
            self._as(deserialize(record.type, record.canonical), CanonicalProduct)
            for record in records
        ]
        plans = plan_product_imports(
            products, self.organization.default_presentment_currency
        )
        for record, product in zip(records, products, strict=True):
            if record.source_id in covered_source_ids:
                await self._mark_skipped(record, _PRICES_ALREADY_IMPORTED)
                continue
            plan = plans[product.source_id]
            if plan.skip is not None:
                await self._mark_skipped(record, plan.skip)
                continue
            polar_product = await self._create_product(product, plan)
            await self._mark_imported(record, polar_product.id)

    async def _import_customers(
        self,
        records: Sequence[MerchantMigrationRecord],
        *,
        country_fallbacks: dict[str, str],
    ) -> None:
        customers = [
            self._as(deserialize(record.type, record.canonical), CanonicalCustomer)
            for record in records
        ]
        plans = plan_customer_imports(customers)
        for record, customer in zip(records, customers, strict=True):
            skip = plans[customer.source_id]
            if skip is not None:
                await self._mark_skipped(record, skip)
                continue
            result = await self._create_or_reuse_customer(
                customer, country_fallbacks.get(customer.source_id)
            )
            if result.skip is not None:
                await self._mark_skipped(record, result.skip)
                continue
            assert result.customer is not None
            await self._mark_imported(record, result.customer.id)

    async def _import_discounts(
        self,
        records: Sequence[MerchantMigrationRecord],
        *,
        product_records: Sequence[MerchantMigrationRecord],
    ) -> None:
        """Import coupons, restricted to the Polar products of their Stripe ones.

        A restricted coupon imports once any of its products is on Polar: waiting
        for every catalog row would wait forever on rows nothing selects, like a
        yearly price nobody is on.
        """
        discounts = [
            self._as(deserialize(record.type, record.canonical), CanonicalDiscount)
            for record in records
        ]
        products = [
            self._as(deserialize(record.type, record.canonical), CanonicalProduct)
            for record in product_records
        ]
        plans = plan_discount_imports(
            discounts, products, self.organization.default_presentment_currency
        )
        polar_product_ids_by_source = _polar_product_ids_by_source(
            product_records, products
        )
        for record, discount in zip(records, discounts, strict=True):
            skip = plans[discount.source_id]
            if skip is not None:
                await self._mark_skipped(record, skip)
                continue
            product_ids = _polar_product_ids(discount, polar_product_ids_by_source)
            if discount.product_source_ids and not product_ids:
                await self._mark_skipped(
                    record,
                    Reason(
                        "discount_products_not_importable",
                        (
                            f"Coupon '{discount.name}' only applies to products "
                            "that weren't imported, so it stays on the source."
                        ),
                    ),
                )
                continue
            polar_discount = await self._create_discount(discount, product_ids)
            await self._mark_imported(record, polar_discount.id)

    async def _restrict_imported_discounts(
        self,
        records: Sequence[MerchantMigrationRecord],
        *,
        product_records: Sequence[MerchantMigrationRecord],
        new_product_ids: set[UUID],
    ) -> None:
        """Rows imported later join a restricted coupon's products, even when an
        earlier migration imported the coupon."""
        if not new_product_ids:
            return
        polar_product_ids_by_source = _polar_product_ids_by_source(
            product_records,
            [
                self._as(deserialize(record.type, record.canonical), CanonicalProduct)
                for record in product_records
            ],
        )
        for record in records:
            if record.status != MerchantMigrationRecordStatus.imported:
                continue
            imported = self._as(
                deserialize(record.type, record.canonical), CanonicalDiscount
            )
            await self._restrict_to_new_products(
                record,
                [
                    product_id
                    for product_id in _polar_product_ids(
                        imported, polar_product_ids_by_source
                    )
                    if product_id in new_product_ids
                ],
            )

    async def _restrict_to_new_products(
        self, record: MerchantMigrationRecord, product_ids: list[UUID]
    ) -> None:
        if not product_ids or record.target_id is None:
            return
        discount = await DiscountRepository.from_session(self.session).get_by_id(
            record.target_id
        )
        # No products at all means every product: widening that would narrow it.
        if (
            discount is None
            or discount.deleted_at is not None
            or not discount.discount_products
        ):
            return
        attached = {link.product_id for link in discount.discount_products}
        missing = [id for id in product_ids if id not in attached]
        if not missing:
            return
        product_repository = ProductRepository.from_session(self.session)
        products = await product_repository.get_all(
            product_repository.get_base_statement().where(
                Product.id.in_(missing),
                Product.organization_id == self.organization.id,
            )
        )
        discount.discount_products.extend(
            DiscountProduct(product=product) for product in products
        )

    async def _create_product(
        self, product: CanonicalProduct, plan: ProductImportPlan
    ) -> Product:
        assert product.recurring_interval is not None
        default_currency = self.organization.default_presentment_currency
        archived_keys = archived_price_keys(product, default_currency)
        sold_amounts: dict[str, int] = {}
        archived_amounts: set[tuple[str, int]] = set()
        for price in product.prices:
            key = canonical_price_key(price)
            if key not in plan.importable_prices:
                continue
            assert price.amount is not None
            currency = price.currency.lower()
            if key in archived_keys:
                archived_amounts.add((currency, price.amount))
            else:
                sold_amounts.setdefault(currency, price.amount)
        prices: list[ProductPriceCreate] = [
            ProductPriceFixedCreate(
                amount_type=ProductPriceAmountType.fixed,
                price_amount=amount,
                price_currency=PresentmentCurrency(currency),
            )
            for currency, amount in sold_amounts.items()
        ]
        # A bulk import must not webhook or re-review the org for every product.
        # An organization token rejects an explicit organization_id.
        polar_product = await product_service.create(
            self.session,
            ProductCreateRecurring(
                name=product.name,
                organization_id=None,
                recurring_interval=SubscriptionRecurringInterval(
                    product.recurring_interval
                ),
                recurring_interval_count=product.recurring_interval_count,
                prices=prices,
            ),
            self.auth_subject,
            notify=False,
        )
        # The create schema allows one price per currency; the others only bill
        # the subscribers already on them, like a price replaced in the dashboard.
        price_repository = ProductPriceRepository.from_session(self.session)
        for currency, amount in archived_amounts:
            await price_repository.create(
                ProductPriceFixed(
                    product=polar_product,
                    price_currency=currency,
                    price_amount=amount,
                    is_archived=True,
                )
            )
        if imports_archived(product, default_currency):
            polar_product.is_archived = True
            await self.session.flush()
        return polar_product

    async def _create_discount(
        self, discount: CanonicalDiscount, product_ids: list[UUID]
    ) -> Discount:
        # Polar can't store the source's used count, so ``max_redemptions`` is
        # what's left. A spent code keeps its name at 0 left, which blocks it.
        exhausted = discount.max_redemptions == 0
        duration = DiscountDuration(discount.duration.value)
        shared: dict[str, Any] = {
            "name": discount.name,
            "code": await self._available_discount_code(discount.code),
            "duration": duration,
            "duration_in_months": (
                discount.duration_in_months
                if duration == DiscountDuration.repeating
                else None
            ),
            "ends_at": discount.ends_at,
            # The create schema rejects 0; it's set once the row exists.
            "max_redemptions": None if exhausted else discount.max_redemptions,
            "products": product_ids or None,
            # An organization token rejects an explicit organization_id.
            "organization_id": None,
            "metadata": {"stripe_coupon_id": discount.source_id},
        }
        create: DiscountFixedCreate | DiscountPercentageCreate
        if discount.discount_type == CanonicalDiscountType.percentage:
            assert discount.basis_points is not None
            create = DiscountPercentageCreate(
                basis_points=discount.basis_points, **shared
            )
        else:
            create = DiscountFixedCreate(
                amounts=polar_discount_amounts(discount.amounts), **shared
            )
        created = await discount_service.create(
            self.session, create, self.auth_subject, notify=False
        )
        if exhausted:
            created.max_redemptions = 0
        return created

    async def _available_discount_code(self, code: str | None) -> str | None:
        if code is None:
            return None
        existing = await discount_service.get_by_code_and_organization(
            self.session, code, self.organization, redeemable=False
        )
        return None if existing is not None else code

    async def _create_or_reuse_customer(
        self, customer: CanonicalCustomer, country_fallback: str | None
    ) -> ImportedCustomer:
        stripe_customer_id = self._stripe_customer_id(customer)
        existing = await self.customer_repository.get_by_email_and_organization(
            customer.email, self.organization.id
        )
        if existing is not None:
            # The PAN-copied card lands under the source `cus_…` id, and renewals
            # charge it through the customer's Stripe id, so the customer has to
            # move onto the source id. Only while nothing depends on its own.
            rebind = (
                stripe_customer_id is not None
                and existing.stripe_customer_id != stripe_customer_id
            )
            if rebind:
                identity = await self.customer_repository.get_bound_stripe_identity(
                    existing.id
                )
                if identity.stripe_customer_id is not None:
                    return ImportedCustomer(skip=stripe_id_conflict_reason(identity))
            updates: dict[str, object] = {}
            if rebind:
                updates["stripe_customer_id"] = stripe_customer_id
            address = self._billing_address(customer, country_fallback)
            if address is not None:
                if existing.billing_address is None:
                    updates["billing_address"] = address
                elif existing.billing_address.country is None:
                    updates["billing_address"] = existing.billing_address.model_copy(
                        update={"country": address.country}
                    )
            if updates:
                await self.customer_repository.update(existing, update_dict=updates)
            return ImportedCustomer(customer=existing)
        polar_customer = await customer_service.create_for_organization(
            self.session,
            self.organization,
            email=customer.email,
            name=customer.name,
            billing_address=self._billing_address(customer, country_fallback),
            stripe_customer_id=stripe_customer_id,
            tax_id=customer.tax_id,
        )
        return ImportedCustomer(customer=polar_customer)

    def _stripe_customer_id(self, customer: CanonicalCustomer) -> str | None:
        # PAN copy preserves the Stripe `cus_…` id; other providers have no
        # such concept.
        if self.migration.source_platform == MerchantMigrationSourcePlatform.stripe:
            return customer.source_id
        return None

    def _billing_address(
        self, customer: CanonicalCustomer, country_fallback: str | None
    ) -> Address | None:
        if customer.billing_address is not None:
            return customer.billing_address
        country_code = customer.country or country_fallback
        if not country_code:
            return None
        try:
            country = CountryAlpha2(country_code.upper())
        except ValueError:
            return None
        return Address(country=country)

    async def _mark_imported(
        self, record: MerchantMigrationRecord, target_id: UUID
    ) -> None:
        await self.record_repository.update(
            record,
            update_dict={
                "status": MerchantMigrationRecordStatus.imported,
                "target_id": target_id,
                "error": None,
            },
        )

    async def _mark_skipped(
        self, record: MerchantMigrationRecord, reason: Reason
    ) -> None:
        await self.record_repository.update(
            record,
            update_dict={
                "status": MerchantMigrationRecordStatus.skipped,
                "error": reason.message,
            },
        )

    def _as(self, record: object, expected: type[_CanonicalT]) -> _CanonicalT:
        assert isinstance(record, expected)
        return record
