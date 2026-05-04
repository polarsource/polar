from uuid import UUID

import httpx
from fastapi import Depends, Query, Response, status
from sqlalchemy.orm import joinedload

from polar.account.schemas import Account as AccountSchema
from polar.account.service import account as account_service
from polar.authz.dependencies import (
    AuthorizeFinanceRead,
    AuthorizeMembersManage,
    AuthorizeOrgAccess,
    AuthorizeOrgAccessUser,
    AuthorizeOrgAccessWrite,
    AuthorizeOrgDelete,
    AuthorizeOrgManagePayoutAccount,
)
from polar.authz.policies import payout_account as pa_policy
from polar.config import settings
from polar.email.schemas import OrganizationInviteEmail, OrganizationInviteProps
from polar.email.sender import enqueue_email_template
from polar.exceptions import (
    NotPermitted,
    PolarRequestValidationError,
    ResourceNotFound,
)
from polar.kit.http import (
    UnsafeCrawlableUrl,
    validate_crawlable_url,
)
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery
from polar.models import Account, Organization
from polar.openapi import APITag
from polar.organization.repository import (
    OrganizationRepository,
    OrganizationReviewRepository,
)
from polar.payout_account.repository import PayoutAccountRepository
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter
from polar.user.service import user as user_service
from polar.user_organization.schemas import OrganizationMember, OrganizationMemberInvite
from polar.user_organization.service import (
    CannotRemoveOrganizationAdmin,
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
)
async def list(
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
            "description": "User is not the admin of the account.",
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
    authz: AuthorizeOrgManagePayoutAccount,
    body: OrganizationPayoutAccountSet,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Set the payout account for an organization."""
    # Resolve payout account and check admin ownership
    pa_repo = PayoutAccountRepository.from_session(session)
    payout_account = await pa_repo.get_by_id(body.payout_account_id)
    if (
        payout_account is None
        or await pa_policy.can_write(authz.auth_subject, payout_account) is not True
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
    authz: AuthorizeOrgAccess,
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
    authz: AuthorizeOrgAccessWrite,
    organization_update: OrganizationUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Update an organization."""
    return await organization_service.update(
        session, authz.organization, organization_update
    )


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
    id: OrganizationID,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Submit an organization's saved details for review."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    return await organization_service.submit_for_review(session, organization)


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
    authz: AuthorizeOrgDelete,
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
        options=(joinedload(Organization.account).joinedload(Account.admin),),
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
    authz: AuthorizeOrgAccess,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[OrganizationMember]:
    """List members in an organization."""
    organization = authz.organization
    members = await user_organization_service.list_by_org(session, organization.id)

    # Get admin user to set is_admin flag
    org_repo = OrganizationRepository.from_session(session)
    admin_user = await org_repo.get_admin_user(organization)
    admin_user_id = admin_user.id if admin_user else None

    # Build response with is_admin flag
    member_items = []
    for m in members:
        member_data = OrganizationMember.model_validate(m)
        if admin_user_id and m.user_id == admin_user_id:
            member_data.is_admin = True
        member_items.append(member_data)

    return ListResource(
        items=member_items,
        pagination=Pagination(total_count=len(members), max_page=1),
    )


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

    Users can only leave an organization if they are not the admin
    and there is at least one other member.
    """
    organization = authz.organization
    user = authz.auth_subject.subject

    org_repo = OrganizationRepository.from_session(session)
    admin_user = await org_repo.get_admin_user(organization)

    if admin_user and admin_user.id == user.id:
        raise NotPermitted("Organization admins cannot leave the organization.")

    # Check if user is the only member
    member_count = await user_organization_service.get_member_count(
        session, organization.id
    )
    if member_count <= 1:
        raise NotPermitted("Cannot leave organization as the only member.")

    # Remove the user from the organization
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

    Only organization admins can remove members.
    Admins cannot remove themselves.
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
    except CannotRemoveOrganizationAdmin:
        raise NotPermitted("Cannot remove the organization admin.")


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
    authz: AuthorizeOrgAccessWrite,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationReviewStatus:
    """Get the AI validation status. Review runs asynchronously in the background."""
    review = await organization_service.get_ai_review(session, authz.organization)

    if review is None:
        # Review is pending (background task not yet complete)
        return OrganizationReviewStatus()

    return OrganizationReviewStatus(
        verdict=review.verdict,  # type: ignore[arg-type]
        reason=review.reason,
        appeal_submitted_at=review.appeal_submitted_at,
        appeal_reason=review.appeal_reason,
        appeal_decision=review.appeal_decision,
        appeal_reviewed_at=review.appeal_reviewed_at,
    )


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
    authz: AuthorizeOrgAccessWrite,
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
    authz: AuthorizeOrgAccessWrite,
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
    authz: AuthorizeOrgAccess,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationReviewStatus:
    """Get the current review status and appeal information for an organization."""
    review_repository = OrganizationReviewRepository.from_session(session)
    review = await review_repository.get_by_organization(authz.organization.id)

    if review is None:
        return OrganizationReviewStatus()

    return OrganizationReviewStatus(
        verdict=review.verdict,  # type: ignore[arg-type]
        reason=review.reason,
        appeal_submitted_at=review.appeal_submitted_at,
        appeal_reason=review.appeal_reason,
        appeal_decision=review.appeal_decision,
        appeal_reviewed_at=review.appeal_reviewed_at,
    )


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
    authz: AuthorizeOrgAccess,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationReviewState:
    """Get the merchant self-review checklist state.

    Powers the account review UI: pre-submission gating checks plus,
    after submission, the AI verdict and appeal state.
    """
    return await organization_service.get_review_state(session, authz.organization)


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
    authz: AuthorizeOrgAccessWrite,
    body: OrganizationValidateWebsiteRequest,
) -> OrganizationValidateWebsiteResponse:
    """Validate that a website URL is reachable and not targeting a private network."""
    try:
        validated_url = await validate_crawlable_url(body.url)
    except UnsafeCrawlableUrl as e:
        return OrganizationValidateWebsiteResponse(reachable=False, error=str(e))

    async def _check_redirect(response: httpx.Response) -> None:
        if response.is_redirect:
            location = response.headers.get("location", "")
            await validate_crawlable_url(location)

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=5.0,
            headers={"User-Agent": "Polar URL Validator/1.0"},
            event_hooks={"response": [_check_redirect]},
        ) as client:
            response = await client.head(str(validated_url))

        reachable = 200 <= response.status_code < 400
        return OrganizationValidateWebsiteResponse(
            reachable=reachable, status=response.status_code
        )
    except UnsafeCrawlableUrl as e:
        return OrganizationValidateWebsiteResponse(reachable=False, error=str(e))
    except httpx.TimeoutException:
        return OrganizationValidateWebsiteResponse(
            reachable=False, error="Request timed out"
        )
    except httpx.HTTPError:
        return OrganizationValidateWebsiteResponse(
            reachable=False, error="Unable to reach URL"
        )
