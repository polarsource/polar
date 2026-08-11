"""Turns CanonicalRecords into a PrecheckReport of blockers, warnings and
per-entity import counts (design Appendices A and D), and classifies individual
records for the review drawer.

The per-record classification reuses the same `_check_*` predicates as the
report, so a record's importable/skipped status always matches the summary.
Each reason also carries a level: `action_required` when the merchant has to fix
something, `info` when there is nothing to fix.
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
    PrecheckReasonLevel,
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

# Codes whose warning means a record won't import, by entity. Keep in sync with
# the `_check_*` methods so classification matches the report.
PRODUCT_DROP_CODES = {
    "one_time_product",
    "unsupported_recurring_interval",
    "multiple_prices_same_currency",
    "missing_default_currency_price",
}
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
# Reasons the merchant has to act on. Every other code is informational: the
# record either imports as-is, or Polar can't take it and there is nothing to do.
ACTION_REQUIRED_CODES = {
    "customer_missing_country",
    "customer_missing_email",
    "duplicate_customer_email",
    "missing_default_currency_price",
    "multiple_prices_same_currency",
    "subscription_has_discount",
    "send_invoice_collection",
}
_DUPLICATE_PRODUCT_NAME_REASON = (
    "Another source product uses this name. Both import and share it in Polar."
)
_EXISTING_PRODUCT_NAME_REASON = (
    "A Polar product already uses this name. Importing adds a second one."
)
_DUPLICATE_CUSTOMER_EMAIL_REASON = (
    "Another source customer uses this email, and a Polar customer can only carry "
    "one source id. Merge them at the source, then run the pre-check again."
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
_PAYMENT_REENTRY_REASON = (
    "The payment method can't be copied. Ask the customer to re-enter their "
    "billing details."
)


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
        default_currency = organization.default_presentment_currency

        issues: list[PrecheckIssue] = list(self._check_organization(organization))
        issues.extend(self._check_account(source_account))

        products: list[CanonicalProduct] = []
        products_by_name: dict[str, set[str]] = {}
        email_counts: Counter[str] = Counter()
        customers_without_country = 0
        customers_without_email = 0

        for record in record_list:
            if isinstance(record, CanonicalProduct):
                products.append(record)
                products_by_name.setdefault(record.name, set()).add(
                    record.product_source_id
                )
                issues.extend(self._check_product(record, default_currency))
            elif isinstance(record, CanonicalCustomer):
                if record.email:
                    email_counts[record.email.lower()] += 1
                else:
                    customers_without_email += 1
                if not record.country:
                    customers_without_country += 1
            elif isinstance(record, CanonicalSubscription):
                issues.extend(self._check_subscription(record))

        issues.extend(self._check_default_currency(products, default_currency))
        issues.extend(self._check_duplicate_names(products_by_name))
        issues.extend(
            self._check_existing_products(
                products_by_name, existing_product_names or set()
            )
        )
        issues.extend(self._check_duplicate_emails(email_counts))
        issues.extend(self._check_missing_email(customers_without_email))
        issues.extend(self._check_missing_country(customers_without_country))

        return PrecheckReport(
            issues=issues,
            can_start=not any(
                issue.level == PrecheckIssueLevel.blocker for issue in issues
            ),
            entities=summarize_records(record_list, default_currency),
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
        if account.has_connected_accounts:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.blocker,
                code="source_has_connected_accounts",
                message=(
                    "The source has Connect accounts. Only data on the platform "
                    "account can be copied, so it can't be migrated automatically."
                ),
                source_id=None,
            )

    def _check_default_currency(
        self, products: Sequence[CanonicalProduct], default_currency: str
    ) -> Iterable[PrecheckIssue]:
        """A catalog priced entirely in another currency imports nothing: every
        product is dropped for the same reason. Say it once, up front, with the
        two ways out, instead of leaving the merchant to read it off every row.
        """
        plans = plan_product_imports(products, default_currency)
        skips = [plans[product.source_id].skip for product in products]
        dropped_for_currency = [
            product
            for product, skip in zip(products, skips, strict=True)
            if skip is not None and skip.code == "missing_default_currency_price"
        ]
        if not dropped_for_currency:
            return
        # Some products still import, so their rows carry the reason on their own.
        if any(skip is None for skip in skips):
            return

        # Only the currencies Polar would have taken: naming a price it drops
        # anyway would send the merchant after a currency it can't switch to.
        currencies = sorted(
            {
                currency.upper()
                for product in dropped_for_currency
                for currency in self._importable_price_currencies(product)
            }
        )
        yield PrecheckIssue(
            level=PrecheckIssueLevel.blocker,
            code="no_default_currency_prices",
            message=(
                "No product can be imported. The ones that could be are priced "
                f"in {', '.join(currencies)}, and your organization's default "
                f"currency is {default_currency.upper()}. Change the default "
                "currency in your organization's payment settings, or add "
                f"{default_currency.upper()} prices at the source, then refresh."
            ),
            source_id=None,
        )

    def _check_product(
        self, product: CanonicalProduct, default_currency: str
    ) -> Iterable[PrecheckIssue]:
        # A product Polar can't represent is skipped along with its subscriptions,
        # rather than blocking the whole migration.
        dropped = False
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
            dropped = True
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
            dropped = True
        for price in product.prices:
            yield from self._check_price(product, price)
        # Only worth reporting on a product that would otherwise import.
        if dropped:
            return
        importable_currencies = self._importable_price_currencies(product)
        for currency, count in importable_currencies.items():
            if count > 1:
                yield PrecheckIssue(
                    level=PrecheckIssueLevel.warning,
                    code="multiple_prices_same_currency",
                    message=(
                        f"Product '{product.name}' has {count} prices in "
                        f"{currency.upper()}; Polar allows one per currency, so it "
                        "and its subscriptions won't be imported."
                    ),
                    source_id=product.source_id,
                )
        # A Polar product must price in the organization's default currency: it's
        # the fallback for every checkout that has no local price. A product with
        # no importable price at all is reported as such instead.
        if importable_currencies and default_currency not in importable_currencies:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="missing_default_currency_price",
                message=(
                    f"Product '{product.name}' has no price in "
                    f"{default_currency.upper()}, your organization's default "
                    "currency, so it and its subscriptions won't be imported. "
                    f"Add a {default_currency.upper()} price at the source, then "
                    "refresh."
                ),
                source_id=product.source_id,
            )

    def _importable_price_currencies(self, product: CanonicalProduct) -> Counter[str]:
        """How many prices Polar would take, per currency."""
        currencies: Counter[str] = Counter()
        for price in product.prices:
            if (
                _drop_reason(self._check_price(product, price), PRICE_DROP_CODES)
                is None
            ):
                currencies[price.currency.lower()] += 1
        return currencies

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
                        f"Multiple products share the name '{name}'; they all "
                        "import and keep the shared name."
                    ),
                    source_id=None,
                )

    def _check_existing_products(
        self,
        products_by_name: dict[str, set[str]],
        existing_product_names: set[str],
    ) -> Iterable[PrecheckIssue]:
        # Warn, don't block: the product still imports, as a new Polar product next
        # to the existing one. Mapping onto it is a later, merchant-driven step.
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

    def _check_missing_email(self, count: int) -> Iterable[PrecheckIssue]:
        if count > 0:
            yield PrecheckIssue(
                level=PrecheckIssueLevel.warning,
                code="customer_missing_email",
                message=(
                    f"{count} customers have no email; they and their subscriptions "
                    "won't be imported."
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


@dataclass(frozen=True)
class Reason:
    """Why a record is skipped, or what to know about one that isn't."""

    code: str
    message: str

    @property
    def level(self) -> PrecheckReasonLevel:
        if self.code in ACTION_REQUIRED_CODES:
            return PrecheckReasonLevel.action_required
        return PrecheckReasonLevel.info


