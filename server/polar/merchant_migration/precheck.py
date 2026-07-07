"""Turns CanonicalRecords into a PrecheckReport of blockers, warnings and
per-entity import counts (design Appendices A and D), and classifies individual
records for the review drawer.

The per-record classification reuses the same `_check_*` predicates as the
report, so a record's importable/skipped status always matches the summary.
"""

from collections import Counter
from collections.abc import AsyncIterable, Iterable, Sequence

from polar.enums import SubscriptionRecurringInterval
from polar.kit.currency import (
    PresentmentCurrency,
    format_currency,
    get_maximum_currency_amount,
    get_minimum_currency_amount,
)
from polar.models import Organization
from polar.models.organization import OrganizationStatus

from .canonical import (
    CanonicalAccount,
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalRecord,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)
from .schemas import (
    MerchantMigrationRecordItem,
    PrecheckEntity,
    PrecheckEntitySummary,
    PrecheckIssue,
    PrecheckIssueLevel,
    PrecheckRecordStatus,
    PrecheckReport,
)

RENEWAL_ENABLED_STATUSES = {OrganizationStatus.REVIEW, OrganizationStatus.ACTIVE}
SUPPORTED_INTERVALS = {interval.value for interval in SubscriptionRecurringInterval}
MAX_INTERVAL_COUNT = 999
NON_IMPORTABLE_STATUSES = {
    CanonicalSubscriptionStatus.past_due,
    CanonicalSubscriptionStatus.unpaid,
    CanonicalSubscriptionStatus.paused,
}

# Warning codes that mean a record won't be imported (it stays on the source),
# grouped by the entity they apply to. Kept in sync with the `_check_*` methods
# so the per-record classification below matches the report's warnings.
PRODUCT_DROP_CODES = {"one_time_product", "unsupported_recurring_interval"}
PRICE_DROP_CODES = {
    "unsupported_pricing_scheme",
    "unsupported_price_amount",
    "unsupported_currency",
    "price_out_of_bounds",
}
SUBSCRIPTION_DROP_CODES = {
    "multiple_line_items",
    "unsupported_quantity",
    "send_invoice_collection",
    "subscription_not_importable",
    "subscription_paused_collection",
}
_DUPLICATE_PRODUCT_NAME_REASON = (
    "Another product already uses this name; the duplicate stays on the source."
)
_DUPLICATE_CUSTOMER_EMAIL_REASON = (
    "Another customer already uses this email; the duplicate stays on the source."
)
_SUBSCRIPTION_PRODUCT_REASON = (
    "The product or price for this subscription won't be imported, so it stays "
    "on the source."
)
_SUBSCRIPTION_CUSTOMER_REASON = (
    "The customer for this subscription won't be imported, so it stays on the source."
)


def _is_supported_currency(currency: str) -> bool:
    try:
        PresentmentCurrency(currency.lower())
        return True
    except ValueError:
        return False


