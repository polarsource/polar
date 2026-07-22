from __future__ import annotations

import dataclasses
import typing

from polar.base import deserialize
from polar.v2026_04.outputs import (
    Benefit,
    BenefitGrantWebhook,
    Checkout,
    Customer,
    CustomerSeat,
    CustomerState,
    Member,
    Order,
    Organization,
    Product,
    Refund,
    Subscription,
)
from polar.webhooks import (
    PolarWebhookError as PolarWebhookError,
)
from polar.webhooks import (
    PolarWebhookUnknownTypeError as PolarWebhookUnknownTypeError,
)
from polar.webhooks import (
    PolarWebhookVerificationError as PolarWebhookVerificationError,
)
from polar.webhooks import (
    validate_event as _validate_event,
)


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookBenefitCreatedPayload:
    """Sent when a new benefit is created.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["benefit.created"]

    timestamp: str

    data: Benefit


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookBenefitGrantCreatedPayload:
    """Sent when a new benefit grant is created.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["benefit_grant.created"]

    timestamp: str

    data: BenefitGrantWebhook


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookBenefitGrantCycledPayload:
    """Sent when a benefit grant is cycled,
    meaning the related subscription has been renewed for another period.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["benefit_grant.cycled"]

    timestamp: str

    data: BenefitGrantWebhook


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookBenefitGrantRevokedPayload:
    """Sent when a benefit grant is revoked.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["benefit_grant.revoked"]

    timestamp: str

    data: BenefitGrantWebhook


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookBenefitGrantUpdatedPayload:
    """Sent when a benefit grant is updated.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["benefit_grant.updated"]

    timestamp: str

    data: BenefitGrantWebhook


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookBenefitUpdatedPayload:
    """Sent when a benefit is updated.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["benefit.updated"]

    timestamp: str

    data: Benefit


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookCheckoutCreatedPayload:
    """Sent when a new checkout is created.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["checkout.created"]

    timestamp: str

    data: Checkout


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookCheckoutExpiredPayload:
    """Sent when a checkout expires.

    This event fires when a checkout reaches its expiration time without being completed.
    Developers can use this to send reminder emails or track checkout abandonment.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["checkout.expired"]

    timestamp: str

    data: Checkout


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookCheckoutUpdatedPayload:
    """Sent when a checkout is updated.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["checkout.updated"]

    timestamp: str

    data: Checkout


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookCustomerCreatedPayload:
    """Sent when a new customer is created.

    A customer can be created:

    * After a successful checkout.
    * Programmatically via the API.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["customer.created"]

    timestamp: str

    data: Customer


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookCustomerDeletedPayload:
    """Sent when a customer is deleted.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["customer.deleted"]

    timestamp: str

    data: Customer


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookCustomerSeatAssignedPayload:
    """Sent when a new customer seat is assigned.

    This event is triggered when a seat is assigned to a customer by the organization.
    The customer will receive an invitation email to claim the seat."""

    type: typing.Literal["customer_seat.assigned"]

    timestamp: str

    data: CustomerSeat


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookCustomerSeatClaimedPayload:
    """Sent when a customer seat is claimed.

    This event is triggered when a customer accepts the seat invitation and claims their access."""

    type: typing.Literal["customer_seat.claimed"]

    timestamp: str

    data: CustomerSeat


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookCustomerSeatRevokedPayload:
    """Sent when a customer seat is revoked.

    This event is triggered when access to a seat is revoked, either manually by the organization or automatically when a subscription is canceled."""

    type: typing.Literal["customer_seat.revoked"]

    timestamp: str

    data: CustomerSeat


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookCustomerStateChangedPayload:
    """Sent when a customer state has changed.

    It's triggered when:

    * Customer is created, updated or deleted.
    * A subscription is created or updated.
    * A benefit is granted or revoked.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["customer.state_changed"]

    timestamp: str

    data: CustomerState


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookCustomerUpdatedPayload:
    """Sent when a customer is updated.

    This event is fired when the customer details are updated.

    If you want to be notified when a customer subscription or benefit state changes, you should listen to the `customer_state_changed` event.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["customer.updated"]

    timestamp: str

    data: Customer


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookMemberCreatedPayload:
    """Sent when a new member is created.

    A member represents an individual within a customer (team).
    This event is triggered when a member is added to a customer,
    either programmatically via the API or when an owner is automatically
    created for a new customer.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["member.created"]

    timestamp: str

    data: Member


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookMemberDeletedPayload:
    """Sent when a member is deleted.

    This event is triggered when a member is removed from a customer.
    Any active seats assigned to the member will be automatically revoked.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["member.deleted"]

    timestamp: str

    data: Member


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookMemberUpdatedPayload:
    """Sent when a member is updated.

    This event is triggered when member details are updated,
    such as their name or role within the customer.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["member.updated"]

    timestamp: str

    data: Member


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookOrderCreatedPayload:
    """Sent when a new order is created.

    A new order is created when:

    * A customer purchases a one-time product. In this case, `billing_reason` is set to `purchase`.
    * A customer starts a subscription. In this case, `billing_reason` is set to `subscription_create`.
    * A subscription is renewed. In this case, `billing_reason` is set to `subscription_cycle`.
    * A subscription is upgraded or downgraded with an immediate proration invoice. In this case, `billing_reason` is set to `subscription_update`.

    > [!WARNING]
    > The order might not be paid yet, so the `status` field might be `pending`.

    **Discord & Slack support:** Full"""

    type: typing.Literal["order.created"]

    timestamp: str

    data: Order


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookOrderPaidPayload:
    """Sent when an order is paid.

    When you receive this event, the order is fully processed and payment has been received.

    **Discord & Slack support:** Full"""

    type: typing.Literal["order.paid"]

    timestamp: str

    data: Order


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookOrderRefundedPayload:
    """Sent when an order is fully or partially refunded.

    **Discord & Slack support:** Full"""

    type: typing.Literal["order.refunded"]

    timestamp: str

    data: Order


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookOrderUpdatedPayload:
    """Sent when an order is updated.

    An order is updated when:

    * Its status changes, e.g. from `pending` to `paid`.
    * It's refunded, partially or fully.

    **Discord & Slack support:** Full"""

    type: typing.Literal["order.updated"]

    timestamp: str

    data: Order


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookOrganizationUpdatedPayload:
    """Sent when a organization is updated.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["organization.updated"]

    timestamp: str

    data: Organization


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookProductCreatedPayload:
    """Sent when a new product is created.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["product.created"]

    timestamp: str

    data: Product


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookProductUpdatedPayload:
    """Sent when a product is updated.

    **Discord & Slack support:** Basic"""

    type: typing.Literal["product.updated"]

    timestamp: str

    data: Product


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookRefundCreatedPayload:
    """Sent when a refund is created regardless of status.

    **Discord & Slack support:** Full"""

    type: typing.Literal["refund.created"]

    timestamp: str

    data: Refund


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookRefundUpdatedPayload:
    """Sent when a refund is updated.

    **Discord & Slack support:** Full"""

    type: typing.Literal["refund.updated"]

    timestamp: str

    data: Refund


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookSubscriptionActivePayload:
    """Sent when a subscription becomes active,
    whether because it's a new paid subscription or because payment was recovered.

    **Discord & Slack support:** Full"""

    type: typing.Literal["subscription.active"]

    timestamp: str

    data: Subscription


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookSubscriptionCanceledPayload:
    """Sent when a subscription is canceled.
    Customers might still have access until the end of the current period.

    **Discord & Slack support:** Full"""

    type: typing.Literal["subscription.canceled"]

    timestamp: str

    data: Subscription


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookSubscriptionCreatedPayload:
    """Sent when a new subscription is created.

    When this event occurs, the subscription `status` might not be `active` yet, as we can still have to wait for the first payment to be processed.

    **Discord & Slack support:** Full"""

    type: typing.Literal["subscription.created"]

    timestamp: str

    data: Subscription


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookSubscriptionPastDuePayload:
    """Sent when a subscription payment fails and the subscription enters `past_due` status.

    This is a recoverable state - the customer can update their payment method to restore the subscription.
    Benefits may be revoked depending on the organization's grace period settings.

    If payment retries are exhausted, a `subscription.revoked` event will be sent.

    **Discord & Slack support:** Full"""

    type: typing.Literal["subscription.past_due"]

    timestamp: str

    data: Subscription


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookSubscriptionPausedPayload:
    """Sent when a subscription is paused and the customer temporarily loses access.

    No order is created while paused. The subscription resumes either on its
    scheduled resume date or when resumed manually, starting a new billing period.

    **Discord & Slack support:** Full"""

    type: typing.Literal["subscription.paused"]

    timestamp: str

    data: Subscription


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookSubscriptionResumedPayload:
    """Sent when a paused subscription resumes, restoring the customer's access.

    Resuming starts a new billing period and charges the customer immediately.

    **Discord & Slack support:** Full"""

    type: typing.Literal["subscription.resumed"]

    timestamp: str

    data: Subscription


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookSubscriptionRevokedPayload:
    """Sent when a subscription is revoked and the user loses access immediately.
    Happens when the subscription is canceled or payment retries are exhausted (status becomes `unpaid`).

    For payment failures that can still be recovered, see `subscription.past_due`.

    **Discord & Slack support:** Full"""

    type: typing.Literal["subscription.revoked"]

    timestamp: str

    data: Subscription


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookSubscriptionUncanceledPayload:
    """Sent when a customer revokes a pending cancellation.

    When a customer cancels with "at period end", they retain access until the
    subscription would renew. During this time, they can change their mind and
    undo the cancellation. This event is triggered when they do so.

    **Discord & Slack support:** Full"""

    type: typing.Literal["subscription.uncanceled"]

    timestamp: str

    data: Subscription


