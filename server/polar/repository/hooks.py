from dataclasses import dataclass

from polar.kit.hook import Hook
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pull_request import PullRequest
from polar.models.repository import Repository


@dataclass
class SyncedHook:
    repository: Repository
    organization: Organization
    record: Issue | PullRequest
    synced: int


@dataclass
class SyncCompletedHook:
    repository: Repository
    organization: Organization
    synced: int


repository_issue_synced: Hook[SyncedHook] = Hook()
repository_issues_sync_completed: Hook[SyncCompletedHook] = Hook()

# TODO: These are unused, can we remove them?
repository_pull_request_synced: Hook[SyncedHook] = Hook()
repository_pull_requests_sync_completed: Hook[SyncCompletedHook] = Hook()