class PrecheckEngine:
    async def run(
        self,
        records: AsyncIterable[CanonicalRecord],
        organization: Organization,
        source_account: CanonicalAccount,
    ) -> PrecheckReport:
        record_list = [record async for record in records]

        issues: list[PrecheckIssue] = list(self._check_organization(organization))
        issues.extend(self._check_account(source_account))

        products_by_name: dict[str, set[str]] = {}
        email_counts: Counter[str] = Counter()
        customers_without_country = 0

        for record in record_list:
            if isinstance(record, CanonicalProduct):
                products_by_name.setdefault(record.name, set()).add(
                    record.product_source_id
                )
                issues.extend(self._check_product(record))
            elif isinstance(record, CanonicalCustomer):
                if record.email:
                    email_counts[record.email.lower()] += 1
                if not record.country:
                    customers_without_country += 1
            elif isinstance(record, CanonicalSubscription):
                issues.extend(self._check_subscription(record))

        issues.extend(self._check_duplicate_names(products_by_name))
        issues.extend(self._check_duplicate_emails(email_counts))
        issues.extend(self._check_missing_country(customers_without_country))

        return PrecheckReport(
            issues=issues,
            can_start=not any(
                issue.level == PrecheckIssueLevel.blocker for issue in issues
            ),
            entities=summarize_records(record_list),
        )

    def _check_organization(
        self, organization: Organization
    ) -> Iterable[PrecheckIssue]:
        if organization.status not in RENEWAL_ENABLED_STATUSES:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.blocker,
                code="organization_not_renewal_enabled",
                message=(
                    "The organization must be in a renewal-enabled status "
                    "(Review or Active) before migrating."
                ),
                source_id=None,
            )

    def _check_account(self, account: CanonicalAccount) -> Iterable[PrecheckIssue]:
        if account.country == "IN":
            yield PrecheckIssue(
                level=PrecheckIssueLevel.blocker,
                code="india_account",
                message=(
                    "India (RBI) accounts can't move card data across the border, "
                    "so the card copy can't run."
                ),
                source_id=None,
            )
        if account.is_connect_platform:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.blocker,
                code="connect_platform_account",
                message=(
                    "The source is a Connect platform; only platform-account data "
                    "is copyable, so it can't be migrated automatically."
                ),
                source_id=None,
            )

    def _check_product(self, product: CanonicalProduct) -> Iterable[PrecheckIssue]:
        # A product Polar can't represent is skipped along with its subscriptions,
        # rather than blocking the whole migration.
        if product.recurring_interval is None:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="one_time_product",
                message=(
                    f"Product '{product.name}' is one-time; it and its "
                    "subscriptions won't be imported."
                ),
                source_id=product.source_id,
            )
        elif (
            product.recurring_interval not in SUPPORTED_INTERVALS
            or not 1 <= product.recurring_interval_count <= MAX_INTERVAL_COUNT
        ):
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="unsupported_recurring_interval",
                message=(
                    f"Product '{product.name}' recurs every "
                    f"{product.recurring_interval_count} {product.recurring_interval}, "
                    "which Polar can't represent; it and its subscriptions won't "
                    "be imported."
                ),
                source_id=product.source_id,
            )
        for price in product.prices:
            yield from self._check_price(product, price)

    def _check_price(
        self, product: CanonicalProduct, price: CanonicalPrice
    ) -> Iterable[PrecheckIssue]:
        if price.pricing_scheme != CanonicalPricingScheme.fixed:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="unsupported_pricing_scheme",
                message=(
                    f"Product '{product.name}' has a {price.pricing_scheme.value} "
                    "price (only fixed is supported); that price won't be imported."
                ),
                source_id=price.source_id,
            )
        elif price.amount is None:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="unsupported_price_amount",
                message=(
                    f"Product '{product.name}' has a price with no representable "
                    "amount (e.g. sub-cent); that price won't be imported."
                ),
                source_id=price.source_id,
            )
        if not _is_supported_currency(price.currency):
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="unsupported_currency",
                message=(
                    f"Product '{product.name}' has a price in {price.currency}, "
                    "which Polar doesn't support; that price won't be imported."
                ),
                source_id=price.source_id,
            )
        elif (
            price.amount is not None
            and price.amount != 0
            and not (
                get_minimum_currency_amount(price.currency)
                <= price.amount
                <= get_maximum_currency_amount(price.currency)
            )
        ):
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="price_out_of_bounds",
                message=(
                    f"Product '{product.name}' has a price outside the allowed "
                    f"range for {price.currency}; that price won't be imported."
                ),
                source_id=price.source_id,
            )

    def _check_duplicate_names(
        self, products_by_name: dict[str, set[str]]
    ) -> Iterable[PrecheckIssue]:
        for name, product_source_ids in products_by_name.items():
            if len(product_source_ids) > 1:
                yield PrecheckIssue(
                    level=PrecheckIssueLevel.warning,
                    code="duplicate_product_name",
                    message=(
                        f"Multiple products share the name '{name}'; the duplicates "
                        "won't be imported."
                    ),
                    source_id=None,
                )

    def _check_duplicate_emails(
        self, email_counts: Counter[str]
    ) -> Iterable[PrecheckIssue]:
        for email, count in email_counts.items():
            if count > 1:
                yield PrecheckIssue(
                    level=PrecheckIssueLevel.warning,
                    code="duplicate_customer_email",
                    message=(
                        f"{count} source customers share the email '{email}'; the "
                        "duplicates and their subscriptions won't be imported."
                    ),
                    source_id=None,
                )

    def _check_missing_country(self, count: int) -> Iterable[PrecheckIssue]:
        if count > 0:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="customer_missing_country",
                message=(
                    f"{count} customers have no billing country; the payment "
                    "card's country will be used as a default."
                ),
                source_id=None,
            )

    def _check_subscription(
        self, subscription: CanonicalSubscription
    ) -> Iterable[PrecheckIssue]:
        source_id = subscription.source_id
        if subscription.line_item_count > 1:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="multiple_line_items",
                message=(
                    "Subscription has multiple line items, which can't be "
                    "represented; it won't be imported."
                ),
                source_id=source_id,
            )
        if subscription.quantity > 1:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="unsupported_quantity",
                message=(
                    f"Subscription has quantity {subscription.quantity}; Polar "
                    "doesn't support per-subscription quantity, so it won't be "
                    "imported."
                ),
                source_id=source_id,
            )
        if subscription.collection_method == CanonicalCollectionMethod.send_invoice:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="send_invoice_collection",
                message=(
                    "Invoice-collected subscriptions can't be handled; it won't "
                    "be imported."
                ),
                source_id=source_id,
            )
        if subscription.status in NON_IMPORTABLE_STATUSES:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="subscription_not_importable",
                message=(
                    f"Subscription is {subscription.status.value}; it won't be "
                    "imported and stays on the current provider."
                ),
                source_id=source_id,
            )
        if subscription.paused_collection:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="subscription_paused_collection",
                message=(
                    "Subscription has paused collection; it won't be imported and "
                    "stays on the current provider."
                ),
                source_id=source_id,
            )
        if subscription.trialing:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="subscription_trialing",
                message="Subscription is on trial.",
                source_id=source_id,
            )
        payment_method = subscription.payment_method
        if payment_method is not None and payment_method.type.requires_reentry:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="payment_method_requires_reentry",
                message=(
                    f"Payment method ({payment_method.type.value}) can't be "
                    "copied; the customer must re-enter their billing details."
                ),
                source_id=source_id,
            )


