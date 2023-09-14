from polar.issue.schemas import Issue, IssueReferenceRead
from polar.kit.schemas import Schema
from polar.pledge.schemas import PledgeRead


class IssueExtensionRead(Schema):
    number: int
    pledges: list[PledgeRead]
    references: list[IssueReferenceRead]
    issue: Issue