@dataclass(frozen=True)
class PriceDisplay:
    """The price shown on a priced review row."""

    amount: int | None = None
    currency: str | None = None
    recurring_interval: str | None = None

    @classmethod
    def of(cls, product: CanonicalProduct, price: CanonicalPrice) -> "PriceDisplay":
        return cls(price.amount, price.currency, product.recurring_interval)


def subscription_import_reason(
    subscription: CanonicalSubscription,
) -> Reason | None:
    """Why a subscription can't be taken on its own terms, ignoring what its
    product and customer do. The cutover re-reads the source weeks later and
    holds it to the same bar as the import did."""
    return _drop_reason(
        precheck_engine._check_subscription(subscription), SUBSCRIPTION_DROP_CODES
    )


def _drop_reason(issues: Iterable[PrecheckIssue], codes: set[str]) -> Reason | None:
    for issue in issues:
        if issue.code in codes:
            return Reason(issue.code, issue.message)
    return None


def _pick_note(*notes: Reason | None) -> Reason | None:
    """The one note to show on an importable row, worth-acting-on first."""
    present = [note for note in notes if note is not None]
    for note in present:
        if note.level == PrecheckReasonLevel.action_required:
            return note
    return present[0] if present else None


def _item(
    entity: PrecheckEntity,
    source_id: str,
    title: str,
    subtitle: str | None,
    *,
    skip: Reason | None,
    note: Reason | None = None,
    price: PriceDisplay | None = None,
) -> MerchantMigrationRecordItem:
    """One review row. ``skip`` means it won't import; ``note`` only annotates a
    row that will."""
    reason = skip or note
    price = price or PriceDisplay()
    return MerchantMigrationRecordItem(
        # record_id and import_status come from the ledger via
        # `_attach_record_ids`; the classifier itself has none.
        record_id=None,
        import_status=None,
        entity=entity,
        source_id=source_id,
        title=title,
        subtitle=subtitle,
        amount=price.amount,
        currency=price.currency,
        recurring_interval=price.recurring_interval,
        status=(
            PrecheckRecordStatus.skipped if skip else PrecheckRecordStatus.importable
        ),
        reason=reason.message if reason else None,
        reason_code=reason.code if reason else None,
        reason_level=reason.level if reason else None,
    )


