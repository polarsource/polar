from dataclasses import dataclass

from polar.kit.hook import Hook
from polar.models.issue import Issue
from polar.postgres import AsyncSession


@dataclass
class IssueHook:
    session: AsyncSession
    issue: Issue


issue_upserted: Hook[IssueHook] = Hook()
