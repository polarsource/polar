"""Imports the staged catalog into Polar (the `create_catalog` step).
Idempotent; migrated subscriptions arrive paused so nothing bills until cutover.
"""

from collections.abc import Sequence
from typing import TypeVar
from uuid import UUID

from sqlalchemy.orm import selectinload

from polar.customer.repository import CustomerRepository
from polar.customer.service import customer as customer_service
from polar.enums import SubscriptionRecurringInterval
from polar.kit.address import Address, CountryAlpha2
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    MerchantMigration,
    MerchantMigrationRecord,
    Organization,
    Product,
    Subscription,
    SubscriptionProductPrice,
)
from polar.models.merchant_migration import MerchantMigrationSourcePlatform
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)
from polar.models.product_price import ProductPriceFixed
from polar.models.subscription import SubscriptionStatus
from polar.product.repository import ProductRepository
from polar.subscription.repository import SubscriptionRepository

from .canonical import (
    CanonicalCustomer,
    CanonicalProduct,
    CanonicalSubscription,
    deserialize,
)
from .precheck import (
    ProductImportPlan,
    plan_customer_imports,
    plan_product_imports,
    plan_subscription_imports,
)
from .repository import MerchantMigrationRecordRepository
from .schemas import (
    MerchantMigrationImportReport,
    MerchantMigrationImportResult,
    PrecheckEntity,
)

_CanonicalT = TypeVar("_CanonicalT")

_CUSTOMER_NOT_IMPORTED_REASON = (
    "Its customer wasn't imported, so this subscription stays on the source."
)
_PRODUCT_NOT_IMPORTED_REASON = (
    "Its product wasn't imported, so this subscription stays on the source."
)
_CUSTOMER_ALREADY_SUBSCRIBED_REASON = (
    "This customer already has a live subscription to the product on Polar, so a "
    "duplicate isn't created. It stays on the source."
)
_CUSTOMER_STRIPE_ID_CONFLICT_REASON = (
    "A Polar customer with this email already has a different Stripe id. Reconcile "
    "them manually; this customer stays on the source."
)


