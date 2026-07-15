"""Turns CanonicalRecords into a PrecheckReport of blockers, warnings and
per-entity import counts (design Appendices A and D), and classifies individual
records for the review drawer.

The per-record classification reuses the same `_check_*` predicates as the
report, so a record's importable/skipped status always matches the summary.
"""

from collections import Counter
from collections.abc import AsyncIterable, Iterable, Sequence
from dataclasses import dataclass

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
    "subscription_has_discount",
}
_DUPLICATE_PRODUCT_NAME_REASON = (
    "Another product already uses this name; the duplicate stays on the source."
)
_DUPLICATE_CUSTOMER_EMAIL_REASON = (
    "Another customer already uses this email; the duplicate stays on the source."
)
_MISSING_EMAIL_REASON = (
    "The source customer has no email, so it can't be imported into Polar."
)
_SUBSCRIPTION_PRODUCT_REASON = (
    "The product or price for this subscription won't be imported, so it stays "
    "on the source."
)
_SUBSCRIPTION_CUSTOMER_REASON = (
    "The customer for this subscription won't be imported, so it stays on the source."
)
_NO_IMPORTABLE_PRICE_REASON = (
    "None of this product's prices can be imported, so the product is skipped."
)
_MISSING_COUNTRY_REASON = (
    "No billing country. Confirm it before the first renewal so tax is correct."
)
_TRIALING_REASON = "On trial. Billing resumes on Polar when the trial ends."