@dataclasses.dataclass(kw_only=True, slots=True)
class WebhookSubscriptionUpdatedPayload:
    """Sent when a subscription is updated. This event fires for all changes to the subscription, including renewals.

    If you want more specific events, you can listen to `subscription.active`, `subscription.canceled`, `subscription.past_due`, and `subscription.revoked`.

    To listen specifically for renewals, you can listen to `order.created` events and check the `billing_reason` field.

    **Discord & Slack support:** On cancellation, past due, and revocation. Renewals are skipped."""

    type: typing.Literal["subscription.updated"]

    timestamp: str

    data: Subscription


WebhookPayload: typing.TypeAlias = (
    WebhookBenefitCreatedPayload
    | WebhookBenefitGrantCreatedPayload
    | WebhookBenefitGrantCycledPayload
    | WebhookBenefitGrantRevokedPayload
    | WebhookBenefitGrantUpdatedPayload
    | WebhookBenefitUpdatedPayload
    | WebhookCheckoutCreatedPayload
    | WebhookCheckoutExpiredPayload
    | WebhookCheckoutUpdatedPayload
    | WebhookCustomerCreatedPayload
    | WebhookCustomerDeletedPayload
    | WebhookCustomerSeatAssignedPayload
    | WebhookCustomerSeatClaimedPayload
    | WebhookCustomerSeatRevokedPayload
    | WebhookCustomerStateChangedPayload
    | WebhookCustomerUpdatedPayload
    | WebhookMemberCreatedPayload
    | WebhookMemberDeletedPayload
    | WebhookMemberUpdatedPayload
    | WebhookOrderCreatedPayload
    | WebhookOrderPaidPayload
    | WebhookOrderRefundedPayload
    | WebhookOrderUpdatedPayload
    | WebhookOrganizationUpdatedPayload
    | WebhookProductCreatedPayload
    | WebhookProductUpdatedPayload
    | WebhookRefundCreatedPayload
    | WebhookRefundUpdatedPayload
    | WebhookSubscriptionActivePayload
    | WebhookSubscriptionCanceledPayload
    | WebhookSubscriptionCreatedPayload
    | WebhookSubscriptionPastDuePayload
    | WebhookSubscriptionPausedPayload
    | WebhookSubscriptionResumedPayload
    | WebhookSubscriptionRevokedPayload
    | WebhookSubscriptionUncanceledPayload
    | WebhookSubscriptionUpdatedPayload
)

