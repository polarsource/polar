from datetime import datetime
from uuid import UUID
from polar.issue.schemas import IssueRead
from polar.kit.schemas import Schema
from enum import Enum

from polar.pledge.schemas import PledgeRead


class NotificationType(str, Enum):
    ISSUE_PLEDGE_CREATED = "issue_pledge_created"
    ISSUE_PLEDGED_BRANCH_CREATED = "issue_pledged_branch_created"
    ISSUE_PLEDGED_PULL_REQUEST_CREATED = "issue_pledged_pull_request_created"
    ISSUE_PLEDGED_PULL_REQUEST_MERGED = "issue_pledged_pull_request_merged"


class NotificationRead(Schema):
    id: UUID
    type: NotificationType
    created_at: datetime
    pledge: PledgeRead | None = None
    issue: IssueRead | None = None
