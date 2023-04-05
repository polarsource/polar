from __future__ import annotations
from datetime import datetime
from uuid import UUID
from polar.issue.schemas import IssueRead
from polar.kit.schemas import Schema
from enum import Enum
from polar.pledge.schemas import PledgeRead
from polar.pull_request.schemas import PullRequestRead


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
    def from_str(cls, s: str) -> NotificationType:
        return NotificationType.__members__[s]


class NotificationRead(Schema):
    id: UUID
    type: NotificationType
    created_at: datetime
    pledge: PledgeRead | None = None
    issue: IssueRead | None = None
    pull_request: PullRequestRead | None = None