def _price_display_by_source_id(
    products: Sequence[CanonicalProduct],
) -> dict[str, PriceDisplay]:
    return {
        price.source_id: PriceDisplay.of(product, price)
        for product in products
        for price in product.prices
    }


def _representative_price(
    product: CanonicalProduct, importable_price_ids: set[str]
) -> PriceDisplay:
    """The price to show on a product row: one that will actually be imported,
    falling back to the first when the product is skipped."""
    price = next(
        (price for price in product.prices if price.source_id in importable_price_ids),
        product.prices[0] if product.prices else None,
    )
    return PriceDisplay.of(product, price) if price else PriceDisplay()


def _duplicate_product_names(products: Sequence[CanonicalProduct]) -> set[str]:
    """A name is a duplicate only when two *distinct* source products share it;
    one product split into several interval rows keeps the same source id and is
    not a duplicate.
    """
    source_ids_by_name: dict[str, set[str]] = {}
    for product in products:
        source_ids_by_name.setdefault(product.name, set()).add(
            product.product_source_id
        )
    return {name for name, ids in source_ids_by_name.items() if len(ids) > 1}


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
    existing_product_names: set[str],
    default_currency: str,
) -> list[MerchantMigrationRecordItem]:
    # Use the importer's plan, so the report can't promise a product it will skip.
    plans = plan_product_imports(products, default_currency)
    duplicate_names = _duplicate_product_names(products)
    items: list[MerchantMigrationRecordItem] = []
    for product in products:
        plan = plans[product.source_id]
        # Sharing a name is allowed in Polar, so it only earns a note.
        note = _pick_note(
            Reason("duplicate_product_name", _DUPLICATE_PRODUCT_NAME_REASON)
            if product.name in duplicate_names
            else None,
            Reason("product_exists_in_polar", _EXISTING_PRODUCT_NAME_REASON)
            if product.name.lower() in existing_product_names
            else None,
        )
        items.append(
            _item(
                PrecheckEntity.products,
                product.product_source_id,
                product.name,
                _interval_label(product),
                skip=plan.skip,
                note=note,
                price=_representative_price(product, plan.importable_price_ids),
            )
        )
    return items


def _price_items(
    products: Sequence[CanonicalProduct],
    default_currency: str,
) -> list[MerchantMigrationRecordItem]:
    items: list[MerchantMigrationRecordItem] = []
    for product in products:
        # A price under a product that won't import can't import either.
        product_skip = _drop_reason(
            precheck_engine._check_product(product, default_currency),
            PRODUCT_DROP_CODES,
        )
        for price in product.prices:
            skip = product_skip or _drop_reason(
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
                    skip=skip,
                    price=PriceDisplay.of(product, price),
                )
            )
    return items