def _humanize_subscription_status(status: CanonicalSubscriptionStatus) -> str:
    return status.value.replace("_", " ").capitalize()


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
        existing_product_names: set[str] | None = None,
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
        issues.extend(
            self._check_existing_products(
                products_by_name, existing_product_names or set()
            )
        )
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
                    "This one-time product can't be imported as a subscription, "
                    "so it stays on the source."
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

    def _check_existing_products(
        self,
        products_by_name: dict[str, set[str]],
        existing_product_names: set[str],
    ) -> Iterable[PrecheckIssue]:
        # Warn (don't block): the source product still imports, but as a new Polar
        # product alongside the existing one. Mapping onto the existing product is
        # a separate, merchant-driven step.
        for name in products_by_name:
            if name.lower() in existing_product_names:
                yield PrecheckIssue(
                    level=PrecheckIssueLevel.warning,
                    code="product_exists_in_polar",
                    message=(
                        f"A Polar product named '{name}' already exists; importing "
                        "will create a duplicate."
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
        if subscription.has_discount:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="subscription_has_discount",
                message=(
                    "Subscription has a discount, which isn't migrated yet; it "
                    "won't be imported so the customer isn't overcharged."
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
                    f"This {_humanize_subscription_status(subscription.status).lower()} "
                    "subscription can't be imported yet; it stays with the "
                    "current provider."
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
    amount: int | None = None,
    currency: str | None = None,
    recurring_interval: str | None = None,
) -> MerchantMigrationRecordItem:
    return MerchantMigrationRecordItem(
        # record_id and import_status come from the ledger via
        # `_attach_record_ids`; the classifier itself has none.
        record_id=None,
        import_status=None,
        entity=entity,
        source_id=source_id,
        title=title,
        subtitle=subtitle,
        amount=amount,
        currency=currency,
        recurring_interval=recurring_interval,
        status=(
            PrecheckRecordStatus.skipped
            if reason_code
            else PrecheckRecordStatus.importable
        ),
        reason=reason,
        reason_code=reason_code,
    )


# The price shown on a priced row: (amount, currency, interval). A product is
# represented by its first price; a subscription by the price it runs on.
def _price_info(
    products: Sequence[CanonicalProduct],
) -> dict[str, tuple[int | None, str, str | None]]:
    info: dict[str, tuple[int | None, str, str | None]] = {}
    for product in products:
        for price in product.prices:
            info[price.source_id] = (
                price.amount,
                price.currency,
                product.recurring_interval,
            )
    return info


def _representative_price(
    product: CanonicalProduct,
) -> tuple[int | None, str | None, str | None]:
    if not product.prices:
        return None, None, None
    price = product.prices[0]
    return price.amount, price.currency, product.recurring_interval


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


def _product_items(
    products: Sequence[CanonicalProduct],
) -> list[MerchantMigrationRecordItem]:
    # Classify with the importer's own plan so the report never promises a product
    # the importer will later skip (e.g. one with no importable price).
    plans = plan_product_imports(products)
    items: list[MerchantMigrationRecordItem] = []
    for product in products:
        plan = plans[product.source_id]
        amount, currency, interval = _representative_price(product)
        items.append(
            _item(
                PrecheckEntity.products,
                product.product_source_id,
                product.name,
                _interval_label(product),
                reason_code=plan.skip_code,
                reason=plan.skip_reason,
                amount=amount,
                currency=currency,
                recurring_interval=interval,
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
            subtitle = (
                "No amount"
                if price.amount is None
                else format_currency(price.amount, price.currency)
            )
            items.append(
                _item(
                    PrecheckEntity.prices,
                    price.source_id,
                    product.name,
                    subtitle,
                    reason_code=code,
                    reason=reason,
                )
            )
    return items


def _customer_items(
    customers: Sequence[CanonicalCustomer],
) -> list[MerchantMigrationRecordItem]:
    # Classify with the importer's own plan so the report never promises a customer
    # the importer will later skip (e.g. one with no email).
    plans = plan_customer_imports(customers)
    items: list[MerchantMigrationRecordItem] = []
    for customer in customers:
        code, reason = plans[customer.source_id]
        if code is None and not customer.country:
            # A warning, not a skip: it still imports, but a missing country means
            # tax can't be computed until the merchant confirms it.
            reason = _MISSING_COUNTRY_REASON
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
    # Classify with the importer's own plan so the report matches the import;
    # layer the display-only trialing warning on top.
    plans = plan_subscription_imports(subscriptions, products, customers)
    email_by_source = {c.source_id: c.email for c in customers if c.email}
    price_info = _price_info(products)
    items: list[MerchantMigrationRecordItem] = []
    for subscription in subscriptions:
        code, reason = plans[subscription.source_id]
        if code is None and subscription.trialing:
            # A warning, not a skip: the trial carries over, but it's worth the
            # merchant's eye since billing resumes when it ends.
            reason = _TRIALING_REASON
        title = email_by_source.get(
            subscription.customer_source_id, subscription.customer_source_id
        )
        subtitle = _humanize_subscription_status(subscription.status)
        amount, currency, interval = price_info.get(
            subscription.price_source_id, (None, None, None)
        )
        items.append(
            _item(
                PrecheckEntity.subscriptions,
                subscription.source_id,
                title,
                subtitle,
                reason_code=code,
                reason=reason,
                amount=amount,
                currency=currency,
                recurring_interval=interval,
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


@dataclass
class ProductImportPlan:
    """The importer's decision for one canonical product (keyed by its
    ``source_id``, the ``(product, interval)`` composite). Either a skip with a
    reason, or the set of price ``source_id``s to create under the Polar product.
    """

    skip_code: str | None
    skip_reason: str | None
    importable_price_ids: set[str]

    @property
    def importable(self) -> bool:
        return self.skip_code is None


def plan_product_imports(
    products: Sequence[CanonicalProduct],
) -> dict[str, ProductImportPlan]:
    """What the catalog importer should do with each canonical product, using the
    exact same predicates as the precheck report so imported == report-importable.

    A product is skipped when its own checks fail (one-time, unsupported interval,
    duplicate name) or when none of its prices can be imported (a product with no
    price is unsellable). Otherwise it imports with the prices that pass.
    """
    first_source_id_by_name, duplicate_names = _duplicate_product_names(products)
    plans: dict[str, ProductImportPlan] = {}
    for product in products:
        code, reason = _product_drop(product, first_source_id_by_name, duplicate_names)
        if code is not None:
            plans[product.source_id] = ProductImportPlan(code, reason, set())
            continue
        price_ids = {
            price.source_id
            for price in product.prices
            if _drop_reason(
                precheck_engine._check_price(product, price), PRICE_DROP_CODES
            )[0]
            is None
        }
        if not price_ids:
            plans[product.source_id] = ProductImportPlan(
                "no_importable_price", _NO_IMPORTABLE_PRICE_REASON, set()
            )
        else:
            plans[product.source_id] = ProductImportPlan(None, None, price_ids)
    return plans


def plan_customer_imports(
    customers: Sequence[CanonicalCustomer],
) -> dict[str, tuple[str | None, str | None]]:
    """Per customer ``source_id``, the skip ``(code, reason)`` or ``(None, None)``
    when importable. Duplicate emails are reused, not re-imported (design
    Appendix A), so only the later duplicate is skipped; a customer with no email
    can't be imported at all."""
    duplicates = _duplicate_customer_source_ids(customers)
    plans: dict[str, tuple[str | None, str | None]] = {}
    for customer in customers:
        if customer.source_id in duplicates:
            plans[customer.source_id] = (
                "duplicate_customer_email",
                _DUPLICATE_CUSTOMER_EMAIL_REASON,
            )
        elif not customer.email:
            plans[customer.source_id] = (
                "customer_missing_email",
                _MISSING_EMAIL_REASON,
            )
        else:
            plans[customer.source_id] = (None, None)
    return plans


def plan_subscription_imports(
    subscriptions: Sequence[CanonicalSubscription],
    products: Sequence[CanonicalProduct],
    customers: Sequence[CanonicalCustomer],
) -> dict[str, tuple[str | None, str | None]]:
    """Per subscription ``source_id``, the skip ``(code, reason)`` or
    ``(None, None)`` when importable. Mirrors the review drawer's per-subscription
    classification: a subscription can't import if its own checks fail or the
    product/price or customer it depends on won't import."""
    importable_prices = {
        price_id
        for plan in plan_product_imports(products).values()
        for price_id in plan.importable_price_ids
    }
    skipped_customers = _duplicate_customer_source_ids(customers)
    plans: dict[str, tuple[str | None, str | None]] = {}
    for subscription in subscriptions:
        code, reason = _drop_reason(
            precheck_engine._check_subscription(subscription), SUBSCRIPTION_DROP_CODES
        )
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
        plans[subscription.source_id] = (code, reason)
    return plans


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
