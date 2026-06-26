import asyncio
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any, assert_never, cast
from urllib.parse import urlparse
from uuid import UUID

import email_validator
import structlog
from pydantic import BaseModel, Field, TypeAdapter
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.exc import IntegrityError

from polar.account.service import account as account_service
from polar.auth.models import AuthSubject, is_user
from polar.authz.service import get_accessible_org_ids
from polar.checkout_link.repository import CheckoutLinkRepository
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.enums import InvoiceNumbering, SubscriptionProrationBehavior
from polar.exceptions import (
    PolarError,
    PolarRequestValidationError,
    ValidationError,
)
from polar.integrations.polar.service import billing_member_role
from polar.integrations.polar.service import polar_self as polar_self_service
from polar.kit.anonymization import anonymize_email_for_deletion, anonymize_for_deletion
from polar.kit.currency import PresentmentCurrency
from polar.kit.http import check_url_reachable
from polar.kit.pagination import PaginationParams
from polar.kit.repository import Options
from polar.kit.sorting import Sorting
from polar.member.repository import MemberRepository
from polar.member.service import member_service
from polar.models import (
    Customer,
    Organization,
    PayoutAccount,
    User,
    UserOrganization,
)
from polar.models.benefit import BenefitType
from polar.models.member import MemberRole
from polar.models.organization import (
    FIRST_REVIEW_THRESHOLD_CENTS,
    STATUS_CAPABILITIES,
    CapabilityName,
    OrganizationCapabilities,
    OrganizationDetails,
    OrganizationStatus,
    SnoozeType,
)
from polar.models.organization_review import OrganizationReview
from polar.models.transaction import TransactionType
from polar.models.user import IdentityVerificationStatus
from polar.models.user_organization import OrganizationRole
from polar.models.webhook_endpoint import WebhookEventType
from polar.organization_access_token.repository import (
    OrganizationAccessTokenRepository,
)
from polar.organization_review.appeal_case import (
    appeal_case as appeal_case_service,
)
from polar.organization_review.repository import (
    OrganizationReviewRepository as AgentReviewRepository,
)
from polar.organization_review.schemas import (
    ActorType,
    DecisionType,
    ReviewContext,
    ReviewVerdict,
)
from polar.payout_account.repository import PayoutAccountRepository
from polar.payout_account.service import payout_account as payout_account_service
from polar.postgres import AsyncReadSession, AsyncSession, sql
from polar.posthog import posthog
from polar.product.repository import ProductRepository
from polar.transaction.service.transaction import transaction as transaction_service
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.webhook.repository import WebhookEndpointRepository
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .repository import OrganizationRepository, OrganizationReviewRepository
from .schemas import (
    OrganizationCreate,
    OrganizationDeletionBlockedReason,
    OrganizationReviewAppeal,
    OrganizationReviewCheck,
    OrganizationReviewCheckKey,
    OrganizationReviewCheckReason,
    OrganizationReviewCheckStatus,
    OrganizationReviewState,
    OrganizationReviewSubCheck,
    OrganizationReviewSubCheckKey,
    OrganizationReviewSubmissionBody,
    OrganizationReviewVerdict,
    OrganizationSlugAvailability,
    OrganizationUpdate,
    SlugInput,
)
from .sorting import OrganizationSortProperty

log = structlog.get_logger()

_slug_input_adapter: TypeAdapter[str] = TypeAdapter(SlugInput)

_MIN_REVIEW_THRESHOLD = 10_000
SNOOZE_MIN_DAYS = 1
SNOOZE_MAX_DAYS = 7

# Benefit types that deliver nothing to the customer without a merchant API
# integration: `feature_flag` (the merchant's app has to read the flag via the
# API) and `meter_credit` (the credit is only meaningful once the merchant
# ingests usage events via the API).
_CHECKOUT_API_ONLY_BENEFITS: frozenset[BenefitType] = frozenset(
    {BenefitType.feature_flag, BenefitType.meter_credit}
)

# Every other benefit delivers something on
# its own — Polar grants it automatically (downloadables, license_keys,
# github_repository, discord, slack_shared_channel) or the customer sees it in
# their portal (custom note).
_CHECKOUT_FULFILLABLE_BENEFITS: frozenset[BenefitType] = (
    frozenset(BenefitType) - _CHECKOUT_API_ONLY_BENEFITS
)

# Hosting domains where it's unreasonable to expect the organization's support email to
# match the website domain — e.g. a user whose product is hosted at `x.framer.com`
# won't have `@framer.com` email.
_HOSTED_WEBSITE_DOMAINS: frozenset[str] = frozenset(
    {
        "chromewebstore.google.com",
        "figma.com",
        "github.com",
        "framer.com",
    }
)


def _website_domain(website: str | None) -> str | None:
    if not website:
        return None
    host = urlparse(website).hostname
    return host.removeprefix("www.") if host else None


def _is_hosted_website_domain(website_domain: str) -> bool:
    return any(
        website_domain == d or website_domain.endswith(f".{d}")
        for d in _HOSTED_WEBSITE_DOMAINS
    )


def _append_internal_note(
    organization: Organization, message: str, *, reason: str | None = None
) -> None:
    timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    note = f"[{timestamp}] {message}"
    if reason:
        note += f"\nReason: {reason}"
    if organization.internal_notes:
        organization.internal_notes = f"{organization.internal_notes}\n\n{note}"
    else:
        organization.internal_notes = note


class PaymentStatusResponse(BaseModel):
    """Service-level response for payment status."""

    payment_ready: bool = Field(
        description="Whether the organization is ready to accept payments"
    )
    organization_status: OrganizationStatus = Field(
        description="Current organization status"
    )


class OrganizationDeletionCheckResult(BaseModel):
    """Result of checking if an organization can be deleted."""

    can_delete_immediately: bool = Field(
        description="Whether the organization can be deleted immediately"
    )
    blocked_reasons: list[OrganizationDeletionBlockedReason] = Field(
        default_factory=list,
        description="Reasons why immediate deletion is blocked",
    )


class OrganizationError(PolarError): ...


class InvalidAccount(OrganizationError):
    def __init__(self, account_id: UUID) -> None:
        self.account_id = account_id
        message = (
            f"The account {account_id} does not exist or you don't have access to it."
        )
        super().__init__(message)


class AccountAlreadySet(OrganizationError):
    def __init__(self, organization_slug: str) -> None:
        self.organization_slug = organization_slug
        message = f"The account for organization '{organization_slug}' has already been set up by the owner. Contact support to change the owner of the account."
        super().__init__(message, 403)


class CannotChangeOwnerError(OrganizationError):
    def __init__(self, reason: str) -> None:
        super().__init__(f"Cannot change organization owner: {reason}")


