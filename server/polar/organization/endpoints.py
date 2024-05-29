from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import UUID4

from polar.auth.models import Subject
from polar.authz.service import AccessType, Authz
from polar.currency.schemas import CurrencyAmount
from polar.enums import Platforms
from polar.exceptions import InternalServerError, ResourceNotFound, Unauthorized
from polar.integrations.github.badge import GithubBadge
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.pagination import ListResource, Pagination, PaginationParamsQuery
from polar.models.organization import Organization
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags
from polar.user_organization.schemas import OrganizationMember
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .auth import AnonymousOrganizationsRead, OrganizationsRead, OrganizationsWrite
from .schemas import (
    CreditBalance,
    OrganizationBadgeSettingsRead,
    OrganizationBadgeSettingsUpdate,
    OrganizationCustomer,
    OrganizationCustomerType,
    OrganizationSetAccount,
    OrganizationStripePortalSession,
    OrganizationUpdate,
    RepositoryBadgeSettingsRead,
)
from .schemas import (
    Organization as OrganizationSchema,
)
from .service import organization as organization_service

log = structlog.get_logger()

router = APIRouter(tags=["organizations"])

OrganizationID = Annotated[UUID4, Path(description="The organization ID.")]
OrganizationNotFound = {
    "description": "Organization not found.",
    "model": ResourceNotFound.schema(),
}


async def to_schema(
    session: AsyncSession,
    subject: Subject,
    o: Organization,
) -> OrganizationSchema:
    is_member = False

    if isinstance(
        subject, User
    ) and await user_organization_service.get_by_user_and_org(
        session,
        subject.id,
        o.id,
    ):
        is_member = True

    return OrganizationSchema.from_db(
        o,
        include_member_fields=is_member,
    )


