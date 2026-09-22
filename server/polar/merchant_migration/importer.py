"""Imports the staged catalog into Polar (the `create_catalog` step).
Idempotent; subscriptions are created later, during cutover.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import TypeVar
from uuid import UUID

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
    User,
)
from polar.models.merchant_migration import MerchantMigrationSourcePlatform
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)
from polar.models.product_price import ProductPriceAmountType, ProductPriceFixed
from polar.product.schemas import (
    ProductCreateRecurring,
    ProductPriceCreate,
    ProductPriceFixedCreate,
)
from polar.product.service import product as product_service
from polar.subscription.service import subscription as subscription_service

from .canonical import (
    CanonicalCustomer,
    CanonicalProduct,
    CanonicalSubscription,
    canonical_price_key,
    deserialize,
    subscription_price_key,
)
from .precheck import (
    CUSTOMER_STRIPE_ID_CONFLICT_REASON,
    ProductImportPlan,
    Reason,
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

_DEPENDENCY_CODE = "subscription_dependency_not_imported"
_CUSTOMER_ALREADY_SUBSCRIBED = Reason(
    _DEPENDENCY_CODE,
    "This customer already has a live subscription to the product on Polar, so a "
    "duplicate isn't created. It stays on the source.",
)


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
    return next(
        (
            price
            for price in product.prices
            if isinstance(price, ProductPriceFixed) and price.price_currency == currency
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
) -> Subscription:
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

    async def run(self) -> MerchantMigrationImportReport:
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
        subscription_records = self._records_of(
            records, MerchantMigrationRecordType.subscription
        )

        product_source_ids, customer_source_ids = (
            self._selected_subscription_dependencies(
                subscription_records,
                self._records_of(catalog, MerchantMigrationRecordType.product),
                self._records_of(catalog, MerchantMigrationRecordType.customer),
            )
        )
        country_fallbacks = self._customer_country_fallbacks(
            self._records_of(catalog, MerchantMigrationRecordType.customer),
            subscription_records,
        )

        product_result = await self._import_products(
            product_records, selected_source_ids=product_source_ids
        )
        customer_result = await self._import_customers(
            customer_records,
            selected_source_ids=customer_source_ids,
            country_fallbacks=country_fallbacks,
        )
        subscription_result = MerchantMigrationImportResult(
            entity=PrecheckEntity.subscriptions,
            imported=0,
            skipped=0,
        )

        return MerchantMigrationImportReport(
            step=self.migration.step,
            results=[product_result, customer_result, subscription_result],
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
        plans = plan_subscription_imports(
            subscriptions,
            products,
            customers,
            self.organization.default_presentment_currency,
        )
        product_by_price = {
            canonical_price_key(price): product
            for product in products
            for price in product.prices
        }

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
            product = product_by_price.get(key) if key is not None else None
            if product is not None:
                product_source_ids.add(product.source_id)
        return product_source_ids, customer_source_ids

    def _customer_country_fallbacks(
        self,
        customer_records: Sequence[MerchantMigrationRecord],
        subscription_records: Sequence[MerchantMigrationRecord],
    ) -> dict[str, str]:
        customers = [
            self._as(deserialize(record.type, record.canonical), CanonicalCustomer)
            for record in customer_records
        ]
        subscriptions = [
            self._as(deserialize(record.type, record.canonical), CanonicalSubscription)
            for record in subscription_records
        ]
        billing_countries: dict[str, str] = {}
        card_countries: dict[str, str] = {}
        for subscription in subscriptions:
            payment_method = subscription.payment_method
            if payment_method is None:
                continue
            if payment_method.billing_country:
                billing_countries.setdefault(
                    subscription.customer_source_id, payment_method.billing_country
                )
            if payment_method.card_country:
                card_countries.setdefault(
                    subscription.customer_source_id, payment_method.card_country
                )
        return {
            customer.source_id: fallback
            for customer in customers
            if (
                fallback := customer.country_hint
                or billing_countries.get(customer.source_id)
                or card_countries.get(customer.source_id)
            )
        }

    async def _import_products(
        self,
        records: Sequence[MerchantMigrationRecord],
        *,
        selected_source_ids: set[str],
    ) -> MerchantMigrationImportResult:
        products = [
            self._as(deserialize(record.type, record.canonical), CanonicalProduct)
            for record in records
        ]
        plans = plan_product_imports(
            products, self.organization.default_presentment_currency
        )

        counts = ImportCounts()
        for record, product in zip(records, products, strict=True):
            if record.source_id not in selected_source_ids:
                continue
            if record.status != MerchantMigrationRecordStatus.pending:
                counts.settle(record.status)
                continue
            plan = plans[product.source_id]
            if plan.skip is not None:
                await self._mark_skipped(record, plan.skip)
                counts.skipped += 1
                continue
            polar_product = await self._create_product(product, plan)
            await self._mark_imported(record, polar_product.id)
            counts.imported += 1

        return MerchantMigrationImportResult(
            entity=PrecheckEntity.products,
            imported=counts.imported,
            skipped=counts.skipped,
        )

    async def _import_customers(
        self,
        records: Sequence[MerchantMigrationRecord],
        *,
        selected_source_ids: set[str],
        country_fallbacks: dict[str, str],
    ) -> MerchantMigrationImportResult:
        customers = [
            self._as(deserialize(record.type, record.canonical), CanonicalCustomer)
            for record in records
        ]
        plans = plan_customer_imports(customers)

        counts = ImportCounts()
        for record, customer in zip(records, customers, strict=True):
            if record.source_id not in selected_source_ids:
                continue
            if record.status != MerchantMigrationRecordStatus.pending:
                counts.settle(record.status)
                continue
            skip = plans[customer.source_id]
            if skip is not None:
                await self._mark_skipped(record, skip)
                counts.skipped += 1
                continue
            result = await self._create_or_reuse_customer(
                customer, country_fallbacks.get(customer.source_id)
            )
            if result.skip is not None:
                await self._mark_skipped(record, result.skip)
                counts.skipped += 1
                continue
            assert result.customer is not None
            await self._mark_imported(record, result.customer.id)
            counts.imported += 1

        return MerchantMigrationImportResult(
            entity=PrecheckEntity.customers,
            imported=counts.imported,
            skipped=counts.skipped,
        )

    async def _create_product(
        self, product: CanonicalProduct, plan: ProductImportPlan
    ) -> Product:
        assert product.recurring_interval is not None
        prices: list[ProductPriceCreate] = []
        for price in product.prices:
            if canonical_price_key(price) not in plan.importable_prices:
                continue
            assert price.amount is not None
            prices.append(
                ProductPriceFixedCreate(
                    amount_type=ProductPriceAmountType.fixed,
                    price_amount=price.amount,
                    price_currency=PresentmentCurrency(price.currency.lower()),
                )
            )
        # A bulk import must not webhook or re-review the org for every product.
        polar_product = await product_service.create(
            self.session,
            ProductCreateRecurring(
                name=product.name,
                organization_id=self.organization.id,
                recurring_interval=SubscriptionRecurringInterval(
                    product.recurring_interval
                ),
                recurring_interval_count=product.recurring_interval_count,
                prices=prices,
            ),
            self.auth_subject,
            notify=False,
        )
        if product.archived:
            polar_product.is_archived = True
            await self.session.flush()
        return polar_product

    async def _create_or_reuse_customer(
        self, customer: CanonicalCustomer, country_fallback: str | None
    ) -> ImportedCustomer:
        stripe_customer_id = self._stripe_customer_id(customer)
        existing = await self.customer_repository.get_by_email_and_organization(
            customer.email, self.organization.id
        )
        if existing is not None:
            # Reusing a customer bound to another Stripe id would attach the
            # PAN-copied card to the wrong record.
            if (
                stripe_customer_id is not None
                and existing.stripe_customer_id is not None
                and existing.stripe_customer_id != stripe_customer_id
            ):
                return ImportedCustomer(
                    skip=Reason(
                        "customer_stripe_id_conflict",
                        CUSTOMER_STRIPE_ID_CONFLICT_REASON,
                    )
                )
            # Reconcile the source id so the PAN-copied card lands on the same
            # customer, but never overwrite one that's already set. Fill a
            # missing Polar billing country from the best source country.
            updates: dict[str, object] = {}
            if stripe_customer_id and existing.stripe_customer_id is None:
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
