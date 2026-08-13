"""Imports the staged catalog into Polar (the `create_catalog` step).
Idempotent; migrated subscriptions arrive paused so nothing bills until cutover.
Runs in Dramatiq batches: products → customers → subscriptions.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import TypeVar
from uuid import UUID

from sqlalchemy.orm import joinedload, selectinload

from polar.auth.models import AuthSubject
from polar.customer.repository import CustomerRepository
from polar.customer.service import customer as customer_service
from polar.enums import SubscriptionRecurringInterval
from polar.kit.address import Address, CountryAlpha2
from polar.kit.currency import PresentmentCurrency
from polar.kit.db.postgres import AsyncSession
from polar.models import (
    Customer,
    MerchantMigration,
    MerchantMigrationRecord,
    Organization,
    Product,
    Subscription,
)
from polar.models.merchant_migration import MerchantMigrationSourcePlatform
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)
from polar.models.product_price import ProductPriceAmountType, ProductPriceFixed
from polar.product.repository import ProductRepository
from polar.product.schemas import (
    ProductCreateRecurring,
    ProductPriceCreate,
    ProductPriceFixedCreate,
)
from polar.product.service import product as product_service
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import subscription as subscription_service

from .canonical import (
    CanonicalCustomer,
    CanonicalProduct,
    CanonicalSubscription,
    deserialize,
)
from .operation import MerchantMigrationOperationSelection
from .precheck import (
    ProductImportPlan,
    Reason,
    plan_customer_imports,
    plan_product_imports,
    plan_subscription_imports,
)
from .repository import MerchantMigrationRecordRepository

_CanonicalT = TypeVar("_CanonicalT")

_DEPENDENCY_CODE = "subscription_dependency_not_imported"
_CUSTOMER_NOT_IMPORTED = Reason(
    _DEPENDENCY_CODE,
    "Its customer wasn't imported, so this subscription stays on the source.",
)
_PRODUCT_NOT_IMPORTED = Reason(
    _DEPENDENCY_CODE,
    "Its product wasn't imported, so this subscription stays on the source.",
)
_CUSTOMER_ALREADY_SUBSCRIBED = Reason(
    _DEPENDENCY_CODE,
    "This customer already has a live subscription to the product on Polar, so a "
    "duplicate isn't created. It stays on the source.",
)
_CUSTOMER_STRIPE_ID_CONFLICT = Reason(
    "customer_stripe_id_conflict",
    "A Polar customer with this email already has a different Stripe id. Reconcile "
    "them manually; this customer stays on the source.",
)


@dataclass(frozen=True)
class ImportBatchResult:
    """Outcome of one import batch for the current record type."""

    records_processed: int
    last_id: UUID | None


@dataclass(frozen=True)
class ImportedCustomer:
    """The Polar customer to use, or why the record is skipped."""

    customer: Customer | None = None
    skip: Reason | None = None


@dataclass(frozen=True)
class ImportedSubscription:
    """The created subscription, or why the record is skipped. Both unset means
    an unexpected miss, which leaves the record pending."""

    subscription: Subscription | None = None
    skip: Reason | None = None


class CatalogImporter:
    def __init__(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        organization: Organization,
        auth_subject: AuthSubject[Organization],
        *,
        selection: MerchantMigrationOperationSelection | None = None,
    ) -> None:
        self.session = session
        self.migration = migration
        self.organization = organization
        self.auth_subject = auth_subject
        self.selection = selection
        self.record_repository = MerchantMigrationRecordRepository.from_session(session)
        self.product_repository = ProductRepository.from_session(session)
        self.customer_repository = CustomerRepository.from_session(session)
        self.subscription_repository = SubscriptionRepository.from_session(session)
        self._product_cache: dict[UUID, Product] = {}
        self._customer_cache: dict[UUID, Customer] = {}

    @property
    def _record_ids(self) -> Sequence[UUID] | None:
        if self.selection is None:
            return None
        return self.selection.record_ids

    @property
    def _exclude_record_ids(self) -> Sequence[UUID] | None:
        if self.selection is None:
            return None
        return self.selection.exclude_record_ids

    async def run_batch(
        self,
        record_type: MerchantMigrationRecordType,
        *,
        after_id: UUID | None,
        limit: int,
    ) -> ImportBatchResult:
        """Import up to ``limit`` pending selected rows of ``record_type``.

        Record-level failures mark that ledger row ``failed`` and the batch
        continues. Returns how far the cursor advanced.
        """
        records = await self.record_repository.list_pending_batch(
            self.migration.id,
            record_type,
            limit=limit,
            after_id=after_id,
            record_ids=self._record_ids,
            exclude_record_ids=self._exclude_record_ids,
        )
        if not records:
            return ImportBatchResult(records_processed=0, last_id=after_id)

        if record_type == MerchantMigrationRecordType.product:
            await self._import_products(records)
        elif record_type == MerchantMigrationRecordType.customer:
            await self._import_customers(records)
        else:
            await self._import_subscriptions(records)

        return ImportBatchResult(records_processed=len(records), last_id=records[-1].id)

    async def _import_products(
        self, records: Sequence[MerchantMigrationRecord]
    ) -> None:
        products = [
            self._as(deserialize(record.type, record.canonical), CanonicalProduct)
            for record in records
        ]
        plans = plan_product_imports(
            products, self.organization.default_presentment_currency
        )

        for record, product in zip(records, products, strict=True):
            if record.status != MerchantMigrationRecordStatus.pending:
                continue
            plan = plans[product.source_id]
            if plan.skip is not None:
                await self._mark_skipped(record, plan.skip)
                continue
            try:
                async with self.session.begin_nested():
                    polar_product = await self._create_product(product, plan)
                await self._mark_imported(record, polar_product.id)
            except Exception as e:
                await self._mark_failed(record, e)

    async def _import_customers(
        self, records: Sequence[MerchantMigrationRecord]
    ) -> None:
        customers = [
            self._as(deserialize(record.type, record.canonical), CanonicalCustomer)
            for record in records
        ]
        plans = plan_customer_imports(customers)

        for record, customer in zip(records, customers, strict=True):
            if record.status != MerchantMigrationRecordStatus.pending:
                continue
            skip = plans[customer.source_id]
            if skip is not None:
                await self._mark_skipped(record, skip)
                continue
            try:
                async with self.session.begin_nested():
                    result = await self._create_or_reuse_customer(customer)
                if result.skip is not None:
                    await self._mark_skipped(record, result.skip)
                    continue
                assert result.customer is not None
                await self._mark_imported(record, result.customer.id)
            except Exception as e:
                await self._mark_failed(record, e)

    async def _create_product(
        self, product: CanonicalProduct, plan: ProductImportPlan
    ) -> Product:
        assert product.recurring_interval is not None
        prices: list[ProductPriceCreate] = []
        for price in product.prices:
            if price.source_id not in plan.importable_price_ids:
                continue
            assert price.amount is not None
            prices.append(
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=price.amount,
                    price_currency=PresentmentCurrency(price.currency.lower()),
                )
            )
        return await product_service.create(
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

    async def _create_or_reuse_customer(
        self, customer: CanonicalCustomer
    ) -> ImportedCustomer:
        stripe_customer_id = self._stripe_customer_id(customer)
        existing = await self.customer_repository.get_by_email_and_organization(
            customer.email, self.organization.id
        )
        if existing is not None:
            if (
                stripe_customer_id is not None
                and existing.stripe_customer_id is not None
                and existing.stripe_customer_id != stripe_customer_id
            ):
                return ImportedCustomer(skip=_CUSTOMER_STRIPE_ID_CONFLICT)
            if stripe_customer_id and existing.stripe_customer_id is None:
                await self.customer_repository.update(
                    existing, update_dict={"stripe_customer_id": stripe_customer_id}
                )
            return ImportedCustomer(customer=existing)
        polar_customer = await customer_service.create_for_organization(
            self.session,
            self.organization,
            email=customer.email,
            name=customer.name,
            billing_address=self._billing_address(customer),
            stripe_customer_id=stripe_customer_id,
        )
        return ImportedCustomer(customer=polar_customer)

    def _stripe_customer_id(self, customer: CanonicalCustomer) -> str | None:
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
        self, records: Sequence[MerchantMigrationRecord]
    ) -> None:
        product_records = await self.record_repository.list_by_migration_and_types(
            self.migration.id, [MerchantMigrationRecordType.product]
        )
        customer_records = await self.record_repository.list_by_migration_and_types(
            self.migration.id, [MerchantMigrationRecordType.customer]
        )
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
        plans = plan_subscription_imports(
            subscriptions,
            products,
            customers,
            self.organization.default_presentment_currency,
        )
        product_by_price = {
            price.source_id: product for product in products for price in product.prices
        }
        customer_target_by_source = self._imported_targets(customer_records)
        product_target_by_source = self._imported_targets(product_records)

        for record, subscription in zip(records, subscriptions, strict=True):
            if record.status != MerchantMigrationRecordStatus.pending:
                continue
            skip = plans[subscription.source_id]
            if skip is not None:
                await self._mark_skipped(record, skip)
                continue
            try:
                async with self.session.begin_nested():
                    result = await self._create_subscription(
                        subscription,
                        product_by_price,
                        customer_target_by_source,
                        product_target_by_source,
                    )
                if result.skip is not None:
                    await self._mark_skipped(record, result.skip)
                    continue
                if result.subscription is None:
                    continue
                await self._mark_imported(record, result.subscription.id)
            except Exception as e:
                await self._mark_failed(record, e)

    async def _create_subscription(
        self,
        subscription: CanonicalSubscription,
        product_by_price: dict[str, CanonicalProduct],
        customer_target_by_source: dict[str, UUID],
        product_target_by_source: dict[str, UUID],
    ) -> ImportedSubscription:
        customer_target = customer_target_by_source.get(subscription.customer_source_id)
        if customer_target is None:
            return ImportedSubscription(skip=_CUSTOMER_NOT_IMPORTED)
        canonical_product = product_by_price.get(subscription.price_source_id)
        if canonical_product is None:
            return ImportedSubscription(skip=_PRODUCT_NOT_IMPORTED)
        product_target = product_target_by_source.get(canonical_product.source_id)
        if product_target is None:
            return ImportedSubscription(skip=_PRODUCT_NOT_IMPORTED)

        polar_product = await self._load_product(product_target)
        customer = await self._load_customer(customer_target)
        if polar_product is None or customer is None:
            return ImportedSubscription()

        if await self.subscription_repository.exists_live_by_customer_and_product(
            customer.id, polar_product.id
        ):
            return ImportedSubscription(skip=_CUSTOMER_ALREADY_SUBSCRIBED)

        price = self._find_price(
            polar_product, canonical_product, subscription.price_source_id
        )
        if price is None:
            return ImportedSubscription()

        return ImportedSubscription(
            subscription=await self._persist_subscription(
                subscription, polar_product, price, customer
            )
        )

    async def _persist_subscription(
        self,
        subscription: CanonicalSubscription,
        product: Product,
        price: ProductPriceFixed,
        customer: Customer,
    ) -> Subscription:
        return await subscription_service.create_imported(
            self.session,
            product=product,
            price=price,
            customer=customer,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            user_metadata={"stripe_subscription_id": subscription.source_id},
        )

    def _imported_targets(
        self, records: Sequence[MerchantMigrationRecord]
    ) -> dict[str, UUID]:
        return {
            record.source_id: record.target_id
            for record in records
            if record.status == MerchantMigrationRecordStatus.imported
            and record.target_id is not None
        }

    async def _load_customer(self, customer_id: UUID) -> Customer | None:
        if customer_id not in self._customer_cache:
            customer = await self.customer_repository.get_by_id(customer_id)
            if customer is None:
                return None
            self._customer_cache[customer_id] = customer
        return self._customer_cache[customer_id]

    async def _load_product(self, product_id: UUID) -> Product | None:
        cached = self._product_cache.get(product_id)
        if cached is not None:
            return cached
        product = await self.product_repository.get_by_id_and_organization(
            product_id,
            self.organization.id,
            options=(
                selectinload(Product.prices),
                joinedload(Product.organization),
            ),
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
        canonical_price = next(
            (p for p in canonical_product.prices if p.source_id == price_source_id),
            None,
        )
        if canonical_price is None:
            return None
        currency = canonical_price.currency.lower()
        return next(
            (
                price
                for price in product.prices
                if isinstance(price, ProductPriceFixed)
                and price.price_currency == currency
            ),
            None,
        )

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

    async def _mark_failed(
        self, record: MerchantMigrationRecord, error: Exception
    ) -> None:
        await self.record_repository.update(
            record,
            update_dict={
                "status": MerchantMigrationRecordStatus.failed,
                "error": str(error)[:500] or error.__class__.__name__,
            },
        )

    def _as(self, record: object, expected: type[_CanonicalT]) -> _CanonicalT:
        assert isinstance(record, expected)
        return record
