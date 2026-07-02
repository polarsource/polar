from collections.abc import Sequence
from uuid import UUID

from fastapi import Depends, Query, Request, Response, status
from sqlalchemy.orm import joinedload

from polar.account.schemas import Account as AccountSchema
from polar.account.service import account as account_service
from polar.auth.permission import ROLE_PERMISSIONS
from polar.authz.dependencies import (
    AuthorizeFinanceRead,
    AuthorizeMembersManage,
    AuthorizeMembersRead,
    AuthorizeMembersSetRole,
    AuthorizeOrgAccess,
    AuthorizeOrgAccessUser,
    AuthorizeOrgManage,
    AuthorizeOrgManageRead,
    AuthorizeOrgManageUser,
)
from polar.config import settings
from polar.email.schemas import OrganizationInviteEmail, OrganizationInviteProps
from polar.email.sender import enqueue_email_template
from polar.exceptions import (
    NotPermitted,
    PolarRequestValidationError,
    ResourceNotFound,
)
from polar.integrations.polar.exceptions import (
    PolarSelfPaymentMethodInUse,
)
from polar.integrations.polar.schemas import (
    OrganizationBenefitGrant,
    OrganizationBenefitGrantUpdate,
    OrganizationBillingDetails,
    OrganizationBillingDetailsUpdate,
    OrganizationCheckoutRequest,
    OrganizationCheckoutResponse,
    OrganizationCustomerSession,
    OrganizationOrder,
    OrganizationOrderInvoice,
    OrganizationPaymentMethod,
    OrganizationPlan,
    OrganizationStartupProgramClaimRequest,
    OrganizationStartupProgramClaimResponse,
    OrganizationSubscription,
    OrganizationSubscriptionUpdate,
    organization_payment_method_from_sdk,
)
from polar.integrations.polar.service import polar_self as polar_self_service
from polar.kit.http import check_url_reachable, get_ip_address
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery
from polar.models import Account, Organization, UserOrganization
from polar.models.support_case import (
    SupportCase,
)
from polar.models.user_organization import OrganizationRole
from polar.openapi import APITag
from polar.organization.repository import (
    OrganizationReviewRepository,
)
from polar.organization_review.appeal_case import (
    AppealNotRejectedError,
    CaseAlreadyExistsError,
)
from polar.organization_review.appeal_case import (
    appeal_case as appeal_case_service,
)
from polar.payout_account.repository import PayoutAccountRepository
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.startup_program.service import (
    StartupProgramError,
)
from polar.startup_program.service import (
    startup_program as startup_program_service,
)
from polar.support_case.schemas import (
    HumanReviewRequest,
    SupportCaseNotFound,
)
from polar.support_case.schemas import (
    SupportCase as SupportCaseSchema,
)
from polar.user.service import user as user_service
from polar.user_organization.schemas import (
    OrganizationMember,
    OrganizationMemberInvite,
    OrganizationMemberRoleUpdate,
)
from polar.user_organization.service import (
    CannotRemoveOrganizationOwner,
    InvalidOwnerRoleAssignment,
    OwnerRoleCannotBeRemoved,
    UserNotMemberOfOrganization,
)
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from . import auth, sorting
from .schemas import Organization as OrganizationSchema
from .schemas import (
    OrganizationAppealRequest,
    OrganizationAppealResponse,
    OrganizationCreate,
    OrganizationDeletionResponse,
    OrganizationID,
    OrganizationKYC,
    OrganizationPaymentStatus,
    OrganizationPayoutAccountSet,
    OrganizationReviewState,
    OrganizationReviewStatus,
    OrganizationRoleDefinition,
    OrganizationSlugAvailability,
    OrganizationSlugCheck,
    OrganizationUpdate,
    OrganizationValidateWebsiteRequest,
    OrganizationValidateWebsiteResponse,
)
from .service import organization as organization_service

router = APIRouter(prefix="/organizations", tags=["organizations"])

