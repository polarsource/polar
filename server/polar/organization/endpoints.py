from uuid import UUID

import structlog
from fastapi import Depends, Query

from polar.account.schemas import Account as AccountSchema
from polar.account.service import account as account_service
from polar.authz.service import AccessType, Authz
from polar.exceptions import (
    InternalServerError,
    NotPermitted,
    ResourceNotFound,
    Unauthorized,
)
from polar.integrations.github.badge import GithubBadge
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery
from polar.models import Account, Organization
from polar.openapi import IN_DEVELOPMENT_ONLY, APITag
from polar.postgres import AsyncSession, get_db_session
from polar.repository.service import repository as repository_service
from polar.routing import APIRouter
from polar.user_organization.schemas import OrganizationMember
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from . import auth
from .schemas import (
    Organization as OrganizationSchema,
)
from .schemas import (
    OrganizationBadgeSettingsRead,
    OrganizationBadgeSettingsUpdate,
    OrganizationCustomer,
    OrganizationCustomerType,
    OrganizationID,
    OrganizationSetAccount,
    OrganizationStripePortalSession,
    OrganizationUpdate,
    RepositoryBadgeSettingsRead,
)
from .service import organization as organization_service

log = structlog.get_logger()

router = APIRouter(prefix="/organizations", tags=["organizations", APITag.documented])

OrganizationNotFound = {
    "description": "Organization not found.",
    "model": ResourceNotFound.schema(),
}


