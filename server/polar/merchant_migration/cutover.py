"""The cutover: Polar takes over billing for the imported subscriptions.

Imported subscriptions sit paused so nothing bills while the cards move. Cutting
one over stops it on the source, then unpauses it on Polar. Every check runs
before the stop, so a subscription that fails one is left billing on the source.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

import stripe as stripe_lib
import structlog
from sqlalchemy.orm import joinedload, noload, selectinload

from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import (
    Customer,
    MerchantMigration,
    MerchantMigrationRecord,
    PaymentMethod,
    Subscription,
)
from polar.models.merchant_migration_record import MerchantMigrationCutoverStatus
from polar.models.subscription import SubscriptionStatus
from polar.payment_method.repository import PaymentMethodRepository
from polar.postgres import AsyncSession
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import subscription as subscription_service

from . import pan_transfer
from .adapters import SourceAdapter
from .canonical import (
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
    deserialize,
    normalize_price_source_id,
)
from .cards import CopiedCardResolutionError, link_payment_method
from .precheck import subscription_import_reason

log: Logger = structlog.get_logger()

# Renewing sooner than this stays on the source: once it has charged, the next
# period opens up and the cutover can be retried.
RENEWAL_SAFETY_WINDOW = timedelta(hours=24)

MIGRATABLE_SOURCE_STATUSES = frozenset(
    {CanonicalSubscriptionStatus.active, CanonicalSubscriptionStatus.trialing}
)

_MINIMUM_PERIOD = timedelta(days=1)

# Re-read under the lock, so anything the activation decides on belongs here.
_LOCKED_COLUMNS = ["status", "current_period_start", "current_period_end"]

_GONE = "It no longer exists on the source, so there is nothing to take over."
_SOURCE_CANCELED = (
    "It was cancelled on the source after the import, so Polar won't start billing it."
)
_SOURCE_NOT_LIVE = (
    "The source reports it as `{status}`, which isn't a healthy subscription "
    "Polar can take billing over from."
)
_ENDING = (
    "It's set to cancel at the end of the period on the source, so there is no "
    "renewal for Polar to take over. It stays there until it ends."
)
_PLAN_CHANGED = (
    "The plan changed on the source since the import, so the imported "
    "subscription no longer matches. Re-run the import for this customer."
)
_NO_CARD = (
    "No copied card has landed on Polar for this customer yet. They need to "
    "enter their billing details again, or the copy has to pick them up."
)
_NOT_PAUSED = "It isn't paused in Polar any more, so it was left alone."
_STRANDED = (
    "It was already stopped on the source, but no payment method has landed on "
    "Polar for this customer, so nobody is billing them. They need to enter "
    "their billing details, then run this again."
)
_CARD_EXPIRED = (
    "The copied card has expired, so the first Polar renewal will fail and go to "
    "dunning. The customer needs to enter a new one."
)
_UNREADABLE = (
    "We can't read what was imported for this subscription, so we can't tell "
    "whether it still matches the source. Re-run the import for this customer."
)
_CUSTOMER_DELETED = "The Polar customer was deleted, so it can't be billed."
_SUBSCRIPTION_GONE = "The imported Polar subscription no longer exists."
_NOT_IMPORTED = (
    "It was never imported into Polar, so there is nothing to switch on. Re-run "
    "the import for this customer."
)
_LAPSED = (
    "It was stopped on the source more than one renewal ago, so switching it on "
    "now would bill the customer for every period missed since. Contact support "
    "to set its next billing date first."
)
_RENEWALS_DISABLED = (
    "Your organization can't renew subscriptions yet, so Polar wouldn't bill "
    "this one after taking it over. It stays on the source until your account "
    "is active."
)


@dataclass(frozen=True)
class CutoverOutcome:
    status: MerchantMigrationCutoverStatus
    # Why it didn't move, or what to chase on one that did.
    message: str | None = None


def _moved(message: str | None = None) -> CutoverOutcome:
    return CutoverOutcome(MerchantMigrationCutoverStatus.moved, message)


def _skip(reason: str) -> CutoverOutcome:
    return CutoverOutcome(MerchantMigrationCutoverStatus.skipped, reason)


def _fail(reason: str) -> CutoverOutcome:
    return CutoverOutcome(MerchantMigrationCutoverStatus.failed, reason)


class SubscriptionCutover:
    """Cuts one imported subscription over, or explains why it didn't."""

    def __init__(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        adapter: SourceAdapter,
    ) -> None:
        self.session = session
        self.migration = migration
        self.adapter = adapter
        self.subscription_repository = SubscriptionRepository.from_session(session)

    async def run(self, record: MerchantMigrationRecord) -> CutoverOutcome:
        try:
            return await self._run(record)
        except CopiedCardResolutionError as e:
            # Recorded rather than raised: one customer must not stop the run.
            log.warning(
                "merchant_migration.cutover.card_resolution_error",
                migration_id=self.migration.id,
                record_id=record.id,
                subscription_id=record.target_id,
                error=str(e),
            )
            return _fail(str(e))
        except stripe_lib.StripeError as e:
            # Failed, not skipped: nothing here is this subscription's fault.
            log.warning(
                "merchant_migration.cutover.stripe_error",
                migration_id=self.migration.id,
                record_id=record.id,
                source_id=record.source_id,
                error=str(e),
            )
            return _fail(e.user_message or str(e))

    async def _run(self, record: MerchantMigrationRecord) -> CutoverOutcome:
        if record.target_id is None:
            return _fail(_NOT_IMPORTED)
        subscription = await self._load_subscription(record.target_id)
        if subscription is None:
            return _fail(_SUBSCRIPTION_GONE)
        if SubscriptionStatus.is_active(subscription.status):
            return await self._reconcile_active(record)
        if subscription.status != SubscriptionStatus.paused:
            return _skip(_NOT_PAUSED)

        customer = subscription.customer
        if customer.is_deleted:
            return _skip(_CUSTOMER_DELETED)

        source = await self.adapter.get_subscription(record.source_id)
        if source is None:
            return _skip(_GONE)

        # We cancelled it ourselves, in an attempt that died before it committed.
        # The checks below would read that as the customer churning and skip for
        # good, leaving them cancelled on the source and paused here.
        already_stopped = source.stopped_for_migration
        if not already_stopped:
            # The renewal scheduler filters on this, so taking the subscription
            # over would cancel it on the source and then never bill it.
            if not subscription.organization.can_renew_subscriptions:
                return _skip(_RENEWALS_DISABLED)
            reason = self._source_reason(source, record, subscription.currency)
            if reason is not None:
                return _skip(reason)

        # Behind the gate above because resolving writes: it upserts the copied
        # methods and may set the customer's default.
        payment_method = await self._resolve_payment_method(
            subscription, customer, source
        )
        if already_stopped:
            # An unproven card beats no biller at all: a failed first renewal
            # goes to dunning, which is recoverable.
            if payment_method is None:
                log.error(
                    "merchant_migration.cutover.stranded",
                    migration_id=self.migration.id,
                    record_id=record.id,
                    source_id=record.source_id,
                )
                return _fail(_STRANDED)
            if subscription.is_period_lapsed(self._period_end(source, subscription)):
                return _fail(_LAPSED)
        elif payment_method is None:
            return _skip(_NO_CARD)

        # Locked only now: the portal takes this same row lock, and everything
        # above spends seconds in Stripe. Bailing here is still free.
        await self.session.refresh(subscription, _LOCKED_COLUMNS, with_for_update=True)
        if subscription.status != SubscriptionStatus.paused:
            return _skip(_NOT_PAUSED)

        if not already_stopped:
            await self.adapter.stop_source_subscription(
                record.source_id, reference=str(self.migration.id)
            )

        current_period_start, current_period_end = self._period(source, subscription)
        try:
            await subscription_service.activate_imported(
                self.session,
                subscription,
                current_period_start=current_period_start,
                current_period_end=current_period_end,
                trial_end=self._trial_end(source),
                anchor_day=source.anchor_day,
                payment_method=payment_method,
            )
        except Exception:
            # The source is stopped and this rolls back, ledger row included, so
            # the log is the only trace of a customer nobody is billing.
            log.exception(
                "merchant_migration.cutover.stopped_but_unfinished",
                migration_id=self.migration.id,
                record_id=record.id,
                source_id=record.source_id,
            )
            raise
        log.info(
            "merchant_migration.cutover.moved",
            migration_id=self.migration.id,
            subscription_id=subscription.id,
            source_id=record.source_id,
        )
        return _moved(self._card_note(payment_method))

    async def _reconcile_active(
        self, record: MerchantMigrationRecord
    ) -> CutoverOutcome:
        """Already live on Polar, so make sure it isn't live on the source too.

        Usually a previous run finishing twice, but a customer can also resume
        from their portal, and then both sides bill them.
        """
        source = await self.adapter.get_subscription(record.source_id)
        if source is not None and source.status != CanonicalSubscriptionStatus.canceled:
            log.warning(
                "merchant_migration.cutover.source_still_live",
                migration_id=self.migration.id,
                source_id=record.source_id,
            )
            await self.adapter.stop_source_subscription(
                record.source_id, reference=str(self.migration.id)
            )
        return _moved()

    async def _load_subscription(self, subscription_id: UUID) -> Subscription | None:
        return await self.subscription_repository.get_by_id(
            subscription_id,
            options=(
                joinedload(Subscription.customer).noload(Customer.owner),
                joinedload(Subscription.organization),
                noload(Subscription.meters),
                selectinload(Subscription.subscription_product_prices),
            ),
        )

    def _source_reason(
        self,
        source: CanonicalSubscription,
        record: MerchantMigrationRecord,
        imported_currency: str,
    ) -> str | None:
        """Why the source says this subscription shouldn't move today."""
        if source.status == CanonicalSubscriptionStatus.canceled:
            return _SOURCE_CANCELED
        migratable = source.status in MIGRATABLE_SOURCE_STATUSES
        if migratable and source.cancel_at_period_end:
            return _ENDING
        # The import's own bar, re-applied: the source has had weeks to grow a
        # second line item, a coupon or a manual invoice.
        reason = subscription_import_reason(source)
        if reason is not None:
            return reason.message
        if not migratable:
            return _SOURCE_NOT_LIVE.format(status=source.status.value)
        try:
            staged = deserialize(record.type, record.canonical)
        except KeyError, TypeError, ValueError:
            # Raising would stall the chain, so it stops at this record instead.
            return _UNREADABLE
        if isinstance(staged, CanonicalSubscription):
            if normalize_price_source_id(
                staged.price_source_id
            ) != normalize_price_source_id(source.price_source_id):
                return _PLAN_CHANGED
            if source.currency != imported_currency:
                return _PLAN_CHANGED
        return self._renewal_reason(source)

    def _renewal_reason(self, source: CanonicalSubscription) -> str | None:
        renewal = source.current_period_end
        if renewal is None:
            return (
                "The source doesn't report a renewal date, so we can't tell "
                "whether it's about to bill this subscription."
            )
        deadline = utc_now() + RENEWAL_SAFETY_WINDOW
        if renewal > deadline:
            return None
        return (
            f"It renews on the source at {renewal.isoformat()}, too soon to hand "
            "over without risking a double charge. Retry once that renewal has "
            "gone through."
        )

    async def _resolve_payment_method(
        self,
        subscription: Subscription,
        customer: Customer,
        source: CanonicalSubscription,
    ) -> PaymentMethod | None:
        """The card the first Polar renewal will charge. A card the `verify_cards`
        step linked wins; otherwise look again, because cards keep landing."""
        source_method = source.payment_method
        payment_method: PaymentMethod | None = None
        if subscription.payment_method_id is not None:
            payment_method = await PaymentMethodRepository.from_session(
                self.session
            ).get_by_id(subscription.payment_method_id)
        if payment_method is not None:
            return payment_method
        if pan_transfer.stripe_mapping_applied(
            self.migration.pan_transfer_method, self.migration.pan_transfer_steps
        ):
            return None
        return await link_payment_method(
            self.session, customer, source_method=source_method
        )

    def _card_note(self, payment_method: PaymentMethod) -> str | None:
        """What the merchant should chase, not a reason to hold the switch back.

        A card only proves itself on a real charge, and a first renewal that
        fails already goes to dunning. Leaving the subscription on the provider
        the merchant is closing helps nobody, so the checks here stay free and
        the answer travels with a subscription that moved.
        """
        expires_at = payment_method.expires_at
        if expires_at is None or expires_at > utc_now():
            return None
        return _CARD_EXPIRED

    def _period(
        self, source: CanonicalSubscription, subscription: Subscription
    ) -> tuple[datetime, datetime]:
        """Where the source left the billing cycle. Read now, not at import: it
        has kept renewing in between, so the staged period is stale."""
        end = self._period_end(source, subscription)
        start = source.current_period_start
        if start is None or start >= end:
            # Polar's own start belongs to whichever period the import caught,
            # which can be renewals behind this end. Reuse its length, not it.
            length = subscription.current_period_end - subscription.current_period_start
            start = end - max(length, _MINIMUM_PERIOD)
        return start, end

    def _period_end(
        self, source: CanonicalSubscription, subscription: Subscription
    ) -> datetime:
        return source.current_period_end or subscription.current_period_end

    def _trial_end(self, source: CanonicalSubscription) -> datetime | None:
        """Keep a running trial running: Polar bills at its end, not today.

        Off the date, not the status: a retry reads the source we cancelled
        ourselves, which says `canceled` while the trial is still running.
        """
        if source.trial_end is None or source.trial_end <= utc_now():
            return None
        return source.trial_end
