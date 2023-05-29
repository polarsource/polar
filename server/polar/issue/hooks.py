from dataclasses import dataclass
from polar.kit.hook import Hook
from polar.models.issue_reference import IssueReference
from polar.postgres import AsyncSession


@dataclass
class IssueReferenceHook:
    session: AsyncSession
    issue_reference: IssueReference


issue_reference_created: Hook[IssueReferenceHook] = Hook()
issue_reference_updated: Hook[IssueReferenceHook] = Hook()
