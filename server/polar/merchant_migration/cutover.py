"""The cutover: Polar takes over billing for the imported subscriptions.

Imported subscriptions sit paused so nothing bills while the cards move. Cutting
over switches one on, and stops it on the old provider, in that order of checks:

1. the subscription is still live on the source, on the same plan;
2. its renewal is far enough out that the source can't bill the period first;
3. the copied card is on Polar and can actually be charged;
4. only then: stop it on the source, and unpause it on Polar.

Everything before step 4 is read-only, so a subscription that fails any check is
left exactly where it is — still billing on the source, still paused on Polar —
with a reason the merchant can act on. The one irreversible act is fenced by all
of them.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

import stripe as stripe_lib
import structlog

from polar.integrations.stripe.service import stripe as stripe_service
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

from .adapters import SourceAdapter
from .canonical import (
    CanonicalPaymentMethod,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
    deserialize,
)
from .cards import CARD_TYPE, AmbiguousCopiedCard, link_payment_method
from .precheck import subscription_import_reason

log: Logger = structlog.get_logger()

# The source must not get the chance to bill the period we're taking over. A
# renewal landing inside this window stays where it is: once the source has
# charged it, the next period opens up and the cutover can be retried.
RENEWAL_SAFETY_WINDOW = timedelta(hours=24)

# Source states we can hand over. Anything else means the customer isn't cleanly
# subscribed there, so there is no healthy billing relationship to take on.
MIGRATABLE_SOURCE_STATUSES = frozenset(
    {CanonicalSubscriptionStatus.active, CanonicalSubscriptionStatus.trialing}
)

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
_NOT_PAUSED = "It isn't paused in Polar any more, so the cutover left it alone."
_CUSTOMER_DELETED = "The Polar customer was deleted, so it can't be billed."
_SUBSCRIPTION_GONE = "The imported Polar subscription no longer exists."


@dataclass(frozen=True)
class CutoverOutcome:
    status: MerchantMigrationCutoverStatus
    reason: str | None = None


_MOVED = CutoverOutcome(MerchantMigrationCutoverStatus.moved)


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
        except AmbiguousCopiedCard as e:
            # One customer nobody can pick a card for must not stop the run for
            # everyone else. Recorded so it surfaces, and retryable once someone
            # has removed the duplicate.
            log.warning(
                "merchant_migration.cutover.ambiguous_card",
                migration_id=self.migration.id,
                record_id=record.id,
                customer_id=e.customer_id,
            )
            return _fail(str(e))
        except stripe_lib.StripeError as e:
            # Reaching Stripe is the one thing that fails for reasons that have
            # nothing to do with this subscription, so it's recorded as failed
            # (retryable) rather than skipped, and the run moves on.
            log.warning(
                "merchant_migration.cutover.stripe_error",
                migration_id=self.migration.id,
                record_id=record.id,
                source_id=record.source_id,
                error=str(e),
            )
            return _fail(e.user_message or str(e))

    async def _run(self, record: MerchantMigrationRecord) -> CutoverOutcome:
        subscription = await self._load_subscription(record)
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

        # A previous attempt already stopped it on the source: the money side is
        # committed, so the only safe move is to finish, not re-run the checks
        # against the cancellation we made ourselves.
        if not source.stopped_for_migration:
            reason = self._source_reason(source, record)
            if reason is not None:
                return _skip(reason)

        payment_method = await self._resolve_payment_method(
            subscription, customer, source.payment_method
        )
        if payment_method is None:
            return _skip(_NO_CARD)
        card_reason = await self._card_reason(customer, payment_method)
        if card_reason is not None:
            return _skip(card_reason)

        if not source.stopped_for_migration:
            await self.adapter.stop_source_subscription(
                record.source_id, reference=str(self.migration.id)
            )

        current_period_start, current_period_end = self._period(source, subscription)
        await subscription_service.activate_imported(
            self.session,
            subscription,
            current_period_start=current_period_start,
            current_period_end=current_period_end,
            trial_end=self._trial_end(source),
            payment_method=payment_method,
        )
        log.info(
            "merchant_migration.cutover.moved",
            migration_id=self.migration.id,
            subscription_id=subscription.id,
            source_id=record.source_id,
        )
        return _MOVED

    async def _reconcile_active(
        self, record: MerchantMigrationRecord
    ) -> CutoverOutcome:
        """The Polar subscription is already live, so make sure the source isn't.

        Usually a previous run finishing twice. But a paused subscription can
        also be resumed by hand — by the customer, from their portal — and then
        both sides are billing the same person.
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
        return _MOVED

    async def _load_subscription(
        self, record: MerchantMigrationRecord
    ) -> Subscription | None:
        if record.target_id is None:
            return None
        return await self.subscription_repository.get_by_id(
            record.target_id,
            options=self.subscription_repository.get_eager_options(),
        )

    def _source_reason(
        self, source: CanonicalSubscription, record: MerchantMigrationRecord
    ) -> str | None:
        """Why the source says this subscription shouldn't move today."""
        if source.status not in MIGRATABLE_SOURCE_STATUSES:
            if source.status == CanonicalSubscriptionStatus.canceled:
                return _SOURCE_CANCELED
            reason = subscription_import_reason(source)
            if reason is not None:
                return reason.message
            return _SOURCE_NOT_LIVE.format(status=source.status.value)
        if source.cancel_at_period_end:
            return _ENDING
        # Everything the import refused to take, re-applied: the source has had
        # weeks to grow a second line item, a coupon or a manual invoice.
        reason = subscription_import_reason(source)
        if reason is not None:
            return reason.message
        staged = deserialize(record.type, record.canonical)
        if (
            isinstance(staged, CanonicalSubscription)
            and staged.price_source_id != source.price_source_id
        ):
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
        source_method: CanonicalPaymentMethod | None,
    ) -> PaymentMethod | None:
        """The card the first Polar renewal will charge.

        A card linked by the `verify_cards` step wins; otherwise we look again,
        because cards keep landing while the merchant walks the checklist. Read
        from the source now, not from the staged copy: the customer may have
        changed which card the subscription charges since the import.
        """
        if subscription.payment_method_id is not None:
            payment_method = await PaymentMethodRepository.from_session(
                self.session
            ).get_by_id(subscription.payment_method_id)
            if payment_method is not None:
                return payment_method
        return await link_payment_method(
            self.session, customer, source_method=source_method
        )

    async def _card_reason(
        self, customer: Customer, payment_method: PaymentMethod
    ) -> str | None:
        """Prove the card can be charged before anything is cancelled.

        Only cards: a zero-amount confirmation says nothing useful about a bank
        debit, and confirming one needs a mandate the copy doesn't carry.
        """
        if payment_method.type != CARD_TYPE or customer.stripe_customer_id is None:
            return None
        try:
            setup_intent = await stripe_service.create_setup_intent(
                customer=customer.stripe_customer_id,
                payment_method=payment_method.processor_id,
                payment_method_types=[CARD_TYPE],
                usage="off_session",
                confirm=True,
                metadata={"merchant_migration_id": str(self.migration.id)},
            )
        except stripe_lib.CardError as e:
            return f"The copied card was declined by the bank: {e.user_message}."
        if setup_intent.status != "succeeded":
            return (
                "The copied card can't be charged without the customer "
                "confirming it, so Polar can't bill it unattended. Ask them to "
                "re-enter their billing details."
            )
        return None

    def _period(
        self, source: CanonicalSubscription, subscription: Subscription
    ) -> tuple[datetime, datetime]:
        """Where the source left the billing cycle.

        Read at cutover, not at import: the source has kept renewing in between,
        so the staged period is stale. The subscription's own period is the
        fallback for a source that no longer reports one.
        """
        end = source.current_period_end or subscription.current_period_end
        start = source.current_period_start or subscription.current_period_start
        if start >= end:
            # An inverted period would feed the renewal maths.
            start = min(subscription.current_period_start, end)
        return start, end

    def _trial_end(self, source: CanonicalSubscription) -> datetime | None:
        """Keep a running trial running: Polar bills at its end, not today."""
        if source.status != CanonicalSubscriptionStatus.trialing:
            return None
        if source.trial_end is None or source.trial_end <= utc_now():
            return None
        return source.trial_end