@router.get(
    "/", summary="List Organizations", response_model=ListResource[OrganizationSchema]
)
async def list(
    auth_subject: auth.AnonymousOrganizationsRead,
    pagination: PaginationParamsQuery,
    slug: str | None = Query(None, description="Filter by slug."),
    is_member: bool | None = Query(
        None,
        description=(
            "Filter by membership."
            "If `true`, only organizations the user is a member of are returned."
            "If `false`, only organizations the user is not a member of are returned."
        ),
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationSchema]:
    """List organizations."""
    results, count = await organization_service.list(
        session,
        auth_subject,
        slug=slug,
        is_member=is_member,
        pagination=pagination,
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
)
async def get(
    id: OrganizationID,
    auth_subject: auth.AnonymousOrganizationsRead,
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Get an organization by ID."""
    organization = await organization_service.get_by_id(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    return organization


@router.get(
    "/{id}/customers",
    summary="List Organization Customers",
    response_model=ListResource[OrganizationCustomer],
    responses={404: OrganizationNotFound},
)
async def list_organization_customers(
    id: OrganizationID,
    auth_subject: auth.AnonymousOrganizationsRead,
    pagination: PaginationParamsQuery,
    customer_types: set[OrganizationCustomerType] = Query(
        {
            OrganizationCustomerType.free_subscription,
            OrganizationCustomerType.paid_subscription,
            OrganizationCustomerType.order,
            OrganizationCustomerType.donation,
        },
        description="Filter by the type of purchase the customer made.",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationCustomer]:
    """List organization customers."""
    organization = await organization_service.get_by_id(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    results, count = await organization_service.list_customers(
        session, organization, customer_types=customer_types, pagination=pagination
    )

    return ListResource.from_paginated_results(
        [OrganizationCustomer.model_validate(result) for result in results],
        count,
        pagination,
    )


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
)
async def update(
    id: OrganizationID,
    organization_update: OrganizationUpdate,
    auth_subject: auth.OrganizationsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Update an organization."""
    organization = await organization_service.get_by_id(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, organization):
        raise NotPermitted()

    # validate featured organizations and featured projects
    # TODO: put this in the service method
    if organization_update.profile_settings is not None:
        if organization_update.profile_settings.featured_organizations is not None:
            for org_id in organization_update.profile_settings.featured_organizations:
                if not await organization_service.get(session, id=org_id):
                    raise ResourceNotFound()
        if organization_update.profile_settings.featured_projects is not None:
            for repo_id in organization_update.profile_settings.featured_projects:
                if not await repository_service.get(session, id=repo_id):
                    raise ResourceNotFound()

    return await organization_service.update(
        session, authz, organization, organization_update, auth_subject
    )


@router.get(
    "/{id}/account",
    response_model=AccountSchema,
    summary="Get Organization Account",
    responses={
        403: {
            "description": "You don't have the permission to update this organization.",
            "model": NotPermitted.schema(),
        },
        404: {
            "description": "Organization not found or account not set.",
            "model": ResourceNotFound.schema(),
        },
    },
)
async def get_account(
    id: OrganizationID,
    auth_subject: auth.OrganizationsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Account:
    """Get the account for an organization."""
    organization = await organization_service.get_by_id(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, organization):
        raise NotPermitted()

    if organization.account_id is None:
        raise ResourceNotFound()

    account = await account_service.get_by_id(session, organization.account_id)

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
)
async def set_account(
    id: OrganizationID,
    set_account: OrganizationSetAccount,
    auth_subject: auth.OrganizationsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    """Set the account for an organization."""
    organization = await organization_service.get_by_id(session, auth_subject, id)

    if organization is None:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, organization):
        raise NotPermitted()

    return await organization_service.set_account(
        session,
        authz=authz,
        auth_subject=auth_subject,
        organization=organization,
        account_id=set_account.account_id,
    )


@router.get(
    "/{id}/members",
    response_model=ListResource[OrganizationMember],
    description="List members of an organization. Requires authentication.",  # noqa: E501
    summary="List members in an organization",
    status_code=200,
)
async def list_members(
    auth_subject: auth.OrganizationsWrite,
    id: UUID | None = None,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[OrganizationMember]:
    if not id:
        raise ResourceNotFound()

    org = await organization_service.get(session, id)
    if not org:
        raise ResourceNotFound()

    # if user is member
    self_member = await user_organization_service.get_by_user_and_org(
        session, auth_subject.subject.id, id
    )
    if not self_member:
        raise Unauthorized()

    members = await user_organization_service.list_by_org(session, id)

    return ListResource(
        items=[OrganizationMember.from_db(m) for m in members],
        pagination=Pagination(total_count=len(members), max_page=1),
    )


@router.post(
    "/{id}/stripe_customer_portal",
    response_model=OrganizationStripePortalSession,
    description="Start a new Stripe Customer session for a organization.",
    status_code=200,
)
async def create_stripe_customer_portal(
    id: UUID,
    auth_subject: auth.OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> OrganizationStripePortalSession:
    org = await organization_service.get(session, id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    portal = await stripe_service.create_org_portal_session(session, org)
    if not portal:
        raise InternalServerError()

    return OrganizationStripePortalSession(url=portal.url)


#
# Internal APIs below
#


@router.get(
    "/{id}/badge_settings",
    response_model=OrganizationBadgeSettingsRead,
    summary="Get badge settings (Internal API)",
)
async def get_badge_settings(
    id: UUID,
    auth_subject: auth.OrganizationsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationBadgeSettingsRead:
    org = await organization_service.get(session, id)
    if not org:
        raise ResourceNotFound()
    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    repositories = await repository_service.list_by(
        session, org_ids=[org.id], order_by_open_source=True
    )

    synced = await repository_service.get_repositories_synced_count(session, org)

    repos = []
    for repo in repositories:
        open_issues = repo.open_issues or 0
        synced_data = synced.get(
            repo.id,
            {
                "synced_issues": 0,
                "auto_embedded_issues": 0,
                "label_embedded_issues": 0,
                "pull_requests": 0,
            },
        )
        synced_issues = synced_data["synced_issues"]
        if synced_issues > open_issues:
            open_issues = synced_issues

        is_sync_completed = synced_issues == open_issues

        repos.append(
            RepositoryBadgeSettingsRead(
                id=repo.id,
                avatar_url=org.avatar_url,
                badge_auto_embed=repo.pledge_badge_auto_embed,
                badge_label=repo.pledge_badge_label,
                name=repo.name,
                synced_issues=synced_issues,
                auto_embedded_issues=synced_data["auto_embedded_issues"],
                label_embedded_issues=synced_data["label_embedded_issues"],
                pull_requests=synced_data["pull_requests"],
                open_issues=open_issues,
                is_private=repo.is_private,
                is_sync_completed=is_sync_completed,
            )
        )

    message = org.default_badge_custom_content
    if not message:
        message = GithubBadge.generate_default_promotion_message(org)

    return OrganizationBadgeSettingsRead(
        show_amount=org.pledge_badge_show_amount,
        minimum_amount=org.pledge_minimum_amount,
        message=message,
        repositories=repos,
    )


@router.post(
    "/{id}/badge_settings",
    response_model=OrganizationSchema,
    include_in_schema=IN_DEVELOPMENT_ONLY,
    summary="Update badge settings (Internal API)",
)
async def update_badge_settings(
    id: UUID,
    settings: OrganizationBadgeSettingsUpdate,
    auth_subject: auth.OrganizationsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    org = await organization_service.get(session, id)
    if not org:
        raise ResourceNotFound()
    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    # convert payload into OrganizationUpdate format
    org_update = OrganizationUpdate()
    if settings.show_amount is not None:
        org_update.pledge_badge_show_amount = settings.show_amount

    if settings.minimum_amount is not None:
        org_update.pledge_minimum_amount = settings.minimum_amount

    if settings.message:
        org_update.default_badge_custom_content = settings.message

    org = await organization_service.update(
        session, authz, org, org_update, auth_subject
    )
    # save repositories settings
    repositories = await repository_service.list_by_ids_and_organization(
        session, [r.id for r in settings.repositories], org.id
    )
    for repository_settings in settings.repositories:
        if repository := next(
            (r for r in repositories if r.id == repository_settings.id), None
        ):
            await repository_service.update_badge_settings(
                session, org, repository, repository_settings
            )

    log.info(
        "organization.update_badge_settings",
        organization_id=org.id,
        settings=settings.model_dump(mode="json"),
    )

    # get for return
    org = await organization_service.get(session, id)
    if not org:
        raise ResourceNotFound()

    return org