class CatalogImporter:
    def __init__(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        organization: Organization,
        *,
        record_ids: set[UUID] | None = None,
        exclude_record_ids: set[UUID] | None = None,
    ) -> None:
        self.session = session
        self.migration = migration
        self.organization = organization
        # Selection: include only `record_ids`, or exclude `exclude_record_ids`
        # (the opt-out default for large catalogs), or neither to import all.
        self.record_ids = record_ids
        self.exclude_record_ids = exclude_record_ids
        self.record_repository = MerchantMigrationRecordRepository.from_session(session)
        self.product_repository = ProductRepository.from_session(session)
        self.customer_repository = CustomerRepository.from_session(session)
        self.subscription_repository = SubscriptionRepository.from_session(session)
        self._product_cache: dict[UUID, Product] = {}

    async def run(self) -> MerchantMigrationImportReport:
        records = await self.record_repository.list_by_migration(self.migration.id)
        product_records = self._records_of(records, MerchantMigrationRecordType.product)
        customer_records = self._records_of(
            records, MerchantMigrationRecordType.customer
        )
        subscription_records = self._records_of(
            records, MerchantMigrationRecordType.subscription
        )

        # Products and customers first: a subscription resolves its Polar product,
        # price and customer from their imported ledger rows.
        product_result = await self._import_products(product_records)
        customer_result = await self._import_customers(customer_records)
        subscription_result = await self._import_subscriptions(
            subscription_records, product_records, customer_records
        )

        return MerchantMigrationImportReport(
            step=self.migration.step,
            results=[product_result, customer_result, subscription_result],
        )

    def _records_of(
        self,
        records: Sequence[MerchantMigrationRecord],
        type: MerchantMigrationRecordType,
    ) -> list[MerchantMigrationRecord]:
        return [record for record in records if record.type == type]

    def _is_selected(self, record: MerchantMigrationRecord) -> bool:
        if self.record_ids is not None:
            return record.id in self.record_ids
        if self.exclude_record_ids is not None:
            return record.id not in self.exclude_record_ids
        return True

    async def _import_products(
        self, records: Sequence[MerchantMigrationRecord]
    ) -> MerchantMigrationImportResult:
        products = [
            self._as(deserialize(record.type, record.canonical), CanonicalProduct)
            for record in records
        ]
        plans = plan_product_imports(products)

        imported = skipped = 0
        for record, product in zip(records, products, strict=True):
            if not self._is_selected(record):
                continue
            if record.status == MerchantMigrationRecordStatus.imported:
                imported += 1
                continue
            plan = plans[product.source_id]
            if not plan.importable:
                await self._mark_skipped(record, plan.skip_code, plan.skip_reason)
                skipped += 1
                continue
            polar_product = await self._create_product(product, plan)
            await self._mark_imported(record, polar_product.id)
            imported += 1

        return MerchantMigrationImportResult(
            entity=PrecheckEntity.products, imported=imported, skipped=skipped
        )

    async def _import_customers(
        self, records: Sequence[MerchantMigrationRecord]
    ) -> MerchantMigrationImportResult:
        customers = [
            self._as(deserialize(record.type, record.canonical), CanonicalCustomer)
            for record in records
        ]
        plans = plan_customer_imports(customers)

        imported = skipped = 0
        for record, customer in zip(records, customers, strict=True):
            if not self._is_selected(record):
                continue
            if record.status == MerchantMigrationRecordStatus.imported:
                imported += 1
                continue
            skip_code, skip_reason = plans[customer.source_id]
            if skip_code is not None:
                await self._mark_skipped(record, skip_code, skip_reason)
                skipped += 1
                continue
            polar_customer, conflict_reason = await self._create_or_reuse_customer(
                customer
            )
            if conflict_reason is not None:
                await self._mark_skipped(
                    record, "customer_stripe_id_conflict", conflict_reason
                )
                skipped += 1
                continue
            assert polar_customer is not None
            await self._mark_imported(record, polar_customer.id)
            imported += 1

        return MerchantMigrationImportResult(
            entity=PrecheckEntity.customers, imported=imported, skipped=skipped
        )

    async def _create_product(
        self, product: CanonicalProduct, plan: ProductImportPlan
    ) -> Product:
        assert product.recurring_interval is not None
        prices: list[ProductPriceFixed] = []
        for price in product.prices:
            if price.source_id not in plan.importable_price_ids:
                continue
            assert price.amount is not None
            prices.append(
                ProductPriceFixed(
                    price_amount=price.amount,
                    price_currency=price.currency.lower(),
                )
            )
        # Repository, not ProductService.create: a bulk import must not fire a
        # product_created webhook or re-run org review for every product.
        return await self.product_repository.create(
            Product(
                organization=self.organization,
                name=product.name,
                recurring_interval=SubscriptionRecurringInterval(
                    product.recurring_interval
                ),
                recurring_interval_count=product.recurring_interval_count,
                prices=prices,
                all_prices=list(prices),
                product_benefits=[],
                product_medias=[],
                attached_custom_fields=[],
            ),
            flush=True,
        )

    async def _create_or_reuse_customer(
        self, customer: CanonicalCustomer
    ) -> tuple[Customer | None, str | None]:
        stripe_customer_id = self._stripe_customer_id(customer)
        existing = await self.customer_repository.get_by_email_and_organization(
            customer.email, self.organization.id
        )
        if existing is not None:
            # The email matches an existing Polar customer that already carries a
            # different Stripe id: reusing it would attach this subscription and a
            # PAN-copied card to the wrong record, so skip for manual reconciliation.
            if (
                stripe_customer_id is not None
                and existing.stripe_customer_id is not None
                and existing.stripe_customer_id != stripe_customer_id
            ):
                return None, _CUSTOMER_STRIPE_ID_CONFLICT_REASON
            # Reuse the existing customer (design Appendix A). Reconcile the source
            # id so the PAN-copied card lands on the same customer, but never
            # overwrite an id that's already set.
            if stripe_customer_id and existing.stripe_customer_id is None:
                await self.customer_repository.update(
                    existing, update_dict={"stripe_customer_id": stripe_customer_id}
                )
            return existing, None
        polar_customer = await customer_service.create_for_organization(
            self.session,
            self.organization,
            email=customer.email,
            name=customer.name,
            billing_address=self._billing_address(customer),
            stripe_customer_id=stripe_customer_id,
        )
        return polar_customer, None

    def _stripe_customer_id(self, customer: CanonicalCustomer) -> str | None:
        # PAN copy preserves the Stripe `cus_…` id, which the canonical record
        # carries as its source id; other providers have no such concept.
        if self.migration.source_platform == MerchantMigrationSourcePlatform.stripe:
            return customer.source_id
        return None

    def _billing_address(self, customer: CanonicalCustomer) -> Address | None:
        if not customer.country:
            return None
        try:
            country = CountryAlpha2(customer.country.upper())
        except ValueError:
            return None
        return Address(country=country)

    async def _import_subscriptions(
        self,
        records: Sequence[MerchantMigrationRecord],
        product_records: Sequence[MerchantMigrationRecord],
        customer_records: Sequence[MerchantMigrationRecord],
    ) -> MerchantMigrationImportResult:
        subscriptions = [
            self._as(deserialize(record.type, record.canonical), CanonicalSubscription)
            for record in records
        ]
        products = [
            self._as(deserialize(record.type, record.canonical), CanonicalProduct)
            for record in product_records
        ]
        customers = [
            self._as(deserialize(record.type, record.canonical), CanonicalCustomer)
            for record in customer_records
        ]
        plans = plan_subscription_imports(subscriptions, products, customers)
        product_by_price = {
            price.source_id: product for product in products for price in product.prices
        }
        # Products and customers were imported earlier in this run, so their ledger
        # rows already carry target ids in-session: resolve dependencies from these
        # maps instead of a per-subscription query.
        customer_target_by_source = self._imported_targets(customer_records)
        product_target_by_source = self._imported_targets(product_records)

        imported = skipped = 0
        for record, subscription in zip(records, subscriptions, strict=True):
            if not self._is_selected(record):
                continue
            if record.status == MerchantMigrationRecordStatus.imported:
                imported += 1
                continue
            code, reason = plans[subscription.source_id]
            if code is not None:
                await self._mark_skipped(record, code, reason)
                skipped += 1
                continue
            polar_subscription, skip_reason = await self._create_subscription(
                subscription,
                product_by_price,
                customer_target_by_source,
                product_target_by_source,
            )
            # Product and customer import first, so a missing one means it was
            # skipped or deselected: skip the subscription rather than leave it pending.
            if skip_reason is not None:
                await self._mark_skipped(
                    record, "subscription_dependency_not_imported", skip_reason
                )
                skipped += 1
                continue
            if polar_subscription is None:
                continue
            await self._mark_imported(record, polar_subscription.id)
            imported += 1

        return MerchantMigrationImportResult(
            entity=PrecheckEntity.subscriptions, imported=imported, skipped=skipped
        )

    async def _create_subscription(
        self,
        subscription: CanonicalSubscription,
        product_by_price: dict[str, CanonicalProduct],
        customer_target_by_source: dict[str, UUID],
        product_target_by_source: dict[str, UUID],
    ) -> tuple[Subscription | None, str | None]:
        # (subscription, skip_reason): a reason means skip; both None means an
        # unexpected miss, left pending.
        customer_target = customer_target_by_source.get(subscription.customer_source_id)
        if customer_target is None:
            return None, _CUSTOMER_NOT_IMPORTED_REASON
        canonical_product = product_by_price.get(subscription.price_source_id)
        if canonical_product is None:
            return None, _PRODUCT_NOT_IMPORTED_REASON
        product_target = product_target_by_source.get(canonical_product.source_id)
        if product_target is None:
            return None, _PRODUCT_NOT_IMPORTED_REASON

        polar_product = await self._load_product(product_target)
        customer = await self.customer_repository.get_by_id(customer_target)
        if polar_product is None or customer is None:
            return None, None

        # Never create a second live subscription to the same product for a
        # customer — at cutover it would double-bill them.
        if await self.subscription_repository.exists_live_by_customer_and_product(
            customer.id, polar_product.id
        ):
            return None, _CUSTOMER_ALREADY_SUBSCRIBED_REASON

        price = self._find_price(
            polar_product, canonical_product, subscription.price_source_id
        )
        if price is None:
            return None, None

        subscription_target = await self._persist_subscription(
            subscription, polar_product, price, customer
        )
        return subscription_target, None

    async def _persist_subscription(
        self,
        subscription: CanonicalSubscription,
        product: Product,
        price: ProductPriceFixed,
        customer: Customer,
    ) -> Subscription:
        assert product.recurring_interval is not None
        interval = product.recurring_interval
        count = product.recurring_interval_count or 1
        start = subscription.current_period_start or utc_now()
        end = subscription.current_period_end or interval.get_next_period(
            start, start.day, count
        )
        polar_subscription = Subscription(
            # Paused isn't active or billable, so the renewal scheduler skips it
            # and the customer isn't charged until cutover resumes it.
            status=SubscriptionStatus.paused,
            paused_at=utc_now(),
            started_at=start,
            anchor_day=start.day,
            current_period_start=start,
            current_period_end=end,
            cancel_at_period_end=False,
            recurring_interval=interval,
            recurring_interval_count=count,
            meter_interval=product.meter_interval,
            meter_interval_count=product.meter_interval_count,
            organization=self.organization,
            product=product,
            customer=customer,
            subscription_product_prices=[SubscriptionProductPrice.from_price(price)],
            currency=price.price_currency,
            user_metadata={"stripe_subscription_id": subscription.source_id},
            pending_update=None,
        )
        polar_subscription.initialize_meter_period(start)
        return await self.subscription_repository.create(polar_subscription, flush=True)

    def _imported_targets(
        self, records: Sequence[MerchantMigrationRecord]
    ) -> dict[str, UUID]:
        return {
            record.source_id: record.target_id
            for record in records
            if record.status == MerchantMigrationRecordStatus.imported
            and record.target_id is not None
        }

    async def _load_product(self, product_id: UUID) -> Product | None:
        cached = self._product_cache.get(product_id)
        if cached is not None:
            return cached
        # None only if an imported product row vanished (data corruption); the
        # caller leaves the subscription pending rather than crashing.
        product = await self.product_repository.get_by_id_and_organization(
            product_id,
            self.organization.id,
            options=(selectinload(Product.prices),),
        )
        if product is not None:
            self._product_cache[product_id] = product
        return product

    def _find_price(
        self,
        product: Product,
        canonical_product: CanonicalProduct,
        price_source_id: str,
    ) -> ProductPriceFixed | None:
        # Prices carry no durable source id, so match the source price to a Polar
        # one by the currency and amount the product importer created it with.
        canonical_price = next(
            (p for p in canonical_product.prices if p.source_id == price_source_id),
            None,
        )
        if canonical_price is None or canonical_price.amount is None:
            return None
        currency = canonical_price.currency.lower()
        for price in product.prices:
            if (
                isinstance(price, ProductPriceFixed)
                and price.price_currency == currency
                and price.price_amount == canonical_price.amount
            ):
                return price
        return None

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
        self,
        record: MerchantMigrationRecord,
        code: str | None,
        reason: str | None,
    ) -> None:
        await self.record_repository.update(
            record,
            update_dict={
                "status": MerchantMigrationRecordStatus.skipped,
                "error": reason or code,
            },
        )

    def _as(self, record: object, expected: type[_CanonicalT]) -> _CanonicalT:
        assert isinstance(record, expected)
        return record
