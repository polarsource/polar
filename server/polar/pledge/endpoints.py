from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from polar import locker
from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.authz.service import AccessType, Authz
from polar.enums import Platforms
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.issue.service import issue as issue_service
from polar.kit.pagination import ListResource, Pagination
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.repository.service import repository as repository_service
from polar.tags.api import Tags
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .payment_intent_service import payment_intent_service
from .schemas import (
    CreatePledgeFromPaymentIntent,
    CreatePledgePayLater,
    PledgePledgesSummary,
    PledgeStripePaymentIntentCreate,
    PledgeStripePaymentIntentMutationResponse,
    PledgeStripePaymentIntentUpdate,
)
from .schemas import (
    Pledge as PledgeSchema,
)
from .service import pledge as pledge_service

router = APIRouter(tags=["pledges"])


@router.get(
    "/pledges/search",
    response_model=ListResource[PledgeSchema],
    tags=[Tags.PUBLIC],
    description="Search pledges. Requires authentication. The user can only read pledges that they have made (personally or via an organization) or received (to organizations that they are a member of).",  # noqa: E501
    summary="Search pledges (Public API)",
    status_code=200,
)
async def search(
    platform: Platforms | None = None,
    organization_name: str
    | None = Query(
        default=None,
        min_length=1,
        example="my-org",
        description="Search pledges in the organization with this name. Requires platform to be set.",  # noqa: E501
    ),
    repository_name: str
    | None = Query(
        default=None,
        min_length=1,
        example="my-repo",
        description="Search pledges in the repository with this name. Can only be used if organization_name is set.",  # noqa: E501
    ),
    issue_id: UUID
    | None = Query(default=None, description="Search pledges to this issue"),
    by_organization_id: UUID
    | None = Query(
        default=None, description="Search pledges made by this organization."
    ),
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
    authz: Authz = Depends(Authz.authz),
) -> ListResource[PledgeSchema]:
    list_by_orgs: list[UUID] = []
    list_by_repos: list[UUID] = []
    list_by_issues: list[UUID] = []

    if organization_name:
        if not platform:
            raise HTTPException(
                status_code=400,
                detail="platform is not set",
            )

        if not platform:
            raise HTTPException(
                status_code=400,
                detail="platform is not set",
            )

        if not organization_name:
            raise HTTPException(
                status_code=400,
                detail="organization_name is not set",
            )

        # get org
        org = await organization_service.get_by_name(
            session,
            platform=Platforms.github,
            name=organization_name,
        )

        if not org:
            raise HTTPException(
                status_code=404,
                detail="organization not found",
            )

        list_by_orgs = [org.id]

    if repository_name:
        if len(list_by_orgs) != 1:
            raise HTTPException(
                status_code=404,
                detail="organization not set",
            )

        repo = await repository_service.get_by_org_and_name(
            session, organization_id=list_by_orgs[0], name=repository_name
        )

        if not repo:
            raise HTTPException(
                status_code=404,
                detail="repository not found",
            )

        list_by_repos = [repo.id]

    if issue_id:
        list_by_issues = [issue_id]

    if (
        len(list_by_orgs) == 0
        and len(list_by_repos) == 0
        and len(list_by_issues) == 0
        and not by_organization_id
    ):
        raise HTTPException(
            status_code=400,
            detail="No search criteria specified",
        )

    pledges = await pledge_service.list_by(
        session=session,
        organization_ids=list_by_orgs,
        repository_ids=list_by_repos,
        issue_ids=list_by_issues,
        pledging_organization=by_organization_id,
        load_issue=True,
        load_pledger=True,
    )

    items = [
        PledgeSchema.from_db(
            p, include_admin_fields=await authz.can(auth.subject, AccessType.write, p)
        )
        for p in pledges
        if await authz.can(auth.subject, AccessType.read, p)
    ]

    return ListResource(
        items=items, pagination=Pagination(total_count=len(items), max_page=1)
    )


@router.get(
    "/pledges/summary",
    response_model=PledgePledgesSummary,
    tags=[Tags.PUBLIC],
    description="Get summary of pledges for resource.",  # noqa: E501
    summary="Get pledges summary (Public API)",
    status_code=200,
)
async def summary(
    issue_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
    authz: Authz = Depends(Authz.authz),
) -> PledgePledgesSummary:
    issue = await issue_service.get(session, issue_id)
    if not issue:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.read, issue):
        raise Unauthorized()

    return await pledge_service.issue_pledge_summary(session, issue)


@router.get(
    "/pledges/{id}",
    response_model=PledgeSchema,
    tags=[Tags.PUBLIC],
    description="Get a pledge. Requires authentication.",  # noqa: E501
    summary="Get pledge (Public API)",
    status_code=200,
)
async def get(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> PledgeSchema:
    pledge = await pledge_service.get_with_loaded(session, id)
    if not pledge:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.read, pledge):
        raise Unauthorized()

    return PledgeSchema.from_db(
        pledge,
        include_admin_fields=await authz.can(auth.subject, AccessType.write, pledge),
    )


# Internal APIs below


