from __future__ import annotations
from uuid import UUID
from polar.kit.schemas import Schema
from enum import Enum


class Type(str, Enum):
    ISSUE_PLEDGE_CREATED = "issue_pledge_created"
    ISSUE_PLEDGED_BRANCH_CREATED = "issue_pledged_branch_created"
    ISSUE_PLEDGED_PULL_REQUEST_CREATED = "issue_pledged_pull_request_created"
    ISSUE_PLEDGED_PULL_REQUEST_MERGED = "issue_pledged_pull_request_merged"

    # PLEDGE_PAID_OUT = "pledge_paid_out"


class NotificationRead(Schema):
    id: UUID
    type: Type

    class Config:
        orm_mode = True
