from datetime import datetime
from typing import Self, Union
from uuid import UUID

from pydantic import BaseModel
from polar.kit.schemas import Schema
from enum import Enum


class NotificationType(str, Enum):
    issue_pledge_created = "issue_pledge_created"

    # To pledgers when the status changes for the pledged issue
    issue_pledged_branch_created = "issue_pledged_branch_created"
    issue_pledged_pull_request_created = "issue_pledged_pull_request_created"
    issue_pledged_pull_request_merged = "issue_pledged_pull_request_merged"

    # To maintainers
    maintainer_issue_branch_created = "maintainer_issue_branch_created"
    maintainer_issue_pull_request_created = "maintainer_issue_pull_request_created"
    maintainer_issue_pull_request_merged = "maintainer_issue_pull_request_merged"

    @classmethod
    def from_str(cls, s: str) -> Self:
        return cls.__members__[s]


class NotificationPayload(Schema):
    pass


class IssuePledgeCreated(BaseModel):
    pledger_name: str
    issue_url: str
    issue_title: str
    issue_number: int
    pledge_amount: str


class IssuePledgedBranchCreated(NotificationPayload):
    issue_url: str
    issue_title: str
    issue_number: int
    branch_creator_username: str
    commit_link: str


class MaintainerIssueBranchCreated(IssuePledgedBranchCreated):
    pass


class IssuePledgedPullRequestCreated(NotificationPayload):
    issue_url: str
    issue_title: str
    issue_number: int
    pull_request_url: str
    pull_request_title: str
    pull_request_creator_username: str
    pull_request_number: int
    repo_owner: str
    repo_name: str


class MaintainerIssuePullRequestCreated(IssuePledgedPullRequestCreated):
    pass


class IssuePledgedPullRequestMerged(NotificationPayload):
    issue_url: str
    issue_title: str
    issue_number: int
    pull_request_url: str
    pull_request_title: str
    pull_request_creator_username: str
    pull_request_number: int
    repo_owner: str
    repo_name: str


class MaintainerIssuePullRequestMerged(IssuePledgedPullRequestMerged):
    pass


class NotificationRead(Schema):
    id: UUID
    type: NotificationType
    created_at: datetime
    payload: Union[
        IssuePledgeCreated,
        IssuePledgedBranchCreated,
        IssuePledgedPullRequestCreated,
        IssuePledgedPullRequestMerged,
        MaintainerIssueBranchCreated,
        MaintainerIssuePullRequestCreated,
        MaintainerIssuePullRequestMerged,
    ]
