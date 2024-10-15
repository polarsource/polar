from dataclasses import dataclass

from polar.kit.hook import Hook
from polar.models.external_organization import ExternalOrganization
from polar.models.issue import Issue
from polar.models.repository import Repository
from polar.redis import Redis


@dataclass
class SyncedHook:
    repository: Repository
    organization: ExternalOrganization
    record: Issue
    synced: int
    redis: Redis


@dataclass
class SyncCompletedHook:
    repository: Repository
    organization: ExternalOrganization
    synced: int
    redis: Redis


repository_issue_synced: Hook[SyncedHook] = Hook()
repository_issues_sync_completed: Hook[SyncCompletedHook] = Hook()
