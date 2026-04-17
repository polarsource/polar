import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any, cast
from uuid import UUID

import structlog
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from polar.account.service import account as account_service
from polar.auth.models import AuthSubject
from polar.config import Environment, settings
from polar.customer.repository import CustomerRepository
from polar.enums import InvoiceNumbering, SubscriptionProrationBehavior
from polar.exceptions import NotPermitted, PolarError, PolarRequestValidationError
from polar.integrations.loops.service import loops as loops_service
from polar.integrations.plain.service import plain as plain_service
from polar.integrations.polar.service import polar_self as polar_self_service
from polar.kit.anonymization import anonymize_email_for_deletion, anonymize_for_deletion
from polar.kit.currency import PresentmentCurrency
from polar.kit.pagination import PaginationParams
from polar.kit.repository import Options
from polar.kit.sorting import Sorting
from polar.models import (
    Customer,
    Organization,
    PayoutAccount,
    User,
    UserOrganization,
)
from polar.models.organization import OrganizationDetails, OrganizationStatus
from polar.models.organization_review import OrganizationReview
from polar.models.transaction import TransactionType
from polar.models.user import IdentityVerificationStatus
from polar.models.webhook_endpoint import WebhookEventType
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
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .repository import OrganizationRepository, OrganizationReviewRepository
from .schemas import (
    OrganizationCreate,
    OrganizationDeletionBlockedReason,
    OrganizationUpdate,
)
from .sorting import OrganizationSortProperty

if TYPE_CHECKING:
    pass

log = structlog.get_logger()

