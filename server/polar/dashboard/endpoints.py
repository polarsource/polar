from typing import Any, Dict, List, Sequence, Set, Union
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query

from polar.dashboard.schemas import (
    Entry,
    IssueListResponse,
    IssueRelationship,
    IssueStatus,
    Relationship,
    RelationshipData,
)
from polar.enums import Platforms
from polar.issue.schemas import IssueRead, IssueReferenceRead, IssueDependencyRead
from polar.models.issue import Issue
from polar.models.issue_reference import ReferenceType
from polar.models.repository import Repository
from polar.organization.schemas import OrganizationRead
from polar.repository.schemas import RepositoryRead
from polar.issue.service import issue
from polar.pledge.schemas import PledgeRead
from polar.pledge.service import pledge
from polar.repository.service import repository
from polar.auth.dependencies import Auth
from polar.postgres import AsyncSession, get_db_session

router = APIRouter(tags=["dashboard"])


@router.get(
    "/{platform}/{org_name}/dashboard",
    response_model=IssueListResponse,
)
async def get_dashboard(
    platform: Platforms,
    org_name: str,
    repo_name: Union[str, None] = Query(default=None),
    status: Union[List[IssueStatus], None] = Query(default=None),
    q: Union[str, None] = Query(default=None),
    auth: Auth = Depends(Auth.user_with_org_access),
    session: AsyncSession = Depends(get_db_session),
) -> IssueListResponse:
    include_open = False
    if status:
        include_open = (
            IssueStatus.backlog in status
            or IssueStatus.building in status
            or IssueStatus.pull_request in status
        )

    include_closed = False
    if status:
        include_closed = IssueStatus.completed in status

    repositories: Sequence[Repository] = []

    # if repo name is set, use that repository
    if repo_name:
        repo = await repository.get_by(
            session, organization_id=auth.organization.id, name=repo_name
        )
        if not repo:
            raise HTTPException(
                status_code=404,
                detail="Repository not found",
            )
        repositories = [repo]
    else:
        # if no repo name is set, use all repositories in the organization
        # TODO: Once we support it: Only show repositories that the user can see on GitHub
        repositories = await repository.list_by_organization(
            session,
            organization_id=auth.organization.id,
        )

    if not repositories:
        raise HTTPException(
            status_code=404,
            detail="Repository not found",
        )

    # get issues
    issues = await issue.list_by_repository_and_status(
        session,
        [r.id for r in repositories],
        text=q,
        include_open=include_open,
        include_closed=include_closed,
    )

    # add org to included
    included: List[Entry[Any]] = [
        Entry(
            id=auth.organization.id,
            type="organization",
            attributes=OrganizationRead.from_orm(auth.organization),
        ),
    ]

    # add repos to included
    for r in repositories:
        included.append(
            Entry(
                id=r.id,
                type="repository",
                attributes=RepositoryRead.from_orm(r),
            )
        )

    # get pledges
    issue_ids = [i.id for i in issues]
    pledges = await pledge.get_by_issue_ids(session, issue_ids)

    # start building issue relationships with pledges
    issue_relationships: Dict[UUID, IssueRelationship] = {}

    def get_issue_relationship(issue_id: UUID) -> IssueRelationship:
        return issue_relationships.setdefault(issue_id, IssueRelationship())

    # add pledges to included
    for pled in pledges:
        included.append(
            Entry(id=pled.id, type="pledge", attributes=PledgeRead.from_orm(pled))
        )
        # inject relationships
        rel = Relationship(data=RelationshipData(type="pledge", id=pled.id))
        pledge_relationship = get_issue_relationship(pled.issue_id)
        if not pledge_relationship.pledges:
            pledge_relationship.pledges = []
        pledge_relationship.pledges.append(rel)

    # Add repository and organization relationships to issues
    for i in issues:
        orgRel = Relationship(
            data=RelationshipData(type="organization", id=auth.organization.id)
        )
        get_issue_relationship(i.id).organization = orgRel

        if i.repository_id:
            repoRel = Relationship(
                data=RelationshipData(type="repository", id=i.repository_id)
            )
            get_issue_relationship(i.id).repository = repoRel

    issues_with_prs: Set[UUID] = set()

    # get linked pull requests
    for i in issues:
        refs = await issue.list_issue_references(session, i)
        for ref in refs:
            ref_entry: Entry[IssueReferenceRead] = Entry(
                id=ref.external_id,
                type="reference",
                attributes=IssueReferenceRead.from_model(ref),
            )
            included.append(ref_entry)

            rel = Relationship(data=RelationshipData(type="reference", id=ref_entry.id))
            reference_relationship = get_issue_relationship(ref.issue_id)
            if not reference_relationship.references:
                reference_relationship.references = []
            reference_relationship.references.append(rel)

            if (
                ref.reference_type == ReferenceType.PULL_REQUEST
                or ref.reference_type == ReferenceType.EXTERNAL_GITHUB_PULL_REQUEST
            ):
                issues_with_prs.add(i.id)

    # add issue dependencies
    for i in issues:
        deps = await issue.list_dependency_issues(session, i)
        for dep in deps:
            dep_entry: Entry[IssueRead] = Entry(
                id=dep.id,
                type="issue",
                attributes=IssueRead.from_orm(dep),
            )
            included.append(dep_entry)

            rel = Relationship(data=RelationshipData(type="issue", id=dep.id))
            dependency_relationship = get_issue_relationship(i.id)
            if not dependency_relationship.dependencies:
                dependency_relationship.dependencies = []
            dependency_relationship.dependencies.append(rel)

    def issue_progress(issue: Issue) -> IssueStatus:
        if issue.issue_closed_at:
            return IssueStatus.completed
        if issue.id in issues_with_prs:
            return IssueStatus.pull_request
        return IssueStatus.backlog

    # filter issues to only include issues with any of the expected statuses
    if status:
        issues = [i for i in issues if issue_progress(i) in status]

    # TODO: only include related objects for issues in the response

    return IssueListResponse(
        data=[
            Entry(
                id=i.id,
                type="issue",
                attributes=IssueRead.from_orm(i),
                relationships=issue_relationships.get(i.id, None),
            )
            for i in issues
        ],
        included=included,
    )