def _customer_items(
    customers: Sequence[CanonicalCustomer],
) -> list[MerchantMigrationRecordItem]:
    # Use the importer's plan, so the report can't promise a customer it will skip.
    plans = plan_customer_imports(customers)
    items: list[MerchantMigrationRecordItem] = []
    for customer in customers:
        # It imports either way, but without a country tax can't be computed.
        note = (
            Reason("customer_missing_country", _MISSING_COUNTRY_REASON)
            if not customer.country
            else None
        )
        items.append(
            _item(
                PrecheckEntity.customers,
                customer.source_id,
                customer.email or customer.name or customer.source_id,
                customer.country or "No billing country",
                skip=plans[customer.source_id],
                note=note,
            )
        )
    return items


def _subscription_items(
    subscriptions: Sequence[CanonicalSubscription],
    products: Sequence[CanonicalProduct],
    customers: Sequence[CanonicalCustomer],
    default_currency: str,
) -> list[MerchantMigrationRecordItem]:
    # Use the importer's plan; the notes on top are display-only.
    plans = plan_subscription_imports(
        subscriptions, products, customers, default_currency
    )
    email_by_source = {c.source_id: c.email for c in customers if c.email}
    price_by_source = _price_display_by_source_id(products)
    items: list[MerchantMigrationRecordItem] = []
    for subscription in subscriptions:
        payment_method = subscription.payment_method
        note = _pick_note(
            Reason("payment_method_requires_reentry", _PAYMENT_REENTRY_REASON)
            if payment_method is not None and payment_method.type.requires_reentry
            else None,
            Reason("subscription_trialing", _TRIALING_REASON)
            if subscription.trialing
            else None,
        )
        title = email_by_source.get(
            subscription.customer_source_id, subscription.customer_source_id
        )
        items.append(
            _item(
                PrecheckEntity.subscriptions,
                subscription.source_id,
                title,
                _humanize_subscription_status(subscription.status),
                skip=plans[subscription.source_id],
                note=note,
                price=price_by_source.get(subscription.price_source_id),
            )
        )
    return items


@dataclass(frozen=True)
class SplitRecords:
    """The staged catalog grouped by entity."""

    products: list[CanonicalProduct]
    customers: list[CanonicalCustomer]
    subscriptions: list[CanonicalSubscription]

    @classmethod
    def of(cls, records: Sequence[CanonicalRecord]) -> "SplitRecords":
        split = cls([], [], [])
        for record in records:
            if isinstance(record, CanonicalProduct):
                split.products.append(record)
            elif isinstance(record, CanonicalCustomer):
                split.customers.append(record)
            elif isinstance(record, CanonicalSubscription):
                split.subscriptions.append(record)
        return split


def _blockers(issues: Iterable[PrecheckIssue]) -> list[PrecheckIssue]:
    return [issue for issue in issues if issue.level == PrecheckIssueLevel.blocker]


def account_blockers(source_account: CanonicalAccount) -> list[PrecheckIssue]:
    """Blockers that come from the source account itself rather than its catalog,
    so the caller can reject the source as soon as it's connected instead of at
    the import."""
    return _blockers(precheck_engine._check_account(source_account))


def import_blockers(
    organization: Organization, source_account: CanonicalAccount
) -> list[PrecheckIssue]:
    """Blockers that don't depend on the catalog, so the import can re-check them
    without re-reading the whole source."""
    return [
        *_blockers(precheck_engine._check_organization(organization)),
        *account_blockers(source_account),
    ]


def classify_records(
    records: Sequence[CanonicalRecord],
    entity: PrecheckEntity,
    default_currency: str,
    existing_product_names: set[str] | None = None,
) -> list[MerchantMigrationRecordItem]:
    """Classify the source catalog into per-record rows of one entity type,
    each marked importable or skipped with a reason."""
    split = SplitRecords.of(records)
    if entity == PrecheckEntity.products:
        return _product_items(
            split.products, existing_product_names or set(), default_currency
        )
    if entity == PrecheckEntity.prices:
        return _price_items(split.products, default_currency)
    if entity == PrecheckEntity.customers:
        return _customer_items(split.customers)
    return _subscription_items(
        split.subscriptions, split.products, split.customers, default_currency
    )