_MIN_REVIEW_THRESHOLD = 10_000
SNOOZE_GRACE_PERIOD = timedelta(hours=24)


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
        statement = repository.get_readable_statement(auth_subject)

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
        statement = (
            repository.get_readable_statement(auth_subject)
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

        organization = await repository.create(
            Organization(
                **create_data,
                customer_invoice_prefix=create_schema.slug.upper(),
            )
        )
        organization.account = await account_service.create(
            session, auth_subject.subject
        )

        await session.flush()
        polar_self_service.enqueue_create_customer(
            organization_id=organization.id,
            name=organization.name,
            owner_external_id=str(auth_subject.subject.id),
            owner_email=auth_subject.subject.email,
            owner_name=auth_subject.subject.public_name,
        )
        await self.add_user(
            session,
            organization,
            auth_subject.subject,
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

        if update_schema.notification_settings is not None:
            organization.notification_settings = update_schema.notification_settings

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

        # Only store details once to avoid API overrides later w/o review
        # We do allow initial details being set upon creation that will still require review,
        # so upon creation we set details but not details_submitted_at
        # so details_submitted_at effectively doubles as a "submit for review"
        # timestamp, for now. We'll revisit this soon enough. @pieterbeulque
        if not organization.details_submitted_at and update_schema.details:
            organization.details = cast(
                OrganizationDetails, update_schema.details.model_dump()
            )
            organization.details_submitted_at = datetime.now(UTC)
            enqueue_job(
                "organization_review.run_agent",
                organization_id=organization.id,
                context=ReviewContext.SUBMISSION,
            )

        organization = await repository.update(organization, update_dict=update_dict)

        await self._after_update(session, organization)
        return organization

    async def delete(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> Organization:
        """Anonymizes fields on the Organization that can contain PII and then
        soft-deletes the Organization.

        DOES NOT:
        - Delete or anonymize Users related Organization
        - Delete or anonymize Account of the Organization
        - Delete or anonymize Customers, Products, Discounts, Benefits, Checkouts of the Organization
        - Revoke Benefits granted
        - Remove API tokens (organization or personal)
        """
        repository = OrganizationRepository.from_session(session)

        update_dict: dict[str, Any] = {}

        pii_fields = ["name", "slug", "website", "customer_invoice_prefix"]
        github_fields = ["bio", "company", "blog", "location", "twitter_username"]
        for pii_field in pii_fields + github_fields:
            value = getattr(organization, pii_field)
            if value:
                update_dict[pii_field] = anonymize_for_deletion(value)

        if organization.email:
            update_dict["email"] = anonymize_email_for_deletion(organization.email)

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
        polar_self_service.enqueue_delete_customer(organization_id=organization.id)

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

        Authorization:
        - If the organization has an account, only the account admin can delete
        - If there is no account, any organization member can delete

        Flow:
        1. Check authorization
        2. Check for orders/subscriptions -> if blocked, create support ticket
        3. If has account -> try to delete Stripe account
        4. If Stripe deletion fails -> create support ticket
        5. Soft delete organization
        """
        # Authorization check: only account admin can delete if account exists
        is_admin = await account_service.is_user_admin(
            session, organization.account_id, auth_subject.subject
        )
        if not is_admin:
            raise NotPermitted(
                "Only the account admin can delete an organization with an account"
            )

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

        # Soft delete the organization
        await self.soft_delete_organization(session, organization)

        return OrganizationDeletionCheckResult(
            can_delete_immediately=True,
            blocked_reasons=[],
        )

    async def soft_delete_organization(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> Organization:
        """Soft-delete an organization, preserving the slug for backoffice links.

        Anonymizes PII fields (except slug) and sets deleted_at timestamp.
        """
        repository = OrganizationRepository.from_session(session)

        update_dict: dict[str, Any] = {}

        # Anonymize PII fields but NOT slug (to keep backoffice links working)
        pii_fields = ["name", "website", "customer_invoice_prefix"]
        github_fields = ["bio", "company", "blog", "location", "twitter_username"]
        for pii_field in pii_fields + github_fields:
            value = getattr(organization, pii_field)
            if value:
                update_dict[pii_field] = anonymize_for_deletion(value)

        if organization.email:
            update_dict["email"] = anonymize_email_for_deletion(organization.email)

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
        auth_subject: AuthSubject[User],
        organization: Organization,
        payout_account_id: uuid.UUID,
    ) -> Organization:
        payout_account = await payout_account_service.get(
            session, auth_subject, payout_account_id
        )
        if payout_account is None:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "payout_account_id"),
                        "msg": "Payout account not found or not accessible.",
                        "input": str(payout_account_id),
                    }
                ]
            )

        organization_repository = OrganizationRepository.from_session(session)
        return await organization_repository.update(
            organization,
            update_dict={"payout_account_id": payout_account.id},
            flush=True,
        )

    async def add_user(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        *,
        polar_self_member_delay: int | None = None,
        enqueue_polar_self_member: bool = True,
    ) -> None:
        nested = await session.begin_nested()
        try:
            relation = UserOrganization(
                user_id=user.id, organization_id=organization.id
            )
            session.add(relation)
            await session.flush()
            log.info(
                "organization.add_user.created",
                user_id=user.id,
                organization_id=organization.id,
            )
        except IntegrityError:
            # TODO: Currently, we treat this as success since the connection
            # exists. However, once we use status to distinguish active/inactive
            # installations we need to change this.
            log.info(
                "organization.add_user.already_exists",
                organization_id=organization.id,
                user_id=user.id,
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
                )
            )
            await session.execute(stmt)
            await session.flush()
        finally:
            await loops_service.user_organization_added(session, user)
            if enqueue_polar_self_member:
                polar_self_service.enqueue_add_member(
                    external_customer_id=str(organization.id),
                    email=user.email,
                    name=user.public_name,
                    external_id=str(user.id),
                    delay=polar_self_member_delay,
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

        # If snoozed and grace period has passed, a sale triggers re-review
        if (
            organization.status == OrganizationStatus.SNOOZED
            and organization.status_updated_at is not None
            and datetime.now(UTC) - organization.status_updated_at
            >= SNOOZE_GRACE_PERIOD
        ):
            organization.set_status(OrganizationStatus.REVIEW)
            session.add(organization)
            enqueue_job("organization.under_review", organization_id=organization.id)
            return organization

        if organization.is_under_review:
            return organization

        if (
            organization.next_review_threshold >= 0
            and transfers_sum >= organization.next_review_threshold
        ):
            organization.set_status(OrganizationStatus.REVIEW)
            session.add(organization)

            enqueue_job("organization.under_review", organization_id=organization.id)

        return organization

    async def block_organization(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> Organization:
        """Block an organization by setting status to BLOCKED."""
        organization.set_status(OrganizationStatus.BLOCKED)
        session.add(organization)
        return organization

    async def confirm_organization_reviewed(
        self,
        session: AsyncSession,
        organization: Organization,
        next_review_threshold: int | None = None,
        *,
        silent: bool = False,
    ) -> Organization:
        if next_review_threshold is None:
            next_review_threshold = max(
                organization.next_review_threshold * 2, _MIN_REVIEW_THRESHOLD
            )

        organization.status = OrganizationStatus.ACTIVE
        organization.status_updated_at = datetime.now(UTC)
        organization.next_review_threshold = next_review_threshold

        initial_review = False
        if organization.initially_reviewed_at is None:
            organization.initially_reviewed_at = datetime.now(UTC)
            initial_review = True

        session.add(organization)

        # If there's an appeal, mark it as approved (handles both pending and previously rejected appeals)
        review_repository = OrganizationReviewRepository.from_session(session)
        review = await review_repository.get_by_organization(organization.id)
        if (
            review
            and review.appeal_submitted_at
            and review.appeal_decision != OrganizationReview.AppealDecision.APPROVED
        ):
            review.appeal_decision = OrganizationReview.AppealDecision.APPROVED
            review.appeal_reviewed_at = datetime.now(UTC)
            session.add(review)

        enqueue_job(
            "organization.reviewed",
            organization_id=organization.id,
            initial_review=initial_review,
            silent=silent,
        )
        return organization

    async def handle_ongoing_review_verdict(
        self,
        session: AsyncSession,
        organization: Organization,
        verdict: ReviewVerdict,
    ) -> bool:
        """Handle AI agent verdict for an ongoing threshold review.

        Returns True if auto-approved, False if the org must be handled by a
        human operator in the backoffice.
        Only auto-approves when: verdict is APPROVE and org has been initially reviewed.
        """
        is_eligible = (
            organization.status == OrganizationStatus.REVIEW
            and organization.initially_reviewed_at is not None
            and verdict == ReviewVerdict.APPROVE
        )

        if is_eligible:
            await self.confirm_organization_reviewed(session, organization)
            return True

        return False

    async def deny_organization(
        self, session: AsyncSession, organization: Organization
    ) -> Organization:
        organization.status = OrganizationStatus.DENIED
        organization.status_updated_at = datetime.now(UTC)
        session.add(organization)

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
        reason: str | None = None,
    ) -> Organization:
        """Snooze an organization under review.

        The org stays snoozed until a sale occurs 24h+ after being snoozed,
        which triggers a transition back to REVIEW via check_review_threshold().
        """
        if organization.status != OrganizationStatus.REVIEW:
            raise OrganizationError(
                "Only organizations under review can be snoozed.", 403
            )

        organization.set_status(OrganizationStatus.SNOOZED)
        organization.snooze_count += 1
        _append_internal_note(
            organization,
            f"Organization snoozed (#{organization.snooze_count}).",
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

        organization.set_status(OrganizationStatus.REVIEW)
        session.add(organization)
        enqueue_job("organization.under_review", organization_id=organization.id)
        return organization

    async def set_organization_under_review(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        enqueue_review: bool = True,
    ) -> Organization:
        organization.status = OrganizationStatus.REVIEW
        organization.status_updated_at = datetime.now(UTC)
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
        if organization.status not in OrganizationStatus.review_statuses():
            raise OrganizationError(
                "Only organizations under review can be set to offboarding.",
                403,
            )
        organization.status = OrganizationStatus.OFFBOARDING
        organization.status_updated_at = datetime.now(UTC)
        _append_internal_note(
            organization, "Organization set to offboarding.", reason=reason
        )
        session.add(organization)
        return organization

    async def reactivate_organization(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> Organization:
        if organization.status != OrganizationStatus.OFFBOARDING:
            raise OrganizationError(
                "Only offboarding organizations can be reactivated.", 403
            )
        organization.status = OrganizationStatus.ACTIVE
        organization.status_updated_at = datetime.now(UTC)
        session.add(organization)
        return organization

    async def get_payment_status(
        self,
        session: AsyncReadSession,
        organization: Organization,
    ) -> PaymentStatusResponse:
        """Get payment status and onboarding steps for an organization."""
        return PaymentStatusResponse(
            payment_ready=await self.is_organization_ready_for_payment(
                session, organization
            ),
            organization_status=organization.status,
        )

    async def is_organization_ready_for_payment(
        self, session: AsyncReadSession, organization: Organization
    ) -> bool:
        """
        Check if an organization is ready to accept payments.
        This method loads the account and admin data as needed, avoiding the need
        for eager loading in other services like checkout.
        """
        # In sandbox environment, always allow payments regardless of account setup
        if settings.ENV == Environment.sandbox:
            return True

        # First check basic conditions that don't require account data
        if organization.status in {
            OrganizationStatus.BLOCKED,
            OrganizationStatus.DENIED,
        }:
            return False

        # Check grandfathering - if grandfathered, they're ready
        cutoff_date = datetime(2025, 8, 4, 9, 0, tzinfo=UTC)
        if organization.created_at <= cutoff_date:
            return True

        # For new organizations, check basic conditions first
        if organization.status not in OrganizationStatus.payment_ready_statuses():
            return False

        # Details must be submitted (check for empty dict as well)
        if not organization.details_submitted_at or not organization.details:
            return False

        # Must have an active payout account
        if organization.payout_account_id is None:
            return False

        payout_account_repository = PayoutAccountRepository.from_session(session)
        payout_account = await payout_account_repository.get_by_id(
            organization.payout_account_id, options=(joinedload(PayoutAccount.admin),)
        )
        if not payout_account:
            return False

        # Check admin identity verification status
        admin = payout_account.admin
        if not admin or admin.identity_verification_status not in [
            IdentityVerificationStatus.verified,
            IdentityVerificationStatus.pending,
        ]:
            return False

        return True

    async def get_ai_review(
        self, session: AsyncSession, organization: Organization
    ) -> OrganizationReview | None:
        """Get the existing AI review for an organization, if any.

        The actual AI review is now triggered asynchronously via a background
        task when organization details are first submitted (see update()).
        """
        repository = OrganizationReviewRepository.from_session(session)
        return await repository.get_by_organization(organization.id)

    async def submit_appeal(
        self, session: AsyncSession, organization: Organization, appeal_reason: str
    ) -> OrganizationReview:
        """Submit an appeal for organization review and create a Plain ticket."""

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

        await plain_service.create_appeal_review_thread(session, organization, review)

        return review

    async def approve_appeal(
        self, session: AsyncSession, organization: Organization
    ) -> OrganizationReview:
        """Approve an organization's appeal and restore payment access."""

        repository = OrganizationReviewRepository.from_session(session)
        review = await repository.get_by_organization(organization.id)

        if review is None:
            raise ValueError("Organization must have a review before approving appeal")

        if review.appeal_submitted_at is None:
            raise ValueError("No appeal has been submitted for this organization")

        if review.appeal_decision is not None:
            raise ValueError("Appeal has already been reviewed")

        organization.status = OrganizationStatus.ACTIVE
        organization.status_updated_at = datetime.now(UTC)
        review.appeal_decision = OrganizationReview.AppealDecision.APPROVED
        review.appeal_reviewed_at = datetime.now(UTC)

        session.add(organization)
        session.add(review)

        return review

    async def deny_appeal(
        self, session: AsyncSession, organization: Organization
    ) -> OrganizationReview:
        """Deny an organization's appeal and keep payment access blocked."""

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


organization = OrganizationService()
