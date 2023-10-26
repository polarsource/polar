from typing import Any

import structlog
from githubkit import GitHub

from polar.enums import Platforms
from polar.integrations.github.badge import PLEDGE_BADGE_COMMENT_START
from polar.integrations.github.client import (
    get_app_installation_client,
    get_polar_client,
)
from polar.logging import Logger
from polar.models import Issue, Organization, Repository
from polar.models.organization import NotInstalledOrganization
from polar.redis import Redis
from polar.redis import redis as redis_client

log: Logger = structlog.get_logger()

_CACHE_TTL_SECONDS = 3600 * 24 * 30  # 30 days


class IssueBodyRenderer:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    async def render(
        self, issue: Issue, repository: Repository, organization: Organization
    ) -> str:
        bounded_logger = log.bind(
            issue=issue.id, repository=repository.id, organization=organization.id
        )
        bounded_logger.debug("render body")

        if issue.body is None:
            return ""

        cache_key = f"polar:issue-body-cache:{issue.id}{issue.issue_modified_at}"
        cached_body = await self.redis.get(cache_key)
        if cached_body is not None:
            bounded_logger.debug("cache hit")
            return cached_body

        body = self._preprocess(issue.body)

        if issue.platform == Platforms.github:
            bounded_logger.debug("render from GitHub API")
            body = await self._render_github(body, repository, organization)

        await self.redis.set(cache_key, body, ex=_CACHE_TTL_SECONDS)

        return body

    def _preprocess(self, body: str) -> str:
        return body.split(PLEDGE_BADGE_COMMENT_START)[0]

    async def _render_github(
        self, body: str, repository: Repository, organization: Organization
    ) -> str:
        try:
            client: GitHub[Any] = get_app_installation_client(
                organization.safe_installation_id
            )
        except NotInstalledOrganization:
            client = get_polar_client()

        response = await client.rest.markdown.async_render(
            text=body, mode="gfm", context=f"{organization.name}/{repository.name}"
        )

        return response.content.decode()


def get_issue_body_renderer() -> IssueBodyRenderer:
    return IssueBodyRenderer(redis_client)
