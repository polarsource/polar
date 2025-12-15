"""
Organizations V2 - Redesigned backoffice interface with improved UX.

This module provides a modern, three-column layout with:
- Enhanced list view with status tabs and smart grouping
- Progressive disclosure in detail views
- Contextual actions based on organization status
- Keyboard shortcuts and accessibility improvements
"""

from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import UUID4, ValidationError
from pydantic_core import PydanticCustomError
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import joinedload
from tagflow import tag, text

from polar.account.service import account as account_service
from polar.auth.scope import Scope
from polar.auth.service import auth as auth_service
from polar.backoffice.organizations.analytics import (
    OrganizationSetupAnalyticsService,
    PaymentAnalyticsService,
)
from polar.backoffice.organizations.forms import (
    DeleteStripeAccountForm,
    DisconnectStripeAccountForm,
    UpdateOrganizationBasicForm,
    UpdateOrganizationDetailsForm,
    UpdateOrganizationInternalNotesForm,
    UpdateOrganizationSocialsForm,
)
from polar.enums import AccountType
from polar.models import Organization, User, UserOrganization
from polar.models.organization import OrganizationStatus
from polar.models.transaction import TransactionType
from polar.models.user import IdentityVerificationStatus
from polar.organization.repository import OrganizationRepository
from polar.organization.schemas import OrganizationFeatureSettings
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.transaction.service.transaction import transaction as transaction_service

from ..components import button, modal
from ..layout import layout
from ..responses import HXRedirectResponse
from .views.detail_view import OrganizationDetailView
from .views.list_view import OrganizationListView
from .views.modals import DeleteStripeModal, DisconnectStripeModal
from .views.sections.account_section import AccountSection
from .views.sections.files_section import FilesSection
from .views.sections.overview_section import OverviewSection
from .views.sections.settings_section import SettingsSection
from .views.sections.team_section import TeamSection

router = APIRouter(prefix="/organizations-v2", tags=["organizations-v2"])

logger = structlog.getLogger(__name__)