precheck_engine = PrecheckEngine()


def _interval_label(product: CanonicalProduct) -> str:
    if product.recurring_interval is None:
        return "One-time"
    count = product.recurring_interval_count
    if count == 1:
        return f"Every {product.recurring_interval}"
    return f"Every {count} {product.recurring_interval}s"


def _amount_label(amount: int | None, currency: str) -> str:
    if amount is None:
        return "No amount"
    return format_currency(amount, currency)


def _drop_reason(
    issues: Iterable[PrecheckIssue], codes: set[str]
) -> tuple[str | None, str | None]:
    for issue in issues:
        if issue.code in codes:
            return issue.code, issue.message
    return None, None


def _item(
    entity: PrecheckEntity,
    source_id: str,
    title: str,
    subtitle: str | None,
    *,
    reason_code: str | None,
    reason: str | None,
) -> MerchantMigrationRecordItem:
    return MerchantMigrationRecordItem(
        entity=entity,
        source_id=source_id,
        title=title,
        subtitle=subtitle,
        status=(
            PrecheckRecordStatus.skipped
            if reason_code
            else PrecheckRecordStatus.importable
        ),
        reason=reason,
        reason_code=reason_code,
    )


def _duplicate_product_names(
    products: Sequence[CanonicalProduct],
) -> tuple[dict[str, str], set[str]]:
    """A name is a duplicate only when two *distinct* source products share it;
    one product split into several interval rows keeps the same source id and is
    not a duplicate.
    """
    first_source_id_by_name: dict[str, str] = {}
    duplicate_names: set[str] = set()
    for product in products:
        first = first_source_id_by_name.setdefault(
            product.name, product.product_source_id
        )
        if first != product.product_source_id:
            duplicate_names.add(product.name)
    return first_source_id_by_name, duplicate_names


