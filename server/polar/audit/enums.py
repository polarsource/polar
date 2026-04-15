from enum import StrEnum


class AuditResourceType(StrEnum):
    organization = "organization"
    product = "product"
    benefit = "benefit"
    customer = "customer"
    member = "member"
    discount = "discount"
    subscription = "subscription"
    order = "order"
    refund = "refund"
    payout = "payout"
    checkout = "checkout"
    checkout_link = "checkout_link"
    webhook_endpoint = "webhook_endpoint"


class AuditAction(StrEnum):
    # Common actions (available for all resource types)
    created = "created"
    updated = "updated"
    deleted = "deleted"

    # Organization-specific
    settings_updated = "settings_updated"
    details_submitted = "details_submitted"
    deletion_requested = "deletion_requested"
    payout_account_set = "payout_account_set"
    member_added = "member_added"
    member_invited = "member_invited"
    member_left = "member_left"
    member_removed = "member_removed"
    review_threshold_triggered = "review_threshold_triggered"
    approved = "approved"
    denied = "denied"
    under_review = "under_review"
    offboarding = "offboarding"
    reactivated = "reactivated"
    appeal_submitted = "appeal_submitted"
    appeal_approved = "appeal_approved"
    appeal_denied = "appeal_denied"
    onboarding_completed = "onboarding_completed"

    # Product-specific (future)
    archived = "archived"

    # Subscription-specific (future)
    canceled = "canceled"
    revoked = "revoked"

    # Customer-specific (future)
    anonymized = "anonymized"


class AuditActorType(StrEnum):
    user = "user"
    admin = "admin"
    system = "system"
