import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

import structlog
from pydantic import BaseModel, Field
from sqlalchemy import update as sqlalchemy_update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

from polar.account.repository import AccountRepository
from polar.account.service import account as account_service
from polar.auth.models import AuthSubject
from polar.checkout_link.repository import CheckoutLinkRepository
from polar.config import Environment, settings
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.integrations.loops.service import loops as loops_service
from polar.integrations.plain.service import plain as plain_service
from polar.kit.anonymization import anonymize_email_for_deletion, anonymize_for_deletion
from polar.kit.pagination import PaginationParams
from polar.kit.repository import Options
from polar.kit.sorting import Sorting
from polar.models import Account, Organization, User, UserOrganization
from polar.models.organization_review import OrganizationReview
from polar.models.transaction import TransactionType
from polar.models.user import IdentityVerificationStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.organization.ai_validation import validator as organization_validator
from polar.organization_access_token.repository import OrganizationAccessTokenRepository
from polar.postgres import AsyncReadSession, AsyncSession, sql
from polar.posthog import posthog
from polar.product.repository import ProductRepository
from polar.transaction.service.transaction import transaction as transaction_service
from polar.webhook.service import webhook as webhook_service
from polar.worker import enqueue_job

from .repository import OrganizationRepository, OrganizationReviewRepository
from .schemas import (
    OrganizationCreate,
    OrganizationUpdate,
)
from .sorting import OrganizationSortProperty

log = structlog.get_logger()


class PaymentStepID(StrEnum):
    """Enum for payment onboarding step identifiers."""

    CREATE_PRODUCT = "create_product"
    INTEGRATE_CHECKOUT = "integrate_checkout"
    SETUP_ACCOUNT = "setup_account"


class PaymentStep(BaseModel):
    """Service-level model for payment onboarding steps."""

    id: str = Field(description="Step identifier")
    title: str = Field(description="Step title")
    description: str = Field(description="Step description")
    completed: bool = Field(description="Whether the step is completed")