def _product_drop(
    product: CanonicalProduct,
    first_source_id_by_name: dict[str, str],
    duplicate_names: set[str],
) -> tuple[str | None, str | None]:
    code, reason = _drop_reason(
        precheck_engine._check_product(product), PRODUCT_DROP_CODES
    )
    if (
        code is None
        and product.name in duplicate_names
        and product.product_source_id != first_source_id_by_name[product.name]
    ):
        return "duplicate_product_name", _DUPLICATE_PRODUCT_NAME_REASON
    return code, reason


def _duplicate_customer_source_ids(
    customers: Sequence[CanonicalCustomer],
) -> set[str]:
    email_counts = Counter(c.email.lower() for c in customers if c.email)
    seen: set[str] = set()
    duplicates: set[str] = set()
    for customer in customers:
        key = customer.email.lower() if customer.email else ""
        if key and email_counts[key] > 1 and key in seen:
            duplicates.add(customer.source_id)
        if key:
            seen.add(key)
    return duplicates


def _importable_price_source_ids(
    products: Sequence[CanonicalProduct],
    first_source_id_by_name: dict[str, str],
    duplicate_names: set[str],
) -> set[str]:
    """Prices that will import: their product imports and the price passes its
    own checks. A subscription whose price is *not* in this set can't import
    either — whether the price was dropped or never extracted at all (e.g. the
    subscription runs on an archived price the source no longer lists)."""
    importable: set[str] = set()
    for product in products:
        product_code, _ = _product_drop(
            product, first_source_id_by_name, duplicate_names
        )
        if product_code is not None:
            continue
        for price in product.prices:
            price_code, _ = _drop_reason(
                precheck_engine._check_price(product, price), PRICE_DROP_CODES
            )
            if price_code is None:
                importable.add(price.source_id)
    return importable


def _product_items(
    products: Sequence[CanonicalProduct],
) -> list[MerchantMigrationRecordItem]:
    first_source_id_by_name, duplicate_names = _duplicate_product_names(products)
    items: list[MerchantMigrationRecordItem] = []
    for product in products:
        code, reason = _product_drop(product, first_source_id_by_name, duplicate_names)
        items.append(
            _item(
                PrecheckEntity.products,
                product.product_source_id,
                product.name,
                _interval_label(product),
                reason_code=code,
                reason=reason,
            )
        )
    return items


def _price_items(
    products: Sequence[CanonicalProduct],
) -> list[MerchantMigrationRecordItem]:
    first_source_id_by_name, duplicate_names = _duplicate_product_names(products)
    items: list[MerchantMigrationRecordItem] = []
    for product in products:
        # A price under a product that won't import can't import either.
        product_code, product_reason = _product_drop(
            product, first_source_id_by_name, duplicate_names
        )
        for price in product.prices:
            code: str | None
            reason: str | None
            if product_code is not None:
                code, reason = product_code, product_reason
            else:
                code, reason = _drop_reason(
                    precheck_engine._check_price(product, price), PRICE_DROP_CODES
                )
            items.append(
                _item(
                    PrecheckEntity.prices,
                    price.source_id,
                    product.name,
                    _amount_label(price.amount, price.currency),
                    reason_code=code,
                    reason=reason,
                )
            )
    return items


