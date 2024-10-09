from dataclasses import dataclass

from polar.kit.hook import Hook
from polar.models.external_organization import ExternalOrganization
from polar.models.issue import Issue
from polar.models.repository import Repository


@dataclass
class SyncedHook:
    repository: Repository
    organization: ExternalOrganization
    record: Issue
    synced: int


@dataclass
class SyncCompletedHook:
    repository: Repository
    organization: ExternalOrganization
    synced: int


repository_issue_synced: Hook[SyncedHook] = Hook()
repository_issues_sync_completed: Hook[SyncCompletedHook] = Hook()