class PaymentStatusResponse(BaseModel):
    """Service-level response for payment status."""

    payment_ready: bool = Field(
        description="Whether the organization is ready to accept payments"
    )
    steps: list[PaymentStep] = Field(description="List of onboarding steps")
    organization_status: Organization.Status = Field(
        description="Current organization status"
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
            .where(Organization.blocked_at.is_(None))
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
        existing_slug = await repository.get_by_slug(create_schema.slug)
        if existing_slug is not None:
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

        organization = await repository.create(
            Organization(
                **create_schema.model_dump(exclude_unset=True, exclude_none=True),
                customer_invoice_prefix=create_schema.slug.upper(),
            )
        )
        await self.add_user(session, organization, auth_subject.subject)

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
            organization.feature_settings = {
                **organization.feature_settings,
                **update_schema.feature_settings.model_dump(
                    mode="json", exclude_unset=True, exclude_none=True
                ),
            }

        if update_schema.subscription_settings is not None:
            organization.subscription_settings = update_schema.subscription_settings

        if update_schema.notification_settings is not None:
            organization.notification_settings = update_schema.notification_settings

        previous_details = organization.details
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
        if not previous_details and update_schema.details:
            organization.details = update_schema.details.model_dump()
            organization.details_submitted_at = datetime.now(UTC)

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

        if organization.avatar_url:
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

        return organization

    async def add_user(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
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

    async def set_account(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        account_id: UUID,
    ) -> Organization:
        if organization.account_id is not None:
            raise AccountAlreadySet(organization.slug)

        account = await account_service.get(session, auth_subject, account_id)
        if account is None:
            raise InvalidAccount(account_id)

        repository = OrganizationRepository.from_session(session)
        organization = await repository.update(
            organization, update_dict={"account": account}
        )

        enqueue_job("organization.account_set", organization.id)

        await self._after_update(session, organization)

        return organization

    async def get_next_invoice_number(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> str:
        invoice_number = f"{organization.customer_invoice_prefix}-{organization.customer_invoice_next_number:04d}"
        repository = OrganizationRepository.from_session(session)
        organization = await repository.update(
            organization,
            update_dict={
                "customer_invoice_next_number": organization.customer_invoice_next_number
                + 1
            },
        )
        return invoice_number

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
        if organization.is_under_review():
            return organization

        transfers_sum = await transaction_service.get_transactions_sum(
            session, organization.account_id, type=TransactionType.balance
        )
        if (
            organization.next_review_threshold >= 0
            and transfers_sum >= organization.next_review_threshold
        ):
            organization.status = Organization.Status.UNDER_REVIEW
            await self._sync_account_status(session, organization)
            session.add(organization)

            enqueue_job("organization.under_review", organization_id=organization.id)

        return organization

    async def confirm_organization_reviewed(
        self,
        session: AsyncSession,
        organization: Organization,
        next_review_threshold: int,
    ) -> Organization:
        organization.status = Organization.Status.ACTIVE
        organization.next_review_threshold = next_review_threshold
        await self._sync_account_status(session, organization)
        session.add(organization)

        # If there's a pending appeal, mark it as approved
        review_repository = OrganizationReviewRepository.from_session(session)
        review = await review_repository.get_by_organization(organization.id)
        if review and review.appeal_submitted_at and review.appeal_decision is None:
            review.appeal_decision = OrganizationReview.AppealDecision.APPROVED
            review.appeal_reviewed_at = datetime.now(UTC)
            session.add(review)

        enqueue_job("organization.reviewed", organization_id=organization.id)
        return organization

    async def deny_organization(
        self, session: AsyncSession, organization: Organization
    ) -> Organization:
        organization.status = Organization.Status.DENIED
        await self._sync_account_status(session, organization)
        session.add(organization)

        # If there's a pending appeal, mark it as rejected
        review_repository = OrganizationReviewRepository.from_session(session)
        review = await review_repository.get_by_organization(organization.id)
        if review and review.appeal_submitted_at and review.appeal_decision is None:
            review.appeal_decision = OrganizationReview.AppealDecision.REJECTED
            review.appeal_reviewed_at = datetime.now(UTC)
            session.add(review)

        return organization

    async def set_organization_under_review(
        self, session: AsyncSession, organization: Organization
    ) -> Organization:
        organization.status = Organization.Status.UNDER_REVIEW
        await self._sync_account_status(session, organization)
        session.add(organization)
        enqueue_job("organization.under_review", organization_id=organization.id)
        return organization

    async def update_status_from_stripe_account(
        self, session: AsyncSession, account: Account
    ) -> None:
        """Update organization status based on Stripe account capabilities."""
        repository = OrganizationRepository.from_session(session)
        organizations = await repository.get_all_by_account(account.id)

        for organization in organizations:
            # Don't override organizations that are denied
            if organization.status == Organization.Status.DENIED:
                continue

            # If account is fully set up, set organization to ACTIVE
            if all(
                (
                    not organization.is_under_review(),
                    not organization.is_active(),
                    account.currency is not None,
                    account.is_details_submitted,
                    account.is_charges_enabled,
                    account.is_payouts_enabled,
                )
            ):
                organization.status = Organization.Status.ACTIVE

            # If Stripe disables some capabilities, reset to ONBOARDING_STARTED
            if any(
                (
                    not account.is_details_submitted,
                    not account.is_charges_enabled,
                    not account.is_payouts_enabled,
                )
            ):
                organization.status = Organization.Status.ONBOARDING_STARTED

            await self._sync_account_status(session, organization)
            session.add(organization)

    async def _sync_account_status(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        """Sync organization status to the related account."""
        if not organization.account_id:
            return

        # Map organization status to account status
        status_mapping = {
            Organization.Status.ONBOARDING_STARTED: Account.Status.ONBOARDING_STARTED,
            Organization.Status.ACTIVE: Account.Status.ACTIVE,
            Organization.Status.UNDER_REVIEW: Account.Status.UNDER_REVIEW,
            Organization.Status.DENIED: Account.Status.DENIED,
        }

        if organization.status in status_mapping:
            account_status = status_mapping[organization.status]
            await session.execute(
                sqlalchemy_update(Account)
                .where(Account.id == organization.account_id)
                .values(status=account_status)
            )

    async def get_payment_status(
        self,
        session: AsyncReadSession,
        organization: Organization,
        account_verification_only: bool = False,
    ) -> PaymentStatusResponse:
        """Get payment status and onboarding steps for an organization."""
        steps = []

        if not account_verification_only:
            # Step 1: Create a product
            product_repository = ProductRepository.from_session(session)
            product_count = await product_repository.count_by_organization_id(
                organization.id, is_archived=False
            )
            steps.append(
                PaymentStep(
                    id=PaymentStepID.CREATE_PRODUCT,
                    title="Create a product",
                    description="Create your first product to start accepting payments",
                    completed=product_count > 0,
                )
            )

            # Step 2: Integrate Checkout (API key OR checkout link)
            token_repository = OrganizationAccessTokenRepository.from_session(session)
            api_key_count = await token_repository.count_by_organization_id(
                organization.id
            )

            checkout_link_repository = CheckoutLinkRepository.from_session(session)
            checkout_link_count = (
                await checkout_link_repository.count_by_organization_id(organization.id)
            )

            # Step is completed if user has either an API key OR a checkout link
            integration_completed = api_key_count > 0 or checkout_link_count > 0
            steps.append(
                PaymentStep(
                    id=PaymentStepID.INTEGRATE_CHECKOUT,
                    title="Integrate Checkout",
                    description="Set up your integration to start accepting payments",
                    completed=integration_completed,
                )
            )

        # Step 3: Finish account setup
        account_setup_complete = self._is_account_setup_complete(organization)
        steps.append(
            PaymentStep(
                id=PaymentStepID.SETUP_ACCOUNT,
                title="Finish account setup",
                description="Complete your account details and verify your identity",
                completed=account_setup_complete,
            )
        )

        return PaymentStatusResponse(
            payment_ready=await self.is_organization_ready_for_payment(
                session, organization
            ),
            steps=steps,
            organization_status=organization.status,
        )

    def _is_account_setup_complete(self, organization: Organization) -> bool:
        """Check if the organization's account setup is complete."""
        if not organization.account_id:
            return False

        account = organization.account
        if not account:
            return False

        admin = account.admin
        return (
            organization.details_submitted_at is not None
            and account.is_details_submitted
            and (admin.identity_verification_status in ["verified", "pending"])
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
        if (
            organization.is_blocked()
            or organization.status == Organization.Status.DENIED
        ):
            return False

        # Check grandfathering - if grandfathered, they're ready
        cutoff_date = datetime(2025, 8, 4, 9, 0, tzinfo=UTC)
        if organization.created_at <= cutoff_date:
            return True

        # For new organizations, check basic conditions first
        if organization.status not in [
            Organization.Status.ACTIVE,
            Organization.Status.UNDER_REVIEW,
        ]:
            return False

        # Details must be submitted (check for empty dict as well)
        if not organization.details_submitted_at or not organization.details:
            return False

        # Must have an active payout account
        if organization.account_id is None:
            return False

        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_id(
            organization.account_id, options=(joinedload(Account.admin),)
        )
        if not account:
            return False

        # Check admin identity verification status
        admin = account.admin
        if not admin or admin.identity_verification_status not in [
            IdentityVerificationStatus.verified,
            IdentityVerificationStatus.pending,
        ]:
            return False

        return True

    async def validate_with_ai(
        self, session: AsyncSession, organization: Organization
    ) -> OrganizationReview:
        """Validate organization details using AI and store the result."""
        repository = OrganizationReviewRepository.from_session(session)
        previous_validation = await repository.get_by_organization(organization.id)

        if previous_validation is not None:
            return previous_validation

        result = await organization_validator.validate_organization_details(
            organization
        )

        ai_validation = OrganizationReview(
            organization_id=organization.id,
            verdict=result.verdict.verdict,
            risk_score=result.verdict.risk_score,
            violated_sections=result.verdict.violated_sections,
            reason=result.verdict.reason,
            timed_out=result.timed_out,
            organization_details_snapshot={
                "name": organization.name,
                "website": organization.website,
                "details": organization.details,
                "socials": organization.socials,
            },
            model_used=organization_validator.model.model_name,
        )

        if result.verdict.verdict in ["FAIL", "UNCERTAIN"]:
            await self.deny_organization(session, organization)

        session.add(ai_validation)
        await session.commit()

        return ai_validation

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

        try:
            await plain_service.create_appeal_review_thread(
                session, organization, review
            )
        except Exception as e:
            log.error(
                "Failed to create Plain ticket for appeal",
                organization_id=str(organization.id),
                error=str(e),
            )

        await session.commit()

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

        organization.status = Organization.Status.ACTIVE
        review.appeal_decision = OrganizationReview.AppealDecision.APPROVED
        review.appeal_reviewed_at = datetime.now(UTC)

        await self._sync_account_status(session, organization)

        session.add(organization)
        session.add(review)
        await session.commit()

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
        await session.commit()

        return review


organization = OrganizationService()
