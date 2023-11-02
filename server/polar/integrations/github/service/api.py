from typing import Any

from githubkit import GitHub

from polar.kit.schemas import Schema


class RateLimit(Schema):
    limit: int
    remaining: int
    used: int
    reset: int


class GitHubApi:
    async def get_rate_limit(self, client: GitHub[Any]) -> RateLimit:
        r = await client.rest.rate_limit.async_get()
        return RateLimit(
            limit=r.parsed_data.resources.core.limit,
            remaining=r.parsed_data.resources.core.remaining,
            used=r.parsed_data.resources.core.used,
            reset=r.parsed_data.resources.core.reset,
        )


github_api = GitHubApi()
