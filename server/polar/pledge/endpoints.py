from typing import Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from polar.auth.dependencies import Auth, current_active_user
from polar.models import Pledge, Repository
from polar.exceptions import ResourceNotFound
from polar.enums import Platforms
from polar.postgres import AsyncSession, get_db_session

from polar.integrations.stripe.service import stripe
from polar.organization.schemas import OrganizationRead
from polar.organization.service import organization as organization_service
from polar.repository.schemas import RepositoryRead
from polar.issue.schemas import IssueRead

from .schemas import PledgeCreate, PledgeUpdate, PledgeRead, State, PledgeResources
from .service import pledge

router = APIRouter(tags=["pledges"])


async def get_pledge_or_404(
    session: AsyncSession,
    *,
    pledge_id: UUID,
    for_repository: Repository,
) -> Pledge:
    pledge = await Pledge.find(session=session, id=pledge_id)

    if not pledge:
        raise HTTPException(
            status_code=404,
            detail="Pledge not found",
        )

    if pledge.repository_id != for_repository.id:
        raise HTTPException(
            status_code=403, detail="Pledge does not belong to this repository"
        )

    return pledge


@router.get(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledge",
    response_model=PledgeResources,
)
async def get_pledge_with_resources(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge_id: UUID | None = None,
    # Mimic JSON-API's include query format
    include: str = "organization,repository,issue",
    session: AsyncSession = Depends(get_db_session),
) -> PledgeResources:
    try:
        includes = include.split(",")
        org, repo, issue = await organization_service.get_with_repo_and_issue(
            session,
            platform=platform,
            org_name=org_name,
            repo_name=repo_name,
            issue=number,
        )

        included_pledge = None
        if pledge_id:
            pledge = await get_pledge_or_404(
                session,
                pledge_id=pledge_id,
                for_repository=repo,
            )
            included_pledge = PledgeRead.from_db(pledge)

        included_org = None
        if "organization" in includes:
            included_org = OrganizationRead.from_orm(org)

        included_repo = None
        if "repository" in includes:
            included_repo = RepositoryRead.from_orm(repo)

        included_issue = None
        if "issue" in includes:
            included_issue = IssueRead.from_orm(issue)

        return PledgeResources(
            pledge=included_pledge,
            organization=included_org,
            repository=included_repo,
            issue=included_issue,
        )
    except ResourceNotFound:
        raise HTTPException(
            status_code=404,
            detail="Organization, repo and issue combination not found",
        )


@router.post(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledges",
    response_model=PledgeRead,
)
async def create_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge: PledgeCreate,
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> PledgeRead:
    # Pre-authenticated pledge flow
    if pledge.pledge_as_org:
        return await create_pledge_as_org(
            platform,
            org_name,
            repo_name,
            number,
            pledge,
            request,
            session,
        )

    return await create_pledge_anonymous(
        platform,
        org_name,
        repo_name,
        number,
        pledge,
        session,
    )


async def create_pledge_anonymous(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge: PledgeCreate,
    session: AsyncSession,
) -> PledgeRead:
    if not pledge.email:
        raise HTTPException(
            status_code=401, detail="pledge.email is required for anonymous pledges"
        )

    org, repo, issue = await organization_service.get_with_repo_and_issue(
        session=session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
        issue=number,
    )

    # Create a payment intent with Stripe
    payment_intent = stripe.create_intent(
        amount=pledge.amount,
        transfer_group=f"{issue.id}",
        issue=issue,
    )

    # Create the pledge
    created = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repo.id,
        organization_id=org.id,
        email=pledge.email,
        amount=pledge.amount,
        state=State.initiated,
        payment_id=payment_intent.id,
    )

    ret = PledgeRead.from_db(created)
    ret.client_secret = payment_intent.client_secret

    return ret


async def create_pledge_as_org(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge: PledgeCreate,
    request: Request,
    session: AsyncSession,
) -> PledgeRead:
    org, repo, issue = await organization_service.get_with_repo_and_issue(
        session=session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
        issue=number,
    )

    # Pre-authenticated pledge flow
    if not pledge.pledge_as_org:
        raise HTTPException(status_code=401, detail="Unexpected flow")

    user = await current_active_user(request, session)

    peldge_as_org = await organization_service.get_by_id_for_user(
        session=session,
        platform=platform,
        org_id=pledge.pledge_as_org,
        user_id=user.id,
    )

    if not peldge_as_org:
        raise HTTPException(status_code=404, detail="Not found")

    # Create a payment intent with Stripe
    payment_intent = await stripe.create_confirmed_payment_intent_for_organization(
        session,
        amount=pledge.amount,
        transfer_group=f"{issue.id}",
        issue=issue,
        organization=peldge_as_org,
    )

    # Create the pledge
    created = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repo.id,
        organization_id=org.id,
        email=pledge.email,
        amount=pledge.amount,
        state=State.created,  # created == polar has received the money
        payment_id=payment_intent.id,
        by_organization_id=peldge_as_org.id,
    )

    ret = PledgeRead.from_db(created)
    # ret.client_secret = payment_intent.client_secret

    return ret


@router.patch(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledges/{pledge_id}",
    response_model=PledgeRead,
)
async def update_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge_id: UUID,
    updates: PledgeUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> PledgeRead:
    org, repo, issue = await organization_service.get_with_repo_and_issue(
        session=session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
        issue=number,
    )

    pledge = await get_pledge_or_404(session, pledge_id=pledge_id, for_repository=repo)

    payment_intent = None

    if updates.amount and updates.amount != pledge.amount:
        pledge.amount = updates.amount
        payment_intent = stripe.modify_intent(pledge.payment_id, amount=pledge.amount)

    if updates.email and updates.email != pledge.email:
        pledge.email = updates.email

    if payment_intent is None:
        payment_intent = stripe.retrieve_intent(pledge.payment_id)

    await pledge.save(session=session)

    ret = PledgeRead.from_db(pledge)
    ret.client_secret = payment_intent.client_secret

    return ret


@router.get(
    "/{platform}/{org_name}/{repo_name}/pledges",
    response_model=list[PledgeRead],
)
async def get_repository_pledges(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    auth: Auth = Depends(Auth.user_with_org_and_repo_access),
    session: AsyncSession = Depends(get_db_session),
) -> Sequence[PledgeRead]:
    pledges = await pledge.list_by_repository(
        session=session, repository_id=auth.repository.id
    )

    return [PledgeRead.from_db(p) for p in pledges]
