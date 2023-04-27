from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request

from polar.auth.dependencies import Auth
from polar.models import Pledge, Repository
from polar.exceptions import ResourceNotFound
from polar.enums import Platforms
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session

from polar.integrations.stripe.service import stripe
from polar.organization.schemas import OrganizationRead
from polar.organization.service import organization as organization_service
from polar.repository.schemas import RepositoryRead
from polar.issue.schemas import IssueRead

from .schemas import (
    PledgeCreate,
    PledgeMutationResponse,
    PledgeUpdate,
    PledgeRead,
    PledgeState,
    PledgeResources,
)
from .service import pledge as pledge_service

router = APIRouter(tags=["pledges"])


async def get_pledge_or_404(
    session: AsyncSession,
    *,
    pledge_id: UUID,
    for_repository: Repository,
) -> Pledge:
    pledge = await pledge_service.get_with_loaded(session=session, pledge_id=pledge_id)

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
    response_model=PledgeMutationResponse,
)
async def create_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge: PledgeCreate,
    session: AsyncSession = Depends(get_db_session),
    auth: Auth = Depends(Auth.optional_user),
) -> PledgeMutationResponse:
    # Pre-authenticated pledge flow (with saved CC)
    if pledge.pledge_as_org and auth.user:
        return await create_pledge_as_org(
            platform,
            org_name,
            repo_name,
            number,
            pledge,
            auth.user,
            session,
        )

    # Pledge flow with logged in user
    if auth.user:
        return await create_pledge_user(
            platform,
            org_name,
            repo_name,
            number,
            pledge,
            auth.user,
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
) -> PledgeMutationResponse:
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

    # Create the pledge
    created = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repo.id,
        organization_id=org.id,
        email=pledge.email,
        amount=pledge.amount,
        state=PledgeState.initiated,
    )

    # Create a payment intent with Stripe
    payment_intent = stripe.create_anonymous_intent(
        amount=pledge.amount,
        transfer_group=f"{created.id}",
        issue=issue,
        anonymous_email=pledge.email,
    )

    # Store the intent id
    created.payment_id = payment_intent.id
    await created.save(session)

    ret = PledgeMutationResponse.from_orm(created)
    ret.client_secret = payment_intent.client_secret

    return ret


async def create_pledge_user(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge: PledgeCreate,
    user: User,
    session: AsyncSession,
) -> PledgeMutationResponse:
    org, repo, issue = await organization_service.get_with_repo_and_issue(
        session=session,
        platform=platform,
        org_name=org_name,
        repo_name=repo_name,
        issue=number,
    )

    # Create the pledge
    created = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repo.id,
        organization_id=org.id,
        email=pledge.email,
        amount=pledge.amount,
        state=PledgeState.initiated,
        by_user_id=user.id,
    )

    # Create a payment intent with Stripe
    payment_intent = stripe.create_user_intent(
        amount=pledge.amount,
        transfer_group=f"{created.id}",
        issue=issue,
        user=user,
    )

    # Store the intent id
    created.payment_id = payment_intent.id
    await created.save(session)

    ret = PledgeMutationResponse.from_orm(created)
    ret.client_secret = payment_intent.client_secret

    # User pledged, allow into the beta!
    if not user.invite_only_approved:
        user.invite_only_approved = True
        await user.save(session)

    return ret


async def create_pledge_as_org(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge: PledgeCreate,
    user: User,
    session: AsyncSession,
) -> PledgeMutationResponse:
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

    pledge_as_org = await organization_service.get_by_id_for_user(
        session=session,
        platform=platform,
        org_id=pledge.pledge_as_org,
        user_id=user.id,
    )

    if not pledge_as_org:
        raise HTTPException(status_code=404, detail="Not found")

    # Create the pledge
    created = await Pledge.create(
        session=session,
        issue_id=issue.id,
        repository_id=repo.id,
        organization_id=org.id,
        email=pledge.email,
        amount=pledge.amount,
        state=PledgeState.created,  # created == polar has received the money
        by_organization_id=pledge_as_org.id,
    )

    # Create a payment intent with Stripe
    payment_intent = await stripe.create_confirmed_payment_intent_for_organization(
        session,
        amount=pledge.amount,
        transfer_group=f"{created.id}",
        issue=issue,
        organization=pledge_as_org,
    )

    # Store the intent id
    created.payment_id = payment_intent.id
    await created.save(session)

    ret = PledgeMutationResponse.from_orm(created)

    return ret


@router.patch(
    "/{platform}/{org_name}/{repo_name}/issues/{number}/pledges/{pledge_id}",
    response_model=PledgeMutationResponse,
)
async def update_pledge(
    platform: Platforms,
    org_name: str,
    repo_name: str,
    number: int,
    pledge_id: UUID,
    updates: PledgeUpdate,
    session: AsyncSession = Depends(get_db_session),
) -> PledgeMutationResponse:
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

    ret = PledgeMutationResponse.from_orm(pledge)
    ret.client_secret = payment_intent.client_secret

    return ret


@router.get(
    "/me/pledges",
    response_model=list[PledgeRead],
)
async def list_personal_pledges(
    auth: Auth = Depends(Auth.current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[PledgeRead]:
    pledges = await pledge_service.list_by_pledging_user(session, auth.user.id)
    return [PledgeRead.from_db(p) for p in pledges]