@router.get("/", name="organizations-v2:list")
async def list_organizations(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    status: str | None = Query(None),
    q: str | None = Query(None),
    sort: str = Query("priority"),
    direction: str = Query("asc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    # Advanced filters
    country: str | None = Query(""),
    risk_level: str | None = Query(""),
    days_in_status: str | None = Query(""),
    has_appeal: str | None = Query(""),
) -> None:
    """
    List organizations with enhanced filtering and smart grouping.

    Features:
    - Status-based tabs with counts
    - "Needs Attention" smart grouping
    - Search across name, slug, email
    - Advanced filters: country, risk, transfers, payments, appeals
    - Column sorting
    """
    from datetime import UTC, datetime, timedelta

    from polar.models import Account
    from polar.models.organization_review import OrganizationReview

    repository = OrganizationRepository(session)
    list_view = OrganizationListView(session)

    # Convert empty strings to None and parse numbers
    country = country if country else None
    risk_level = risk_level if risk_level else None
    has_appeal = has_appeal if has_appeal else None
    days_in_status_int = int(days_in_status) if days_in_status else None

    # Parse status filter
    status_filter: OrganizationStatus | None = None
    if status == "active":
        status_filter = OrganizationStatus.ACTIVE
    elif status == "denied":
        status_filter = OrganizationStatus.DENIED
    elif status == "initial_review":
        status_filter = OrganizationStatus.INITIAL_REVIEW
    elif status == "ongoing_review":
        status_filter = OrganizationStatus.ONGOING_REVIEW
    elif status == "created":
        status_filter = OrganizationStatus.CREATED
    elif status == "onboarding_started":
        status_filter = OrganizationStatus.ONBOARDING_STARTED

    # Build query
    stmt = select(Organization).options(
        joinedload(Organization.account),
        joinedload(Organization.review),
    )

    # Apply filters
    if status_filter:
        stmt = stmt.where(Organization.status == status_filter)
    else:
        # By default, exclude denied organizations
        stmt = stmt.where(Organization.status != OrganizationStatus.DENIED)

    if q:
        search_term = f"%{q}%"
        stmt = stmt.where(
            or_(
                Organization.name.ilike(search_term),
                Organization.slug.ilike(search_term),
                Organization.email.ilike(search_term),
            )
        )

    # Country filter
    if country:
        stmt = stmt.join(Organization.account).where(Account.country == country)

    # Risk level filter
    if risk_level:
        stmt = stmt.join(Organization.review)
        if risk_level == "high":
            stmt = stmt.where(OrganizationReview.risk_score >= 75)
        elif risk_level == "medium":
            stmt = stmt.where(
                OrganizationReview.risk_score >= 50, OrganizationReview.risk_score < 75
            )
        elif risk_level == "low":
            stmt = stmt.where(OrganizationReview.risk_score < 50)
        elif risk_level == "unscored":
            stmt = (
                select(Organization)
                .options(
                    joinedload(Organization.account),
                    joinedload(Organization.review),
                )
                .outerjoin(Organization.review)
                .where(OrganizationReview.id.is_(None))
            )

    # Days in status filter
    if days_in_status_int:
        threshold_date = datetime.now(UTC) - timedelta(days=days_in_status_int)
        # Organizations in status for more than X days:
        # - Either status_updated_at exists and is older than threshold
        # - Or status_updated_at is NULL (never changed) and created_at is older than threshold
        stmt = stmt.where(
            or_(
                Organization.status_updated_at <= threshold_date,
                and_(
                    Organization.status_updated_at.is_(None),
                    Organization.created_at <= threshold_date,
                ),
            )
        )

    # Appeal filter
    if has_appeal:
        stmt = stmt.join(Organization.review)
        if has_appeal == "pending":
            stmt = stmt.where(
                OrganizationReview.appeal_submitted_at.is_not(None),
                OrganizationReview.appeal_reviewed_at.is_(None),
            )
        elif has_appeal == "reviewed":
            stmt = stmt.where(OrganizationReview.appeal_reviewed_at.is_not(None))
        elif has_appeal == "none":
            stmt = stmt.where(OrganizationReview.appeal_submitted_at.is_(None))

    # Apply sorting
    is_desc = direction == "desc"

    if sort == "name":
        stmt = stmt.order_by(
            Organization.name.desc() if is_desc else Organization.name.asc()
        )
    elif sort == "country":
        country_order = (
            Account.country.desc().nullslast()
            if is_desc
            else Account.country.asc().nullslast()
        )
        stmt = stmt.join(Organization.account).order_by(country_order)
    elif sort == "created":
        stmt = stmt.order_by(
            Organization.created_at.asc() if is_desc else Organization.created_at.desc()
        )
    elif sort == "updated":
        stmt = stmt.order_by(
            Organization.modified_at.asc()
            if is_desc
            else Organization.modified_at.desc()
        )
    elif sort == "status_duration":
        status_order = (
            Organization.status_updated_at.desc().nullslast()
            if is_desc
            else Organization.status_updated_at.asc().nullsfirst()
        )
        stmt = stmt.order_by(status_order)
    elif sort == "risk":
        risk_order = (
            OrganizationReview.risk_score.asc().nullsfirst()
            if is_desc
            else OrganizationReview.risk_score.desc().nullslast()
        )
        stmt = stmt.join(Organization.review).order_by(risk_order)
    elif sort == "next_review":
        threshold_order = (
            Organization.next_review_threshold.asc().nullsfirst()
            if is_desc
            else Organization.next_review_threshold.desc().nullslast()
        )
        stmt = stmt.order_by(threshold_order)
    elif sort == "priority":
        # Priority: Under Review > Denied > Others, then by days in status
        stmt = stmt.order_by(
            Organization.status.desc(),
            Organization.status_updated_at.asc().nullsfirst(),
        )

    # Pagination
    offset = (page - 1) * limit
    stmt = stmt.offset(offset).limit(limit + 1)

    result = await session.execute(stmt)
    organizations = list(result.scalars().unique().all())

    # Check if there are more results
    has_more = len(organizations) > limit
    if has_more:
        organizations = organizations[:limit]

    # Get status counts for tabs
    status_counts = await list_view.get_status_counts()

    # Get distinct countries for filter dropdown
    countries = await list_view.get_distinct_countries()

    # Check if this is an HTMX request targeting just the table
    is_htmx_table_request = request.headers.get("HX-Target") == "org-list"

    if is_htmx_table_request:
        # Only return the table content
        with list_view.render_table_only(
            request,
            organizations,
            status_filter,
            status_counts,
            page,
            has_more,
            sort,
            direction,
        ):
            pass
    else:
        # Render full page with layout
        with layout(
            request,
            [("Organizations V2", str(request.url))],
            "organizations-v2:list",
        ):
            with list_view.render(
                request,
                organizations,
                status_filter,
                status_counts,
                page,
                has_more,
                sort,
                direction,
                countries,
                country,
            ):
                pass


@router.get("/{organization_id}", name="organizations-v2:detail")
async def get_organization_detail(
    request: Request,
    organization_id: UUID4,
    section: str = Query("overview"),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Organization detail view with three-column layout.

    Features:
    - Left sidebar: Section navigation
    - Main content: Current section details
    - Right sidebar: Contextual actions and metadata
    """
    repository = OrganizationRepository(session)

    # Fetch organization with relationships
    stmt = (
        select(Organization)
        .options(
            joinedload(Organization.account),
            joinedload(Organization.review),
        )
        .where(Organization.id == organization_id)
    )

    result = await session.execute(stmt)
    organization = result.scalars().unique().one_or_none()

    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Fetch members separately
    members_stmt = (
        select(UserOrganization)
        .options(joinedload(UserOrganization.user))
        .where(UserOrganization.organization_id == organization_id)
        .limit(10)
    )
    members_result = await session.execute(members_stmt)
    organization.members = list(members_result.scalars().unique().all())  # type: ignore[attr-defined]

    # Create views
    detail_view = OrganizationDetailView(organization)

    # Fetch analytics data for overview section
    setup_data = None
    payment_stats = None
    if section == "overview":
        setup_analytics = OrganizationSetupAnalyticsService(session)
        payment_analytics = PaymentAnalyticsService(session)

        # Get setup metrics
        checkout_links_count = await setup_analytics.get_checkout_links_count(
            organization_id
        )
        webhooks_count = await setup_analytics.get_webhooks_count(organization_id)
        api_keys_count = await setup_analytics.get_organization_tokens_count(
            organization_id
        )
        products_count = await setup_analytics.get_products_count(organization_id)
        benefits_count = await setup_analytics.get_benefits_count(organization_id)

        user_verified_result = await session.execute(
            select(User.identity_verification_status)
            .join(UserOrganization, User.id == UserOrganization.user_id)
            .where(UserOrganization.organization_id == organization_id)
            .limit(1)
        )
        user_verified_row = user_verified_result.first()
        user_verified = (
            user_verified_row[0] == IdentityVerificationStatus.verified
            if user_verified_row
            else False
        )

        (
            account_charges_enabled,
            account_payouts_enabled,
        ) = await setup_analytics.check_account_enabled(organization)
        payment_ready = await organization_service.is_organization_ready_for_payment(
            session, organization
        )

        setup_score = OrganizationSetupAnalyticsService.calculate_setup_score(
            checkout_links_count,
            webhooks_count,
            api_keys_count,
            products_count,
            benefits_count,
            user_verified,
            account_charges_enabled,
            account_payouts_enabled,
        )

        # Calculate total transfer sum (balance transactions)
        total_transfer_sum = 0
        if organization.account_id:
            total_transfer_sum = await transaction_service.get_transactions_sum(
                session, organization.account_id, type=TransactionType.balance
            )
        else:
            logger.warning(
                "Organization has no account_id for transaction sum",
                organization_id=str(organization.id),
                organization_slug=organization.slug,
            )

        setup_data = {
            "setup_score": setup_score,
            "checkout_links_count": checkout_links_count,
            "webhooks_count": webhooks_count,
            "api_keys_count": api_keys_count,
            "products_count": products_count,
            "benefits_count": benefits_count,
            "user_verified": user_verified,
            "account_charges_enabled": account_charges_enabled,
            "account_payouts_enabled": account_payouts_enabled,
            "payment_ready": payment_ready,
            "next_review_threshold": organization.next_review_threshold,
            "total_transfer_sum": total_transfer_sum,
        }

        # Get payment metrics
        (
            payment_count,
            total_amount,
            risk_scores,
        ) = await payment_analytics.get_succeeded_payments_stats(organization_id)
        refunds_count, refunds_amount = await payment_analytics.get_refund_stats(
            organization_id
        )

        p50_risk, p90_risk = PaymentAnalyticsService.calculate_risk_percentiles(
            risk_scores
        )
        refund_rate = (refunds_count / payment_count * 100) if payment_count > 0 else 0

        payment_stats = {
            "payment_count": payment_count,
            "total_amount": total_amount / 100,  # Convert cents to dollars
            "refunds_count": refunds_count,
            "refunds_amount": refunds_amount / 100,  # Convert cents to dollars
            "refund_rate": refund_rate,
            "p50_risk": p50_risk,
            "p90_risk": p90_risk,
            "next_review_threshold": organization.next_review_threshold,
            "total_transfer_sum": total_transfer_sum,
        }

    # Render based on section
    with layout(
        request,
        [
            ("Organizations V2", str(request.url_for("organizations-v2:list"))),
            (organization.name, str(request.url)),
        ],
        "organizations-v2:detail",
    ):
        with detail_view.render(request, section):
            # Render section content
            if section == "overview":
                overview = OverviewSection(organization)
                with overview.render(
                    request, setup_data=setup_data, payment_stats=payment_stats
                ):
                    pass
            elif section == "team":
                # Get admin user for the organization
                admin_user = await repository.get_admin_user(session, organization)
                team_section = TeamSection(organization, admin_user)
                with team_section.render(request):
                    pass
            elif section == "account":
                account_section = AccountSection(organization)
                with account_section.render(request):
                    pass
            elif section == "files":
                # TODO: Fetch files from repository
                files_section = FilesSection(organization, files=[])
                with files_section.render(request):
                    pass
            elif section == "history":
                # TODO: Implement history section
                with tag.div():
                    text("History section coming soon...")
            elif section == "settings":
                settings_section = SettingsSection(organization)
                with settings_section.render(request):
                    pass
            else:
                with tag.div():
                    text(f"Unknown section: {section}")


@router.post("/{organization_id}/approve", name="organizations-v2:approve")
async def approve_organization(
    request: Request,
    organization_id: UUID4,
    threshold: int | None = Query(None),
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse:
    """Approve an organization with optional threshold."""
    repository = OrganizationRepository(session)

    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Use provided threshold or default to $250 in cents (max as per requirement)
    next_review_threshold = threshold if threshold else 25000

    # Approve the organization
    await organization_service.confirm_organization_reviewed(
        session, organization, next_review_threshold
    )

    return HXRedirectResponse(
        request,
        str(
            request.url_for("organizations-v2:detail", organization_id=organization_id)
        ),
        303,
    )


@router.api_route(
    "/{organization_id}/deny-dialog",
    name="organizations-v2:deny_dialog",
    methods=["GET", "POST"],
    response_model=None,
)
async def deny_dialog(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Deny organization dialog and action."""
    repository = OrganizationRepository(session)

    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if request.method == "POST":
        # Deny the organization
        await organization_service.deny_organization(session, organization)

        return HXRedirectResponse(
            request,
            str(
                request.url_for(
                    "organizations-v2:detail", organization_id=organization_id
                )
            ),
            303,
        )

    with modal("Deny Organization", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p(classes="font-semibold text-error"):
                text("⚠️ Warning: Payments will be blocked")

            with tag.div(classes="bg-base-200 p-4 rounded-lg"):
                with tag.p(classes="mb-2"):
                    text(
                        "Denying this organization will prevent them from receiving payments. "
                        "This action can be reversed, but the organization will need to be reviewed again."
                    )

            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    variant="error",
                    hx_post=str(
                        request.url_for(
                            "organizations-v2:deny_dialog",
                            organization_id=organization_id,
                        )
                    ),
                ):
                    text("Deny Organization")

    return None


@router.api_route(
    "/{organization_id}/approve-denied-dialog",
    name="organizations-v2:approve_denied_dialog",
    methods=["GET", "POST"],
    response_model=None,
)
async def approve_denied_dialog(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Approve a denied organization dialog and action."""
    repository = OrganizationRepository(session)

    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if request.method == "POST":
        data = await request.form()
        # Convert dollars to cents (user enters 250, we store 25000)
        raw_threshold = data.get("threshold", "250")
        threshold = int(float(str(raw_threshold)) * 100)

        # Approve the organization
        await organization_service.confirm_organization_reviewed(
            session, organization, threshold
        )

        return HXRedirectResponse(
            request,
            str(
                request.url_for(
                    "organizations-v2:detail", organization_id=organization_id
                )
            ),
            303,
        )

    with modal("Approve Denied Organization", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p(classes="font-semibold"):
                text("Approve this previously denied organization")

            with tag.div(classes="bg-base-200 p-4 rounded-lg"):
                with tag.p(classes="mb-3"):
                    text(
                        "This will set the organization to ACTIVE status and allow them to receive payments. "
                        "Make sure you've reviewed the organization details and any appeal information."
                    )

                with tag.div(classes="form-control"):
                    with tag.label(classes="label"):
                        with tag.span(classes="label-text font-semibold"):
                            text("Next Review Threshold (in dollars)")
                    with tag.input(
                        type="number",
                        name="threshold",
                        value="250",
                        placeholder="250",
                        classes="input input-bordered",
                    ):
                        pass
                    with tag.label(classes="label"):
                        with tag.span(classes="label-text-alt"):
                            text("Amount in dollars that will trigger next review")

            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with tag.form(
                    hx_post=str(
                        request.url_for(
                            "organizations-v2:approve_denied_dialog",
                            organization_id=organization_id,
                        )
                    ),
                    hx_target="#modal",
                ):
                    with button(variant="primary"):
                        text("Approve Organization")

    return None


@router.api_route(
    "/{organization_id}/unblock-approve-dialog",
    name="organizations-v2:unblock_approve_dialog",
    methods=["GET", "POST"],
    response_model=None,
)
async def unblock_approve_dialog(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Unblock and approve organization dialog and action."""
    repository = OrganizationRepository(session)

    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if request.method == "POST":
        data = await request.form()
        # Convert dollars to cents (user enters 250, we store 25000)
        raw_threshold = data.get("threshold", "250")
        threshold = int(float(str(raw_threshold)) * 100)

        # Unblock the organization (set blocked_at to None)
        organization.blocked_at = None

        # Approve the organization
        await organization_service.confirm_organization_reviewed(
            session, organization, threshold
        )

        return HXRedirectResponse(
            request,
            str(
                request.url_for(
                    "organizations-v2:detail", organization_id=organization_id
                )
            ),
            303,
        )

    with modal("Unblock & Approve Organization", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p(classes="font-semibold"):
                text("Unblock and approve this organization")

            with tag.div(classes="bg-base-200 p-4 rounded-lg"):
                with tag.p(classes="mb-3"):
                    text(
                        "This will unblock the organization and set it to ACTIVE status. "
                        "The organization will be able to receive payments again."
                    )

                with tag.div(classes="form-control"):
                    with tag.label(classes="label"):
                        with tag.span(classes="label-text font-semibold"):
                            text("Next Review Threshold (in dollars)")
                    with tag.input(
                        type="number",
                        name="threshold",
                        value="250",
                        placeholder="250",
                        classes="input input-bordered",
                    ):
                        pass
                    with tag.label(classes="label"):
                        with tag.span(classes="label-text-alt"):
                            text("Amount in dollars that will trigger next review")

            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with tag.form(
                    hx_post=str(
                        request.url_for(
                            "organizations-v2:unblock_approve_dialog",
                            organization_id=organization_id,
                        )
                    ),
                    hx_target="#modal",
                ):
                    with button(variant="primary"):
                        text("Unblock & Approve")

    return None


@router.api_route(
    "/{organization_id}/block-dialog",
    name="organizations-v2:block_dialog",
    methods=["GET", "POST"],
    response_model=None,
)
async def block_dialog(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Block organization dialog and action."""
    repository = OrganizationRepository(session)

    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if request.method == "POST":
        # Block the organization (set blocked_at to current time)
        from datetime import UTC, datetime

        organization.blocked_at = datetime.now(UTC)

        return HXRedirectResponse(
            request,
            str(
                request.url_for(
                    "organizations-v2:detail", organization_id=organization_id
                )
            ),
            303,
        )

    with modal("Block Organization", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p(classes="font-semibold text-error"):
                text("⚠️ Critical Warning: Complete Organization Block")

            with tag.div(classes="bg-error/10 border border-error/20 p-4 rounded-lg"):
                with tag.p(classes="font-semibold mb-2 text-error"):
                    text("Blocking this organization will:")
                with tag.ul(classes="list-disc list-inside space-y-1 text-sm"):
                    with tag.li():
                        text("Prevent all access to the organization")
                    with tag.li():
                        text("Block all payments and transactions")
                    with tag.li():
                        text("Disable API access")
                    with tag.li():
                        text("Prevent any organization operations")

                with tag.p(classes="mt-3 text-sm font-semibold"):
                    text(
                        "This is a severe action typically used for fraud or ToS violations."
                    )

            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    variant="error",
                    hx_post=str(
                        request.url_for(
                            "organizations-v2:block_dialog",
                            organization_id=organization_id,
                        )
                    ),
                ):
                    text("Block Organization")

    return None


@router.api_route(
    "/{organization_id}/edit",
    name="organizations-v2:edit",
    methods=["GET", "POST"],
    response_model=None,
)
async def edit_organization(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Edit organization details."""
    repository = OrganizationRepository(session)

    # Fetch organization
    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    validation_error = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = UpdateOrganizationBasicForm.model_validate_form(data)
            if form.slug != organization.slug:
                existing_slug = await repository.get_by_slug(form.slug)
                if existing_slug is not None:
                    raise ValidationError.from_exception_data(
                        title="SlugAlreadyExists",
                        line_errors=[
                            {
                                "loc": ("slug",),
                                "type": PydanticCustomError(
                                    "SlugAlreadyExists",
                                    "An organization with this slug already exists.",
                                ),
                                "input": form.slug,
                            }
                        ],
                    )

            # Update organization with basic fields only
            form_dict = form.model_dump(exclude_none=True)
            organization = await repository.update(
                organization,
                update_dict=form_dict,
            )
            redirect_url = (
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=organization_id
                    )
                )
                + "?section=settings"
            )
            return HXRedirectResponse(request, redirect_url, 303)

        except ValidationError as e:
            validation_error = e

    # Prepare data for form rendering
    form_data = {
        "name": organization.name,
        "slug": organization.slug,
        "customer_invoice_prefix": organization.customer_invoice_prefix,
    }

    with modal("Edit Basic Settings", open=True):
        with tag.p(classes="text-sm text-base-content/60 mb-4"):
            text("Update organization name, slug, and customer invoice prefix")

        with UpdateOrganizationBasicForm.render(
            data=form_data,
            validation_error=validation_error,
            hx_post=str(
                request.url_for(
                    "organizations-v2:edit", organization_id=organization_id
                )
            ),
            hx_target="#modal",
            classes="space-y-4",
        ):
            # Action buttons
            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="submit",
                    variant="primary",
                ):
                    text("Save Changes")

    return None


@router.api_route(
    "/{organization_id}/edit-details",
    name="organizations-v2:edit_details",
    methods=["GET", "POST"],
    response_model=None,
)
async def edit_details(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Edit organization details (about, product description, intended use)."""
    repository = OrganizationRepository(session)

    # Fetch organization
    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    validation_error = None

    if request.method == "POST":
        try:
            data = await request.form()
            form = UpdateOrganizationDetailsForm.model_validate_form(data)

            # Update organization with form data
            form_dict = form.model_dump(exclude_none=True)
            organization = await repository.update(
                organization,
                update_dict=form_dict,
            )
            redirect_url = (
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=organization_id
                    )
                )
                + "?section=settings"
            )
            return HXRedirectResponse(request, redirect_url, 303)

        except ValidationError as e:
            validation_error = e

    # Prepare data for form rendering
    form_data = {
        "website": organization.website,
        "details": organization.details or {},
    }

    with modal("Edit Organization Details", open=True):
        with tag.p(classes="text-sm text-base-content/60 mb-4"):
            text(
                "Update organization details (about, product description, intended use)"
            )

        with UpdateOrganizationDetailsForm.render(
            data=form_data,
            validation_error=validation_error,
            hx_post=str(
                request.url_for(
                    "organizations-v2:edit_details", organization_id=organization_id
                )
            ),
            hx_target="#modal",
            classes="space-y-4",
        ):
            # Action buttons
            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="submit",
                    variant="primary",
                ):
                    text("Save Changes")

    return None


@router.api_route(
    "/{organization_id}/edit-order-settings",
    name="organizations-v2:edit_order_settings",
    methods=["GET", "POST"],
    response_model=None,
)
async def edit_order_settings(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Edit organization order settings."""
    repository = OrganizationRepository(session)

    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if request.method == "POST":
        data = await request.form()
        updated_order_settings = {
            **organization.order_settings,
            "invoice_numbering": data.get("invoice_numbering", "organization"),
        }
        await repository.update(
            organization, update_dict={"order_settings": updated_order_settings}
        )
        return HXRedirectResponse(
            request,
            str(
                request.url_for(
                    "organizations-v2:detail", organization_id=organization_id
                )
            )
            + "?section=settings",
            303,
        )

    current = organization.order_settings.get("invoice_numbering", "organization")

    with modal("Edit Order Settings", open=True):
        with tag.p(classes="text-sm text-base-content/60 mb-4"):
            text("Configure how invoice numbers are generated")

        with tag.form(
            hx_post=str(
                request.url_for(
                    "organizations-v2:edit_order_settings",
                    organization_id=organization_id,
                )
            ),
            hx_target="#modal",
            classes="space-y-4",
        ):
            with tag.div(classes="space-y-3"):
                for value, label, desc in [
                    (
                        "organization",
                        "Organization-wide",
                        "Sequential numbering across all customers",
                    ),
                    ("customer", "Per-customer", "Separate numbering per customer"),
                ]:
                    with tag.label(
                        classes="label cursor-pointer justify-start gap-3 p-3 border border-base-300 rounded-lg hover:bg-base-200"
                    ):
                        with tag.input(
                            type="radio",
                            name="invoice_numbering",
                            value=value,
                            classes="radio radio-sm",
                            **{"checked": ""} if current == value else {},
                        ):
                            pass
                        with tag.div():
                            with tag.div(classes="font-semibold text-sm"):
                                text(label)
                            with tag.div(classes="text-xs text-base-content/60"):
                                text(desc)

            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(type="submit", variant="primary"):
                    text("Save Changes")

    return None


@router.api_route(
    "/{organization_id}/edit-socials",
    name="organizations-v2:edit_socials",
    methods=["GET", "POST"],
    response_model=None,
)
async def edit_socials(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Edit organization social media links."""
    # Platform name constants for consistency
    PLATFORM_YOUTUBE = "youtube"
    PLATFORM_INSTAGRAM = "instagram"
    PLATFORM_LINKEDIN = "linkedin"
    PLATFORM_X = "x"
    PLATFORM_FACEBOOK = "facebook"
    PLATFORM_THREADS = "threads"
    PLATFORM_TIKTOK = "tiktok"
    PLATFORM_GITHUB = "github"
    PLATFORM_DISCORD = "discord"
    PLATFORM_OTHER = "other"

    repository = OrganizationRepository(session)

    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    validation_error = None

    if request.method == "POST":
        try:
            data = await request.form()
            form = UpdateOrganizationSocialsForm.model_validate_form(data)

            # Build socials list from form data
            socials: list[dict[str, str]] = []
            if form.youtube_url:
                socials.append(
                    {"platform": PLATFORM_YOUTUBE, "url": str(form.youtube_url)}
                )
            if form.instagram_url:
                socials.append(
                    {"platform": PLATFORM_INSTAGRAM, "url": str(form.instagram_url)}
                )
            if form.linkedin_url:
                socials.append(
                    {"platform": PLATFORM_LINKEDIN, "url": str(form.linkedin_url)}
                )
            if form.x_url:
                socials.append({"platform": PLATFORM_X, "url": str(form.x_url)})
            if form.facebook_url:
                socials.append(
                    {"platform": PLATFORM_FACEBOOK, "url": str(form.facebook_url)}
                )
            if form.threads_url:
                socials.append(
                    {"platform": PLATFORM_THREADS, "url": str(form.threads_url)}
                )
            if form.tiktok_url:
                socials.append(
                    {"platform": PLATFORM_TIKTOK, "url": str(form.tiktok_url)}
                )
            if form.github_url:
                socials.append(
                    {"platform": PLATFORM_GITHUB, "url": str(form.github_url)}
                )
            if form.discord_url:
                socials.append(
                    {"platform": PLATFORM_DISCORD, "url": str(form.discord_url)}
                )
            if form.other_url:
                socials.append({"platform": PLATFORM_OTHER, "url": str(form.other_url)})

            # Update organization with new socials
            organization = await repository.update(
                organization,
                update_dict={"socials": socials},
            )
            redirect_url = (
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=organization_id
                    )
                )
                + "?section=settings"
            )
            return HXRedirectResponse(request, redirect_url, 303)

        except ValidationError as e:
            validation_error = e

    # Prepare data for form rendering - extract URLs from existing socials
    existing_socials = organization.socials or []
    form_data: dict[str, str | None] = {
        "youtube_url": None,
        "instagram_url": None,
        "linkedin_url": None,
        "x_url": None,
        "facebook_url": None,
        "threads_url": None,
        "tiktok_url": None,
        "github_url": None,
        "discord_url": None,
        "other_url": None,
    }
    for social in existing_socials:
        platform = social.get("platform", "").lower()
        url = social.get("url", "")
        if platform == PLATFORM_YOUTUBE:
            form_data["youtube_url"] = url
        elif platform == PLATFORM_INSTAGRAM:
            form_data["instagram_url"] = url
        elif platform == PLATFORM_LINKEDIN:
            form_data["linkedin_url"] = url
        elif platform == PLATFORM_X:
            form_data["x_url"] = url
        elif platform == PLATFORM_FACEBOOK:
            form_data["facebook_url"] = url
        elif platform == PLATFORM_THREADS:
            form_data["threads_url"] = url
        elif platform == PLATFORM_TIKTOK:
            form_data["tiktok_url"] = url
        elif platform == PLATFORM_GITHUB:
            form_data["github_url"] = url
        elif platform == PLATFORM_DISCORD:
            form_data["discord_url"] = url
        elif platform == PLATFORM_OTHER:
            form_data["other_url"] = url

    with modal("Edit Social Media Links", open=True):
        with tag.p(classes="text-sm text-base-content/60 mb-4"):
            text("Update organization social media links for creator outreach")

        with UpdateOrganizationSocialsForm.render(
            data=form_data,
            validation_error=validation_error,
            hx_post=str(
                request.url_for(
                    "organizations-v2:edit_socials", organization_id=organization_id
                )
            ),
            hx_target="#modal",
            classes="space-y-4",
        ):
            # Action buttons
            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="submit",
                    variant="primary",
                ):
                    text("Save Changes")

    return None


@router.api_route(
    "/{organization_id}/edit-features",
    name="organizations-v2:edit_features",
    methods=["GET", "POST"],
    response_model=None,
)
async def edit_features(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Edit organization feature flags."""
    repository = OrganizationRepository(session)

    # Fetch organization
    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    validation_error = None

    if request.method == "POST":
        try:
            data = await request.form()

            # Parse feature flags from form data
            feature_flags = {}
            for field_name in OrganizationFeatureSettings.model_fields.keys():
                # Checkboxes that are unchecked won't be in form data
                feature_flags[field_name] = field_name in data

            # Merge with existing feature_settings
            updated_feature_settings = {
                **organization.feature_settings,
                **feature_flags,
            }

            # Update organization
            organization = await repository.update(
                organization,
                update_dict={"feature_settings": updated_feature_settings},
            )
            redirect_url = (
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=organization_id
                    )
                )
                + "?section=settings"
            )
            return HXRedirectResponse(request, redirect_url, 303)

        except ValidationError as e:
            validation_error = e

    # Render feature flags form
    with modal("Edit Feature Flags", open=True):
        with tag.p(classes="text-sm text-base-content/60 mb-4"):
            text("Enable or disable feature flags for this organization")

        with tag.form(
            hx_post=str(
                request.url_for(
                    "organizations-v2:edit_features", organization_id=organization_id
                )
            ),
            hx_target="#modal",
            classes="space-y-4",
        ):
            # Feature flags checkboxes
            with tag.div(classes="space-y-3"):
                for (
                    field_name,
                    field_info,
                ) in OrganizationFeatureSettings.model_fields.items():
                    enabled = organization.feature_settings.get(field_name, False)
                    label = field_name.replace("_", " ").title()

                    with tag.div(classes="form-control"):
                        with tag.label(
                            classes="label cursor-pointer justify-start gap-3"
                        ):
                            with tag.input(
                                type="checkbox",
                                name=field_name,
                                classes="checkbox checkbox-sm",
                                **{"checked": ""} if enabled else {},
                            ):
                                pass
                            with tag.span(classes="label-text"):
                                text(label)

            # Action buttons
            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="submit",
                    variant="primary",
                ):
                    text("Save Changes")

    return None


@router.api_route(
    "/{organization_id}/add-note",
    name="organizations-v2:add_note",
    methods=["GET", "POST"],
    response_model=None,
)
async def add_note(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Add internal notes to an organization."""
    repository = OrganizationRepository(session)

    # Fetch organization
    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    validation_error = None

    if request.method == "POST":
        try:
            data = await request.form()
            form = UpdateOrganizationInternalNotesForm.model_validate_form(data)
            organization = await repository.update(
                organization, update_dict=form.model_dump(exclude_none=True)
            )
            return HXRedirectResponse(
                request,
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=organization_id
                    )
                ),
                303,
            )

        except ValidationError as e:
            validation_error = e

    with modal("Add Internal Notes", open=True):
        with tag.p(classes="text-sm text-base-content/60 mb-4"):
            text("Add internal notes about this organization (admin only)")

        with UpdateOrganizationInternalNotesForm.render(
            data=organization,
            validation_error=validation_error,
            hx_post=str(
                request.url_for(
                    "organizations-v2:add_note", organization_id=organization_id
                )
            ),
            hx_target="#modal",
            classes="space-y-4",
        ):
            # Action buttons
            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="submit",
                    variant="primary",
                ):
                    text("Save Notes")

    return None


@router.api_route(
    "/{organization_id}/edit-note",
    name="organizations-v2:edit_note",
    methods=["GET", "POST"],
    response_model=None,
)
async def edit_note(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Edit internal notes for an organization."""
    repository = OrganizationRepository(session)

    # Fetch organization
    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    validation_error = None

    if request.method == "POST":
        try:
            data = await request.form()
            form = UpdateOrganizationInternalNotesForm.model_validate_form(data)
            organization = await repository.update(
                organization, update_dict=form.model_dump(exclude_none=True)
            )
            return HXRedirectResponse(
                request,
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=organization_id
                    )
                ),
                303,
            )

        except ValidationError as e:
            validation_error = e

    with modal("Edit Internal Notes", open=True):
        with tag.p(classes="text-sm text-base-content/60 mb-4"):
            text("Update internal notes about this organization (admin only)")

        with UpdateOrganizationInternalNotesForm.render(
            data=organization,
            validation_error=validation_error,
            hx_post=str(
                request.url_for(
                    "organizations-v2:edit_note", organization_id=organization_id
                )
            ),
            hx_target="#modal",
            classes="space-y-4",
        ):
            # Action buttons
            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    type="submit",
                    variant="primary",
                ):
                    text("Save Notes")

    return None


