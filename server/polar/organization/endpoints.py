from typing import cast

from fastapi import Depends, Query, Response, status
from sqlalchemy.orm import joinedload

from polar.account.schemas import Account as AccountSchema
from polar.account.service import account as account_service
from polar.auth.models import is_anonymous, is_user
from polar.auth.scope import Scope
from polar.config import settings
from polar.email.react import render_email_template
from polar.email.sender import enqueue_email
from polar.exceptions import (
    NotPermitted,
    PolarRequestValidationError,
    ResourceNotFound,
    Unauthorized,
)
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery
from polar.models import Account, Organization
from polar.openapi import APITag
from polar.organization.repository import OrganizationReviewRepository
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
    user_organization as user_organization_service,
)

from . import auth, sorting
from .schemas import Organization as OrganizationSchema
from .schemas import (
    OrganizationAppealRequest,
    OrganizationAppealResponse,
    OrganizationCreate,
    OrganizationID,
    OrganizationPaymentStatus,
    OrganizationPaymentStep,
    OrganizationReviewStatus,
    OrganizationUpdate,
    OrganizationValidationResult,
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
    id: OrganizationID,
    auth_subject: auth.OrganizationsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Organization:
    """Get an organization by ID."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    return organization


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
    id: OrganizationID,
    organization_update: OrganizationUpdate,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Update an organization."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    return await organization_service.update(session, organization, organization_update)


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
    id: OrganizationID,
    auth_subject: auth.OrganizationsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> Account:
    """Get the account for an organization."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    if organization.account_id is None:
        raise ResourceNotFound()

    if is_user(auth_subject):
        user = auth_subject.subject
        if not await account_service.is_user_admin(
            session, organization.account_id, user
        ):
            raise NotPermitted("You are not the admin of this account")

    account = await account_service.get(session, auth_subject, organization.account_id)
    if account is None:
        raise ResourceNotFound()

    return account


@router.get(
    "/{id}/payment-status",
    response_model=OrganizationPaymentStatus,
    tags=[APITag.private],
    summary="Get Organization Payment Status",
    responses={404: OrganizationNotFound},
)
async def get_payment_status(
    id: OrganizationID,
    auth_subject: auth.OrganizationsReadOrAnonymous,
    session: AsyncReadSession = Depends(get_db_read_session),
    account_verification_only: bool = Query(
        False,
        description="Only perform account verification checks, skip product and integration checks",
    ),
) -> OrganizationPaymentStatus:
    """Get payment status and onboarding steps for an organization."""
    # Handle authentication based on account_verification_only flag
    if is_anonymous(auth_subject) and not account_verification_only:
        raise Unauthorized()
    elif is_anonymous(auth_subject):
        organization = await organization_service.get_anonymous(
            session,
            id,
            options=(joinedload(Organization.account).joinedload(Account.admin),),
        )
    else:
        # For authenticated users, check proper scopes (need at least one of these)
        required_scopes = {
            Scope.web_read,
            Scope.web_write,
            Scope.organizations_read,
            Scope.organizations_write,
        }
        if not (auth_subject.scopes & required_scopes):
            raise ResourceNotFound()
        organization = await organization_service.get(
            session,
            cast(auth.OrganizationsRead, auth_subject),
            id,
            options=(joinedload(Organization.account).joinedload(Account.admin),),
        )

    if organization is None:
        raise ResourceNotFound()

    payment_status = await organization_service.get_payment_status(
        session, organization, account_verification_only=account_verification_only
    )

    return OrganizationPaymentStatus(
        payment_ready=payment_status.payment_ready,
        steps=[
            OrganizationPaymentStep(**step.model_dump())
            for step in payment_status.steps
        ],
        organization_status=payment_status.organization_status,
    )


@router.get(
    "/{id}/members",
    response_model=ListResource[OrganizationMember],
    tags=[APITag.private],
)
async def members(
    id: OrganizationID,
    auth_subject: auth.OrganizationsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> ListResource[OrganizationMember]:
    """List members in an organization."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    members = await user_organization_service.list_by_org(session, id)

    return ListResource(
        items=[OrganizationMember.model_validate(m) for m in members],
        pagination=Pagination(total_count=len(members), max_page=1),
    )


@router.post(
    "/{id}/members/invite",
    response_model=OrganizationMember,
    tags=[APITag.private],
)
async def invite_member(
    id: OrganizationID,
    invite_body: OrganizationMemberInvite,
    auth_subject: auth.OrganizationsWrite,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationMember:
    """Invite a user to join an organization."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

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

    # Get the inviter's email (from auth subject)
    inviter_email = auth_subject.subject.email

    # Send invitation email
    body = render_email_template(
        "organization_invite",
        {
            "organization_name": organization.name,
            "inviter_email": inviter_email or "",
            "invite_url": settings.generate_frontend_url(
                f"/dashboard/{organization.slug}"
            ),
        },
    )

    enqueue_email(
        to_email_addr=invite_body.email,
        subject=f"You've been invited to {organization.name} on Polar",
        html_content=body,
    )

    # Get the user organization relationship to return
    user_org = await user_organization_service.get_by_user_and_org(
        session, user.id, organization.id
    )

    if user_org is None:
        raise ResourceNotFound()

    response.status_code = status.HTTP_201_CREATED
    return OrganizationMember.model_validate(user_org)


@router.post(
    "/{id}/ai-validation",
    response_model=OrganizationValidationResult,
    summary="Validate Organization Details with AI",
    responses={
        200: {"description": "Organization validated with AI."},
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def validate_with_ai(
    id: OrganizationID,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationValidationResult:
    """Validate organization details using AI compliance check."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    # Run AI validation and store results
    result = await organization_service.validate_with_ai(session, organization)

    return OrganizationValidationResult(
        verdict=result.verdict,  # type: ignore[arg-type]
        reason=result.reason,
        timed_out=result.timed_out,
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
    id: OrganizationID,
    appeal_request: OrganizationAppealRequest,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationAppealResponse:
    """Submit an appeal for organization review after AI validation failure."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    try:
        result = await organization_service.submit_appeal(
            session, organization, appeal_request.reason
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
    id: OrganizationID,
    auth_subject: auth.OrganizationsRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> OrganizationReviewStatus:
    """Get the current review status and appeal information for an organization."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    review_repository = OrganizationReviewRepository.from_session(session)
    review = await review_repository.get_by_organization(organization.id)

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