@router.get(
    "/organizations",
    response_model=ListResource[OrganizationSchema],
    tags=[Tags.PUBLIC],
    description="List organizations that the authenticated user is a member of. Requires authentication.",  # noqa: E501
    summary="List organizations",
    status_code=200,
)
async def list(
    auth_subject: OrganizationsRead,
    is_admin_only: bool = Query(
        default=True,
        description="Include only organizations that the user is an admin of.",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationSchema]:
    orgs = await organization_service.list_all_orgs_by_user_id(
        session, auth_subject.subject.id, is_admin_only
    )

    return ListResource(
        items=[await to_schema(session, auth_subject.subject, o) for o in orgs],
        pagination=Pagination(total_count=len(orgs), max_page=1),
    )


@router.get(
    "/organizations/search",
    response_model=ListResource[OrganizationSchema],
    tags=[Tags.PUBLIC],
    description="Search organizations.",
    summary="Search organizations",
    status_code=200,
)
async def search(
    auth_subject: AnonymousOrganizationsRead,
    platform: Platforms | None = None,
    organization_name: str | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationSchema]:
    # Search by platform and organization name.
    # Currently the only way to search
    if platform and organization_name:
        org = await organization_service.get_by_name(
            session, platform, organization_name
        )
        if org:
            return ListResource(
                items=[await to_schema(session, auth_subject.subject, org)],
                pagination=Pagination(total_count=0, max_page=1),
            )

    # no org found
    return ListResource(
        items=[],
        pagination=Pagination(total_count=0, max_page=1),
    )


@router.get(
    "/organizations/lookup",
    response_model=OrganizationSchema,
    tags=[Tags.PUBLIC],
    description="Lookup a single organization.",  # noqa: E501
    summary="Lookup organization",
    status_code=200,
    responses={404: {}},
)
async def lookup(
    auth_subject: AnonymousOrganizationsRead,
    platform: Platforms | None = None,
    organization_name: str | None = None,
    custom_domain: str | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSchema:
    # Search by platform and organization name.
    if platform and organization_name:
        org = await organization_service.get_by_name(
            session, platform, organization_name
        )
        if org:
            return await to_schema(session, auth_subject.subject, org)

    # Search by custom domain
    if custom_domain:
        org = await organization_service.get_by_custom_domain(
            session, custom_domain=custom_domain
        )
        if org:
            return await to_schema(session, auth_subject.subject, org)

    raise HTTPException(
        status_code=404,
        detail="Organization not found ",
    )


@router.get(
    "/organizations/{id}",
    response_model=OrganizationSchema,
    tags=[Tags.PUBLIC],
    description="Get a organization by ID",
    status_code=200,
    summary="Get organization",
    responses={404: {}},
)
async def get(
    id: UUID,
    auth_subject: AnonymousOrganizationsRead,
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSchema:
    org = await organization_service.get(session, id=id)

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    return await to_schema(session, auth_subject.subject, org)


@router.get(
    "/organizations/{id}/customers",
    response_model=ListResource[OrganizationCustomer],
    tags=[Tags.PUBLIC],
    responses={404: OrganizationNotFound},
)
async def list_organization_customers(
    id: OrganizationID,
    auth_subject: AnonymousOrganizationsRead,
    pagination: PaginationParamsQuery,
    customer_types: set[OrganizationCustomerType] = Query(
        {
            OrganizationCustomerType.subscription,
            OrganizationCustomerType.order,
            OrganizationCustomerType.donation,
        },
        description="Filter by the type of purchase the customer made.",
    ),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OrganizationCustomer]:
    """List organization customers."""
    organization = await organization_service.get(session, id=id)

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
    "/organizations/{id}",
    response_model=OrganizationSchema,
    tags=[Tags.PUBLIC],
    description="Update organization",
    status_code=200,
    summary="Update an organization",
    responses={404: {}},
)
async def update(
    id: UUID,
    update: OrganizationUpdate,
    auth_subject: OrganizationsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSchema:
    org = await organization_service.get(session, id=id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    # validate featured organizations and featured projects
    if update.profile_settings is not None:
        if update.profile_settings.featured_organizations is not None:
            for org_id in update.profile_settings.featured_organizations:
                if not await organization_service.get(session, id=org_id):
                    raise ResourceNotFound()
        if update.profile_settings.featured_projects is not None:
            for repo_id in update.profile_settings.featured_projects:
                if not await repository_service.get(session, id=repo_id):
                    raise ResourceNotFound()

    org = await organization_service.update_settings(session, org, update)

    return await to_schema(session, auth_subject.subject, org)


@router.patch(
    "/organizations/{id}/account",
    response_model=OrganizationSchema,
    tags=[Tags.PUBLIC],
    description="Set organization account",
    status_code=200,
    summary="Set organization organization",
    responses={404: {}},
)
async def set_account(
    id: UUID,
    set_account: OrganizationSetAccount,
    auth_subject: OrganizationsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSchema:
    org = await organization_service.get(session, id=id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    org = await organization_service.set_account(
        session,
        authz=authz,
        auth_subject=auth_subject,
        organization=org,
        account_id=set_account.account_id,
    )

    return await to_schema(session, auth_subject.subject, org)


@router.get(
    "/organizations/{id}/members",
    response_model=ListResource[OrganizationMember],
    tags=[Tags.PUBLIC],
    description="List members of an organization. Requires authentication.",  # noqa: E501
    summary="List members in an organization",
    status_code=200,
)
async def list_members(
    auth_subject: OrganizationsWrite,
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
    "/organizations/{id}/stripe_customer_portal",
    response_model=OrganizationStripePortalSession,
    tags=[Tags.PUBLIC],
    description="Start a new Stripe Customer session for a organization.",
    status_code=200,
)
async def create_stripe_customer_portal(
    id: UUID,
    auth_subject: OrganizationsWrite,
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


@router.get(
    "/organizations/{id}/credit",
    response_model=CreditBalance,
    tags=[Tags.PUBLIC],
    description="Get credits for a organization",  # noqa: E501
    status_code=200,
)
async def get_credits(
    id: UUID,
    auth_subject: OrganizationsWrite,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> CreditBalance:
    org = await organization_service.get(session, id)
    if not org:
        raise ResourceNotFound()

    if not await authz.can(auth_subject.subject, AccessType.write, org):
        raise Unauthorized()

    balance = await stripe_service.get_organization_credit_balance(session, org)
    if balance is None:
        raise ResourceNotFound()

    return CreditBalance(
        amount=CurrencyAmount(
            currency="USD",
            amount=balance,
        )
    )


#
# Internal APIs below
#


@router.get(
    "/organizations/{id}/badge_settings",
    response_model=OrganizationBadgeSettingsRead,
    summary="Get badge settings (Internal API)",
)
async def get_badge_settings(
    id: UUID,
    auth_subject: OrganizationsWrite,
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
    "/organizations/{id}/badge_settings",
    response_model=OrganizationSchema,
    tags=[Tags.INTERNAL],
    summary="Update badge settings (Internal API)",
)
async def update_badge_settings(
    id: UUID,
    settings: OrganizationBadgeSettingsUpdate,
    auth_subject: OrganizationsWrite,
    authz: Authz = Depends(Authz.authz),
    session: AsyncSession = Depends(get_db_session),
) -> OrganizationSchema:
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

    await organization_service.update_settings(session, org, org_update)

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

    return await to_schema(session, auth_subject.subject, org)