@router.post(
    "/pledges",
    response_model=PledgeSchema,
    tags=[Tags.INTERNAL],
    description="Creates a pledge from a payment intent",
    status_code=200,
)
async def create(
    create: CreatePledgeFromPaymentIntent,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
    authz: Authz = Depends(Authz.authz),
    locker: locker.Locker = Depends(locker.get_locker),
) -> PledgeSchema:
    async with locker.lock(
        f"create_pledge_from_intent:{create.payment_intent_id}",
        timeout=60 * 60,
        blocking_timeout=5,
    ):
        pledge = await payment_intent_service.create_pledge(
            session=session,
            payment_intent_id=create.payment_intent_id,
        )

    ret = await pledge_service.get_with_loaded(session, pledge.id)
    if not ret:
        raise ResourceNotFound()

    return PledgeSchema.from_db(
        ret, include_admin_fields=await authz.can(auth.subject, AccessType.write, ret)
    )


@router.post(
    "/pledges/pay_on_completion",
    response_model=PledgeSchema,
    tags=[Tags.INTERNAL],
    description="Creates a pay_on_completion type of pledge",
    status_code=200,
)
async def create_pay_on_completion(
    create: CreatePledgePayLater,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> PledgeSchema:
    pledge = await pledge_service.create_pay_on_completion(
        session=session,
        issue_id=create.issue_id,
        amount=create.amount,
        by_user=auth.user,
        on_behalf_of_organization_id=create.on_behalf_of_organization_id,
    )

    ret = await pledge_service.get_with_loaded(session, pledge.id)
    if not ret:
        raise ResourceNotFound()

    return PledgeSchema.from_db(
        ret, include_admin_fields=await authz.can(auth.subject, AccessType.write, ret)
    )


@router.post(
    "/pledges/{id}/create_invoice",
    response_model=PledgeSchema,
    tags=[Tags.INTERNAL],
    description="Creates an invoice for pay_on_completion pledges",
    status_code=200,
)
async def create_invoice(
    id: UUID,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    authz: Authz = Depends(Authz.authz),
) -> PledgeSchema:
    pledge = await pledge_service.get(session, id)
    if not pledge:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.write, pledge):
        raise Unauthorized()

    await pledge_service.send_invoice(session, id)

    ret = await pledge_service.get_with_loaded(session, id)
    if not ret:
        raise ResourceNotFound()

    return PledgeSchema.from_db(
        ret, include_admin_fields=await authz.can(auth.subject, AccessType.write, ret)
    )


@router.post(
    "/pledges/payment_intent",
    response_model=PledgeStripePaymentIntentMutationResponse,
    status_code=200,
    responses={
        400: {"detail": "message"},
        403: {"detail": "message"},
        404: {"detail": "message"},
    },
)
async def create_payment_intent(
    intent: PledgeStripePaymentIntentCreate,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
    authz: Authz = Depends(Authz.authz),
) -> PledgeStripePaymentIntentMutationResponse:
    issue = await issue_service.get(session, intent.issue_id)
    if not issue:
        raise ResourceNotFound()

    if not await authz.can(auth.subject, AccessType.read, issue):
        raise Unauthorized()

    # If on behalf of org, check that user is member of this org.
    if intent.on_behalf_of_organization_id:
        if not auth.user:
            raise Unauthorized()
        member = await user_organization_service.get_by_user_and_org(
            session, auth.user.id, intent.on_behalf_of_organization_id
        )
        if not member:
            raise Unauthorized()

    return await payment_intent_service.create_payment_intent(
        session=session,
        user=auth.user,
        issue=issue,
        intent=intent,
    )


@router.patch(
    "/pledges/payment_intent/{id}",
    response_model=PledgeStripePaymentIntentMutationResponse,
)
async def update_payment_intent(
    id: str,
    updates: PledgeStripePaymentIntentUpdate,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> PledgeStripePaymentIntentMutationResponse:
    # If on behalf of org, check that user is member of this org.
    if updates.on_behalf_of_organization_id:
        if not auth.user:
            raise Unauthorized()
        member = await user_organization_service.get_by_user_and_org(
            session, auth.user.id, updates.on_behalf_of_organization_id
        )
        if not member:
            raise Unauthorized()

    return await payment_intent_service.update_payment_intent(
        payment_intent_id=id,
        updates=updates,
    )


@router.post(
    "/pledges/{pledge_id}/dispute",
    response_model=PledgeSchema,
)
async def dispute_pledge(
    pledge_id: UUID,
    reason: str,
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> PledgeSchema:
    pledge = await pledge_service.get(session, pledge_id)
    if not pledge:
        raise HTTPException(status_code=404, detail="Pledge not found")

    # authorize
    user_memberships = await user_organization_service.list_by_user_id(
        session,
        auth.user.id,
    )

    if not pledge_service.user_can_admin_sender_pledge(
        auth.user, pledge, user_memberships
    ):
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    await pledge_service.mark_disputed(
        session, pledge_id=pledge_id, by_user_id=auth.user.id, reason=reason
    )

    # get pledge again
    pledge = await pledge_service.get_with_loaded(session, pledge_id)
    if not pledge:
        raise HTTPException(status_code=404, detail="Pledge not found")

    return PledgeSchema.from_db(pledge)
