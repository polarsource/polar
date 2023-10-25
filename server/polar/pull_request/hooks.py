from dataclasses import dataclass

from polar.kit.hook import Hook
from polar.models.pull_request import PullRequest
from polar.postgres import AsyncSession


@dataclass
class PullRequestHook:
    session: AsyncSession
    pull_request: PullRequest


pull_request_upserted: Hook[PullRequestHook] = Hook()
