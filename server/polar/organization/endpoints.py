import datetime

from fastapi import Depends, Query, Response, status

from polar.account.schemas import Account as AccountSchema
from polar.account.service import account as account_service
from polar.config import settings
from polar.email.react import render_email_template
from polar.email.sender import enqueue_email
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery
from polar.models import Account, Organization
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.user.service import user as user_service
from polar.user_organization.schemas import OrganizationMember, OrganizationMemberInvite
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from . import auth, sorting
from .schemas import Organization as OrganizationSchema
from .schemas import (
    OrganizationCreate,
    OrganizationID,
    OrganizationSetAccount,
    OrganizationUpdate,
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
    tags=[APITag.documented, APITag.featured],
)
async def list(
    auth_subject: auth.OrganizationsRead,
    pagination: PaginationParamsQuery,
    sorting: sorting.ListSorting,
    slug: str | None = Query(None, description="Filter by slug."),
    session: AsyncSession = Depends(get_db_session),
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
    tags=[APITag.documented, APITag.featured],
)
async def get(
    id: OrganizationID,
    auth_subject: auth.OrganizationsRead,
    session: AsyncSession = Depends(get_db_session),
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
    tags=[APITag.documented, APITag.featured],
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
    tags=[APITag.documented, APITag.featured],
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
        404: {
            "description": "Organization not found or account not set.",
            "model": ResourceNotFound.schema(),
        },
    },
    tags=[APITag.private],
)
async def get_account(
    id: OrganizationID,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Account:
    """Get the account for an organization."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    if organization.account_id is None:
        raise ResourceNotFound()

    account = await account_service.get(session, auth_subject, organization.account_id)

    if account is None:
        raise ResourceNotFound()

    return account


@router.patch(
    "/{id}/account",
    response_model=OrganizationSchema,
    summary="Set Organization Account",
    responses={
        200: {"description": "Organization account set."},
        403: {
            "description": "You don't have the permission to update this organization.",
            "model": NotPermitted.schema(),
        },
        404: OrganizationNotFound,
    },
    tags=[APITag.private],
)
async def set_account(
    id: OrganizationID,
    set_account: OrganizationSetAccount,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Set the account for an organization."""
    organization = await organization_service.get(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    return await organization_service.set_account(
        session, auth_subject, organization, set_account.account_id
    )


@router.get(
    "/{id}/members",
    response_model=ListResource[OrganizationMember],
    tags=[APITag.private],
)
async def members(
    id: OrganizationID,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
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
            "current_year": datetime.datetime.now().year,
        },
    )

    enqueue_email(
        to_email_addr=invite_body.email,
        subject=f"You've added to {organization.name} on Polar",
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
