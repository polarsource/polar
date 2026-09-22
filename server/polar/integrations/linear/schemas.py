from typing import Literal, NotRequired, TypedDict


class IssueCreateFromTemplateInput(TypedDict):
    teamId: str
    templateId: str
    title: NotRequired[str]
    description: NotRequired[str]
    assigneeId: NotRequired[str | None]
    stateId: NotRequired[str]
    priority: NotRequired[Literal[0, 1, 2, 3, 4]]
    labelIds: NotRequired[list[str]]
    projectId: NotRequired[str | None]
    projectMilestoneId: NotRequired[str | None]
    parentId: NotRequired[str | None]
    cycleId: NotRequired[str | None]
    dueDate: NotRequired[str | None]
    estimate: NotRequired[int | None]
    subscriberIds: NotRequired[list[str]]


class Issue(TypedDict):
    id: str
    identifier: str
    title: str
    description: str | None
    url: str


class IssueCreatePayload(TypedDict):
    success: bool
    issue: Issue | None