OrganizationNotFound = {
    "description": "Organization not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/",
    summary="List Organizations",
    response_model=ListResource[OrganizationSchema],
    tags=[APITag.public],
    operation_id="organizations:list",
)
async def list_organizations(
    auth_subject: auth.OrganizationsRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    slug: str | None = Query(None, description="Filter by slug."),
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[OrganizationSchema]:
    """List organizations."""
    results, count = await organization_service.list(
        session,
        auth_subject,
        slug=slug,
        pagination=pagination,
        sorting=sorting,
    )

    return ListResource.from_paginated_results(
        [OrganizationSchema.model_validate(result) for result in results],
        count,
        pagination,
    )


@router.get(
    "/{id}",
    summary="Get Organization",
    response_model=OrganizationSchema,
    responses={404: OrganizationNotFound},
    tags=[APITag.public],
)
async def get(
    authz: AuthorizeOrgAccess,
) -> Organization:
    """Get an organization by ID."""
    return authz.organization


@router.get(
    "/{id}/account",
    response_model=AccountSchema,
    summary="Get Organization Account",
    responses={
        403: {
            "description": "User lacks `finance:read` permission.",
            "model": NotPermitted.schema(),
        },
        404: {
            "description": "Organization not found or account not set.",
            "model": ResourceNotFound.schema(),
        },
    },
    tags=[APITag.private],
)
async def get_account(
    authz: AuthorizeFinanceRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Account:
    """Get the account for an organization."""
    account = await account_service.get_by_organization(session, authz.organization.id)
    if account is None:
        raise ResourceNotFound()

    return account


@router.patch(
    "/{id}/payout-account",
    summary="Set Organization Payout Account",
    response_model=OrganizationSchema,
    responses={
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def set_payout_account(
    authz: AuthorizeOrgManageUser,
    body: OrganizationPayoutAccountSet,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Set the payout account for an organization."""
    # Resolve payout account and check admin ownership
    pa_repo = PayoutAccountRepository.from_session(session)
    payout_account = await pa_repo.get_by_id(body.payout_account_id)
    if (
        payout_account is None
        or payout_account.admin_id != authz.auth_subject.subject.id
    ):
        raise PolarRequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("body", "payout_account_id"),
                    "msg": "Payout account not found or not accessible.",
                    "input": str(body.payout_account_id),
                }
            ]
        )

    return await organization_service.set_payout_account(
        session, authz.organization, payout_account
    )


@router.get(
    "/{id}/kyc",
    summary="Get Organization KYC Details",
    response_model=OrganizationKYC,
    responses={404: OrganizationNotFound},
    tags=[APITag.private],
)
async def get_kyc(
    authz: AuthorizeOrgManageRead,
) -> Organization:
    """Get an organization's KYC/compliance details."""
    return authz.organization


@router.post(
    "/",
    response_model=OrganizationSchema,
    status_code=201,
    summary="Create Organization",
    responses={201: {"description": "Organization created."}},
    tags=[APITag.public],
)
async def create(
    organization_create: OrganizationCreate,
    auth_subject: auth.OrganizationsCreate,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Create an organization."""
    return await organization_service.create(session, organization_create, auth_subject)


@router.post(
    "/check-slug",
    response_model=OrganizationSlugAvailability,
    summary="Check Organization Slug Availability",
    tags=[APITag.private],
)
async def check_slug(
    body: OrganizationSlugCheck,
    auth_subject: auth.OrganizationsCreate,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationSlugAvailability:
    """Check whether a slug is valid and available for a new organization."""
    return await organization_service.check_slug_availability(session, body.slug)


@router.patch(
    "/{id}",
    response_model=OrganizationSchema,
    summary="Update Organization",
    responses={
        200: {"description": "Organization updated."},
        403: {
            "description": "You don't have the permission to update this organization.",
            "model": NotPermitted.schema(),
        },
        404: OrganizationNotFound,
    },
    tags=[APITag.public],
)
async def update(
    authz: AuthorizeOrgManage,
    organization_update: OrganizationUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Update an organization."""
    return await organization_service.update(
        session, authz.organization, organization_update
    )


@router.post(
    "/{id}/enable-preview-access",
    response_model=OrganizationSchema,
    summary="Enable Preview Access",
    responses={
        200: {"description": "Preview access enabled."},
        403: {
            "description": (
                "Preview access can only be enabled on the Sandbox environment."
            ),
            "model": NotPermitted.schema(),
        },
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def enable_preview_access(
    authz: AuthorizeOrgManage,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Enable preview access to in-preview features for an organization.

    On the Sandbox environment, organizations can opt into the features that
    are otherwise only available to paid plans in production.
    """
    if not settings.is_sandbox():
        raise NotPermitted(
            "Preview access can only be enabled on the Sandbox environment."
        )
    return await organization_service.enable_preview_access(session, authz.organization)


@router.post(
    "/{id}/submit-review",
    response_model=OrganizationSchema,
    summary="Submit Organization for Review",
    responses={
        200: {"description": "Organization submitted for review."},
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def submit_review(
    authz: AuthorizeOrgManage,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Submit an organization's saved details for review."""
    return await organization_service.submit_for_review(session, authz.organization)


@router.delete(
    "/{id}",
    response_model=OrganizationDeletionResponse,
    summary="Delete Organization",
    responses={
        200: {"description": "Organization deleted or deletion request submitted."},
        403: {
            "description": "You don't have the permission to delete this organization.",
            "model": NotPermitted.schema(),
        },
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def delete(
    authz: AuthorizeOrgManageUser,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationDeletionResponse:
    """Request deletion of an organization.

    If the organization has no orders or active subscriptions, it will be
    immediately soft-deleted. If it has an account, the Stripe account will
    be deleted first.

    If deletion cannot proceed immediately (has orders, subscriptions, or
    Stripe deletion fails), a support ticket will be created for manual handling.
    """
    result = await organization_service.request_deletion(
        session, authz.auth_subject, authz.organization
    )

    return OrganizationDeletionResponse(
        deleted=result.can_delete_immediately,
        requires_support=not result.can_delete_immediately,
        blocked_reasons=result.blocked_reasons,
    )


@router.get(
    "/{id}/payment-status",
    response_model=OrganizationPaymentStatus,
    tags=[APITag.private],
    summary="Get Organization Payment Status",
    responses={404: OrganizationNotFound},
)
async def get_payment_status(
    id: OrganizationID,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationPaymentStatus:
    """Get payment status and onboarding steps for an organization."""
    organization = await organization_service.get_anonymous(
        session,
        id,
        options=(joinedload(Organization.account),),
    )

    if organization is None:
        raise ResourceNotFound()

    payment_status = organization_service.get_payment_status(organization)

    return OrganizationPaymentStatus(
        payment_ready=payment_status.payment_ready,
        organization_status=payment_status.organization_status,
    )


@router.get(
    "/{id}/members",
    response_model=ListResource[OrganizationMember],
    tags=[APITag.private],
)
async def members(
    authz: AuthorizeMembersRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[OrganizationMember]:
    """List members in an organization."""
    organization = authz.organization
    members = await user_organization_service.list_by_org(session, organization.id)

    return ListResource(
        items=[OrganizationMember.model_validate(m) for m in members],
        pagination=Pagination(total_count=len(members), max_page=1),
    )


@router.get(
    "/{id}/roles",
    response_model=list[OrganizationRoleDefinition],
    responses={404: OrganizationNotFound},
    tags=[APITag.private],
)
async def roles(authz: AuthorizeOrgAccess) -> list[OrganizationRoleDefinition]:
    """List the roles available in an organization, with the permissions
    each role grants.

    The set is currently static (identical across organizations); the
    per-organization route shape leaves room for org-level role
    customization in the future.
    """
    return [
        OrganizationRoleDefinition(id=role, permissions=sorted(permissions))
        for role, permissions in ROLE_PERMISSIONS.items()
    ]


@router.post(
    "/{id}/members/invite",
    response_model=OrganizationMember,
    tags=[APITag.private],
)
async def invite_member(
    authz: AuthorizeMembersManage,
    invite_body: OrganizationMemberInvite,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationMember:
    """Invite a user to join an organization."""
    organization = authz.organization

    # Get or create user by email
    user, _ = await user_service.get_by_email_or_create(session, invite_body.email)

    # Check if user is already member of organization
    user_org = await user_organization_service.get_by_user_and_org(
        session, user.id, organization.id
    )
    if user_org is not None:
        response.status_code = status.HTTP_200_OK
        return OrganizationMember.model_validate(user_org)

    # Add user to organization
    await organization_service.add_user(session, organization, user)

    inviter_email = authz.auth_subject.subject.email

    # Send invitation email
    email = invite_body.email
    enqueue_email_template(
        OrganizationInviteEmail(
            props=OrganizationInviteProps(
                email=email,
                organization_name=organization.name,
                inviter_email=inviter_email or "",
                invite_url=settings.generate_frontend_url(
                    f"/dashboard/{organization.slug}"
                ),
            )
        ),
        to_email_addr=email,
        subject=f"You've been invited to {organization.name} on Polar",
    )

    # Get the user organization relationship to return
    user_org = await user_organization_service.get_by_user_and_org(
        session, user.id, organization.id
    )

    if user_org is None:
        raise ResourceNotFound()

    response.status_code = status.HTTP_201_CREATED
    return OrganizationMember.model_validate(user_org)


@router.delete(
    "/{id}/members/leave",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=[APITag.private],
    responses={
        204: {"description": "Successfully left the organization."},
        403: {
            "description": "Cannot leave organization (admin or only member).",
            "model": NotPermitted.schema(),
        },
        404: OrganizationNotFound,
    },
)
async def leave_organization(
    authz: AuthorizeOrgAccessUser,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Leave an organization.

    The organization owner cannot leave; ownership must be transferred first.
    """
    organization = authz.organization
    user = authz.auth_subject.subject

    user_org = await user_organization_service.get_by_user_and_org(
        session, user.id, organization.id
    )
    if user_org is None:
        raise ResourceNotFound()

    if user_org.role == OrganizationRole.owner:
        raise NotPermitted(
            "The organization owner cannot leave; transfer ownership first."
        )

    # Check if user is the only member
    member_count = await user_organization_service.get_member_count(
        session, organization.id
    )
    if member_count <= 1:
        raise NotPermitted("Cannot leave organization as the only member.")

    await user_organization_service.remove_member(
        session,
        user_id=user.id,
        organization_id=organization.id,
    )


@router.delete(
    "/{id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=[APITag.private],
    responses={
        204: {"description": "Member successfully removed."},
        403: {
            "description": "Not authorized to remove members.",
            "model": NotPermitted.schema(),
        },
        404: OrganizationNotFound,
    },
)
async def remove_member(
    authz: AuthorizeMembersManage,
    user_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Remove a member from an organization.

    Requires `members:manage` permission. Owners cannot be removed.
    """
    try:
        target_user_id = UUID(user_id)
    except ValueError:
        raise ResourceNotFound()

    try:
        await user_organization_service.remove_member_safe(
            session,
            user_id=target_user_id,
            organization_id=authz.organization.id,
        )
    except UserNotMemberOfOrganization:
        raise ResourceNotFound()
    except CannotRemoveOrganizationOwner:
        raise NotPermitted("Cannot remove the organization owner.")


@router.patch(
    "/{id}/members/{user_id}",
    response_model=OrganizationMember,
    summary="Set Member Role",
    tags=[APITag.private],
    responses={
        200: {"description": "Role updated."},
        403: {
            "description": "Not authorized to change member roles, or the role "
            "transition is not allowed.",
            "model": NotPermitted.schema(),
        },
        404: OrganizationNotFound,
    },
)
async def set_member_role(
    authz: AuthorizeMembersSetRole,
    user_id: UUID,
    body: OrganizationMemberRoleUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> UserOrganization:
    """Change a member's role on an organization.

    Only `admin` and `member` are accepted; ownership transfers go through
    a separate flow (today the backoffice `change_owner` endpoint, which
    calls `user_organization_service.transfer_ownership`).
    """
    try:
        return await user_organization_service.set_role(
            session,
            user_id=user_id,
            organization_id=authz.organization.id,
            role=body.role,
        )
    except UserNotMemberOfOrganization:
        raise ResourceNotFound()
    except OwnerRoleCannotBeRemoved:
        raise NotPermitted(
            "The organization owner cannot be moved to another role; "
            "transfer ownership first."
        )
    except InvalidOwnerRoleAssignment:
        # Should be unreachable given the schema rejects `owner`, but kept
        # as defence-in-depth in case the schema constraint is ever relaxed.
        raise NotPermitted("Cannot assign the owner role via this endpoint.")


@router.post(
    "/{id}/ai-validation",
    response_model=OrganizationReviewStatus,
    summary="Get AI Validation Status",
    responses={
        200: {"description": "AI validation status returned."},
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def validate_with_ai(
    authz: AuthorizeOrgManage,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationReviewStatus:
    """Get the AI validation status. Review runs asynchronously in the background."""
    review = await organization_service.get_ai_review(session, authz.organization)

    if review is None:
        # Review is pending (background task not yet complete)
        return OrganizationReviewStatus()

    case = await appeal_case_service.get_case(session, review)
    return OrganizationReviewStatus.from_review(review, case)


@router.post(
    "/{id}/appeal",
    response_model=OrganizationAppealResponse,
    summary="Submit Appeal for Organization Review",
    responses={
        200: {"description": "Appeal submitted successfully."},
        404: OrganizationNotFound,
        400: {"description": "Invalid appeal request."},
    },
    tags=[APITag.private],
)
async def submit_appeal(
    authz: AuthorizeOrgManage,
    appeal_request: OrganizationAppealRequest,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationAppealResponse:
    """Submit an appeal for organization review after AI validation failure."""
    try:
        result = await organization_service.submit_appeal(
            session, authz.organization, appeal_request.reason
        )

        return OrganizationAppealResponse(
            success=True,
            message="Appeal submitted successfully. Our team will review your case.",
            appeal_submitted_at=result.appeal_submitted_at,  # type: ignore[arg-type]
        )
    except ValueError as e:
        raise PolarRequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("body", "reason"),
                    "msg": e.args[0],
                    "input": appeal_request.reason,
                }
            ]
        )


@router.post(
    "/{id}/appeal/human-review",
    response_model=SupportCaseSchema,
    summary="Request Human Review",
    responses={
        200: {"description": "Human review case opened."},
        404: SupportCaseNotFound,
        409: {
            "description": (
                "The appeal has not been rejected, or a human-review case "
                "already exists for this review."
            ),
            "model": AppealNotRejectedError.schema() | CaseAlreadyExistsError.schema(),
        },
    },
    tags=[APITag.private],
)
async def request_human_review(
    authz: AuthorizeOrgManageUser,
    request: HumanReviewRequest,
    session: AsyncSession = Depends(get_db_session),
) -> SupportCase:
    """Open a human-review case after the AI appeal was denied."""
    review_repository = OrganizationReviewRepository.from_session(session)
    review = await review_repository.get_by_organization(authz.organization.id)
    if review is None:
        raise ResourceNotFound()

    return await appeal_case_service.request_human_review(
        session,
        review,
        organization=authz.organization,
        reason=request.reason,
        requested_by_user=authz.auth_subject.subject,
    )


@router.post(
    "/{id}/ai-onboarding-complete",
    response_model=OrganizationSchema,
    summary="Mark AI Onboarding Complete",
    responses={
        200: {"description": "AI onboarding marked as complete."},
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def mark_ai_onboarding_complete(
    authz: AuthorizeOrgManage,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Mark the AI onboarding as completed for this organization."""
    return await organization_service.mark_ai_onboarding_complete(
        session, authz.organization
    )


@router.get(
    "/{id}/review-status",
    response_model=OrganizationReviewStatus,
    summary="Get Organization Review Status",
    responses={
        200: {"description": "Organization review status retrieved."},
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def get_review_status(
    authz: AuthorizeOrgManageRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationReviewStatus:
    """Get the current review status and appeal information for an organization."""
    review_repository = OrganizationReviewRepository.from_session(session)
    review = await review_repository.get_by_organization(authz.organization.id)

    if review is None:
        return OrganizationReviewStatus()

    case = await appeal_case_service.get_case(session, review)
    return OrganizationReviewStatus.from_review(review, case)


@router.get(
    "/{id}/review",
    response_model=OrganizationReviewState,
    summary="Get Organization Self-Review Checklist",
    responses={
        200: {"description": "Organization self-review checklist returned."},
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def get_review(
    authz: AuthorizeOrgManageRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationReviewState:
    """Get the merchant self-review checklist state.

    Powers the account review UI: pre-submission gating checks plus,
    after submission, the AI verdict and appeal state.
    """
    return await organization_service.get_review_state(
        session, authz.organization, authz.auth_subject
    )


@router.post(
    "/{id}/validate-website",
    response_model=OrganizationValidateWebsiteResponse,
    summary="Validate Website URL",
    responses={
        200: {"description": "Website validation result."},
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def validate_website(
    authz: AuthorizeOrgManage,
    body: OrganizationValidateWebsiteRequest,
) -> OrganizationValidateWebsiteResponse:
    """Validate that a website URL is reachable and not targeting a private network."""
    result = await check_url_reachable(body.url)
    return OrganizationValidateWebsiteResponse(
        reachable=result.reachable,
        status=result.status,
        error=result.error,
    )


@router.get(
    "/{id}/plans",
    response_model=Sequence[OrganizationPlan],
    summary="List Available Plans",
    responses={404: OrganizationNotFound},
    tags=[APITag.private],
)
async def list_plans(
    authz: AuthorizeOrgManageRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Sequence[OrganizationPlan]:
    """List the plans this organization can subscribe to.

    The free plan is synthesized (no underlying Polar product); selecting it in
    the UI cancels the active subscription instead of creating one.
    """
    products = await polar_self_service.list_plans()
    subscription = await polar_self_service.get_subscription(authz.organization.id)
    free_plan = await polar_self_service.resolve_free_plan(
        session, authz.organization.id, subscription=subscription
    )
    return [free_plan, *(OrganizationPlan.from_sdk(product) for product in products)]


async def _enrich_subscription(
    subscription_obj: OrganizationSubscription,
    *,
    organization_id: UUID,
) -> OrganizationSubscription:
    """Annotate the subscription with Startup Program state when configured."""
    if settings.STARTUP_PROGRAM_ENABLED:
        subscription_obj.startup_program_scale_product_id = (
            settings.POLAR_SCALE_PRODUCT_ID
        )
        subscription_obj.startup_program_status = (
            await startup_program_service.get_status(organization_id)
        )
    return subscription_obj


@router.get(
    "/{id}/subscription",
    response_model=OrganizationSubscription,
    summary="Get Organization Subscription",
    responses={404: OrganizationNotFound},
    tags=[APITag.private],
)
async def get_subscription(
    authz: AuthorizeOrgManageRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationSubscription:
    """Get the current Polar subscription for this organization.

    Returns a synthesized free-plan representation when the organization has no
    active paid subscription. Grandfathered orgs get the "Early Member" variant.
    """
    subscription = await polar_self_service.get_subscription(authz.organization.id)
    if subscription is None:
        free_plan = await polar_self_service.resolve_free_plan(
            session, authz.organization.id, subscription=None
        )
        subscription_obj = OrganizationSubscription.free(plan=free_plan)
    else:
        subscription_obj = OrganizationSubscription.from_sdk(subscription)
    return await _enrich_subscription(
        subscription_obj,
        organization_id=authz.organization.id,
    )


@router.post(
    "/{id}/subscription",
    response_model=OrganizationCheckoutResponse,
    status_code=201,
    summary="Start Subscription Checkout",
    responses={
        201: {"description": "Checkout session created."},
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def start_subscription_checkout(
    request: Request,
    authz: AuthorizeOrgManage,
    body: OrganizationCheckoutRequest,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationCheckoutResponse:
    """Create a Polar checkout session for an initial paid subscription."""
    customer_ip_address = get_ip_address(request)
    checkout = await polar_self_service.start_checkout(
        session=session,
        organization_id=authz.organization.id,
        product_id=body.product_id,
        customer_ip_address=customer_ip_address,
        success_url=body.success_url,
        return_url=body.return_url,
        embed_origin=body.embed_origin,
    )
    return OrganizationCheckoutResponse.from_sdk(checkout)


@router.patch(
    "/{id}/subscription",
    response_model=OrganizationSubscription,
    summary="Change Organization Plan",
    responses={
        200: {"description": "Plan changed."},
        404: {
            "description": "Organization or subscription not found.",
            "model": ResourceNotFound.schema(),
        },
    },
    tags=[APITag.private],
)
async def change_subscription_plan(
    authz: AuthorizeOrgManage,
    body: OrganizationSubscriptionUpdate,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationSubscription:
    """Change the plan for an organization's existing subscription."""
    subscription = await polar_self_service.change_plan(
        session=session,
        organization_id=authz.organization.id,
        product_id=body.product_id,
    )
    return await _enrich_subscription(
        OrganizationSubscription.from_sdk(subscription),
        organization_id=authz.organization.id,
    )


@router.delete(
    "/{id}/subscription",
    response_model=OrganizationSubscription,
    summary="Cancel Organization Subscription",
    responses={
        200: {"description": "Subscription scheduled for cancellation."},
        404: {
            "description": "Organization or active subscription not found.",
            "model": ResourceNotFound.schema(),
        },
    },
    tags=[APITag.private],
)
async def cancel_subscription_endpoint(
    authz: AuthorizeOrgManage,
) -> OrganizationSubscription:
    """Cancel the organization's active subscription at the end of the current period.

    The organization stays on its paid plan until period end, then transitions
    to the synthesized free plan.
    """
    subscription = await polar_self_service.cancel_subscription(
        organization_id=authz.organization.id,
    )
    return await _enrich_subscription(
        OrganizationSubscription.from_sdk(subscription),
        organization_id=authz.organization.id,
    )


@router.post(
    "/{id}/startup-program/claim",
    response_model=OrganizationStartupProgramClaimResponse,
    summary="Claim Startup Program Discount",
    responses={404: OrganizationNotFound},
    tags=[APITag.private],
)
async def claim_startup_program(
    request: Request,
    authz: AuthorizeOrgManage,
    body: OrganizationStartupProgramClaimRequest,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationStartupProgramClaimResponse:
    """Claim the Startup Program discount on the Scale plan.

    Single entry point for the "Switch to Scale" callout regardless of
    current plan:

    - Free orgs receive a checkout to set up payment (discount attached).
    - Paid orgs get their subscription switched to Scale + discount applied
      directly via PATCH, no checkout needed.

    Caller passes ``success_url`` / ``return_url`` defensively; they're only
    used on the Free-plan branch.
    """
    customer_ip_address = get_ip_address(request)
    try:
        subscription, checkout = await polar_self_service.claim_startup_program(
            session=session,
            organization_id=authz.organization.id,
            customer_ip_address=customer_ip_address,
            success_url=body.success_url,
            return_url=body.return_url,
            embed_origin=body.embed_origin,
        )
    except StartupProgramError as e:
        raise PolarRequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("body",),
                    "msg": str(e),
                    "input": None,
                }
            ]
        ) from e

    response = OrganizationStartupProgramClaimResponse()
    if checkout is not None:
        response.checkout = OrganizationCheckoutResponse.from_sdk(checkout)
    if subscription is not None:
        response.subscription = await _enrich_subscription(
            OrganizationSubscription.from_sdk(subscription),
            organization_id=authz.organization.id,
        )
    return response


@router.get(
    "/{id}/orders",
    response_model=ListResource[OrganizationOrder],
    summary="List Organization Orders",
    responses={404: OrganizationNotFound},
    tags=[APITag.private],
)
async def list_orders(
    authz: AuthorizeOrgAccess,
    pagination: PaginationParamsQuery,
) -> ListResource[OrganizationOrder]:
    """List Polar orders billed to this organization."""
    items, total = await polar_self_service.list_orders(
        authz.organization.id,
        page=pagination.page,
        limit=pagination.limit,
    )
    return ListResource.from_paginated_results(
        [OrganizationOrder.from_sdk(order) for order in items],
        total,
        pagination,
    )


@router.get(
    "/{id}/billing-details",
    response_model=OrganizationBillingDetails,
    summary="Get Organization Billing Details",
    responses={404: OrganizationNotFound},
    tags=[APITag.private],
)
async def get_billing_details(
    authz: AuthorizeOrgManageUser,
) -> OrganizationBillingDetails:
    """Get the billing name, address, and tax ID used on Polar invoices."""
    customer = await polar_self_service.get_billing_details(
        authz.organization.id,
        external_member_id=str(authz.auth_subject.subject.id),
    )
    return OrganizationBillingDetails.from_sdk(customer)


@router.patch(
    "/{id}/billing-details",
    response_model=OrganizationBillingDetails,
    summary="Update Organization Billing Details",
    responses={404: OrganizationNotFound},
    tags=[APITag.private],
)
async def update_billing_details(
    authz: AuthorizeOrgManageUser,
    body: OrganizationBillingDetailsUpdate,
) -> OrganizationBillingDetails:
    """Update the billing name, address, and tax ID used on Polar invoices."""
    customer = await polar_self_service.update_billing_details(
        authz.organization.id,
        update=body,
        external_member_id=str(authz.auth_subject.subject.id),
    )
    return OrganizationBillingDetails.from_sdk(customer)


@router.get(
    "/{id}/payment-methods",
    response_model=ListResource[OrganizationPaymentMethod],
    summary="List Organization Payment Methods",
    responses={404: OrganizationNotFound},
    tags=[APITag.private],
)
async def list_payment_methods(
    authz: AuthorizeOrgManageUser,
) -> ListResource[OrganizationPaymentMethod]:
    """List the saved payment methods used to pay Polar invoices."""
    methods, default_payment_method_id = await polar_self_service.list_payment_methods(
        authz.organization.id,
        external_member_id=str(authz.auth_subject.subject.id),
    )
    items = [
        organization_payment_method_from_sdk(
            method, default_payment_method_id=default_payment_method_id
        )
        for method in methods
    ]
    return ListResource(
        items=items,
        pagination=Pagination(total_count=len(items), max_page=1 if items else 0),
    )


@router.post(
    "/{id}/customer-session",
    response_model=OrganizationCustomerSession,
    status_code=201,
    summary="Create Organization Customer Session",
    responses={404: OrganizationNotFound},
    tags=[APITag.private],
)
async def create_customer_session(
    authz: AuthorizeOrgManageUser,
) -> OrganizationCustomerSession:
    """Create a customer session token bound to this org's Polar billing
    customer. The returned token authenticates against
    `/v1/customer-portal/customers/me/*` for the duration of its TTL."""
    token = await polar_self_service.create_customer_session(
        authz.organization.id,
        external_member_id=str(authz.auth_subject.subject.id),
    )
    return OrganizationCustomerSession(token=token)


@router.delete(
    "/{id}/payment-methods/{payment_method_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Organization Payment Method",
    responses={
        204: {"description": "Payment method deleted."},
        400: {
            "description": "Payment method is in use by an active "
            "subscription and cannot be deleted.",
            "model": PolarSelfPaymentMethodInUse.schema(),
        },
        404: {
            "description": "Organization or payment method not found.",
            "model": ResourceNotFound.schema(),
        },
    },
    tags=[APITag.private],
)
async def delete_payment_method(
    authz: AuthorizeOrgManageUser,
    payment_method_id: str,
) -> None:
    """Delete a saved payment method used to pay Polar invoices."""
    await polar_self_service.delete_payment_method(
        authz.organization.id,
        payment_method_id=payment_method_id,
        external_member_id=str(authz.auth_subject.subject.id),
    )


@router.post(
    "/{id}/payment-methods/{payment_method_id}/default",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Set Default Organization Payment Method",
    responses={
        204: {"description": "Default payment method updated."},
        404: {
            "description": "Organization or payment method not found.",
            "model": ResourceNotFound.schema(),
        },
    },
    tags=[APITag.private],
)
async def set_default_payment_method(
    authz: AuthorizeOrgManageUser,
    payment_method_id: str,
) -> None:
    """Set the default payment method used to pay Polar invoices."""
    await polar_self_service.set_default_payment_method(
        authz.organization.id,
        payment_method_id=payment_method_id,
        external_member_id=str(authz.auth_subject.subject.id),
    )


@router.get(
    "/{id}/orders/{order_id}/invoice",
    response_model=OrganizationOrderInvoice,
    summary="Get Organization Order Invoice",
    responses={
        200: {"description": "Order invoice URL returned."},
        404: {
            "description": "Order or invoice not found.",
            "model": ResourceNotFound.schema(),
        },
    },
    tags=[APITag.private],
)
async def get_order_invoice(
    authz: AuthorizeOrgAccess,
    order_id: str,
) -> OrganizationOrderInvoice:
    """Get the invoice URL for a Polar order belonging to this organization."""
    url = await polar_self_service.get_order_invoice_url(
        authz.organization.id, order_id
    )
    return OrganizationOrderInvoice(url=url)


@router.get(
    "/{id}/benefit-grants",
    response_model=ListResource[OrganizationBenefitGrant],
    summary="List Organization Benefit Grants",
    responses={404: OrganizationNotFound},
    tags=[APITag.private],
)
async def list_benefit_grants(
    authz: AuthorizeOrgManageUser,
) -> ListResource[OrganizationBenefitGrant]:
    """List Slack shared channel benefit grants attached to this org's Polar
    subscription."""
    grants = await polar_self_service.list_benefit_grants(
        authz.organization.id,
        external_member_id=str(authz.auth_subject.subject.id),
    )
    items = [OrganizationBenefitGrant.from_sdk(grant) for grant in grants]
    return ListResource(
        items=items,
        pagination=Pagination(total_count=len(items), max_page=1 if items else 0),
    )


@router.patch(
    "/{id}/benefit-grants/{benefit_grant_id}",
    response_model=OrganizationBenefitGrant,
    summary="Update Organization Benefit Grant",
    responses={
        404: {
            "description": "Organization or benefit grant not found.",
            "model": ResourceNotFound.schema(),
        },
    },
    tags=[APITag.private],
)
async def update_benefit_grant(
    authz: AuthorizeOrgManageUser,
    benefit_grant_id: str,
    body: OrganizationBenefitGrantUpdate,
) -> OrganizationBenefitGrant:
    """Set the Slack admin email that should receive the Slack Connect invite
    for this benefit grant."""
    grant = await polar_self_service.update_benefit_grant(
        authz.organization.id,
        benefit_grant_id=benefit_grant_id,
        update=body,
        external_member_id=str(authz.auth_subject.subject.id),
    )
    return OrganizationBenefitGrant.from_sdk(grant)