_KNOWN_EVENT_TYPES = frozenset(
    {
        "benefit.created",
        "benefit.updated",
        "benefit_grant.created",
        "benefit_grant.cycled",
        "benefit_grant.revoked",
        "benefit_grant.updated",
        "checkout.created",
        "checkout.expired",
        "checkout.updated",
        "customer.created",
        "customer.deleted",
        "customer.state_changed",
        "customer.updated",
        "customer_seat.assigned",
        "customer_seat.claimed",
        "customer_seat.revoked",
        "member.created",
        "member.deleted",
        "member.updated",
        "order.created",
        "order.paid",
        "order.refunded",
        "order.updated",
        "organization.updated",
        "product.created",
        "product.updated",
        "refund.created",
        "refund.updated",
        "subscription.active",
        "subscription.canceled",
        "subscription.created",
        "subscription.past_due",
        "subscription.paused",
        "subscription.resumed",
        "subscription.revoked",
        "subscription.uncanceled",
        "subscription.updated",
    }
)


def validate_event(
    body: str | bytes, headers: dict[str, str], secret: str
) -> WebhookPayload:
    """Verify a raw Polar webhook request and load its typed payload."""
    return _validate_event(body, headers, secret, _KNOWN_EVENT_TYPES, _load_payload)


def _load_payload(data: dict[str, typing.Any]) -> WebhookPayload:
    return deserialize(data, WebhookPayload)
