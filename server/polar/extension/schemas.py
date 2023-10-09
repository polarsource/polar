from polar.issue.schemas import Issue, IssueReferenceRead
from polar.kit.schemas import Schema
from polar.pledge.schemas import Pledge


class IssueExtensionRead(Schema):
    number: int
    pledges: list[Pledge]
    references: list[IssueReferenceRead]
    issue: Issue
