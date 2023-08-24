from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.enums import Platforms
from polar.integrations.github.service.issue import github_issue
from polar.integrations.github.service.organization import (
    github_organization as github_organization_service,
)
from polar.integrations.github.service.repository import (
    github_repository as github_repository_service,
)
from polar.invite.schemas import InviteCreate, InviteRead
from polar.invite.service import invite as invite_service
from polar.issue.schemas import Issue
from polar.issue.service import issue as issue_service
from polar.kit.schemas import Schema
from polar.models.issue_reward import IssueReward
from polar.models.organization import Organization
from polar.models.pledge import Pledge as PledgeModel
from polar.models.pledge_transaction import PledgeTransaction as PledgeTransactionModel
from polar.organization.endpoints import OrganizationPrivateRead
from polar.organization.service import organization as organization_service
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session
from polar.reward.endpoints import to_resource as reward_to_resource
from polar.reward.service import reward_service
from polar.tags.api import Tags
from polar.types import ListResource, Pagination

from .pledge_service import bo_pledges_service
from .schemas import (
    BackofficeBadge,
    BackofficeBadgeResponse,
    BackofficePledge,
    BackofficeReward,
)

router = APIRouter(tags=["backoffice"], prefix="/backoffice")

log = structlog.get_logger()


@router.get("/pledges", response_model=list[BackofficePledge], tags=[Tags.INTERNAL])
async def pledges(
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[BackofficePledge]:
    return await bo_pledges_service.list_pledges(session)


def r(
    pledge: PledgeModel, reward: IssueReward, transaction: PledgeTransactionModel
) -> BackofficeReward:
    r = reward_to_resource(pledge, reward, transaction)
    return BackofficeReward(
        pledge=r.pledge,
        user=r.user,
        organization=r.organization,
        amount=r.amount,
        state=r.state,
        paid_at=r.paid_at,
        transfer_id=transaction.transaction_id if transaction else None,
        issue_reward_id=reward.id,
        pledge_payment_id=pledge.payment_id,
        pledger_email=pledge.email,
    )


@router.get(
    "/rewards/by_issue",
    response_model=ListResource[BackofficeReward],
    tags=[Tags.INTERNAL],
)
async def rewards(
    issue_id: UUID | None = None,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[BackofficeReward]:
    rewards = await reward_service.list(session, issue_id=issue_id)

    return ListResource(
        items=[
            r(pledge, reward, transaction) for pledge, reward, transaction in rewards
        ],
        pagination=Pagination(total_count=len(rewards)),
    )


@router.get(
    "/rewards/pending",
    response_model=ListResource[BackofficeReward],
    tags=[Tags.INTERNAL],
)
async def rewards_pending(
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[BackofficeReward]:
    rewards = await reward_service.list(session, is_transfered=False)

    return ListResource(
        items=[
            r(pledge, reward, transaction) for pledge, reward, transaction in rewards
        ],
        pagination=Pagination(total_count=len(rewards)),
    )


@router.get("/issue/{id}", response_model=Issue, tags=[Tags.INTERNAL])
async def issue(
    id: UUID,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> Issue:
    i = await issue_service.get_loaded(session, id)
    if not i:
        raise HTTPException(
            status_code=404,
            detail="Issue not found",
        )

    return Issue.from_db(i)


async def get_pledge(session: AsyncSession, pledge_id: UUID) -> BackofficePledge:
    pledge = await pledge_service.get_with_loaded(session, pledge_id)
    if not pledge:
        raise HTTPException(
            status_code=404,
            detail="Pledge not found",
        )
    return BackofficePledge.from_db(pledge)


class PledgeRewardTransfer(Schema):
    pledge_id: UUID
    issue_reward_id: UUID


@router.post("/pledges/approve", response_model=BackofficeReward, tags=[Tags.INTERNAL])
async def pledge_reward_transfer(
    body: PledgeRewardTransfer,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> BackofficeReward:
    await pledge_service.transfer(session, body.pledge_id, body.issue_reward_id)

    reward_tuple = await reward_service.get(
        session, pledge_id=body.pledge_id, issue_reward_id=body.issue_reward_id
    )

    if not reward_tuple:
        raise HTTPException(
            status_code=404,
            detail="Reward not found",
        )

    (pledge, reward, transaction) = reward_tuple

    return r(pledge, reward, transaction)


@router.post(
    "/pledges/mark_pending/{pledge_id}",
    response_model=BackofficePledge,
    tags=[Tags.INTERNAL],
)
async def pledge_mark_pending(
    pledge_id: UUID,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> BackofficePledge:
    await pledge_service.mark_pending_by_pledge_id(session, pledge_id)
    return await get_pledge(session, pledge_id)


@router.post(
    "/pledges/mark_disputed/{pledge_id}",
    response_model=BackofficePledge,
    tags=[Tags.INTERNAL],
)
async def pledge_mark_disputed(
    pledge_id: UUID,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> BackofficePledge:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    await pledge_service.mark_disputed(
        session, pledge_id, by_user_id=auth.user.id, reason="Disputed via Backoffice"
    )
    return await get_pledge(session, pledge_id)


@router.post("/invites/create_code", response_model=InviteRead, tags=[Tags.INTERNAL])
async def invites_create_code(
    invite: InviteCreate,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> InviteRead:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    res = await invite_service.create_code(session, invite, auth.user)
    if not res:
        raise HTTPException(
            status_code=404,
            detail="Pledge not found",
        )
    return InviteRead.from_db(res)


@router.post("/invites/list", response_model=list[InviteRead], tags=[Tags.INTERNAL])
async def invites_list(
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[InviteRead]:
    res = await invite_service.list(session)
    return [InviteRead.from_db(i) for i in res]


@router.post(
    "/organization/sync/{name}",
    response_model=OrganizationPrivateRead,
    tags=[Tags.INTERNAL],
)
async def organization_sync(
    name: str,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> Organization:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    org = await github_organization_service.get_by_name(session, Platforms.github, name)
    if not org:
        raise HTTPException(
            status_code=404,
            detail="Org not found",
        )

    await github_repository_service.install_for_organization(
        session, org, org.installation_id
    )

    return org


@router.post("/badge", response_model=BackofficeBadgeResponse, tags=[Tags.INTERNAL])
async def manage_badge(
    badge: BackofficeBadge,
    auth: Auth = Depends(Auth.backoffice_user),
    session: AsyncSession = Depends(get_db_session),
) -> BackofficeBadgeResponse:
    if not auth.user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    log.info("backoffice.badge", badge=badge.dict(), admin=auth.user.username)

    org, repo, issue = await organization_service.get_with_repo_and_issue(
        session,
        platform=Platforms.github,
        org_name=badge.org_slug,
        repo_name=badge.repo_slug,
        issue=badge.issue_number,
    )

    if repo.pledge_badge_auto_embed:
        raise HTTPException(403)

    if badge.action == "remove":
        issue = await github_issue.remove_polar_label(
            session,
            organization=org,
            repository=repo,
            issue=issue,
        )
        success = not issue.has_pledge_badge_label
    else:
        issue = await github_issue.add_polar_label(
            session,
            organization=org,
            repository=repo,
            issue=issue,
        )
        success = issue.has_pledge_badge_label

    return BackofficeBadgeResponse(
        org_slug=org.name,
        repo_slug=repo.name,
        issue_number=issue.number,
        action=badge.action,
        success=success,
    )