@router.get(
    "/{organization_id}/impersonate/{user_id}",
    name="organizations-v2:impersonate",
)
async def impersonate_user(
    request: Request,
    organization_id: UUID4,
    user_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse:
    """Impersonate a user by creating a read-only session for them."""
    from datetime import timedelta

    from polar.config import settings

    # Fetch the user to impersonate
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    user = result.scalars().one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify user belongs to organization
    membership_stmt = select(UserOrganization).where(
        UserOrganization.user_id == user_id,
        UserOrganization.organization_id == organization_id,
    )
    result = await session.execute(membership_stmt)
    if not result.scalars().one_or_none():
        raise HTTPException(
            status_code=400, detail="User is not a member of this organization"
        )

    # Create read-only impersonation session with time limit
    token, impersonation_session = await auth_service._create_user_session(
        session=session,
        user=user,
        user_agent=request.headers.get("User-Agent", ""),
        scopes=[Scope.web_read],  # Read-only
        expire_in=timedelta(minutes=60),  # Time-limited
    )

    # Get user's first organization for redirect
    repository = OrganizationRepository(session)
    user_orgs = await repository.get_all_by_user(user.id)
    redirect_url = f"/{user_orgs[0].slug}" if user_orgs else "/"

    response = HXRedirectResponse(request, redirect_url, 303)

    # Get current admin session token
    current_token = request.cookies.get(settings.USER_SESSION_COOKIE_KEY)

    # Preserve admin session in impersonation cookie
    if current_token:
        response.set_cookie(
            settings.IMPERSONATION_COOKIE_KEY,
            value=current_token,
            expires=impersonation_session.expires_at,
            path="/",
            domain=settings.USER_SESSION_COOKIE_DOMAIN,
            secure=request.url.hostname not in ["127.0.0.1", "localhost"],
            httponly=True,
            samesite="lax",
        )

    # Set impersonated session cookie
    response = auth_service._set_user_session_cookie(
        request, response, token, impersonation_session.expires_at
    )

    # Set impersonation indicator (JS-readable for UI)
    response.set_cookie(
        settings.IMPERSONATION_INDICATOR_COOKIE_KEY,
        value="true",
        expires=impersonation_session.expires_at,
        path="/",
        domain=settings.USER_SESSION_COOKIE_DOMAIN,
        secure=request.url.hostname not in ["127.0.0.1", "localhost"],
        httponly=False,  # JS-readable for UI banner
        samesite="lax",
    )

    return response


@router.post(
    "/{organization_id}/make-admin/{user_id}",
    name="organizations-v2:make_admin",
)
async def make_admin(
    request: Request,
    organization_id: UUID4,
    user_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse:
    """Make a user an admin of the organization."""
    repository = OrganizationRepository(session)

    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Change the admin user
    try:
        from polar.account.service import account as account_service

        if not organization.account:
            raise HTTPException(status_code=400, detail="Organization has no account")

        await account_service.change_admin(
            session, organization.account, user_id, organization_id
        )
    except Exception as e:
        logger.error("Failed to make user admin", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

    redirect_url = (
        str(request.url_for("organizations-v2:detail", organization_id=organization_id))
        + "?section=team"
    )
    return HXRedirectResponse(request, redirect_url, 303)


@router.delete(
    "/{organization_id}/remove-member/{user_id}",
    name="organizations-v2:remove_member",
)
async def remove_member(
    request: Request,
    organization_id: UUID4,
    user_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse:
    """Remove a member from the organization."""
    repository = OrganizationRepository(session)

    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Remove the user from the organization
    try:
        from polar.user_organization.service import (
            user_organization as user_organization_service,
        )

        await user_organization_service.remove_member(session, organization.id, user_id)
    except Exception as e:
        logger.error("Failed to remove member", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))

    redirect_url = (
        str(request.url_for("organizations-v2:detail", organization_id=organization_id))
        + "?section=team"
    )
    return HXRedirectResponse(request, redirect_url, 303)


@router.api_route(
    "/{organization_id}/delete-dialog",
    name="organizations-v2:delete_dialog",
    methods=["GET", "POST"],
    response_model=None,
)
async def delete_dialog(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Delete organization dialog and action."""
    repository = OrganizationRepository(session)

    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if request.method == "POST":
        await organization_service.delete(session, organization)

        return HXRedirectResponse(
            request,
            str(request.url_for("organizations-v2:list")),
            303,
        )

    with modal(f"Delete Organization {organization.name}", open=True):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.p(classes="font-semibold text-error"):
                text("Are you sure you want to delete this organization?")

            with tag.div(classes="bg-base-200 p-4 rounded-lg"):
                with tag.p(classes="font-semibold mb-2"):
                    text("Deleting this organization DOES NOT:")
                with tag.ul(classes="list-disc list-inside space-y-1 text-sm"):
                    with tag.li():
                        text("Delete or anonymize users")
                    with tag.li():
                        text("Delete or anonymize the account")
                    with tag.li():
                        text(
                            "Delete customers, products, discounts, benefits, or checkouts"
                        )
                    with tag.li():
                        text("Revoke granted benefits")
                    with tag.li():
                        text("Remove API tokens")

            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    variant="error",
                    hx_post=str(
                        request.url_for(
                            "organizations-v2:delete_dialog",
                            organization_id=organization_id,
                        )
                    ),
                ):
                    text("Delete Organization")

    return None


@router.api_route(
    "/{organization_id}/setup-account",
    name="organizations-v2:setup_account",
    methods=["GET", "POST"],
    response_model=None,
)
async def setup_account(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    """Show modal to setup a manual payment account."""
    repository = OrganizationRepository(session)

    organization = await repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if request.method == "POST":
        # TODO: Implement manual account creation
        # This would need to create an Account record and associate it with the organization
        raise HTTPException(
            status_code=501, detail="Manual account creation not yet implemented"
        )

        # Redirect back to account section
        redirect_url = (
            str(
                request.url_for(
                    "organizations-v2:detail", organization_id=organization_id
                )
            )
            + "?section=account"
        )
        return HXRedirectResponse(request, redirect_url, 303)

    # GET - Show modal
    with modal("Setup Manual Account", open=True):
        with tag.div(classes="space-y-4"):
            with tag.p(classes="text-sm text-base-content/60"):
                text("This will create a manual payment account for this organization.")

            with tag.div(classes="alert alert-warning"):
                with tag.span(classes="text-sm"):
                    text(
                        "Manual accounts require manual payout processing and do not integrate with Stripe."
                    )

            # Action buttons
            with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                with tag.form(method="dialog"):
                    with button(ghost=True):
                        text("Cancel")
                with button(
                    variant="primary",
                    hx_post=str(
                        request.url_for(
                            "organizations-v2:setup_account",
                            organization_id=organization_id,
                        )
                    ),
                ):
                    text("Create Manual Account")

    return None


@router.api_route(
    "/{organization_id}/disconnect-stripe-account",
    name="organizations-v2:disconnect_stripe_account",
    methods=["GET", "POST"],
    response_model=None,
)
async def disconnect_stripe_account(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    repository = OrganizationRepository(session)
    organization = await repository.get_by_id_with_account(organization_id)

    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not organization.account:
        raise HTTPException(status_code=400, detail="Organization has no account")

    if organization.account.account_type != AccountType.stripe:
        raise HTTPException(status_code=400, detail="Account is not a Stripe account")

    if not organization.account.stripe_id:
        raise HTTPException(status_code=400, detail="Account does not have a Stripe ID")

    account = organization.account
    validation_error = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = DisconnectStripeAccountForm.model_validate_form(data)

            if form.stripe_account_id != account.stripe_id:
                raise ValidationError.from_exception_data(
                    title="StripeAccountIdMismatch",
                    line_errors=[
                        {
                            "loc": ("stripe_account_id",),
                            "type": PydanticCustomError(
                                "StripeAccountIdMismatch",
                                "Stripe Account ID does not match.",
                            ),
                            "input": form.stripe_account_id,
                        }
                    ],
                )

            old_stripe_id = account.stripe_id
            archive_account = await account_service.disconnect_stripe(session, account)

            timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
            disconnect_note = (
                f"[{timestamp}] Stripe account disconnected.\n"
                f"Previous Stripe ID: {old_stripe_id}\n"
                f"Archive Account ID: {archive_account.id}\n"
                f"Reason: {form.reason.strip()}"
            )
            if organization.internal_notes:
                organization.internal_notes = (
                    f"{organization.internal_notes}\n\n{disconnect_note}"
                )
            else:
                organization.internal_notes = disconnect_note

            session.add(organization)

            is_ready = await organization_service.is_organization_ready_for_payment(
                session, organization
            )

            logger.info(
                "Stripe account disconnected from organization",
                organization_id=str(organization_id),
                old_stripe_id=old_stripe_id,
                archive_account_id=str(archive_account.id),
                payment_ready=is_ready,
            )

            redirect_url = (
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=organization_id
                    )
                )
                + "?section=account"
            )
            return HXRedirectResponse(request, redirect_url, 303)

        except ValidationError as e:
            validation_error = e

    form_action = str(
        request.url_for(
            "organizations-v2:disconnect_stripe_account",
            organization_id=organization_id,
        )
    )
    modal_view = DisconnectStripeModal(account, form_action, validation_error)
    with modal_view.render():
        pass

    return None


@router.api_route(
    "/{organization_id}/delete-stripe-account",
    name="organizations-v2:delete_stripe_account",
    methods=["GET", "POST"],
    response_model=None,
)
async def delete_stripe_account(
    request: Request,
    organization_id: UUID4,
    session: AsyncSession = Depends(get_db_session),
) -> HXRedirectResponse | None:
    repository = OrganizationRepository(session)
    organization = await repository.get_by_id_with_account(organization_id)

    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not organization.account:
        raise HTTPException(status_code=400, detail="Organization has no account")

    if organization.account.account_type != AccountType.stripe:
        raise HTTPException(status_code=400, detail="Account is not a Stripe account")

    if not organization.account.stripe_id:
        raise HTTPException(status_code=400, detail="Account does not have a Stripe ID")

    account = organization.account
    validation_error = None

    if request.method == "POST":
        data = await request.form()
        try:
            form = DeleteStripeAccountForm.model_validate_form(data)

            if form.stripe_account_id != account.stripe_id:
                raise ValidationError.from_exception_data(
                    title="StripeAccountIdMismatch",
                    line_errors=[
                        {
                            "loc": ("stripe_account_id",),
                            "type": PydanticCustomError(
                                "StripeAccountIdMismatch",
                                "Stripe Account ID does not match.",
                            ),
                            "input": form.stripe_account_id,
                        }
                    ],
                )

            old_stripe_id = account.stripe_id
            await account_service.delete_stripe_account(session, account)

            timestamp = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
            delete_note = (
                f"[{timestamp}] Stripe account deleted.\n"
                f"Deleted Stripe ID: {old_stripe_id}\n"
                f"Reason: {form.reason.strip()}"
            )
            if organization.internal_notes:
                organization.internal_notes = (
                    f"{organization.internal_notes}\n\n{delete_note}"
                )
            else:
                organization.internal_notes = delete_note

            session.add(organization)

            logger.info(
                "Stripe account deleted from organization",
                organization_id=str(organization_id),
                deleted_stripe_id=old_stripe_id,
            )

            redirect_url = (
                str(
                    request.url_for(
                        "organizations-v2:detail", organization_id=organization_id
                    )
                )
                + "?section=account"
            )
            return HXRedirectResponse(request, redirect_url, 303)

        except ValidationError as e:
            validation_error = e

    form_action = str(
        request.url_for(
            "organizations-v2:delete_stripe_account",
            organization_id=organization_id,
        )
    )
    modal_view = DeleteStripeModal(account, form_action, validation_error)
    with modal_view.render():
        pass

    return None


# TODO: Implement action endpoints
# - POST /{organization_id}/quick-approve
# - GET /{organization_id}/deny-dialog
# - GET /{organization_id}/plain-thread
# - etc.


__all__ = ["router"]
