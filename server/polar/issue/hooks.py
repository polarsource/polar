from dataclasses import dataclass

from polar.kit.hook import Hook
from polar.models.issue import Issue
from polar.postgres import AsyncSession
from polar.redis import Redis


@dataclass
class IssueHook:
    session: AsyncSession
    redis: Redis
    issue: Issue


issue_upserted: Hook[IssueHook] = Hook()