class OrganizationService:
    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        slug: str | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[OrganizationSortProperty]] = [
            (OrganizationSortProperty.created_at, False)
        ],
    ) -> tuple[Sequence[Organization], int]:
        repository = OrganizationRepository.from_session(session)
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = repository.get_statement_by_org_ids(org_ids)

        if slug is not None:
            statement = statement.where(Organization.slug == slug)

        statement = repository.apply_sorting(statement, sorting)

        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
        *,
        options: Options = (),
    ) -> Organization | None:
        repository = OrganizationRepository.from_session(session)
        org_ids = await get_accessible_org_ids(session, auth_subject)
        statement = (
            repository.get_statement_by_org_ids(org_ids)
            .where(Organization.id == id)
            .options(*options)
        )
        return await repository.get_one_or_none(statement)

    async def get_anonymous(
        self,
        session: AsyncReadSession,
        id: uuid.UUID,
        *,
        options: Options = (),
    ) -> Organization | None:
        """Use it with precaution! Get organization by ID for anonymous users."""
        repository = OrganizationRepository.from_session(session)
        statement = (
            repository.get_base_statement()
            .where(Organization.status != OrganizationStatus.BLOCKED)
            .where(Organization.id == id)
            .options(*options)
        )

        return await repository.get_one_or_none(statement)

    async def check_slug_availability(
        self, session: AsyncReadSession, slug: str
    ) -> OrganizationSlugAvailability:
        """Check whether a slug is valid and available for a new organization.

        Runs the slug through `SlugInput` (the same validator used when
        creating an organization) and reports invalid slugs as unavailable
        rather than as a 422.
        """
        try:
            normalized = _slug_input_adapter.validate_python(slug)
        except PydanticValidationError:
            return OrganizationSlugAvailability(available=False)

        repository = OrganizationRepository.from_session(session)
        if await repository.slug_exists(normalized):
            return OrganizationSlugAvailability(available=False)

        return OrganizationSlugAvailability(available=True)

    async def create(
        self,
        session: AsyncSession,
        create_schema: OrganizationCreate,
        auth_subject: AuthSubject[User],
    ) -> Organization:
        repository = OrganizationRepository.from_session(session)
        if await repository.slug_exists(create_schema.slug):
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("body", "slug"),
                        "msg": "An organization with this slug already exists.",
                        "type": "value_error",
                        "input": create_schema.slug,
                    }
                ]
            )

        create_data = create_schema.model_dump(exclude_unset=True, exclude_none=True)
        feature_settings = create_data.get("feature_settings", {})
        feature_settings["member_model_enabled"] = True
        feature_settings["seat_based_pricing_enabled"] = True
        create_data["feature_settings"] = feature_settings

        if settings.is_sandbox():
            create_data["status"] = OrganizationStatus.ACTIVE
            create_data["capabilities"] = {
                **STATUS_CAPABILITIES[OrganizationStatus.ACTIVE]
            }
            create_data["status_updated_at"] = datetime.now(UTC)

        nested = await session.begin_nested()
        try:
            organization = await repository.create(
                Organization(
                    **create_data,
                    customer_invoice_prefix=create_schema.slug.upper(),
                )
            )
            organization.account = await account_service.create(session)
            await session.flush()
        except IntegrityError as e:
            await nested.rollback()
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("body", "slug"),
                        "msg": "An organization with this slug already exists.",
                        "type": "value_error",
                        "input": create_schema.slug,
                    }
                ]
            ) from e
        owner = auth_subject.subject
        polar_self_service.enqueue_create_customer(
            organization_id=organization.id,
            name=organization.name,
            slug=organization.slug,
            owner_external_id=str(owner.id),
            owner_email=owner.email,
            owner_name=owner.full_name or owner.email.split("@", 1)[0],
        )
        await self.add_user(
            session,
            organization,
            auth_subject.subject,
            role=OrganizationRole.owner,
            enqueue_polar_self_member=False,
        )

        enqueue_job("organization.created", organization_id=organization.id)

        posthog.auth_subject_event(
            auth_subject,
            "organizations",
            "create",
            "done",
            {
                "id": organization.id,
                "name": organization.name,
                "slug": organization.slug,
            },
        )
        return organization

    async def _validate_currency_change(
        self,
        session: AsyncSession,
        organization: Organization,
        new_currency: PresentmentCurrency,
    ) -> None:
        """Validate that all active products have the target currency."""
        if new_currency == organization.default_presentment_currency:
            return

        product_repo = ProductRepository.from_session(session)
        products_without_currency = await product_repo.get_products_without_currency(
            organization.id, new_currency
        )

        if products_without_currency:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("body", "default_presentment_currency"),
                        "msg": (
                            "All active products must have prices in the new currency."
                        ),
                        "type": "value_error",
                        "input": new_currency,
                    }
                ]
            )

    async def update(
        self,
        session: AsyncSession,
        organization: Organization,
        update_schema: OrganizationUpdate,
    ) -> Organization:
        repository = OrganizationRepository.from_session(session)

        if organization.onboarded_at is None:
            organization.onboarded_at = datetime.now(UTC)

        if update_schema.feature_settings is not None:
            old_member_model = organization.feature_settings.get(
                "member_model_enabled", False
            )
            old_seat_based = organization.feature_settings.get(
                "seat_based_pricing_enabled", False
            )

            organization.feature_settings = {
                **organization.feature_settings,
                **update_schema.feature_settings.model_dump(
                    mode="json", exclude_unset=True, exclude_none=True
                ),
            }

            new_seat_based = organization.feature_settings.get(
                "seat_based_pricing_enabled", False
            )
            new_member_model = organization.feature_settings.get(
                "member_model_enabled", False
            )

            if old_seat_based and not new_seat_based:
                raise PolarRequestValidationError(
                    [
                        {
                            "loc": (
                                "body",
                                "feature_settings",
                                "seat_based_pricing_enabled",
                            ),
                            "msg": "Seat-based pricing cannot be disabled once enabled.",
                            "type": "value_error",
                            "input": False,
                        }
                    ]
                )

            if not old_seat_based and new_seat_based and not new_member_model:
                raise PolarRequestValidationError(
                    [
                        {
                            "loc": (
                                "body",
                                "feature_settings",
                                "seat_based_pricing_enabled",
                            ),
                            "msg": "Member model must be enabled before enabling seat-based pricing.",
                            "type": "value_error",
                            "input": True,
                        }
                    ]
                )

            if not old_member_model and new_member_model:
                enqueue_job(
                    "organization.backfill_members",
                    organization_id=organization.id,
                )

        if update_schema.subscription_settings is not None:
            if (
                update_schema.subscription_settings.get("proration_behavior")
                == SubscriptionProrationBehavior.reset
                and not organization.feature_settings.get(
                    "reset_proration_behavior_enabled"
                )
            ):
                raise PolarRequestValidationError(
                    [
                        {
                            "type": "value_error",
                            "loc": (
                                "body",
                                "subscription_settings",
                                "proration_behavior",
                            ),
                            "msg": "The 'reset' proration behavior is not enabled for this organization.",
                            "input": update_schema.subscription_settings[
                                "proration_behavior"
                            ],
                        }
                    ]
                )
            organization.subscription_settings = update_schema.subscription_settings

        if update_schema.default_presentment_currency is not None:
            await self._validate_currency_change(
                session, organization, update_schema.default_presentment_currency
            )

        update_dict = update_schema.model_dump(
            by_alias=True,
            exclude_unset=True,
            exclude={
                "profile_settings",
                "feature_settings",
                "subscription_settings",
                "details",
            },
        )

        if update_schema.details:
            organization.details = cast(
                OrganizationDetails, update_schema.details.model_dump()
            )

        organization = await repository.update(organization, update_dict=update_dict)

        await self._after_update(session, organization)
        return organization

    async def submit_for_review(
        self, session: AsyncSession, organization: Organization
    ) -> Organization:
        try:
            OrganizationReviewSubmissionBody.model_validate({"body": organization})
        except PydanticValidationError as e:
            raise PolarRequestValidationError(
                cast(Sequence[ValidationError], e.errors())
            ) from e

        if organization.details_submitted_at is None:
            organization.details_submitted_at = datetime.now(UTC)
            enqueue_job(
                "organization_review.run_agent",
                organization_id=organization.id,
                context=ReviewContext.SUBMISSION,
            )

        session.add(organization)

        await self._after_update(session, organization)
        return organization

    async def check_can_delete(
        self,
        session: AsyncReadSession,
        organization: Organization,
    ) -> OrganizationDeletionCheckResult:
        """Check if an organization can be deleted immediately.

        An organization can be deleted immediately if it has:
        - No paid orders (excludes $0 orders from free/discounted products)
        - No paid active subscriptions (excludes inherently free or
          permanently discounted subscriptions)

        If it has an account but no orders/subscriptions, we'll attempt to
        delete the Stripe account first.
        """
        blocked_reasons: list[OrganizationDeletionBlockedReason] = []
        repository = OrganizationRepository.from_session(session)

        # Check for paid orders (excludes $0 orders)
        order_count = await repository.count_paid_orders_by_organization(
            organization.id
        )
        if order_count > 0:
            blocked_reasons.append(OrganizationDeletionBlockedReason.HAS_ORDERS)

        # Check for paid active subscriptions (excludes free subscriptions)
        active_subscription_count = (
            await repository.count_paid_active_subscriptions_by_organization(
                organization.id
            )
        )
        if active_subscription_count > 0:
            blocked_reasons.append(
                OrganizationDeletionBlockedReason.HAS_ACTIVE_SUBSCRIPTIONS
            )

        return OrganizationDeletionCheckResult(
            can_delete_immediately=len(blocked_reasons) == 0,
            blocked_reasons=blocked_reasons,
        )

    async def request_deletion(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> OrganizationDeletionCheckResult:
        """Request deletion of an organization.

        Authorization is handled by the AuthorizeOrgDelete policy dependency
        at the endpoint level.

        Flow:
        1. Check for orders/subscriptions -> if blocked, create support ticket
        2. If has account -> try to delete Stripe account
        3. If Stripe deletion fails -> create support ticket
        4. Soft delete organization
        """
        check_result = await self.check_can_delete(session, organization)

        if not check_result.can_delete_immediately:
            # Organization has orders or active subscriptions
            enqueue_job(
                "organization.deletion_requested",
                organization_id=organization.id,
                user_id=auth_subject.subject.id,
                blocked_reasons=[r.value for r in check_result.blocked_reasons],
            )
            return check_result

        try:
            await self._delete_payout_account(session, organization)
        except Exception as e:
            log.error(
                "organization.deletion.stripe_account_deletion_failed",
                organization_id=organization.id,
                error=str(e),
            )
            # Stripe deletion failed, create support ticket
            check_result = OrganizationDeletionCheckResult(
                can_delete_immediately=False,
                blocked_reasons=[
                    OrganizationDeletionBlockedReason.STRIPE_ACCOUNT_DELETION_FAILED
                ],
            )
            enqueue_job(
                "organization.deletion_requested",
                organization_id=organization.id,
                user_id=auth_subject.subject.id,
                blocked_reasons=[r.value for r in check_result.blocked_reasons],
            )
            return check_result

        # Soft delete the organization, releasing its slug for reuse
        await self.soft_delete_organization(session, organization, release_slug=True)

        return OrganizationDeletionCheckResult(
            can_delete_immediately=True,
            blocked_reasons=[],
        )

    async def soft_delete_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        release_slug: bool = False,
    ) -> Organization:
        """Soft-delete an organization, anonymizing its PII.

        When ``release_slug`` is set, the previous slug is archived to
        ``slug_history`` and the live slug is rewritten to a tombstone so a new
        organization can claim the original. Otherwise the slug is scrubbed like
        any other PII field, leaving no recoverable trace.
        """
        repository = OrganizationRepository.from_session(session)

        update_dict: dict[str, Any] = {}
        pii_fields = ["name", "website", "customer_invoice_prefix"]

        if release_slug:
            now = datetime.now(UTC)
            update_dict["slug_history"] = [
                *organization.slug_history,
                {"slug": organization.slug, "deleted_at": now.isoformat()},
            ]
            update_dict["slug"] = f"__deleted__-{organization.slug}-{organization.id}"
        else:
            pii_fields = ["name", "slug", "website", "customer_invoice_prefix"]

        github_fields = ["bio", "company", "blog", "location", "twitter_username"]
        for pii_field in pii_fields + github_fields:
            value = getattr(organization, pii_field)
            if value:
                update_dict[pii_field] = anonymize_for_deletion(
                    value, organization.created_at
                )

        if organization.email:
            update_dict["email"] = anonymize_email_for_deletion(
                organization.email, organization.created_at
            )

        if organization._avatar_url:
            # Anonymize by setting to Polar logo
            update_dict["avatar_url"] = (
                "https://avatars.githubusercontent.com/u/105373340?s=48&v=4"
            )

        if organization.details:
            update_dict["details"] = {}

        if organization.socials:
            update_dict["socials"] = []

        organization = await repository.update(organization, update_dict=update_dict)
        await repository.soft_delete(organization)

        # Close an open *appeal* support case — it's moot once the org is gone.
        # Only appeals: dispute and refund cases are deliberately left open, as
        # they're financial matters (chargebacks, refunds) that outlive the
        # merchant deleting their account.
        review_repository = OrganizationReviewRepository.from_session(session)
        review = await review_repository.get_by_organization(organization.id)
        if review is not None:
            await appeal_case_service.close_for_organization_deletion(session, review)

        polar_self_service.enqueue_delete_customer(organization_id=organization.id)

        log.info(
            "organization.deleted",
            organization_id=organization.id,
            slug=organization.slug,
        )

        return organization

    async def _delete_payout_account(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        if organization.payout_account_id is None:
            return

        payout_account_repository = PayoutAccountRepository.from_session(session)
        payout_account = await payout_account_repository.get_by_id(
            organization.payout_account_id
        )

        if payout_account is None:
            return

        # Unlink the payout account from the organization before deleting
        organization_repository = OrganizationRepository.from_session(session)
        await organization_repository.delete_payout_account(payout_account.id)

        await payout_account_service.delete(session, payout_account)

    async def set_payout_account(
        self,
        session: AsyncSession,
        organization: Organization,
        payout_account: PayoutAccount,
    ) -> Organization:
        previous_payout_account_id = organization.payout_account_id

        organization_repository = OrganizationRepository.from_session(session)
        await organization_repository.update(
            organization,
            update_dict={"payout_account_id": payout_account.id},
            flush=True,
        )

        # A held payout pins the payout account it was created against, so a
        # rebind would release to a stale account. Cancel held payouts on swap
        # (they refund their fees, so re-requesting is safe); leave pending ones,
        # whose transfer may already be in flight. Scope the cancel to the
        # previous payout account so a held payout already created against the
        # new account isn't swept up. Emitted as an event to keep the payout
        # layer out of this service.
        account_changed = (
            previous_payout_account_id is not None
            and previous_payout_account_id != payout_account.id
        )
        if account_changed and organization.account_id is not None:
            enqueue_job(
                "payout.cancel_held_payouts",
                account_id=organization.account_id,
                payout_account_id=previous_payout_account_id,
            )

        # Reusing an already-ready payout account doesn't fire a Stripe
        # `account.updated` webhook, so attempt activation here too.
        await self.maybe_activate(session, organization)
        return organization

    async def add_user(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        *,
        role: OrganizationRole = OrganizationRole.member,
        polar_self_member_delay: int | None = None,
        enqueue_polar_self_member: bool = True,
    ) -> None:
        nested = await session.begin_nested()
        try:
            relation = UserOrganization(
                user_id=user.id, organization_id=organization.id, role=role
            )
            session.add(relation)
            await session.flush()
            log.info(
                "organization.member.added",
                user_id=user.id,
                organization_id=organization.id,
                role=role,
            )
        except IntegrityError:
            # TODO: Currently, we treat this as success since the connection
            # exists. However, once we use status to distinguish active/inactive
            # installations we need to change this.
            log.info(
                "organization.member.re_added",
                organization_id=organization.id,
                user_id=user.id,
                role=role,
            )
            await nested.rollback()
            # Update
            stmt = (
                sql.Update(UserOrganization)
                .where(
                    UserOrganization.user_id == user.id,
                    UserOrganization.organization_id == organization.id,
                )
                .values(
                    deleted_at=None,  # un-delete user if exists
                    role=role,
                )
            )
            await session.execute(stmt)
            await session.flush()
        finally:
            if enqueue_polar_self_member:
                polar_self_service.enqueue_add_member(
                    external_customer_id=str(organization.id),
                    email=user.email,
                    name=user.full_name or user.email.split("@", 1)[0],
                    external_id=str(user.id),
                    role=billing_member_role(role),
                    delay=polar_self_member_delay,
                )

    async def change_owner(
        self,
        session: AsyncSession,
        *,
        new_owner_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> None:
        new_owner_user = await user_organization_service.transfer_ownership(
            session,
            new_owner_user_id=new_owner_id,
            organization_id=organization_id,
        )

        await self._sync_polar_self_customer_owner(
            session,
            organization_id=organization_id,
            new_owner_user=new_owner_user,
        )

    async def _sync_polar_self_customer_owner(
        self,
        session: AsyncSession,
        *,
        organization_id: uuid.UUID,
        new_owner_user: User,
    ) -> None:
        if not settings.POLAR_SELF_ENABLED:
            return

        polar_organization_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)
        if organization_id == polar_organization_id:
            return

        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_external_id_and_organization(
            str(organization_id), polar_organization_id
        )
        if customer is None:
            raise CannotChangeOwnerError(
                f"Polar self customer not found for organization {organization_id}"
            )

        member_repository = MemberRepository.from_session(session)
        target_member = await member_repository.get_by_customer_id_and_external_id(
            customer.id, str(new_owner_user.id)
        )
        if target_member is None:
            raise CannotChangeOwnerError(
                f"Polar self member not found for user {new_owner_user.id}"
            )

        if target_member.role != MemberRole.owner:
            await member_service.update(
                session,
                target_member,
                role=MemberRole.owner,
                allow_ownership_transfer=True,
            )

    async def get_next_invoice_number(
        self,
        session: AsyncSession,
        organization: Organization,
        customer: "Customer",
    ) -> str:
        match organization.invoice_numbering:
            case InvoiceNumbering.customer:
                customer_repository = CustomerRepository.from_session(session)
                invoice_number = (
                    await customer_repository.increment_invoice_next_number(customer.id)
                )
                return f"{organization.customer_invoice_prefix}-{customer.short_id_str}-{invoice_number:04d}"

            case InvoiceNumbering.organization:
                repository = OrganizationRepository.from_session(session)
                invoice_number = (
                    await repository.increment_customer_invoice_next_number(
                        organization.id
                    )
                )
                return f"{organization.customer_invoice_prefix}-{invoice_number:04d}"

    async def _after_update(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await webhook_service.send(
            session, organization, WebhookEventType.organization_updated, organization
        )

    async def check_review_threshold(
        self, session: AsyncSession, organization: Organization
    ) -> Organization:
        transfers_sum = await transaction_service.get_transactions_sum(
            session, organization.account_id, type=TransactionType.balance
        )

        # Always keep total_balance in sync
        organization.total_balance = transfers_sum
        session.add(organization)

        if settings.is_sandbox():
            return organization

        # Time-based snoozes are handled exclusively by
        # ``organization.unsnooze_expired``; only next-sale snoozes
        # transition here when their deadline has passed.
        if (
            organization.status == OrganizationStatus.SNOOZED
            and organization.snooze_type == SnoozeType.NEXT_SALE
            and organization.snoozed_until is not None
            and datetime.now(UTC) >= organization.snoozed_until
        ):
            await self._exit_snooze_to_review(session, organization)
            return organization

        # Only ACTIVE orgs are auto-pulled into review when they cross the
        # threshold. Other statuses — notably OFFBOARDING — must never flip
        # to review automatically; they can only return via a manual
        # "Set under review" action (set_organization_under_review).
        if organization.status != OrganizationStatus.ACTIVE:
            return organization

        if (
            organization.next_review_threshold >= 0
            and transfers_sum >= organization.next_review_threshold
        ):
            organization.set_status(OrganizationStatus.REVIEW)
            session.add(organization)

            enqueue_job("organization.under_review", organization_id=organization.id)

        return organization

    def _enqueue_cancel_pending_payouts(self, organization: Organization) -> None:
        """Cancel in-flight (held/pending) payouts when an org leaves the
        review flow to a terminal state (denied, blocked, offboarding)."""
        if organization.account_id is not None:
            enqueue_job(
                "payout.cancel_account_payouts",
                account_id=organization.account_id,
            )

    async def block_organization(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> Organization:
        """Block an organization by setting status to BLOCKED."""
        organization.set_status(OrganizationStatus.BLOCKED)
        session.add(organization)
        self._enqueue_cancel_pending_payouts(organization)
        return organization

    async def confirm_organization_reviewed(
        self,
        session: AsyncSession,
        organization: Organization,
        next_review_threshold: int | None = None,
    ) -> Organization | None:
        """Atomically transition a REVIEW or SNOOZED organization to ACTIVE.

        Returns the (refreshed) organization, or ``None`` if the transition
        did not happen — typically because another worker already confirmed
        the org first. Callers in the auto-approve path should treat
        ``None`` as "race lost, the other worker is canonical".

        The threshold doubling is computed server-side so that concurrent
        confirms cannot collapse onto each other's stale in-memory snapshot
        (workers that loaded the org before a 30s LLM call would otherwise
        all double from the same value).

        For DENIED/BLOCKED reactivation, use ``backoffice_approve``. For
        post-appeal-approval transitions, use ``approve_appeal``.
        """
        if organization.status not in (
            OrganizationStatus.REVIEW,
            OrganizationStatus.SNOOZED,
        ):
            raise OrganizationError(
                f"Cannot confirm organization {organization.id}: requires "
                f"REVIEW or SNOOZED status, got "
                f"{organization.status.get_display_name()}.",
                409,
            )

        repository = OrganizationRepository.from_session(session)
        confirmed = await repository.confirm_review_atomic(
            organization.id,
            next_review_threshold=next_review_threshold,
            min_threshold=_MIN_REVIEW_THRESHOLD,
            active_capabilities={**STATUS_CAPABILITIES[OrganizationStatus.ACTIVE]},
            now=datetime.now(UTC),
        )

        # Only the worker that actually flipped the org to ACTIVE releases its
        # held payouts; a lost race returns None and does nothing.
        if confirmed is not None and confirmed.account_id is not None:
            enqueue_job(
                "payout.release_held_payouts",
                account_id=confirmed.account_id,
            )

        return confirmed

    async def _is_activation_ready(
        self, session: AsyncSession, organization: Organization
    ) -> bool:
        """Whether onboarding gates (details, payout account, KYC) are met.

        Mirrors the non-review gates checked by `maybe_activate` so the
        backoffice approval path can decide whether a reactivation should go
        straight to ACTIVE or revert to CREATED to finish onboarding.
        """
        if not organization.details_submitted_at or not organization.details:
            return False

        if organization.payout_account_id is None:
            return False

        payout_account_repository = PayoutAccountRepository.from_session(session)
        payout_account = await payout_account_repository.get_by_id(
            organization.payout_account_id,
        )
        if payout_account is None or not payout_account.is_payout_ready:
            return False

        organization_repository = OrganizationRepository.from_session(session)
        owner_user = await organization_repository.get_owner_user(organization)
        if (
            owner_user is None
            or owner_user.identity_verification_status
            != IdentityVerificationStatus.verified
        ):
            return False

        return True

    async def maybe_activate(
        self, session: AsyncSession, organization: Organization
    ) -> bool:
        """Transition CREATED → ACTIVE when every onboarding gate passes.

        Gates:
          1. Status is CREATED.
          2. Review is approved: verdict PASS, or verdict FAIL with an
             APPROVED appeal.
          3. Details submitted, payout account ready, owner identity
             verified (see `_is_activation_ready`).

        Idempotent — safe to call from automated triggers (AI review, Stripe
        ``account.updated``, identity verification). Returns True iff the org
        was transitioned.

        Re-activation from DENIED/BLOCKED is synchronous and explicit, via
        `approve_appeal` (post-appeal-approval) or `backoffice_approve`
        (admin override). Webhooks never transition out of DENIED — the org's
        current status is the sole source of truth for what's authorized.
        """
        if organization.status != OrganizationStatus.CREATED:
            return False

        review_repository = OrganizationReviewRepository.from_session(session)
        review = await review_repository.get_by_organization(organization.id)
        if review is None or not review.is_approved:
            return False

        if not await self._is_activation_ready(session, organization):
            return False

        organization.set_status(OrganizationStatus.ACTIVE)
        if organization.initially_reviewed_at is None:
            # First activation: keep the small default threshold so the next
            # review fires quickly once the merchant starts taking payments.
            organization.initially_reviewed_at = datetime.now(UTC)
        else:
            organization.next_review_threshold = max(
                organization.next_review_threshold * 2, _MIN_REVIEW_THRESHOLD
            )
        session.add(organization)
        log.info(
            "organization.maybe_activate.activated",
            organization_id=str(organization.id),
            slug=organization.slug,
        )
        return True

    async def _reactivate_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        note: str,
        reason: str | None,
        next_review_threshold: int | None = None,
    ) -> OrganizationStatus:
        """Synchronously transition a DENIED/BLOCKED org to ACTIVE or CREATED.

        Goes to ACTIVE if every onboarding gate passes; otherwise to CREATED so
        the merchant can finish Stripe onboarding (a later `maybe_activate`
        then promotes them to ACTIVE).
        """
        if next_review_threshold is None:
            next_review_threshold = FIRST_REVIEW_THRESHOLD_CENTS

        is_ready = await self._is_activation_ready(session, organization)
        target_status = (
            OrganizationStatus.ACTIVE if is_ready else OrganizationStatus.CREATED
        )

        full_note = note
        if not is_ready:
            full_note += (
                " Status reverted to created — pending Stripe Identity and "
                "Stripe Connect Express completion before activation."
            )

        organization.set_status(target_status)
        organization.next_review_threshold = next_review_threshold
        _append_internal_note(organization, full_note, reason=reason)

        if organization.initially_reviewed_at is None:
            organization.initially_reviewed_at = datetime.now(UTC)

        session.add(organization)
        return target_status

    async def backoffice_approve(
        self,
        session: AsyncSession,
        organization: Organization,
        next_review_threshold: int | None = None,
        *,
        reason: str | None = None,
        internal_note: str | None = None,
        staff_user: User,
    ) -> Organization:
        """Backoffice override to re-activate a DENIED or BLOCKED organization.

        Use for support-contact escalations where an admin overrides a denial
        without going through the appeal flow (or after the AI auto-rejected
        an appeal). Synchronously transitions to ACTIVE if onboarding is
        complete, otherwise to CREATED.

        If a review with a submitted appeal exists, the appeal is recorded
        as APPROVED so the merchant's frontend reflects it, and any open appeal
        support case is closed as approved

        ``internal_note`` overrides the default reactivation note (and omits the
        reason line) so callers can record a context-specific note instead — the
        appeal flow points to the support case rather than repeating its reason.

        ``reason`` is optional and, when set, becomes the merchant-facing body of
        the appeal decision message on the support case. The appeal flow keeps it
        optional (the staff-facing override reason is recorded separately); the
        org-level reactivation passes its required override reason through here.
        """
        notes = {
            OrganizationStatus.DENIED: "Organization reactivated from denied.",
            OrganizationStatus.BLOCKED: "Organization unblocked.",
        }
        if organization.status not in notes:
            raise OrganizationError(
                "backoffice_approve requires DENIED or BLOCKED status, got "
                f"{organization.status.get_display_name()}.",
                400,
            )

        review_repository = OrganizationReviewRepository.from_session(session)
        review = await review_repository.get_by_organization(organization.id)
        if review is not None:
            if (
                review.appeal_submitted_at
                and review.appeal_decision != OrganizationReview.AppealDecision.APPROVED
            ):
                review.appeal_decision = OrganizationReview.AppealDecision.APPROVED
                review.appeal_reviewed_at = datetime.now(UTC)
                session.add(review)
            await appeal_case_service.approve_open_case(
                session, review, staff_user=staff_user, reason=reason
            )

        note = (
            internal_note if internal_note is not None else notes[organization.status]
        )
        target_status = await self._reactivate_organization(
            session,
            organization,
            note=note,
            reason=None if internal_note is not None else reason,
            next_review_threshold=next_review_threshold,
        )
        log.info(
            "organization.backoffice_approve.activated"
            if target_status == OrganizationStatus.ACTIVE
            else "organization.backoffice_approve.reverted_to_created",
            organization_id=str(organization.id),
            slug=organization.slug,
        )
        return organization

    async def add_internal_note(
        self, session: AsyncSession, organization: Organization, message: str
    ) -> None:
        """Append a timestamped, admin-only internal note (append-only)."""
        _append_internal_note(organization, message)
        session.add(organization)

    async def handle_ongoing_review_verdict(
        self,
        session: AsyncSession,
        organization: Organization,
        verdict: ReviewVerdict,
    ) -> bool:
        """Handle AI agent verdict for an ongoing threshold review.

        Returns True if THIS worker auto-approved (won the race). Returns
        False otherwise — either the verdict was not APPROVE, the org was
        not in REVIEW, or another concurrent worker already confirmed it.
        Only the winner should record the agent decision and side-effects.
        """
        is_eligible = (
            organization.status == OrganizationStatus.REVIEW
            and verdict == ReviewVerdict.APPROVE
        )
        if not is_eligible:
            return False

        confirmed = await self.confirm_organization_reviewed(session, organization)
        return confirmed is not None

    async def deny_organization(
        self, session: AsyncSession, organization: Organization
    ) -> Organization:
        organization.set_status(OrganizationStatus.DENIED)
        session.add(organization)

        self._enqueue_cancel_pending_payouts(organization)

        # If there's a pending appeal, mark it as rejected
        review_repository = OrganizationReviewRepository.from_session(session)
        review = await review_repository.get_by_organization(organization.id)
        if review and review.appeal_submitted_at and review.appeal_decision is None:
            review.appeal_decision = OrganizationReview.AppealDecision.REJECTED
            review.appeal_reviewed_at = datetime.now(UTC)
            session.add(review)

        return organization

    async def snooze_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        days: int,
        snooze_type: SnoozeType,
        reason: str | None = None,
    ) -> Organization:
        """Snooze an organization under review for ``days`` days.

        Two modes are supported via ``snooze_type``:

        * ``TIME_BASED``: the org returns to REVIEW automatically once the
          deadline passes (handled by the ``organization.unsnooze_expired``
          periodic task).
        * ``NEXT_SALE``: the org stays snoozed past the deadline until the
          next sale arrives, which triggers re-review via
          ``check_review_threshold``.
        """
        if organization.status != OrganizationStatus.REVIEW:
            raise OrganizationError(
                "Only organizations under review can be snoozed.", 403
            )

        if not SNOOZE_MIN_DAYS <= days <= SNOOZE_MAX_DAYS:
            raise OrganizationError(
                f"Snooze duration must be between {SNOOZE_MIN_DAYS} and "
                f"{SNOOZE_MAX_DAYS} days.",
                400,
            )

        organization.set_status(OrganizationStatus.SNOOZED)
        organization.snooze_count += 1
        organization.snoozed_until = datetime.now(UTC) + timedelta(days=days)
        organization.snooze_type = snooze_type

        trigger = (
            "auto re-review afterwards"
            if snooze_type == SnoozeType.TIME_BASED
            else "re-review on next sale afterwards"
        )
        _append_internal_note(
            organization,
            f"Organization snoozed (#{organization.snooze_count}) "
            f"for {days} day(s) — {trigger}.",
            reason=reason,
        )
        session.add(organization)
        return organization

    async def unsnooze_organization(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> Organization:
        """Manually move a snoozed organization back to review."""
        if organization.status != OrganizationStatus.SNOOZED:
            raise OrganizationError("Only snoozed organizations can be unsnoozed.", 403)

        await self._exit_snooze_to_review(session, organization)
        return organization

    async def unsnooze_expired_organizations(
        self, session: AsyncSession
    ) -> Sequence[Organization]:
        """Auto-unsnooze TIME_BASED snoozes whose deadline has passed.

        Run periodically by a worker. Returns the orgs transitioned.
        """
        repository = OrganizationRepository.from_session(session)
        candidates = await repository.get_expired_time_based_snoozes(datetime.now(UTC))
        transitioned: list[Organization] = []
        for organization in candidates:
            # Skip if a concurrent admin action already moved the org out of
            # SNOOZED — set_status would raise InvalidStatusTransitionError
            # and abort the whole batch otherwise.
            if organization.status != OrganizationStatus.SNOOZED:
                continue
            await self._exit_snooze_to_review(session, organization)
            transitioned.append(organization)
        return transitioned

    async def offboard_expired_organizations(
        self, session: AsyncSession
    ) -> Sequence[Organization]:
        """Auto-transition offboarding orgs to the terminal offboarded state.

        Run periodically by a worker once the offboarding period has elapsed
        since both the org's last paid order (chargeback safety) and its
        entry into offboarding (merchant wind-down floor). Returns the orgs
        transitioned.
        """
        repository = OrganizationRepository.from_session(session)
        cutoff = datetime.now(UTC) - settings.ORGANIZATION_OFFBOARDING_PERIOD
        # The candidate query takes FOR UPDATE on each org row, so a concurrent
        # admin status change either falls out of the WHERE clause or waits
        # behind our lock — no per-row re-check needed.
        candidates = await repository.get_offboarding_past_period(cutoff)
        transitioned: list[Organization] = []
        for organization in candidates:
            self._transition_to_offboarded(
                session,
                organization,
                "Automatically offboarded after the offboarding period elapsed.",
            )
            transitioned.append(organization)
        return transitioned

    async def set_organization_offboarded(
        self, session: AsyncSession, organization: Organization
    ) -> Organization:
        """Manually transition an offboarding org to the terminal offboarded state.

        Same effect as the auto-offboard cron, but triggered from the
        backoffice — used to complete offboarding before the wind-down period
        has fully elapsed.
        """
        if organization.status != OrganizationStatus.OFFBOARDING:
            raise OrganizationError(
                "Only organizations that are offboarding can be set to offboarded.",
                403,
            )
        self._transition_to_offboarded(
            session, organization, "Manually offboarded from the backoffice."
        )
        return organization

    def _transition_to_offboarded(
        self, session: AsyncSession, organization: Organization, note: str
    ) -> None:
        organization.set_status(OrganizationStatus.OFFBOARDED)
        _append_internal_note(organization, note)
        session.add(organization)
        enqueue_job("organization.offboarded", organization_id=organization.id)

    async def _exit_snooze_to_review(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        organization.set_status(OrganizationStatus.REVIEW)
        organization.snoozed_until = None
        organization.snooze_type = None
        session.add(organization)
        enqueue_job("organization.under_review", organization_id=organization.id)

    async def set_organization_under_review(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        enqueue_review: bool = True,
    ) -> Organization:
        organization.set_status(OrganizationStatus.REVIEW)
        session.add(organization)

        # Record a human ESCALATE decision so the agent knows not to auto-act
        review_repository = AgentReviewRepository.from_session(session)
        await review_repository.deactivate_current_decisions(organization.id)
        await review_repository.save_review_decision(
            organization_id=organization.id,
            actor_type=ActorType.HUMAN,
            decision=DecisionType.ESCALATE,
            review_context=ReviewContext.MANUAL,
        )

        if enqueue_review:
            enqueue_job("organization.under_review", organization_id=organization.id)
        return organization

    async def set_organization_offboarding(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        reason: str | None = None,
    ) -> Organization:
        if organization.status != OrganizationStatus.REVIEW:
            raise OrganizationError(
                "Only organizations under review can be set to offboarding.",
                403,
            )
        organization.set_status(OrganizationStatus.OFFBOARDING)
        _append_internal_note(
            organization, "Organization set to offboarding.", reason=reason
        )
        session.add(organization)
        self._enqueue_cancel_pending_payouts(organization)
        return organization

    def get_payment_status(self, organization: Organization) -> PaymentStatusResponse:
        """Get payment status and onboarding steps for an organization."""
        return PaymentStatusResponse(
            payment_ready=organization.can_accept_payments,
            organization_status=organization.status,
        )

    async def get_ai_review(
        self, session: AsyncSession, organization: Organization
    ) -> OrganizationReview | None:
        """Get the existing AI review for an organization, if any.

        The actual AI review is triggered asynchronously via a background
        task when organization details are submitted for review.
        """
        repository = OrganizationReviewRepository.from_session(session)
        return await repository.get_by_organization(organization.id)

    async def get_review_state(
        self,
        session: AsyncReadSession,
        organization: Organization,
        auth_subject: AuthSubject[User | Organization] | None = None,
    ) -> OrganizationReviewState:
        """Build the merchant self-review checklist state.

        Pre-submission, the response surfaces gating checks that block
        submission until resolved. Once submitted, ``submitted_at`` is set
        and the response also carries the AI verdict and any appeal state.
        """
        payout_account: PayoutAccount | None = None
        if organization.payout_account_id is not None:
            payout_account_repository = PayoutAccountRepository.from_session(session)
            payout_account = await payout_account_repository.get_by_id(
                organization.payout_account_id
            )

        organization_repository = OrganizationRepository.from_session(session)
        owner_user = await organization_repository.get_owner_user(organization)

        # Identity verification is the owner's to complete. When a non-owner
        # member is viewing, surface that they can't action it
        current_user = (
            auth_subject.subject
            if auth_subject is not None and is_user(auth_subject)
            else None
        )
        identity_restricted = current_user is not None and not (
            owner_user is not None and current_user.id == owner_user.id
        )

        review_repository = OrganizationReviewRepository.from_session(session)
        review = await review_repository.get_by_organization(organization.id)

        # Run the HTTP-bound product-URL check concurrently with the DB-bound
        # builders so the outbound fetch overlaps with the rest of the work.
        product_url_task = asyncio.create_task(
            self._build_product_url_check(organization)
        )
        product_configuration_check = await self._build_product_configuration_check(
            session, organization
        )
        setup_readiness_check = await self._build_setup_readiness_check(
            session, organization
        )

        preliminary_steps = [
            self._build_product_description_check(organization),
            product_configuration_check,
            setup_readiness_check,
            self._build_identity_verification_check(
                owner_user, restricted=identity_restricted
            ),
            self._build_payout_account_check(payout_account),
            self._build_socials_check(organization),
            await product_url_task,
            self._build_email_check(organization),
        ]

        submitted_at = organization.details_submitted_at
        optional_keys = {OrganizationReviewCheckKey.IDENTITY_SOCIAL_LINKS}
        is_blocked = any(
            step.status
            in (
                OrganizationReviewCheckStatus.FAILED,
                OrganizationReviewCheckStatus.PENDING,
            )
            for step in preliminary_steps
            if step.key not in optional_keys
        )
        can_submit = submitted_at is None and not is_blocked

        verdict: OrganizationReviewVerdict | None = None
        appeal: OrganizationReviewAppeal | None = None
        if review is not None:
            if review.verdict == OrganizationReview.Verdict.PASS:
                verdict = "pass"
            elif review.verdict == OrganizationReview.Verdict.FAIL:
                verdict = "fail"
            if review.appeal_submitted_at is not None:
                appeal = OrganizationReviewAppeal(
                    submitted_at=review.appeal_submitted_at,
                    reviewed_at=review.appeal_reviewed_at,
                    decision=review.appeal_decision,
                )

        return OrganizationReviewState(
            can_submit=can_submit,
            submitted_at=submitted_at,
            verdict=verdict,
            appeal=appeal,
            preliminary_steps=preliminary_steps,
        )

    @staticmethod
    def _not_started_check(
        key: OrganizationReviewCheckKey,
    ) -> OrganizationReviewCheck:
        return OrganizationReviewCheck(
            key=key,
            status=OrganizationReviewCheckStatus.PENDING,
            reasons=[OrganizationReviewCheckReason.NOT_STARTED],
        )

    @staticmethod
    def _passed_check(key: OrganizationReviewCheckKey) -> OrganizationReviewCheck:
        return OrganizationReviewCheck(
            key=key, status=OrganizationReviewCheckStatus.PASSED
        )

    def _build_email_check(self, organization: Organization) -> OrganizationReviewCheck:
        key = OrganizationReviewCheckKey.IDENTITY_EMAIL
        if not organization.email:
            return self._not_started_check(key)

        try:
            email_domain = email_validator.validate_email(
                organization.email, check_deliverability=False
            ).domain
        except email_validator.EmailNotValidError:
            return self._passed_check(key)

        website_domain = _website_domain(organization.website)
        reasons: list[OrganizationReviewCheckReason] = []

        if email_domain in settings.PERSONAL_EMAIL_DOMAINS:
            reasons.append(OrganizationReviewCheckReason.IDENTITY_PERSONAL_EMAIL)

        if (
            website_domain
            and email_domain != website_domain
            and not _is_hosted_website_domain(website_domain)
        ):
            reasons.append(OrganizationReviewCheckReason.IDENTITY_DOMAIN_MISMATCH)

        if reasons:
            return OrganizationReviewCheck(
                key=key,
                status=OrganizationReviewCheckStatus.WARNING,
                reasons=reasons,
            )
        return self._passed_check(key)

    async def _build_product_url_check(
        self, organization: Organization
    ) -> OrganizationReviewCheck:
        key = OrganizationReviewCheckKey.PRODUCT_URL
        if not organization.website:
            return self._not_started_check(key)

        result = await check_url_reachable(organization.website)
        if not result.reachable:
            return OrganizationReviewCheck(
                key=key,
                status=OrganizationReviewCheckStatus.FAILED,
                reasons=[OrganizationReviewCheckReason.PRODUCT_URL_UNREACHABLE],
                value=organization.website,
            )

        return OrganizationReviewCheck(
            key=key,
            status=OrganizationReviewCheckStatus.PASSED,
            value=organization.website,
        )

    def _build_socials_check(
        self, organization: Organization
    ) -> OrganizationReviewCheck:
        key = OrganizationReviewCheckKey.IDENTITY_SOCIAL_LINKS
        if not organization.socials:
            return self._not_started_check(key)
        return self._passed_check(key)

    def _build_identity_verification_check(
        self, owner_user: User | None, *, restricted: bool = False
    ) -> OrganizationReviewCheck:
        key = OrganizationReviewCheckKey.IDENTITY_STRIPE_VERIFICATION
        check = self._owner_identity_check(owner_user, key)
        if restricted and check.status != OrganizationReviewCheckStatus.PASSED:
            return OrganizationReviewCheck(
                key=key,
                status=check.status,
                reasons=[OrganizationReviewCheckReason.NOT_AUTHORIZED],
            )
        return check

    def _owner_identity_check(
        self, owner_user: User | None, key: OrganizationReviewCheckKey
    ) -> OrganizationReviewCheck:
        if owner_user is None:
            return self._not_started_check(key)

        status = owner_user.identity_verification_status
        match status:
            case IdentityVerificationStatus.verified:
                return self._passed_check(key)
            case IdentityVerificationStatus.pending:
                return OrganizationReviewCheck(
                    key=key,
                    status=OrganizationReviewCheckStatus.PENDING,
                    reasons=[OrganizationReviewCheckReason.EXTERNAL_PENDING],
                )
            case IdentityVerificationStatus.failed:
                return OrganizationReviewCheck(
                    key=key,
                    status=OrganizationReviewCheckStatus.FAILED,
                    reasons=[OrganizationReviewCheckReason.IDENTITY_REJECTED],
                )
            case IdentityVerificationStatus.unverified:
                return self._not_started_check(key)
            case _:
                assert_never(status)

    def _build_product_description_check(
        self, organization: Organization
    ) -> OrganizationReviewCheck:
        key = OrganizationReviewCheckKey.PRODUCT_DESCRIPTION
        description = organization.details.get("product_description")
        # ``details`` is JSONB — defend against non-string values written by
        # legacy migrations or backoffice tooling.
        if not isinstance(description, str) or not description.strip():
            return self._not_started_check(key)
        # Mirrors OrganizationReviewSubmissionDetails: min_length=30 after strip.
        if len(description.strip()) < 30:
            return OrganizationReviewCheck(
                key=key,
                status=OrganizationReviewCheckStatus.FAILED,
                reasons=[OrganizationReviewCheckReason.IN_PROGRESS],
            )
        return self._passed_check(key)

    def _build_payout_account_check(
        self, payout_account: PayoutAccount | None
    ) -> OrganizationReviewCheck:
        key = OrganizationReviewCheckKey.PAYOUT_ACCOUNT
        if payout_account is None:
            return self._not_started_check(key)
        if payout_account.is_payout_ready:
            return self._passed_check(key)
        # Reserve PAYOUTS_DISABLED for the case where Stripe explicitly blocked
        # payouts on an otherwise-complete account; everything else (incomplete
        # onboarding, charges off, missing details) is a requirements gap that
        # the merchant can resolve by finishing Stripe Connect.
        stripe_blocked_payouts = (
            payout_account.is_details_submitted
            and payout_account.is_charges_enabled
            and not payout_account.is_payouts_enabled
        )
        reason = (
            OrganizationReviewCheckReason.PAYOUT_ACCOUNT_PAYOUTS_DISABLED
            if stripe_blocked_payouts
            else OrganizationReviewCheckReason.PAYOUT_ACCOUNT_REQUIREMENTS_DUE
        )
        return OrganizationReviewCheck(
            key=key,
            status=OrganizationReviewCheckStatus.FAILED,
            reasons=[reason],
        )

    async def _build_product_configuration_check(
        self, session: AsyncReadSession, organization: Organization
    ) -> OrganizationReviewCheck:
        key = OrganizationReviewCheckKey.PRODUCT_CONFIGURATION
        product_repository = ProductRepository.from_session(session)
        product_count = await product_repository.count_by_organization_id(
            organization.id, is_archived=False
        )
        if product_count == 0:
            return self._not_started_check(key)
        return self._passed_check(key)

    async def _build_setup_readiness_check(
        self, session: AsyncReadSession, organization: Organization
    ) -> OrganizationReviewCheck:
        """Setup readiness passes when the merchant has at least one
        auto-fulfillable checkout link (selling a Polar-fulfilled benefit,
        or with a success_url so the merchant handles fulfillment via
        redirect), or has both an organization access token and a webhook
        endpoint.

        A checkout link with neither benefits nor a success_url has no
        automatic fulfillment path, which is a broken integration.

        An access token without a webhook is a non-blocking warning rather
        than a failure: the merchant can still fulfill via success_url +
        API calls, we just can't observe state changes (refunds,
        cancellations) without webhooks during review. Aggregate checks
        expose per-component state via `sub_checks`; the parent `status`
        remains the source of truth for gating.
        """
        key = OrganizationReviewCheckKey.SETUP_READINESS

        checkout_link_repository = CheckoutLinkRepository.from_session(session)
        access_token_repository = OrganizationAccessTokenRepository.from_session(
            session
        )
        webhook_repository = WebhookEndpointRepository.from_session(session)

        has_checkout_link_with_fulfillable_benefit = (
            await checkout_link_repository.has_with_benefit_types(
                organization.id, _CHECKOUT_FULFILLABLE_BENEFITS
            )
        )
        has_checkout_link_with_success_url = (
            await checkout_link_repository.has_with_success_url(organization.id)
        )
        has_fulfillable_checkout_link = (
            has_checkout_link_with_fulfillable_benefit
            or has_checkout_link_with_success_url
        )
        has_any_checkout_link = await checkout_link_repository.has_any(organization.id)
        has_access_token = await access_token_repository.has_by_organization_id(
            organization.id
        )
        has_webhook = await webhook_repository.has_by_organization_id(organization.id)

        def _sub(
            sub_key: OrganizationReviewSubCheckKey, ok: bool
        ) -> OrganizationReviewSubCheck:
            return OrganizationReviewSubCheck(
                key=sub_key,
                status=OrganizationReviewCheckStatus.PASSED
                if ok
                else OrganizationReviewCheckStatus.PENDING,
                reasons=[] if ok else [OrganizationReviewCheckReason.NOT_STARTED],
            )

        # Checkout link escalates to WARNING when the merchant has created a
        # checkout link but it neither sells a fulfillable benefit nor sets a
        # success_url — i.e. the link exists but won't actually deliver
        # anything to the customer post-purchase.
        if has_fulfillable_checkout_link:
            checkout_link_sub = _sub(
                OrganizationReviewSubCheckKey.SETUP_READINESS_CHECKOUT_LINK,
                True,
            )
        elif has_any_checkout_link:
            # The merchant created a checkout link but it neither sells a
            # fulfillable benefit nor sets a success_url — it can't actually
            # deliver anything post-purchase. Treat as a hard failure so the
            # row surfaces it clearly; the parent rollup still falls back to
            # PASSED if the API path is fully configured.
            checkout_link_sub = OrganizationReviewSubCheck(
                key=OrganizationReviewSubCheckKey.SETUP_READINESS_CHECKOUT_LINK,
                status=OrganizationReviewCheckStatus.FAILED,
                reasons=[
                    OrganizationReviewCheckReason.SETUP_READINESS_CHECKOUT_LINK_NOT_FULFILLABLE
                ],
            )
        else:
            checkout_link_sub = _sub(
                OrganizationReviewSubCheckKey.SETUP_READINESS_CHECKOUT_LINK,
                False,
            )
        access_token_sub = _sub(
            OrganizationReviewSubCheckKey.SETUP_READINESS_ACCESS_TOKEN,
            has_access_token,
        )

        # Webhook escalates to WARNING (not just PENDING) when the merchant
        # has chosen the API path: at that point we expect a webhook for
        # observability, and its absence is a non-blocking flag rather than
        # a "not started yet" state.
        if has_access_token and not has_webhook:
            webhook_sub = OrganizationReviewSubCheck(
                key=OrganizationReviewSubCheckKey.SETUP_READINESS_WEBHOOK,
                status=OrganizationReviewCheckStatus.WARNING,
                reasons=[OrganizationReviewCheckReason.SETUP_READINESS_WEBHOOK_MISSING],
            )
        else:
            webhook_sub = _sub(
                OrganizationReviewSubCheckKey.SETUP_READINESS_WEBHOOK, has_webhook
            )

        api_path_passed = (
            access_token_sub.status == OrganizationReviewCheckStatus.PASSED
            and webhook_sub.status == OrganizationReviewCheckStatus.PASSED
        )

        if (
            checkout_link_sub.status == OrganizationReviewCheckStatus.PASSED
            or api_path_passed
        ):
            parent_status = OrganizationReviewCheckStatus.PASSED
        elif checkout_link_sub.status == OrganizationReviewCheckStatus.FAILED:
            # No-code path attempted but the link can't fulfill — surface as
            # a hard failure so the user can't submit without fixing it.
            parent_status = OrganizationReviewCheckStatus.FAILED
        elif access_token_sub.status == OrganizationReviewCheckStatus.PASSED:
            # API path partially configured — token present, webhook missing.
            parent_status = OrganizationReviewCheckStatus.WARNING
        else:
            parent_status = OrganizationReviewCheckStatus.PENDING

        # Propagate failure/warning-level reasons from sub-checks to the
        # parent so the row header can surface a single, actionable hint
        # without the frontend re-deriving which sub-check produced it. Skip
        # propagation when the parent is already PASSED — one complete path
        # makes any partial state on the other path irrelevant for the rollup
        # message.
        sub_checks = [checkout_link_sub, access_token_sub, webhook_sub]
        parent_reasons: list[OrganizationReviewCheckReason] = []
        if parent_status != OrganizationReviewCheckStatus.PASSED:
            propagated_statuses = {
                OrganizationReviewCheckStatus.WARNING,
                OrganizationReviewCheckStatus.FAILED,
            }
            seen: set[OrganizationReviewCheckReason] = set()
            for sub in sub_checks:
                if sub.status not in propagated_statuses:
                    continue
                for reason in sub.reasons:
                    if reason in seen:
                        continue
                    seen.add(reason)
                    parent_reasons.append(reason)

        return OrganizationReviewCheck(
            key=key,
            status=parent_status,
            reasons=parent_reasons,
            sub_checks=sub_checks,
        )

    async def submit_appeal(
        self, session: AsyncSession, organization: Organization, appeal_reason: str
    ) -> OrganizationReview:
        """Submit an appeal and enqueue the AI agent to decide it.

        The appeal is decisive: the agent either approves the org or rejects
        the appeal with a "contact support" message. No Plain ticket is
        created automatically.
        """

        repository = OrganizationReviewRepository.from_session(session)
        review = await repository.get_by_organization(organization.id)

        if review is None:
            raise ValueError("Organization must have a review before submitting appeal")

        if review.verdict == OrganizationReview.Verdict.PASS:
            raise ValueError("Cannot submit appeal for a passed review")

        if review.appeal_submitted_at is not None:
            raise ValueError("Appeal has already been submitted for this organization")

        review.appeal_submitted_at = datetime.now(UTC)
        review.appeal_reason = appeal_reason

        session.add(review)

        enqueue_job("organization_review.appeal_submitted", organization.id)

        return review

    async def approve_appeal(
        self, session: AsyncSession, organization: Organization
    ) -> OrganizationReview:
        """Approve an appeal and synchronously transition the organization.

        Sets ``review.appeal_decision = APPROVED`` and immediately moves the
        org out of DENIED — to ACTIVE if every onboarding gate passes,
        otherwise to CREATED so the merchant can finish Stripe onboarding. A
        later `maybe_activate` then promotes a CREATED org to ACTIVE.
        """

        repository = OrganizationReviewRepository.from_session(session)
        review = await repository.get_by_organization(organization.id)

        if review is None:
            raise ValueError("Organization must have a review before approving appeal")

        if review.appeal_submitted_at is None:
            raise ValueError("No appeal has been submitted for this organization")

        if review.appeal_decision is not None:
            raise ValueError("Appeal has already been reviewed")

        review.appeal_decision = OrganizationReview.AppealDecision.APPROVED
        review.appeal_reviewed_at = datetime.now(UTC)
        session.add(review)

        if organization.status == OrganizationStatus.DENIED:
            target_status = await self._reactivate_organization(
                session,
                organization,
                note="Appeal approved.",
                reason=review.appeal_reason,
            )
            log.info(
                "organization.approve_appeal.activated"
                if target_status == OrganizationStatus.ACTIVE
                else "organization.approve_appeal.reverted_to_created",
                organization_id=str(organization.id),
                slug=organization.slug,
            )

        return review

    async def deny_appeal(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        staff_user: User | None = None,
        reason: str | None = None,
    ) -> OrganizationReview:
        """Deny an organization's appeal and keep payment access blocked.

        With ``staff_user`` (the backoffice deny dialog), any open appeal
        support case is also closed as denied — the denial twin of
        ``backoffice_approve``, so no deny path resolves the appeal while
        leaving the case open. The automated AI appeal task calls this without
        a ``staff_user`` (no human actor, and no case exists at that point).
        """

        repository = OrganizationReviewRepository.from_session(session)
        review = await repository.get_by_organization(organization.id)

        if review is None:
            raise ValueError("Organization must have a review before denying appeal")

        if review.appeal_submitted_at is None:
            raise ValueError("No appeal has been submitted for this organization")

        if review.appeal_decision is not None:
            raise ValueError("Appeal has already been reviewed")

        review.appeal_decision = OrganizationReview.AppealDecision.REJECTED
        review.appeal_reviewed_at = datetime.now(UTC)

        session.add(review)

        if staff_user is not None:
            await appeal_case_service.deny_open_case(
                session, review, staff_user=staff_user, reason=reason
            )

        return review

    async def mark_ai_onboarding_complete(
        self, session: AsyncSession, organization: Organization
    ) -> Organization:
        """Mark the AI onboarding as completed for this organization.

        Only sets the timestamp if it hasn't been set before, to capture the first completion.
        """
        if organization.ai_onboarding_completed_at is not None:
            return organization

        repository = OrganizationRepository.from_session(session)
        organization = await repository.update(
            organization,
            update_dict={
                "onboarded_at": datetime.now(UTC),
                "ai_onboarding_completed_at": datetime.now(UTC),
            },
        )
        return organization

    async def enable_preview_access(
        self, session: AsyncSession, organization: Organization
    ) -> Organization:
        """Enable preview access to in-preview features for this organization.

        Mirrors the paid-plan benefit webhook
        (`PolarSelfService._apply_preview_access`) by flipping on every
        `PREVIEW_ACCESS_FEATURE_FLAGS` flag, so Sandbox testing matches the real
        paid-plan behavior. Intended for Sandbox only: the endpoint guards on
        `settings.is_sandbox()`.
        """
        repository = OrganizationRepository.from_session(session)
        organization = await repository.update(
            organization,
            update_dict={
                "feature_settings": {
                    **organization.feature_settings,
                    **{
                        flag: True
                        for flag in polar_self_service.PREVIEW_ACCESS_FEATURE_FLAGS
                    },
                }
            },
        )
        return organization

    async def set_capability(
        self,
        session: AsyncSession,
        organization: Organization,
        capability: CapabilityName,
        value: bool,
        *,
        reason: str,
        admin_email: str | None = None,
    ) -> Organization:
        """Override a single capability on an organization.

        The override persists until the next status transition — `set_status`
        resets `capabilities` from `STATUS_CAPABILITIES`.
        """
        current: OrganizationCapabilities = dict(  # type: ignore[assignment]
            organization.capabilities
        )
        if current[capability] == value:
            return organization

        current[capability] = value
        organization.capabilities = current

        action = "enabled" if value else "disabled"
        by = f" by {admin_email}" if admin_email else ""
        _append_internal_note(
            organization,
            f"Capability '{capability}' {action}{by}",
            reason=reason,
        )

        session.add(organization)
        return organization


organization = OrganizationService()
