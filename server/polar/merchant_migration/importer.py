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
from polar.discount.schemas import DiscountFixedCreate, DiscountPercentageCreate
from polar.discount.service import discount as discount_service
from polar.enums import SubscriptionRecurringInterval
from polar.kit.address import Address, CountryAlpha2
from polar.kit.currency import PresentmentCurrency
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    Discount,
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
    CanonicalDiscount,
    CanonicalDiscountType,
    CanonicalProduct,
    CanonicalSubscription,
    canonical_price_key,
    deserialize,
    polar_discount_amounts,
    subscription_price_key,
)
from .precheck import (
    ProductImportPlan,
    Reason,
    plan_customer_imports,
    plan_discount_imports,
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
_CUSTOMER_STRIPE_ID_CONFLICT = Reason(
    "customer_stripe_id_conflict",
    "A Polar customer with this email already has a different Stripe id. Reconcile "
    "them manually; this customer stays on the source.",
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
        user_metadata={"stripe_subscription_id": subscription.source_id},
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
        discount_records = self._records_of(
            records, MerchantMigrationRecordType.discount
        )
        subscription_records = self._records_of(
            records, MerchantMigrationRecordType.subscription
        )

        product_source_ids, customer_source_ids = (
            self._selected_subscription_dependencies(
                subscription_records,
                self._records_of(catalog, MerchantMigrationRecordType.product),
                self._records_of(catalog, MerchantMigrationRecordType.customer),
                self._records_of(catalog, MerchantMigrationRecordType.discount),
            )
        )

        product_result = await self._import_products(
            product_records, selected_source_ids=product_source_ids
        )
        discount_result = await self._import_discounts(
            discount_records,
            product_records=self._records_of(
                catalog, MerchantMigrationRecordType.product
            ),
        )
        customer_result = await self._import_customers(
            customer_records, selected_source_ids=customer_source_ids
        )
        subscription_result = MerchantMigrationImportResult(
            entity=PrecheckEntity.subscriptions,
            imported=0,
            skipped=0,
        )

        return MerchantMigrationImportReport(
            step=self.migration.step,
            results=[
                product_result,
                discount_result,
                customer_result,
                subscription_result,
            ],
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
            discounts,
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
            result = await self._create_or_reuse_customer(customer)
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

    async def _import_discounts(
        self,
        records: Sequence[MerchantMigrationRecord],
        *,
        product_records: Sequence[MerchantMigrationRecord],
    ) -> MerchantMigrationImportResult:
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
        polar_product_ids_by_source: dict[str, list[UUID]] = {}
        for record, product in zip(product_records, products, strict=True):
            if (
                record.status != MerchantMigrationRecordStatus.imported
                or record.target_id is None
            ):
                continue
            polar_product_ids_by_source.setdefault(
                product.product_source_id, []
            ).append(record.target_id)

        counts = ImportCounts()
        for record, discount in zip(records, discounts, strict=True):
            if record.status != MerchantMigrationRecordStatus.pending:
                counts.settle(record.status)
                continue
            skip = plans[discount.source_id]
            if skip is not None:
                await self._mark_skipped(record, skip)
                counts.skipped += 1
                continue
            product_ids: list[UUID] = []
            if discount.product_source_ids:
                for product_source_id in discount.product_source_ids:
                    product_ids.extend(
                        polar_product_ids_by_source.get(product_source_id, [])
                    )
                if not product_ids:
                    continue
            polar_discount = await self._create_discount(discount, product_ids)
            await self._mark_imported(record, polar_discount.id)
            counts.imported += 1

        return MerchantMigrationImportResult(
            entity=PrecheckEntity.discounts,
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
        return await product_service.create(
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

    async def _create_discount(
        self, discount: CanonicalDiscount, product_ids: list[UUID]
    ) -> Discount:
        exhausted = discount.max_redemptions == 0
        duration = DiscountDuration(discount.duration.value)
        ends_at = discount.ends_at
        if exhausted:
            now = utc_now()
            ends_at = now if ends_at is None or ends_at > now else ends_at
        shared: dict[str, Any] = {
            "name": discount.name,
            "code": (
                None
                if exhausted
                else await self._available_discount_code(discount.code)
            ),
            "duration": duration,
            "duration_in_months": (
                discount.duration_in_months
                if duration == DiscountDuration.repeating
                else None
            ),
            "ends_at": ends_at,
            "max_redemptions": None if exhausted else discount.max_redemptions,
            "products": product_ids or None,
            "organization_id": self.organization.id,
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
        self, customer: CanonicalCustomer
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
                return ImportedCustomer(skip=_CUSTOMER_STRIPE_ID_CONFLICT)
            # Reconcile the source id so the PAN-copied card lands on the same
            # customer, but never overwrite one that's already set.
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
        # PAN copy preserves the Stripe `cus_…` id; other providers have no
        # such concept.
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