def _customer_items(
    customers: Sequence[CanonicalCustomer],
) -> list[MerchantMigrationRecordItem]:
    duplicates = _duplicate_customer_source_ids(customers)
    items: list[MerchantMigrationRecordItem] = []
    for customer in customers:
        if customer.source_id in duplicates:
            code: str | None = "duplicate_customer_email"
            reason: str | None = _DUPLICATE_CUSTOMER_EMAIL_REASON
        else:
            code, reason = None, None
        items.append(
            _item(
                PrecheckEntity.customers,
                customer.source_id,
                customer.email or customer.name or customer.source_id,
                customer.country or "No billing country",
                reason_code=code,
                reason=reason,
            )
        )
    return items


def _subscription_items(
    subscriptions: Sequence[CanonicalSubscription],
    products: Sequence[CanonicalProduct],
    customers: Sequence[CanonicalCustomer],
) -> list[MerchantMigrationRecordItem]:
    first_source_id_by_name, duplicate_names = _duplicate_product_names(products)
    importable_prices = _importable_price_source_ids(
        products, first_source_id_by_name, duplicate_names
    )
    skipped_customers = _duplicate_customer_source_ids(customers)
    email_by_source = {c.source_id: c.email for c in customers if c.email}
    items: list[MerchantMigrationRecordItem] = []
    for subscription in subscriptions:
        code, reason = _drop_reason(
            precheck_engine._check_subscription(subscription), SUBSCRIPTION_DROP_CODES
        )
        # A subscription can't import if the records it depends on won't either.
        # `not in importable_prices` also catches prices never extracted (e.g.
        # the subscription runs on an archived price).
        if code is None and subscription.price_source_id not in importable_prices:
            code, reason = (
                "subscription_product_not_importable",
                _SUBSCRIPTION_PRODUCT_REASON,
            )
        elif code is None and subscription.customer_source_id in skipped_customers:
            code, reason = (
                "subscription_customer_not_importable",
                _SUBSCRIPTION_CUSTOMER_REASON,
            )
        title = email_by_source.get(
            subscription.customer_source_id, subscription.customer_source_id
        )
        subtitle = subscription.status.value
        if subscription.trialing:
            subtitle = f"{subtitle} · trial"
        items.append(
            _item(
                PrecheckEntity.subscriptions,
                subscription.source_id,
                title,
                subtitle,
                reason_code=code,
                reason=reason,
            )
        )
    return items


def _split_records(
    records: Sequence[CanonicalRecord],
) -> tuple[
    list[CanonicalProduct],
    list[CanonicalCustomer],
    list[CanonicalSubscription],
]:
    products: list[CanonicalProduct] = []
    customers: list[CanonicalCustomer] = []
    subscriptions: list[CanonicalSubscription] = []
    for record in records:
        if isinstance(record, CanonicalProduct):
            products.append(record)
        elif isinstance(record, CanonicalCustomer):
            customers.append(record)
        elif isinstance(record, CanonicalSubscription):
            subscriptions.append(record)
    return products, customers, subscriptions


def classify_records(
    records: Sequence[CanonicalRecord], entity: PrecheckEntity
) -> list[MerchantMigrationRecordItem]:
    """Classify the source catalog into per-record rows of one entity type,
    each marked importable or skipped with a reason."""
    products, customers, subscriptions = _split_records(records)
    if entity == PrecheckEntity.products:
        return _product_items(products)
    if entity == PrecheckEntity.prices:
        return _price_items(products)
    if entity == PrecheckEntity.customers:
        return _customer_items(customers)
    return _subscription_items(subscriptions, products, customers)


def summarize_records(
    records: Sequence[CanonicalRecord],
) -> list[PrecheckEntitySummary]:
    """Per-entity counts of total/importable/skipped, computed from the same
    classification the review drawer shows."""
    summaries: list[PrecheckEntitySummary] = []
    for entity in PrecheckEntity:
        items = classify_records(records, entity)
        importable = sum(
            1 for item in items if item.status == PrecheckRecordStatus.importable
        )
        summaries.append(
            PrecheckEntitySummary(
                entity=entity,
                total=len(items),
                importable=importable,
                skipped=len(items) - importable,
            )
        )
    return summaries