@dataclass
class ProductImportPlan:
    """The importer's decision for one canonical product (keyed by its
    ``source_id``, the ``(product, interval)`` composite). Either a skip with a
    reason, or the set of price ``source_id``s to create under the Polar product.
    """

    skip: Reason | None
    importable_price_ids: set[str]

    @property
    def importable(self) -> bool:
        return self.skip is None


def plan_product_imports(
    products: Sequence[CanonicalProduct],
    default_currency: str,
) -> dict[str, ProductImportPlan]:
    """What the catalog importer should do with each canonical product, using the
    exact same predicates as the precheck report so imported == report-importable.

    A product is skipped when its own checks fail (one-time, unsupported interval,
    no price in the organization's default currency) or when none of its prices
    can be imported (a product with no price is unsellable). Otherwise it imports
    with the prices that pass. Sharing a name with another product is fine: Polar
    doesn't require unique names.
    """
    plans: dict[str, ProductImportPlan] = {}
    for product in products:
        skip = _drop_reason(
            precheck_engine._check_product(product, default_currency),
            PRODUCT_DROP_CODES,
        )
        if skip is not None:
            plans[product.source_id] = ProductImportPlan(skip, set())
            continue
        price_ids = {
            price.source_id
            for price in product.prices
            if _drop_reason(
                precheck_engine._check_price(product, price), PRICE_DROP_CODES
            )
            is None
        }
        if not price_ids:
            plans[product.source_id] = ProductImportPlan(
                Reason("no_importable_price", _NO_IMPORTABLE_PRICE_REASON), set()
            )
        else:
            plans[product.source_id] = ProductImportPlan(None, price_ids)
    return plans


def plan_customer_imports(
    customers: Sequence[CanonicalCustomer],
) -> dict[str, Reason | None]:
    """Per customer ``source_id``, the skip reason or ``None`` when importable.
    A Polar customer is unique by email and carries a single source id, so of
    several customers sharing an email only the first can be imported; a customer
    with no email can't be imported at all."""
    duplicates = _duplicate_customer_source_ids(customers)
    plans: dict[str, Reason | None] = {}
    for customer in customers:
        if customer.source_id in duplicates:
            plans[customer.source_id] = Reason(
                "duplicate_customer_email", _DUPLICATE_CUSTOMER_EMAIL_REASON
            )
        elif not customer.email:
            plans[customer.source_id] = Reason(
                "customer_missing_email", _MISSING_EMAIL_REASON
            )
        else:
            plans[customer.source_id] = None
    return plans


def plan_subscription_imports(
    subscriptions: Sequence[CanonicalSubscription],
    products: Sequence[CanonicalProduct],
    customers: Sequence[CanonicalCustomer],
    default_currency: str,
) -> dict[str, Reason | None]:
    """Per subscription ``source_id``, the skip reason or ``None`` when
    importable. Mirrors the review drawer's per-subscription classification: a
    subscription can't import if its own checks fail or the product/price or
    customer it depends on won't import."""
    importable_prices = {
        price_id
        for plan in plan_product_imports(products, default_currency).values()
        for price_id in plan.importable_price_ids
    }
    importable_customers = {
        source_id
        for source_id, skip in plan_customer_imports(customers).items()
        if skip is None
    }
    plans: dict[str, Reason | None] = {}
    for subscription in subscriptions:
        skip = subscription_import_reason(subscription)
        if skip is None and subscription.price_source_id not in importable_prices:
            skip = Reason(
                "subscription_product_not_importable", _SUBSCRIPTION_PRODUCT_REASON
            )
        elif (
            skip is None and subscription.customer_source_id not in importable_customers
        ):
            skip = Reason(
                "subscription_customer_not_importable", _SUBSCRIPTION_CUSTOMER_REASON
            )
        plans[subscription.source_id] = skip
    return plans


def summarize_records(
    records: Sequence[CanonicalRecord],
    default_currency: str,
) -> list[PrecheckEntitySummary]:
    """Per-entity counts of total/importable/skipped, computed from the same
    classification the review drawer shows."""
    summaries: list[PrecheckEntitySummary] = []
    for entity in PrecheckEntity:
        items = classify_records(records, entity, default_currency)
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
